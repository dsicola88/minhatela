'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const creatorStudioController = require('../controllers/creatorStudioController');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(creatorStudioController.register)
);

router.get('/home', asyncHandler(creatorStudioController.home));

router.patch(
  '/bank',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(creatorStudioController.updateBank)
);

router.post(
  '/contents',
  asyncHandler(creatorStudioController.createContent)
);

router.patch(
  '/contents/:id',
  asyncHandler(creatorStudioController.updateContent)
);

router.post(
  '/contents/:id/submit',
  asyncHandler(creatorStudioController.submit)
);

router.post(
  '/bunny/videos',
  rateLimit({ windowMs: 60_000, max: 30, keyFn: (req) => `bunny-slot:${req.user?.id || req.ip}` }),
  asyncHandler(creatorStudioController.createBunnySlot)
);

const payoutController = require('../controllers/payoutController');

router.get('/payouts', asyncHandler(payoutController.mine));
router.post('/payouts', asyncHandler(payoutController.request));
router.get('/ledger', asyncHandler(async (req, res) => {
  const creatorRepository = require('../repositories/creatorRepository');
  const creatorEarningsService = require('../services/creatorEarningsService');
  const creator = await creatorRepository.findByUserId(req.user.id);
  if (!creator) {
    res.json({
      entries: [],
      ownershipNote: 'A declaração de direitos do estúdio não prova a propriedade do filme.',
    });
    return;
  }
  const entries = await creatorEarningsService.listForCreator(creator.id);
  res.json({
    entries,
    ownershipNote: 'A declaração de direitos do estúdio não prova a propriedade do filme.',
  });
}));

module.exports = router;
