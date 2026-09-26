'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, optionalProfile } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const ctrl = require('../controllers/watchTogetherController');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/rooms',
  optionalProfile,
  rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => `party:${req.user.id}` }),
  asyncHandler(ctrl.createParty)
);
router.post(
  '/rooms/join',
  optionalProfile,
  rateLimit({ windowMs: 60_000, max: 20, keyFn: (req) => `partyjoin:${req.user.id}` }),
  asyncHandler(ctrl.joinParty)
);
router.get('/rooms/:roomId', asyncHandler(ctrl.partyState));
router.post('/rooms/:roomId/sync', asyncHandler(ctrl.partySync));
router.post('/rooms/:roomId/end', asyncHandler(ctrl.partyEnd));
router.post('/rooms/:roomId/leave', asyncHandler(ctrl.partyLeave));

router.post(
  '/feedback',
  rateLimit({ windowMs: 60_000, max: 20, keyFn: (req) => `fb:${req.user.id}` }),
  asyncHandler(ctrl.feedback)
);

router.post('/still-watching', asyncHandler(ctrl.stillChallenge));
router.post('/still-watching/:challengeId/confirm', asyncHandler(ctrl.stillConfirm));
router.get('/still-watching/pending', asyncHandler(ctrl.stillPending));

module.exports = router;
