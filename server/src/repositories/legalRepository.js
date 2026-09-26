'use strict';

const { query } = require('../config/database');

async function getCurrent(docType, locale = 'pt-AO') {
  const result = await query(
    `SELECT id, doc_type, version, locale, title, body_md, effective_at, is_current
     FROM legal_documents
     WHERE doc_type = $1
       AND locale = $2
       AND is_current = TRUE
     ORDER BY effective_at DESC
     LIMIT 1`,
    [docType, locale]
  );
  return result.rows[0] || null;
}

async function listCurrent(locale = 'pt-AO') {
  const result = await query(
    `SELECT DISTINCT ON (doc_type)
            id, doc_type, version, locale, title, effective_at
     FROM legal_documents
     WHERE locale = $1 AND is_current = TRUE
     ORDER BY doc_type, effective_at DESC`,
    [locale]
  );
  return result.rows;
}

async function recordConsent({
  userId,
  docType,
  docVersion,
  locale = 'pt-AO',
  ip,
  userAgent,
}) {
  await query(
    `INSERT INTO user_consents (user_id, doc_type, doc_version, locale, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, doc_type, doc_version) DO UPDATE
       SET accepted_at = NOW(), ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent`,
    [userId, docType, docVersion, locale, ip || null, userAgent || null]
  );
}

async function listConsents(userId) {
  const result = await query(
    `SELECT doc_type, doc_version, locale, accepted_at
     FROM user_consents
     WHERE user_id = $1
     ORDER BY accepted_at DESC`,
    [userId]
  );
  return result.rows;
}

async function hasAcceptedCurrent(userId, docType, locale = 'pt-AO') {
  const current = await getCurrent(docType, locale);
  if (!current) return true;
  const result = await query(
    `SELECT 1 FROM user_consents
     WHERE user_id = $1 AND doc_type = $2 AND doc_version = $3
     LIMIT 1`,
    [userId, docType, current.version]
  );
  return result.rows.length > 0;
}

module.exports = {
  getCurrent,
  listCurrent,
  recordConsent,
  listConsents,
  hasAcceptedCurrent,
};
