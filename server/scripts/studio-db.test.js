'use strict';

/**
 * Prova controlada no Postgres local. Cria linhas com email ledger-test-* e apaga-as no fim.
 * Não correr contra uma base remota.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool } = require('../src/config/database');
const earnings = require('../src/services/creatorEarningsService');
const payouts = require('../src/services/payoutService');
const reports = require('../src/services/reportService');

const stamp = Date.now();
const emails = [`ledger-a-${stamp}@minhatela.test`, `ledger-b-${stamp}@minhatela.test`, `ledger-viewer-${stamp}@minhatela.test`];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!/^(localhost|127\.0\.0\.1)$/.test(host)) {
    throw new Error('recusa base remota');
  }

  const ids = { users: [], creators: [], videos: [] };
  await pool.query(
    `DELETE FROM creators WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'ledger-%@minhatela.test')`
  );
  await pool.query(`DELETE FROM users WHERE email LIKE 'ledger-%@minhatela.test'`);
  try {
    const viewer = await pool.query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', 'Viewer') RETURNING id`,
      [emails[2]]
    );
    ids.users.push(viewer.rows[0].id);

    for (const [index, email] of emails.slice(0, 2).entries()) {
      const user = await pool.query(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', $2) RETURNING id`,
        [email, index === 0 ? 'Estúdio A' : 'Estúdio B']
      );
      ids.users.push(user.rows[0].id);
      const creator = await pool.query(
        `INSERT INTO creators (user_id, type, display_name, status, bank_iban)
         VALUES ($1, 'filmmaker', $2, 'active', 'AO06000000000000000000000')
         RETURNING id`,
        [user.rows[0].id, index === 0 ? 'Estúdio A' : 'Estúdio B']
      );
      ids.creators.push(creator.rows[0].id);
      const video = await pool.query(
        `INSERT INTO videos (
           title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
           workflow_status, is_published, creator_id, monetization, kind, bunny_video_id
         ) VALUES ($1, $2, 's', 's', 'https://example.com/p.jpg', 'https://example.com/b.jpg',
           'published', TRUE, $3, 'avod', 'movie', $4)
         RETURNING id`,
        [`Filme ${index}`, `ledger-${stamp}-${index}`, creator.rows[0].id, index === 0 ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222']
      );
      ids.videos.push(video.rows[0].id);
      await pool.query(
        `INSERT INTO content_rights (content_id, owner_name, territory, license_type, status)
         VALUES ($1, $2, 'AO', 'ugc_distribution', 'active')`,
        [video.rows[0].id, index === 0 ? 'Estúdio A' : 'Estúdio B']
      );
    }

    const [creatorA, creatorB] = ids.creators;
    const [videoA, videoB] = ids.videos;
    const viewerId = ids.users[0];

    const first = await earnings.creditQualifiedView({
      creatorId: creatorA,
      contentId: videoA,
      userId: viewerId,
    });
    const second = await earnings.creditQualifiedView({
      creatorId: creatorA,
      contentId: videoA,
      userId: viewerId,
    });
    assert(first.credited === true, 'primeiro crédito');
    assert(second.credited === false, 'crédito repetido no mesmo dia');

    const crossed = await earnings.creditQualifiedView({
      creatorId: creatorB,
      contentId: videoA,
      userId: viewerId,
    });
    assert(crossed.credited === false, 'não credita o filme no estúdio errado');

    const parallelViewer = `${viewerId}-parallel`;
    const pair = await Promise.all([
      earnings.creditQualifiedView({ creatorId: creatorA, contentId: videoA, userId: parallelViewer }),
      earnings.creditQualifiedView({ creatorId: creatorA, contentId: videoA, userId: parallelViewer }),
    ]);
    assert(pair.filter((item) => item.credited).length === 1, 'um só crédito em paralelo');

    const linesA = await earnings.listForCreator(creatorA);
    const linesB = await earnings.listForCreator(creatorB);
    assert(linesA.length >= 1 && linesA.every((line) => line.contentId === videoA), 'livro A só vê o filme A');
    assert(linesB.length === 0, 'livro B não vê créditos de A');
    assert(!JSON.stringify(linesA).includes(viewerId), 'o livro do cineasta não leva o id do espectador');

    let rejected = false;
    try {
      await earnings.postStaffEntry({
        creatorId: creatorA,
        contentId: videoB,
        source: 'reversal',
        amountKz: 2,
        traceKey: `reversal-cross-${stamp}`,
        reason: 'teste',
      });
    } catch (err) {
      rejected = err.code === 'LEDGER_REJECTED';
    }
    assert(rejected, 'reversão recusada noutro estúdio');

    await pool.query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata, trace_key)
       VALUES ($1, $2, 'adjustment', 6000, '{"reason":"teste"}', $3)`,
      [creatorA, videoA, `adjust-${stamp}`]
    );
    const results = await Promise.allSettled([
      payouts.requestPayout(ids.users[1], { amountKz: 5000 }),
      payouts.requestPayout(ids.users[1], { amountKz: 5000 }),
    ]);
    const ok = results.filter((item) => item.status === 'fulfilled');
    const denied = results.filter((item) => item.status === 'rejected');
    assert(ok.length === 1, `um levantamento aceite, veio ${ok.length}`);
    assert(denied.length === 1, 'o segundo levantamento falha');
    assert(denied[0].reason.code === 'INSUFFICIENT_BALANCE', denied[0].reason.code || denied[0].reason.message);

    const report = await pool.query(
      `INSERT INTO content_reports (reporter_user_id, content_id, reason, details)
       VALUES ($1, $2, 'copyright', 'teste controlado') RETURNING id`,
      [viewerId, videoA]
    );
    const removed = await reports.reviewReport(ids.users[1], report.rows[0].id, {
      status: 'resolved',
      remove: true,
      notes: 'reclamação de teste',
    });
    assert(removed.removed === true, 'remoção registada');
    const after = await pool.query(
      `SELECT v.is_published, v.workflow_status, r.status AS rights
       FROM videos v
       JOIN content_rights r ON r.content_id = v.id
       WHERE v.id = $1`,
      [videoA]
    );
    assert(after.rows[0].is_published === false, 'sai do catálogo');
    assert(after.rows[0].workflow_status === 'archived', 'fica arquivado');
    assert(after.rows[0].rights === 'revoked', 'direitos revogados');

    console.log('studio-db: ok');
  } finally {
    await pool.query(`DELETE FROM creator_payouts WHERE creator_id = ANY($1::uuid[])`, [ids.creators]);
    await pool.query(`DELETE FROM creator_earnings WHERE creator_id = ANY($1::uuid[])`, [ids.creators]);
    await pool.query(`DELETE FROM content_reports WHERE content_id = ANY($1::uuid[])`, [ids.videos]);
    await pool.query(`DELETE FROM content_rights WHERE content_id = ANY($1::uuid[])`, [ids.videos]);
    await pool.query(`DELETE FROM videos WHERE id = ANY($1::uuid[])`, [ids.videos]);
    await pool.query(`DELETE FROM creators WHERE id = ANY($1::uuid[])`, [ids.creators]);
    await pool.query(
      `DELETE FROM creators WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'ledger-%@minhatela.test')`
    );
    await pool.query(`DELETE FROM users WHERE email LIKE 'ledger-%@minhatela.test'`);
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error('studio-db: fail', err.message, err.code || '');
  try { await pool.end(); } catch { /* already closed */ }
  process.exit(1);
});
