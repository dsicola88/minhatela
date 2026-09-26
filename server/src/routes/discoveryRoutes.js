'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const discoveryController = require('../controllers/discoveryController');

const router = express.Router();

router.get('/recommendations', requireAuth, asyncHandler(discoveryController.recommendations));
router.get('/favorites', requireAuth, asyncHandler(discoveryController.favorites));
router.post('/favorites/:id', requireAuth, asyncHandler(discoveryController.addFavorite));
router.delete('/favorites/:id', requireAuth, asyncHandler(discoveryController.removeFavorite));
router.get('/facets', requireAuth, asyncHandler(discoveryController.facets));
router.get('/reminders', requireAuth, asyncHandler(discoveryController.reminders));
router.post('/:id/rate', requireAuth, asyncHandler(discoveryController.rate));
router.post('/:id/remind', requireAuth, asyncHandler(discoveryController.remind));
router.get('/:id/related', requireAuth, asyncHandler(discoveryController.related));

module.exports = router;
