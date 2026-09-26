'use strict';

const { query } = require('../config/database');
const creatorRepository = require('../repositories/creatorRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');

async function balance(creatorId) {
  const [earned, paid] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount_kz),0)::int AS total FROM creator_earnings WHERE creator_id = $1`,
      [creatorId]
    ),
    query(
      `SELECT COALESCE(SUM(amount_kz),0)::int AS total
       FROM creator_payouts
       WHERE creator_id = $1 AND status IN ('pending','paid')`,
      [creatorId]
    ),
  ]);
  return {
    earnedKz: earned.rows[0].total,
    reservedOrPaidKz: paid.rows[0].total,
    availableKz: Math.max(0, earned.rows[0].total - paid.rows[0].total),
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
  const bal = await balance(creator.id);
  if (amount > bal.availableKz) {
    throw createError(400, 'Saldo insuficiente para payout', 'INSUFFICIENT_BALANCE', bal);
  }
  if (amount < 5000) {
    throw createError(400, 'Payout mínimo: 5.000 Kz', 'MIN_PAYOUT');
  }

  const result = await query(
    `INSERT INTO creator_payouts (creator_id, amount_kz, status, method, notes)
     VALUES ($1,$2,'pending','iban',$3)
     RETURNING *`,
    [creator.id, amount, notes || null]
  );

  await auditRepository.write({
    actorId: userId,
    action: 'CREATOR_PAYOUT_REQUESTED',
    entity: 'creator_payout',
    entityId: result.rows[0].id,
    metadata: { amountKz: amount },
  });

  return { payout: mapPayout(result.rows[0]), balance: await balance(creator.id) };
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
  if (!['paid', 'rejected'].includes(status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
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
    [payoutId, status, notes || null, adminId]
  );

  if (!result.rowCount) {
    throw createError(404, 'Payout não encontrado', 'NOT_FOUND');
  }

  await auditRepository.write({
    actorId: adminId,
    action: status === 'paid' ? 'CREATOR_PAYOUT_PAID' : 'CREATOR_PAYOUT_REJECTED',
    entity: 'creator_payout',
    entityId: payoutId,
    metadata: { status, notes: notes || null },
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
  requestPayout,
  listMine,
  listPendingAdmin,
  review,
};
