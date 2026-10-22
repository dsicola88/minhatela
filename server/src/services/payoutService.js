'use strict';

const { query } = require('../config/database');
const creatorRepository = require('../repositories/creatorRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');
const { MIN_PAYOUT_KZ, payoutRefusal } = require('../utils/studioRules');
const { settleLedger } = require('../utils/ledger');

async function balance(creatorId) {
  const [lines, payouts] = await Promise.all([
    query(
      `SELECT source, COALESCE(SUM(amount_kz), 0)::int AS amount_kz
       FROM creator_earnings
       WHERE creator_id = $1
       GROUP BY source`,
      [creatorId]
    ),
    query(
      `SELECT status, COALESCE(SUM(amount_kz), 0)::int AS amount_kz
       FROM creator_payouts
       WHERE creator_id = $1
       GROUP BY status`,
      [creatorId]
    ),
  ]);
  const settled = settleLedger(lines.rows, payouts.rows);
  return {
    earnedKz: settled.netKz,
    creditsKz: settled.creditsKz,
    reversalsKz: settled.reversalsKz,
    reservedOrPaidKz: settled.reservedOrPaidKz,
    availableKz: settled.availableKz,
    deficitKz: settled.deficitKz,
  };
}

async function requestPayout(userId, { amountKz, notes }) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator || creator.status !== 'active') {
    throw createError(403, 'Criador activo necessário', 'CREATOR_REQUIRED');
  }
  if (!creator.bank_iban) {
    throw createError(400, 'Configure o IBAN no perfil de criador antes do payout', 'IBAN_REQUIRED');
  }

  const amount = assertPositiveKz(amountKz);
  if (payoutRefusal(amount, Number.MAX_SAFE_INTEGER) === 'MIN_PAYOUT') {
    throw createError(400, `Payout mínimo: ${MIN_PAYOUT_KZ.toLocaleString('pt-AO')} Kz`, 'MIN_PAYOUT');
  }

  const { withTransaction } = require('../config/database');
  const result = await withTransaction(async (client) => {
    await client.query(`SELECT id FROM creators WHERE id = $1 FOR UPDATE`, [creator.id]);
    const [earned, paid] = await Promise.all([
      client.query(
        `SELECT source, COALESCE(SUM(amount_kz), 0)::int AS amount_kz
         FROM creator_earnings WHERE creator_id = $1 GROUP BY source`,
        [creator.id]
      ),
      client.query(
        `SELECT status, COALESCE(SUM(amount_kz), 0)::int AS amount_kz
         FROM creator_payouts WHERE creator_id = $1 GROUP BY status`,
        [creator.id]
      ),
    ]);
    const settled = settleLedger(earned.rows, paid.rows);
    const availableKz = settled.availableKz;
    if (payoutRefusal(amount, availableKz) === 'INSUFFICIENT_BALANCE') {
      throw createError(400, 'Saldo insuficiente para payout', 'INSUFFICIENT_BALANCE', {
        earnedKz: settled.netKz,
        reservedOrPaidKz: settled.reservedOrPaidKz,
        availableKz,
        deficitKz: settled.deficitKz,
      });
    }
    return client.query(
      `INSERT INTO creator_payouts (creator_id, amount_kz, status, method, notes)
       VALUES ($1,$2,'pending','iban',$3)
       RETURNING *`,
      [creator.id, amount, notes || null]
    );
  });

  await auditRepository.write({
    actorId: userId,
    action: 'CREATOR_PAYOUT_REQUESTED',
    entity: 'creator_payout',
    entityId: result.rows[0].id,
    metadata: { amountKz: amount },
  });

  return { payout: mapPayout(result.rows[0]), balance: await balance(creator.id) };
}

async function statusCounts(creatorId) {
  const result = await query(
    `SELECT status, COUNT(*)::int AS n, COALESCE(SUM(amount_kz), 0)::int AS total
     FROM creator_payouts
     WHERE creator_id = $1
     GROUP BY status`,
    [creatorId]
  );
  const counts = {
    pending: 0,
    paid: 0,
    rejected: 0,
    pendingKz: 0,
    paidKz: 0,
    rejectedKz: 0,
  };
  for (const row of result.rows) {
    if (!Object.prototype.hasOwnProperty.call(counts, row.status)) continue;
    counts[row.status] = row.n;
    counts[`${row.status}Kz`] = row.total;
  }
  return counts;
}

async function listMine(userId) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator) return { payouts: [], balance: null };
  const result = await query(
    `SELECT * FROM creator_payouts WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [creator.id]
  );
  return {
    payouts: result.rows.map(mapPayout),
    balance: await balance(creator.id),
  };
}

async function listPendingAdmin() {
  const result = await query(
    `SELECT p.*, c.display_name, c.bank_iban, c.bank_account_name, u.email
     FROM creator_payouts p
     JOIN creators c ON c.id = p.creator_id
     JOIN users u ON u.id = c.user_id
     WHERE p.status = 'pending'
       AND ${require('../utils/tenantScope').opsVideoSql('c')}
     ORDER BY p.created_at ASC`
  );
  return {
    payouts: result.rows.map((row) => ({
      ...mapPayout(row),
      displayName: row.display_name,
      bankIban: row.bank_iban,
      bankAccountName: row.bank_account_name,
      email: row.email,
    })),
  };
}

async function review(adminId, payoutId, { status, notes }) {
  const raw = String(status || '').toLowerCase();
  const normalized =
    ['paid', 'pago'].includes(raw) ? 'paid' : ['rejected', 'rejeitado', 'recusado'].includes(raw) ? 'rejected' : null;
  if (!normalized) {
    throw createError(400, 'Estado inválido. Use paid/pago ou rejected/rejeitado', 'VALIDATION');
  }
  if (normalized === 'rejected' && !String(notes || '').trim()) {
    throw createError(400, 'Indique o motivo da recusa do levantamento', 'VALIDATION');
  }

  const result = await query(
    `UPDATE creator_payouts
     SET status = $2,
         notes = COALESCE($3, notes),
         reviewer_id = $4,
         reviewed_at = NOW(),
         paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [payoutId, normalized, notes || null, adminId]
  );

  if (!result.rowCount) {
    throw createError(404, 'Payout não encontrado', 'NOT_FOUND');
  }

  await auditRepository.write({
    actorId: adminId,
    action: normalized === 'paid' ? 'CREATOR_PAYOUT_PAID' : 'CREATOR_PAYOUT_REJECTED',
    entity: 'creator_payout',
    entityId: payoutId,
    metadata: { status: normalized, notes: notes || null },
  });

  return { payout: mapPayout(result.rows[0]) };
}

function mapPayout(row) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    amountKz: row.amount_kz,
    status: row.status,
    method: row.method,
    notes: row.notes,
    paidAt: row.paid_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

module.exports = {
  balance,
  statusCounts,
  requestPayout,
  listMine,
  listPendingAdmin,
  review,
};
