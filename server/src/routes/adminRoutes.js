'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRoles } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const adminOpsController = require('../controllers/adminOpsController');
const creatorStudioService = require('../services/creatorStudioService');
const adPlatformService = require('../services/adPlatformService');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

router.use(requireAuth, requireRoles('admin', 'super_admin', 'moderator'));

router.get('/command-center', asyncHandler(adminOpsController.commandCenter));
router.get('/dashboard', asyncHandler(adminOpsController.commandCenter));
router.get('/audit', asyncHandler(adminOpsController.audit));
router.get('/streams/live', asyncHandler(adminOpsController.liveStreams));
router.get('/campaigns/pending', asyncHandler(adminOpsController.campaigns));

router.get('/transactions/pending', asyncHandler(paymentController.pending));
router.patch('/transactions/:id/status', asyncHandler(paymentController.review));

router.get(
  '/creators/pending',
  asyncHandler(async (_req, res) => {
    const result = await creatorStudioService.adminListCreators();
    res.json(result);
  })
);

router.patch(
  '/creators/:id/status',
  asyncHandler(async (req, res) => {
    const result = await creatorStudioService.adminReviewCreator(
      req.user.id,
      req.params.id,
      req.body.status
    );
    res.json(result);
  })
);

router.get(
  '/content/pending',
  asyncHandler(async (req, res) => {
    const status = req.query.status || 'submitted';
    const result = await creatorStudioService.adminListContent(status);
    res.json(result);
  })
);

router.patch(
  '/content/:id/moderate',
  asyncHandler(async (req, res) => {
    const result = await creatorStudioService.adminModerateContent(req.user.id, req.params.id, {
      action: req.body.action,
      rejectionReason: req.body.rejectionReason,
    });
    res.json(result);
  })
);

router.patch(
  '/campaigns/:id/status',
  asyncHandler(async (req, res) => {
    const result = await adPlatformService.adminModerateCampaign(
      req.user.id,
      req.params.id,
      req.body.status
    );
    res.json(result);
  })
);

router.get('/payouts/pending', asyncHandler(payoutController.pending));
router.patch('/payouts/:id/status', asyncHandler(payoutController.review));

router.get(
  '/promos',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/promoService').adminList();
    res.json(result);
  })
);

router.post(
  '/promos',
  asyncHandler(async (req, res) => {
    const result = await require('../services/promoService').adminCreate(req.user.id, req.body);
    res.status(201).json(result);
  })
);

router.patch(
  '/promos/:id/active',
  asyncHandler(async (req, res) => {
    const result = await require('../services/promoService').adminSetActive(
      req.user.id,
      req.params.id,
      req.body.isActive !== false && req.body.active !== false
    );
    res.json(result);
  })
);

router.get(
  '/feature-flags',
  asyncHandler(async (_req, res) => {
    const flags = await require('../services/featureFlagService').listAll();
    res.json({ flags });
  })
);

router.patch(
  '/feature-flags/:key',
  asyncHandler(async (req, res) => {
    const flag = await require('../services/featureFlagService').setFlag(
      req.params.key,
      req.body.enabled !== false && req.body.enabled !== 'false'
    );
    if (!flag) {
      return res.status(404).json({ error: true, message: 'Flag não encontrada' });
    }
    await require('../repositories/auditRepository').write({
      actorId: req.user.id,
      action: 'feature_flag.updated',
      entity: 'feature_flag',
      entityId: req.params.key,
      metadata: { enabled: flag.enabled },
      ip: req.ip,
    });
    res.json(flag);
  })
);

router.get('/reports', asyncHandler(require('../controllers/reportController').listOpen));
router.patch(
  '/reports/:reportId',
  asyncHandler(require('../controllers/reportController').review)
);

router.get(
  '/editorial',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/editorialService').adminList();
    res.json(result);
  })
);
router.post(
  '/editorial',
  asyncHandler(async (req, res) => {
    const result = await require('../services/editorialService').adminCreate(req.body, {
      actorId: req.user.id,
      ip: req.ip,
    });
    res.status(201).json(result);
  })
);
router.patch(
  '/editorial/:id',
  asyncHandler(async (req, res) => {
    const result = await require('../services/editorialService').adminUpdate(
      req.params.id,
      req.body,
      { actorId: req.user.id, ip: req.ip }
    );
    res.json(result);
  })
);
router.put(
  '/editorial/:id/items',
  asyncHandler(async (req, res) => {
    const result = await require('../services/editorialService').adminSetItems(
      req.params.id,
      req.body.items || req.body,
      { actorId: req.user.id, ip: req.ip }
    );
    res.json(result);
  })
);

router.get(
  '/qoe/summary',
  asyncHandler(async (req, res) => {
    const summary = await require('../services/qoeService').adminSummary(req.query.days);
    res.json({ summary });
  })
);

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const result = await require('../services/helpService').adminListTickets(req.query.limit);
    res.json(result);
  })
);
router.patch(
  '/tickets/:ticketId',
  asyncHandler(async (req, res) => {
    const result = await require('../services/helpService').adminReviewTicket(
      req.user.id,
      req.params.ticketId,
      req.body,
      { ip: req.ip }
    );
    res.json(result);
  })
);

router.get(
  '/gifts',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/giftService').adminList();
    res.json(result);
  })
);
router.post(
  '/gifts',
  asyncHandler(async (req, res) => {
    const result = await require('../services/giftService').adminCreate(
      req.user.id,
      req.body,
      { ip: req.ip }
    );
    res.status(201).json(result);
  })
);
router.patch(
  '/gifts/:id/revoke',
  asyncHandler(async (req, res) => {
    const result = await require('../services/giftService').adminRevoke(
      req.user.id,
      req.params.id,
      { ip: req.ip }
    );
    res.json(result);
  })
);

router.get(
  '/premieres',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/premiereService').adminList();
    res.json(result);
  })
);
router.post(
  '/premieres',
  asyncHandler(async (req, res) => {
    const result = await require('../services/premiereService').adminCreate(
      req.user.id,
      req.body,
      { ip: req.ip }
    );
    res.status(201).json(result);
  })
);
router.patch(
  '/premieres/:id',
  asyncHandler(async (req, res) => {
    const result = await require('../services/premiereService').adminUpdate(
      req.user.id,
      req.params.id,
      req.body,
      { ip: req.ip }
    );
    res.json(result);
  })
);

router.get(
  '/experiments',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/phase24Service').adminExperiments();
    res.json(result);
  })
);

router.get(
  '/payments/risk',
  asyncHandler(require('../controllers/phase25Controller').paymentRisk)
);

router.get(
  '/encoding',
  asyncHandler(require('../controllers/phase25Controller').encodingQueue)
);

router.patch(
  '/encoding/:contentId',
  asyncHandler(require('../controllers/phase25Controller').encodingUpdate)
);

router.get('/packs', asyncHandler(require('../controllers/phase26Controller').adminPacks));
router.get('/surveys/summary', asyncHandler(require('../controllers/phase26Controller').adminSurveys));
router.post('/cdn/probe', asyncHandler(require('../controllers/phase26Controller').probeCdn));
router.get('/cdn/health', asyncHandler(require('../controllers/phase26Controller').cdnHealth));

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json(await require('../services/appConfigService').adminList());
  })
);
router.get(
  '/config/:key',
  asyncHandler(async (req, res) => {
    res.json(await require('../services/appConfigService').adminGet(req.params.key));
  })
);
router.put(
  '/config/:key',
  asyncHandler(async (req, res) => {
    const result = await require('../services/appConfigService').adminUpsert(
      req.user.id,
      req.params.key,
      req.body,
      { ip: req.ip }
    );
    res.json(result);
  })
);

router.get(
  '/help/articles',
  asyncHandler(async (req, res) => {
    res.json(await require('../services/helpService').adminListArticles(req.query.limit));
  })
);
router.post(
  '/help/articles',
  asyncHandler(async (req, res) => {
    const result = await require('../services/helpService').adminUpsertArticle(
      req.user.id,
      req.body,
      { ip: req.ip }
    );
    res.status(201).json(result);
  })
);
router.patch(
  '/help/articles/:id/publish',
  asyncHandler(async (req, res) => {
    const result = await require('../services/helpService').adminSetArticlePublished(
      req.user.id,
      req.params.id,
      req.body.isPublished !== false && req.body.published !== false,
      { ip: req.ip }
    );
    res.json(result);
  })
);

module.exports = router;
