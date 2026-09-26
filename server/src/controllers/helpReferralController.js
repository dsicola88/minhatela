'use strict';

const helpService = require('../services/helpService');
const referralService = require('../services/referralService');

async function avatars(req, res) {
  const result = await helpService.listAvatars(req.query);
  res.json(result);
}

async function listHelp(req, res) {
  const result = await helpService.listHelp(req.query);
  res.json(result);
}

async function getArticle(req, res) {
  const result = await helpService.getHelpArticle(req.params.slug, req.query.locale);
  res.json(result);
}

async function createTicket(req, res) {
  const result = await helpService.createTicket(req.user.id, req.body, {
    ip: req.ip,
  });
  res.status(201).json(result);
}

async function myTickets(req, res) {
  const result = await helpService.myTickets(req.user.id);
  res.json(result);
}

async function myReferral(req, res) {
  const result = await referralService.getMyReferral(req.user.id);
  res.json(result);
}

async function redeemReferral(req, res) {
  const result = await referralService.redeemReferral(req.user.id, req.body?.code, {
    ip: req.ip,
  });
  res.json(result);
}

module.exports = {
  avatars,
  listHelp,
  getArticle,
  createTicket,
  myTickets,
  myReferral,
  redeemReferral,
};
