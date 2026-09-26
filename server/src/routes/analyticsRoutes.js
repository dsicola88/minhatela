'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.post(
  '/events',
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 120,
    keyFn: (req) => `${req.user?.id || req.ip}:analytics`,
  }),
  asyncHandler(analyticsController.ingest)
);

module.exports = router;
