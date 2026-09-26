'use strict';

const adPlatformService = require('../services/adPlatformService');

async function register(req, res) {
  const result = await adPlatformService.registerAdvertiser(req.user.id, req.body);
  res.status(result.alreadyExists ? 200 : 201).json(result);
}

async function portal(req, res) {
  const result = await adPlatformService.getPortal(req.user.id);
  res.json(result);
}

async function createCampaign(req, res) {
  const result = await adPlatformService.createCampaign(req.user.id, req.body);
  res.status(201).json(result);
}

async function decision(req, res) {
  const result = await adPlatformService.decideAd({
    contentId: req.body.contentId,
    monetization: req.body.monetization || 'avod',
    userId: req.user.id,
    placement: req.body.placement || 'pre_roll',
  });
  res.json({ decision: result });
}

module.exports = {
  register,
  portal,
  createCampaign,
  decision,
};
