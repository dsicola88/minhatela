'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/helpReferralController');

const router = express.Router();

// Públicos autenticados (catálogo de avatares / help)
router.get('/avatars', requireAuth, asyncHandler(ctrl.avatars));
router.get('/help', requireAuth, asyncHandler(ctrl.listHelp));
router.get('/help/:slug', requireAuth, asyncHandler(ctrl.getArticle));

router.get('/tickets', requireAuth, asyncHandler(ctrl.myTickets));
router.post(
  '/tickets',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 5, keyFn: (req) => `ticket:${req.user.id}` }),
  asyncHandler(ctrl.createTicket)
);

router.get('/referral', requireAuth, asyncHandler(ctrl.myReferral));
router.post(
  '/referral/redeem',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 8, keyFn: (req) => `ref:${req.user.id}` }),
  asyncHandler(ctrl.redeemReferral)
);

module.exports = router;
