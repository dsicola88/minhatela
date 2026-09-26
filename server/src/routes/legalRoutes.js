'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const legalController = require('../controllers/legalController');

const router = express.Router();

router.get('/', asyncHandler(legalController.list));

router.get('/me/status', requireAuth, asyncHandler(legalController.status));
router.post(
  '/me/accept',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(legalController.accept)
);

router.get(
  '/:docType',
  rateLimit({ windowMs: 60_000, max: 60 }),
  asyncHandler(legalController.getDoc)
);

module.exports = router;
