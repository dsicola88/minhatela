'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const adController = require('../controllers/adController');

const router = express.Router();

router.post('/decision', requireAuth, asyncHandler(adController.decision));

router.post('/advertisers/register', requireAuth, asyncHandler(adController.register));

router.get('/portal', requireAuth, asyncHandler(adController.portal));

router.get('/campaigns', requireAuth, asyncHandler(adController.listCampaigns));
router.get('/campaigns/:id', requireAuth, asyncHandler(adController.getCampaign));
router.post('/campaigns', requireAuth, asyncHandler(adController.createCampaign));
router.post('/campaigns/:id/pause', requireAuth, asyncHandler(adController.pauseCampaign));

router.get('/reports', requireAuth, asyncHandler(adController.reports));

router.post(
  '/creatives/upload',
  requireAuth,
  adController.receiveCreative,
  asyncHandler(adController.uploadCreative)
);

router.post(
  '/impressions/:impressionId/start',
  requireAuth,
  asyncHandler(adController.start)
);
router.post(
  '/impressions/:impressionId/complete',
  requireAuth,
  asyncHandler(adController.complete)
);
router.post(
  '/impressions/:impressionId/click',
  requireAuth,
  asyncHandler(adController.click)
);

module.exports = router;
