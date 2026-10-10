'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const companyPortalService = require('../services/companyPortalService');

const router = express.Router();
router.use(requireAuth);

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 8 }),
  asyncHandler(async (req, res) => {
    const result = await companyPortalService.registerCompany(req.user.id, req.body, {
      ip: req.ip,
    });
    res.status(result.alreadyExists ? 200 : 201).json(result);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await companyPortalService.dashboard(req.user.id));
  })
);

router.post(
  '/members',
  asyncHandler(async (req, res) => {
    res.status(201).json(await companyPortalService.addMember(req.user.id, req.body, { ip: req.ip }));
  })
);

router.delete(
  '/members/:userId',
  asyncHandler(async (req, res) => {
    res.json(await companyPortalService.removeMember(req.user.id, req.params.userId, { ip: req.ip }));
  })
);

module.exports = router;
