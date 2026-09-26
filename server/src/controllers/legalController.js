'use strict';

const legalService = require('../services/legalService');

async function list(req, res) {
  const locale = req.query.locale || 'pt-AO';
  const result = await legalService.listDocuments(locale);
  res.json(result);
}

async function getDoc(req, res) {
  const locale = req.query.locale || 'pt-AO';
  const doc = await legalService.getDocument(req.params.docType, locale);
  const wantsHtml =
    String(req.query.format || '').toLowerCase() === 'html' ||
    (req.headers.accept || '').includes('text/html');
  if (wantsHtml) {
    const { renderLegalHtml } = require('../utils/legalHtml');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLegalHtml(doc));
  }
  res.json(doc);
}

async function accept(req, res) {
  const result = await legalService.acceptCurrent(req.user.id, req.body?.types, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    locale: req.body?.locale || 'pt-AO',
  });
  res.json(result);
}

async function status(req, res) {
  const result = await legalService.getConsentStatus(
    req.user.id,
    req.query.locale || 'pt-AO'
  );
  res.json(result);
}

module.exports = { list, getDoc, accept, status };
