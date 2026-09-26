'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const browseController = require('../controllers/browseController');

const router = express.Router();

router.use(requireAuth);

router.get('/new-and-hot', asyncHandler(browseController.newAndHot));
router.get('/genres', asyncHandler(browseController.genres));
router.get('/genre/:genre', asyncHandler(browseController.byGenre));
router.get('/rows', asyncHandler(browseController.browse));
router.get('/collections', asyncHandler(browseController.collections));
router.get('/collections/:slug', asyncHandler(browseController.collectionBySlug));

router.get(
  '/languages',
  asyncHandler(require('../controllers/phase23Controller').languagesHub)
);
router.get(
  '/language/:lang',
  asyncHandler(require('../controllers/phase23Controller').byLanguage)
);
router.get(
  '/category/:slug',
  asyncHandler(require('../controllers/phase23Controller').byCategory)
);

module.exports = router;
