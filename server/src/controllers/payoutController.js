'use strict';

const payoutService = require('../services/payoutService');

async function mine(req, res) {
  const result = await payoutService.listMine(req.user.id);
  res.json(result);
}

async function request(req, res) {
  const result = await payoutService.requestPayout(req.user.id, req.body);
  res.status(201).json(result);
}

async function pending(req, res) {
  const result = await payoutService.listPendingAdmin();
  res.json(result);
}

async function review(req, res) {
  const result = await payoutService.review(req.user.id, req.params.id, req.body);
  res.json(result);
}

module.exports = { mine, request, pending, review };
