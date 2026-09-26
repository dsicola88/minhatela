'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const adController = require('../controllers/adController');

const router = express.Router();

router.post('/decision', requireAuth, asyncHandler(adController.decision));

router.post('/advertisers/register', requireAuth, asyncHandler(adController.register));

router.get('/portal', requireAuth, asyncHandler(adController.portal));

router.post('/campaigns', requireAuth, asyncHandler(adController.createCampaign));

module.exports = router;
