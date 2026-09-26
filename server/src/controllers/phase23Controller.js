'use strict';

const phase23Service = require('../services/phase23Service');

async function diagnostics(req, res) {
  const result = await phase23Service.runDiagnostics(req.user.id, req.body, {
    profileId: req.headers['x-profile-id'],
    platform: req.body?.platform,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  res.json(result);
}

async function whatsapp(req, res) {
  const result = await phase23Service.whatsappShare(req.user.id, req.params.contentId);
  res.json(result);
}

async function follow(req, res) {
  const result = await phase23Service.follow(
    req.user.id,
    req.headers['x-profile-id'] || req.body.profileId,
    req.params.seriesId,
    req.body,
    { ip: req.ip }
  );
  res.status(201).json(result);
}

async function unfollow(req, res) {
  const result = await phase23Service.unfollow(
    req.user.id,
    req.headers['x-profile-id'] || req.body.profileId,
    req.params.seriesId
  );
  res.json(result);
}

async function followState(req, res) {
  const result = await phase23Service.followState(
    req.user.id,
    req.headers['x-profile-id'] || req.query.profileId,
    req.params.seriesId
  );
  res.json(result);
}

async function myFollows(req, res) {
  const result = await phase23Service.myFollows(
    req.user.id,
    req.headers['x-profile-id'] || req.query.profileId
  );
  res.json(result);
}

async function languagesHub(req, res) {
  const result = await phase23Service.languagesHub();
  res.json(result);
}

async function byLanguage(req, res) {
  const result = await phase23Service.byLanguage(req.params.lang);
  res.json(result);
}

async function byCategory(req, res) {
  const result = await phase23Service.byCategory(req.params.slug);
  res.json(result);
}

async function invoices(req, res) {
  const result = await phase23Service.listInvoices(req.user.id);
  res.json(result);
}

async function invoice(req, res) {
  const wantsHtml = String(req.query.format || '').toLowerCase() === 'html';
  const result = await phase23Service.getInvoice(req.user.id, req.params.invoiceId, {
    html: wantsHtml,
  });
  if (wantsHtml && result.html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(result.html);
  }
  res.json(result);
}

module.exports = {
  diagnostics,
  whatsapp,
  follow,
  unfollow,
  followState,
  myFollows,
  languagesHub,
  byLanguage,
  byCategory,
  invoices,
  invoice,
};
