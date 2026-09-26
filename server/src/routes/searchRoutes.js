'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const discoveryController = require('../controllers/discoveryController');

const router = express.Router();

router.get(
  '/',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 60, keyFn: (req) => `${req.user?.id}:search` }),
  asyncHandler(discoveryController.search)
);
router.get(
  '/suggest',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 90, keyFn: (req) => `${req.user?.id}:suggest` }),
  asyncHandler(discoveryController.suggest)
);
router.get('/facets', requireAuth, asyncHandler(discoveryController.facets));
router.get(
  '/trending',
  requireAuth,
  asyncHandler(require('../controllers/phase24Controller').trending)
);

module.exports = router;
