'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRoles } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.get('/packs', requireAuth, asyncHandler(require('../controllers/phase26Controller').packs));
router.get('/packs/:id', requireAuth, asyncHandler(require('../controllers/phase26Controller').packById));

router.get('/methods', requireAuth, asyncHandler(paymentController.methods));
router.post(
  '/checkout',
  requireAuth,
  paymentService.upload.single('proof'),
  asyncHandler(paymentController.checkout)
);
router.get('/transactions', requireAuth, asyncHandler(paymentController.myTransactions));
router.get(
  '/transactions/:id/receipt',
  requireAuth,
  asyncHandler(paymentController.receipt)
);

module.exports = router;
