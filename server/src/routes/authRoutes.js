'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(authController.register)
);
router.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(authController.login)
);
router.post(
  '/refresh',
  rateLimit({ windowMs: 60_000, max: 40 }),
  asyncHandler(authController.refresh)
);
router.post(
  '/forgot-password',
  rateLimit({ windowMs: 60_000, max: 8, keyFn: (req) => `forgot:${req.ip}` }),
  asyncHandler(authController.forgotPassword)
);
router.post(
  '/reset-password',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(authController.resetPassword)
);
router.post(
  '/verify-email',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(authController.verifyEmail)
);
router.get(
  '/verify-email',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(authController.verifyEmail)
);
router.post(
  '/oauth/google',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(require('../controllers/phase25Controller').oauthGoogle)
);
router.post(
  '/oauth/apple',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(require('../controllers/phase25Controller').oauthApple)
);

router.get('/me', requireAuth, asyncHandler(authController.me));
router.get('/profiles', requireAuth, asyncHandler(authController.profiles));
router.post('/logout', requireAuth, asyncHandler(authController.logout));
router.post(
  '/change-password',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 8 }),
  asyncHandler(authController.changePassword)
);
router.post(
  '/resend-verification',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 5 }),
  asyncHandler(authController.resendVerification)
);
router.get('/sessions', requireAuth, asyncHandler(authController.sessions));
router.delete('/sessions/:sessionId', requireAuth, asyncHandler(authController.revokeSession));
router.post('/sessions/revoke-others', requireAuth, asyncHandler(authController.revokeOthers));

module.exports = router;
