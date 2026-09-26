'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/giftHouseholdController');

const giftsRouter = express.Router();
const householdRouter = express.Router();
const premieresRouter = express.Router();

giftsRouter.get('/', requireAuth, asyncHandler(ctrl.myGifts));
giftsRouter.post(
  '/',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 5, keyFn: (req) => `gift:${req.user.id}` }),
  asyncHandler(ctrl.purchaseGift)
);
giftsRouter.post(
  '/redeem',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `gift-redeem:${req.user.id}` }),
  asyncHandler(ctrl.redeemGift)
);

householdRouter.get('/', requireAuth, asyncHandler(ctrl.householdMine));
householdRouter.post('/', requireAuth, asyncHandler(ctrl.householdCreate));
householdRouter.post(
  '/invite',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 8, keyFn: (req) => `hh-inv:${req.user.id}` }),
  asyncHandler(ctrl.householdInvite)
);
householdRouter.post(
  '/accept',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `hh-acc:${req.user.id}` }),
  asyncHandler(ctrl.householdAccept)
);
householdRouter.delete('/members/:userId', requireAuth, asyncHandler(ctrl.householdRemove));
householdRouter.post('/leave', requireAuth, asyncHandler(ctrl.householdLeave));

premieresRouter.get('/', requireAuth, asyncHandler(ctrl.premieres));
premieresRouter.get('/:slug', requireAuth, asyncHandler(ctrl.premiereBySlug));
premieresRouter.post('/:eventId/remind', requireAuth, asyncHandler(ctrl.premiereRemind));
premieresRouter.delete('/:eventId/remind', requireAuth, asyncHandler(ctrl.premiereUnremind));
premieresRouter.post(
  '/:eventId/join',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30 }),
  asyncHandler(require('../controllers/phase26Controller').joinPremiere)
);

module.exports = { giftsRouter, householdRouter, premieresRouter, moreLikeThis: ctrl.moreLikeThis };
