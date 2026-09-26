'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/phase23Controller');

const router = express.Router();

router.post(
  '/network/diagnostics',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30, keyFn: (req) => `net:${req.user.id}` }),
  asyncHandler(ctrl.diagnostics)
);

router.get(
  '/catalog/content/:contentId/share/whatsapp',
  requireAuth,
  asyncHandler(ctrl.whatsapp)
);

module.exports = router;
