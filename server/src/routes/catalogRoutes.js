'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const catalogController = require('../controllers/catalogController');
const reportController = require('../controllers/reportController');
const watchTogetherController = require('../controllers/watchTogetherController');

const router = express.Router();

router.get('/home', requireAuth, asyncHandler(catalogController.home));
router.get('/share/:id', asyncHandler(catalogController.share));
router.get(
  '/preview/:id',
  rateLimit({ windowMs: 60_000, max: 90 }),
  requireAuth,
  asyncHandler(catalogController.preview)
);
router.get('/videos/:id', requireAuth, asyncHandler(catalogController.details));
router.get('/content/:id', requireAuth, asyncHandler(catalogController.details));
router.get(
  '/content/:contentId/cast',
  requireAuth,
  asyncHandler(watchTogetherController.cast)
);
router.get(
  '/content/:contentId/chapters',
  requireAuth,
  asyncHandler(watchTogetherController.chapters)
);
router.get(
  '/content/:contentId/more-like-this',
  requireAuth,
  asyncHandler(require('../controllers/giftHouseholdController').moreLikeThis)
);
router.get(
  '/content/:id/scrub',
  requireAuth,
  asyncHandler(require('../controllers/phase25Controller').scrub)
);
router.get(
  '/videos/:id/scrub',
  requireAuth,
  asyncHandler(require('../controllers/phase25Controller').scrub)
);

router.get('/people/:slug', requireAuth, asyncHandler(watchTogetherController.person));

router.post(
  '/content/:contentId/report',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `report:${req.user.id}` }),
  asyncHandler(reportController.report)
);
router.post(
  '/videos/:contentId/report',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `report:${req.user.id}` }),
  asyncHandler(reportController.report)
);

module.exports = router;
