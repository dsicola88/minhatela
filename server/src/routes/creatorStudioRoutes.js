'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const creatorStudioController = require('../controllers/creatorStudioController');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(creatorStudioController.register)
);

router.get('/home', asyncHandler(creatorStudioController.home));

router.post(
  '/contents',
  asyncHandler(creatorStudioController.createContent)
);

router.patch(
  '/contents/:id',
  asyncHandler(creatorStudioController.updateContent)
);

router.post(
  '/contents/:id/submit',
  asyncHandler(creatorStudioController.submit)
);

router.post(
  '/bunny/videos',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(creatorStudioController.createBunnySlot)
);

const payoutController = require('../controllers/payoutController');

router.get('/payouts', asyncHandler(payoutController.mine));
router.post('/payouts', asyncHandler(payoutController.request));

module.exports = router;
