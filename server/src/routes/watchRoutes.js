'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, optionalProfile } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const watchController = require('../controllers/watchController');

const router = express.Router();

router.post(
  '/:contentId/start',
  requireAuth,
  optionalProfile,
  rateLimit({
    windowMs: 60_000,
    max: 30,
    keyFn: (req) => `${req.user?.id || req.ip}:watch`,
  }),
  asyncHandler(watchController.start)
);

router.put(
  '/:contentId/progress',
  requireAuth,
  optionalProfile,
  rateLimit({
    windowMs: 60_000,
    max: 60,
    keyFn: (req) => `${req.user?.id || req.ip}:progress`,
  }),
  asyncHandler(watchController.progress)
);

router.get(
  '/:contentId/progress',
  requireAuth,
  optionalProfile,
  asyncHandler(watchController.getProgress)
);

router.post(
  '/sessions/:sessionId/heartbeat',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 120 }),
  asyncHandler(watchController.heartbeat)
);

router.post(
  '/sessions/:sessionId/end',
  requireAuth,
  asyncHandler(watchController.end)
);

router.post(
  '/qoe',
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 120,
    keyFn: (req) => `${req.user?.id}:qoe`,
  }),
  asyncHandler(watchController.qoe)
);

module.exports = router;
