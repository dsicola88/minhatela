'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const pushService = require('../services/pushService');
const plansService = require('../services/plansService');

const pushRouter = express.Router();
pushRouter.use(requireAuth);

pushRouter.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 30 }),
  asyncHandler(async (req, res) => {
    const result = await pushService.registerToken(req.user.id, {
      token: req.body.token,
      platform: req.headers['x-device-platform'] || req.body.platform,
      deviceKey: req.headers['x-device-key'] || req.body.deviceKey,
    });
    res.status(201).json(result);
  })
);

pushRouter.delete(
  '/register',
  asyncHandler(async (req, res) => {
    const result = await pushService.unregisterToken(req.user.id, req.body.token);
    res.json(result);
  })
);

const plansRouter = express.Router();
plansRouter.get('/', (_req, res) => {
  res.json(plansService.listPlans());
});

module.exports = { pushRouter, plansRouter };
