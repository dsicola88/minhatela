'use strict';

const legalRepository = require('../repositories/legalRepository');
const { createError } = require('../utils/errors');

function mapDoc(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.doc_type,
    version: row.version,
    locale: row.locale,
    title: row.title,
    bodyMd: row.body_md,
    effectiveAt: row.effective_at,
  };
}

async function getDocument(docType, locale = 'pt-AO') {
  const allowed = new Set(['terms', 'privacy']);
  if (!allowed.has(docType)) {
    throw createError(404, 'Documento não encontrado', 'LEGAL_NOT_FOUND');
  }
  const row = await legalRepository.getCurrent(docType, locale);
  if (!row) {
    throw createError(404, 'Documento não disponível', 'LEGAL_NOT_FOUND');
  }
  return mapDoc(row);
}

async function listDocuments(locale = 'pt-AO') {
  const rows = await legalRepository.listCurrent(locale);
  return {
    locale,
    documents: rows.map((r) => ({
      type: r.doc_type,
      version: r.version,
      title: r.title,
      effectiveAt: r.effective_at,
      path: `/api/legal/${r.doc_type}`,
    })),
  };
}

async function acceptCurrent(userId, docTypes, meta = {}) {
  const types = Array.isArray(docTypes) && docTypes.length
    ? docTypes
    : ['terms', 'privacy'];
  const accepted = [];
  for (const type of types) {
    const doc = await legalRepository.getCurrent(type, meta.locale || 'pt-AO');
    if (!doc) continue;
    await legalRepository.recordConsent({
      userId,
      docType: type,
      docVersion: doc.version,
      locale: doc.locale,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    accepted.push({ type, version: doc.version });
  }
  return { accepted };
}

async function getConsentStatus(userId, locale = 'pt-AO') {
  const consents = await legalRepository.listConsents(userId);
  const termsOk = await legalRepository.hasAcceptedCurrent(userId, 'terms', locale);
  const privacyOk = await legalRepository.hasAcceptedCurrent(userId, 'privacy', locale);
  return {
    termsAccepted: termsOk,
    privacyAccepted: privacyOk,
    upToDate: termsOk && privacyOk,
    history: consents.map((c) => ({
      type: c.doc_type,
      version: c.doc_version,
      locale: c.locale,
      acceptedAt: c.accepted_at,
    })),
  };
}

module.exports = {
  getDocument,
  listDocuments,
  acceptCurrent,
  getConsentStatus,
  mapDoc,
};
