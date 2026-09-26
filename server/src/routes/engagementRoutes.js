'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const engagementController = require('../controllers/engagementController');

const router = express.Router();

router.use(requireAuth);

router.get('/notifications', asyncHandler(engagementController.listNotifications));
router.get('/notifications/unread', asyncHandler(engagementController.unread));
router.post('/notifications/read-all', asyncHandler(engagementController.markAllRead));
router.post('/notifications/:id/read', asyncHandler(engagementController.markRead));

router.get('/history', asyncHandler(engagementController.watchHistory));
router.delete('/history', asyncHandler(engagementController.clearHistory));
router.delete('/history/:contentId', asyncHandler(engagementController.removeHistoryItem));
router.post('/history/:contentId/hide', asyncHandler(engagementController.hideContinueItem));
router.get('/payments', asyncHandler(engagementController.myPayments));

const forYouController = require('../controllers/forYouController');
const { rateLimit } = require('../middleware/rateLimit');

router.get('/for-you', asyncHandler(forYouController.hub));
router.get('/titles/:contentId/preference', asyncHandler(forYouController.preference));
router.post(
  '/titles/:contentId/not-interested',
  rateLimit({ windowMs: 60_000, max: 40, keyFn: (req) => `ni:${req.user.id}` }),
  asyncHandler(forYouController.notInterested)
);
router.delete(
  '/titles/:contentId/not-interested',
  asyncHandler(forYouController.clearNotInterested)
);
router.post(
  '/titles/:contentId/mark-watched',
  asyncHandler(forYouController.markWatched)
);
router.delete(
  '/titles/:contentId/mark-watched',
  asyncHandler(forYouController.unmarkWatched)
);

const phase23Controller = require('../controllers/phase23Controller');
router.get('/follows', asyncHandler(phase23Controller.myFollows));
router.get('/follows/:seriesId', asyncHandler(phase23Controller.followState));
router.post('/follows/:seriesId', asyncHandler(phase23Controller.follow));
router.delete('/follows/:seriesId', asyncHandler(phase23Controller.unfollow));
router.get('/invoices', asyncHandler(phase23Controller.invoices));
router.get('/invoices/:invoiceId', asyncHandler(phase23Controller.invoice));

module.exports = router;
