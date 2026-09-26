'use strict';

const adminOpsService = require('../services/adminOpsService');
const paymentController = require('./paymentController');

async function commandCenter(_req, res) {
  const result = await adminOpsService.getCommandCenter();
  res.json(result);
}

async function audit(req, res) {
  const result = await adminOpsService.listAudit({
    limit: req.query.limit,
    action: req.query.action,
    entity: req.query.entity,
  });
  res.json(result);
}

async function campaigns(_req, res) {
  const result = await adminOpsService.listPendingCampaigns();
  res.json(result);
}

async function liveStreams(_req, res) {
  const result = await adminOpsService.getLiveStreams();
  res.json(result);
}

module.exports = {
  commandCenter,
  audit,
  campaigns,
  liveStreams,
  // re-export convenience
  pendingPayments: paymentController.pending,
};
