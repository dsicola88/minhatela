'use strict';

const phase26Service = require('../services/phase26Service');

async function packs(_req, res) {
  res.json(await phase26Service.listPacks());
}

async function packById(req, res) {
  res.json(await phase26Service.getPack(req.params.id));
}

async function selectProfile(req, res) {
  const deviceId = req.headers['x-device-id'] || req.body?.deviceId || null;
  res.json(await phase26Service.selectProfile(req.user.id, req.params.profileId, deviceId));
}

async function pendingSurvey(req, res) {
  res.json(await phase26Service.pendingSurvey(req.user.id));
}

async function respondSurvey(req, res) {
  res.status(201).json(await phase26Service.respondSurvey(req.user.id, req.body));
}

async function joinPremiere(req, res) {
  res.json(
    await phase26Service.joinPremiere(req.user.id, req.params.eventId, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })
  );
}

async function probeCdn(_req, res) {
  res.json(await phase26Service.probeCdn());
}

async function cdnHealth(req, res) {
  res.json(await phase26Service.cdnHealthHistory(Number(req.query.limit) || 20));
}

async function adminSurveys(_req, res) {
  res.json(await phase26Service.adminSurveySummary());
}

async function adminPacks(_req, res) {
  res.json(await phase26Service.adminPacks());
}

module.exports = {
  packs,
  packById,
  selectProfile,
  pendingSurvey,
  respondSurvey,
  joinPremiere,
  probeCdn,
  cdnHealth,
  adminSurveys,
  adminPacks,
};
