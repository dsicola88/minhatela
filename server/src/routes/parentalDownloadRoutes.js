'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/parentalDownloadController');

const parentalRouter = express.Router();
parentalRouter.use(requireAuth);
parentalRouter.get('/profiles/:profileId/blocked', asyncHandler(ctrl.listBlocked));
parentalRouter.post(
  '/profiles/:profileId/blocked/:contentId',
  rateLimit({ windowMs: 60_000, max: 40 }),
  asyncHandler(ctrl.blockTitle)
);
parentalRouter.delete(
  '/profiles/:profileId/blocked/:contentId',
  asyncHandler(ctrl.unblockTitle)
);

const downloadRouter = express.Router();
downloadRouter.use(requireAuth);
downloadRouter.get('/', asyncHandler(ctrl.listDownloads));
downloadRouter.get('/licenses/:licenseId/refresh', asyncHandler(ctrl.refreshLicense));
downloadRouter.post('/licenses/:licenseId/played', asyncHandler(ctrl.markPlayed));
downloadRouter.delete('/licenses/:licenseId', asyncHandler(ctrl.revokeDownload));
downloadRouter.post(
  '/:contentId',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(ctrl.requestDownload)
);

module.exports = { parentalRouter, downloadRouter };
