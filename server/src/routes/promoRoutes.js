'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const promoService = require('../services/promoService');

const router = express.Router();

router.post(
  '/redeem',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `promo:${req.user?.id || req.ip}` }),
  asyncHandler(async (req, res) => {
    const result = await promoService.redeem({
      userId: req.user.id,
      code: req.body.code,
      profileId: req.headers['x-profile-id'] || req.body.profileId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.json(result);
  })
);

module.exports = router;
