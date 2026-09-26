'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const accountController = require('../controllers/accountController');
const complianceController = require('../controllers/complianceController');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(accountController.getAccount));
router.get('/devices', asyncHandler(accountController.listDevices));
router.delete('/devices/:deviceId', asyncHandler(accountController.revokeDevice));
router.post('/devices/:deviceId/trust', asyncHandler(accountController.trustDevice));
router.patch('/devices/:deviceId', asyncHandler(accountController.renameDevice));
router.get('/streams', asyncHandler(accountController.streamStatus));
router.get('/experiments', asyncHandler(require('../controllers/phase24Controller').experiments));
router.patch(
  '/playback-prefs',
  asyncHandler(require('../controllers/phase24Controller').updatePlaybackPrefs)
);

router.get('/profiles', asyncHandler(accountController.listProfiles));
router.post('/profiles', asyncHandler(accountController.createProfile));
router.patch('/profiles/:profileId', asyncHandler(accountController.updateProfile));
router.delete('/profiles/:profileId', asyncHandler(accountController.deleteProfile));
router.post('/profiles/:profileId/unlock', asyncHandler(accountController.unlockProfile));
router.post(
  '/profiles/:profileId/select',
  asyncHandler(require('../controllers/phase26Controller').selectProfile)
);

// Compliance · LGPD/AO
router.get('/privacy', asyncHandler(complianceController.privacy));
router.post(
  '/export-data',
  rateLimit({ windowMs: 60_000, max: 3, keyFn: (req) => `export:${req.user.id}` }),
  asyncHandler(complianceController.exportData)
);
router.get('/export-data/:exportId', asyncHandler(complianceController.getExport));
router.post(
  '/delete',
  rateLimit({ windowMs: 60_000, max: 3, keyFn: (req) => `del:${req.user.id}` }),
  asyncHandler(complianceController.requestDelete)
);
router.post('/delete/cancel', asyncHandler(complianceController.cancelDelete));

module.exports = router;
