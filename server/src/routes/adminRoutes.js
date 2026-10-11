'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRoles, requireExactRoles, requireStaffMfa } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const adminOpsController = require('../controllers/adminOpsController');
const creatorStudioService = require('../services/creatorStudioService');
const adPlatformService = require('../services/adPlatformService');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

router.use(
  requireAuth,
  requireRoles(
    'admin',
    'super_admin',
    'moderator',
    'content_manager',
    'finance_manager',
    'support_agent'
  ),
  requireStaffMfa
);

/** Ops elevados: admin empresa (não moderator) */
const elevated = requireRoles('admin', 'super_admin');
/** Só superadmin: identidade e config crítica */
const superOnly = requireExactRoles('super_admin');
const { requirePermission } = require('../services/authorizationService');

router.get('/command-center', asyncHandler(adminOpsController.commandCenter));
router.get('/dashboard', asyncHandler(adminOpsController.commandCenter));
router.get('/audit', requirePermission('support.tickets'), asyncHandler(adminOpsController.audit));
router.get('/streams/live', requirePermission('catalog.moderate'), asyncHandler(adminOpsController.liveStreams));
router.get('/campaigns/pending', requirePermission('ads.manage'), asyncHandler(adminOpsController.campaigns));

router.get('/transactions/pending', elevated, requirePermission('finance.review'), asyncHandler(paymentController.pending));
router.patch('/transactions/:id/status', elevated, requirePermission('finance.review'), asyncHandler(paymentController.review));

router.get(
  '/creators/pending',
  requirePermission('creators.manage'),
  asyncHandler(async (_req, res) => {
    const result = await creatorStudioService.adminListCreators();
    res.json(result);
  })
);

router.patch(
  '/creators/:id/status',
  requirePermission('creators.manage'),
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
  requirePermission('catalog.moderate'),
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
  requirePermission('ads.manage'),
  asyncHandler(async (req, res) => {
    const result = await adPlatformService.adminModerateCampaign(
      req.user.id,
      req.params.id,
      req.body.status,
      { reason: req.body.reason }
    );
    res.json(result);
  })
);

router.get('/payouts/pending', requirePermission('finance.review'), asyncHandler(payoutController.pending));
router.patch('/payouts/:id/status', requirePermission('finance.review'), asyncHandler(payoutController.review));
router.post(
  '/creator-ledger',
  superOnly,
  asyncHandler(async (req, res) => {
    const creatorEarningsService = require('../services/creatorEarningsService');
    const auditRepository = require('../repositories/auditRepository');
    const reason = String(req.body.reason || '').trim();
    const entry = await creatorEarningsService.postStaffEntry({
      creatorId: req.body.creatorId,
      contentId: req.body.contentId || null,
      source: req.body.source,
      amountKz: req.body.amountKz,
      traceKey: req.body.traceKey,
      reason,
    });
    await auditRepository.write({
      actorId: req.user.id,
      action: 'CREATOR_LEDGER_POSTED',
      entity: 'creator_earning',
      entityId: entry.id,
      metadata: {
        source: entry.source,
        amountKz: entry.amountKz,
        creatorId: req.body.creatorId,
        reason,
      },
      ip: req.ip,
    });
    res.status(201).json({ entry });
  })
);

router.get(
  '/promos',
  asyncHandler(async (_req, res) => {
    const result = await require('../services/promoService').adminList();
    res.json(result);
  })
);

router.post(
  '/promos',
  requirePermission('catalog.publish'),
  asyncHandler(async (req, res) => {
    const result = await require('../services/promoService').adminCreate(req.user.id, req.body);
    res.status(201).json(result);
  })
);

router.patch(
  '/promos/:id/active',
  requirePermission('catalog.publish'),
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
  '/connections',
  superOnly,
  asyncHandler(async (_req, res) => {
    res.json(require('../services/connectionsService').list());
  })
);

router.get(
  '/feature-flags',
  elevated,
  asyncHandler(async (_req, res) => {
    const flags = await require('../services/featureFlagService').listAll();
    res.json({ flags });
  })
);

router.patch(
  '/feature-flags/:key',
  superOnly,
  requirePermission('platform.settings.manage'),
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
  requirePermission('support.tickets'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('support.tickets'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('catalog.publish'),
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
  requirePermission('catalog.publish'),
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
router.patch(
  '/experiments/:id',
  requirePermission('platform.settings.manage'),
  asyncHandler(async (req, res) => {
    const next =
      req.body.isActive !== undefined ? req.body.isActive : req.body.enabled;
    const result = await require('../services/phase24Service').setExperimentActive(
      req.params.id,
      next !== false
    );
    res.json(result);
  })
);

router.get(
  '/payments/risk',
  requirePermission('finance.review'),
  asyncHandler(require('../controllers/phase25Controller').paymentRisk)
);

router.get(
  '/encoding',
  asyncHandler(require('../controllers/phase25Controller').encodingQueue)
);

router.patch(
  '/encoding/:contentId',
  requirePermission('catalog.moderate'),
  asyncHandler(require('../controllers/phase25Controller').encodingUpdate)
);

router.get('/packs', asyncHandler(require('../controllers/phase26Controller').adminPacks));
router.get('/surveys/summary', asyncHandler(require('../controllers/phase26Controller').adminSurveys));
router.post('/cdn/probe', requirePermission('platform.settings.manage'), asyncHandler(require('../controllers/phase26Controller').probeCdn));
router.get('/cdn/health', asyncHandler(require('../controllers/phase26Controller').cdnHealth));

router.get(
  '/config',
  elevated,
  asyncHandler(async (_req, res) => {
    res.json(await require('../services/appConfigService').adminList());
  })
);
router.get(
  '/config/:key',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await require('../services/appConfigService').adminGet(req.params.key));
  })
);
router.put(
  '/config/:key',
  superOnly,
  requirePermission('platform.settings.manage'),
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
  requirePermission('support.tickets'),
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
  requirePermission('support.tickets'),
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

const enterprise = require('../services/enterpriseConsoleService');

router.get(
  '/users',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await enterprise.listUsers(req.query));
  })
);
router.patch(
  '/users/:id',
  elevated,
  requirePermission('platform.settings.manage'),
  asyncHandler(async (req, res) => {
    res.json(await enterprise.updateUser(req.user.id, req.params.id, req.body, { ip: req.ip }));
  })
);

router.get(
  '/plans',
  elevated,
  asyncHandler(async (_req, res) => {
    res.json(await enterprise.listPlansAdmin());
  })
);
router.put(
  '/plans/:id',
  elevated,
  requirePermission('finance.review'),
  asyncHandler(async (req, res) => {
    res.json(
      await enterprise.upsertPlan(req.user.id, req.params.id, req.body, { ip: req.ip })
    );
  })
);

router.get(
  '/leads',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await enterprise.listLeads(req.query));
  })
);
router.patch(
  '/leads/:id',
  elevated,
  requirePermission('support.tickets'),
  asyncHandler(async (req, res) => {
    res.json(await enterprise.updateLead(req.user.id, req.params.id, req.body, { ip: req.ip }));
  })
);

router.get(
  '/uploads',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await enterprise.listUploads(req.query));
  })
);
router.get(
  '/uploads/proofs',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await enterprise.listProofUploads(req.query.limit));
  })
);
router.post(
  '/uploads',
  elevated,
  requirePermission('catalog.publish'),
  enterprise.mediaUpload.single('file'),
  asyncHandler(async (req, res) => {
    res.status(201).json(await enterprise.registerUpload(req.user.id, req.file, req.body));
  })
);

router.get(
  '/ads/campaigns',
  elevated,
  asyncHandler(async (req, res) => {
    res.json(await enterprise.listAllCampaigns(req.query));
  })
);

router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    res.json(
      await enterprise.listCatalog({
        ...req.query,
        superAdmin: (req.user.roles || []).includes('super_admin'),
      })
    );
  })
);
router.patch(
  '/catalog/:id',
  elevated,
  requirePermission('catalog.publish'),
  asyncHandler(async (req, res) => {
    res.json(
      await enterprise.patchCatalogTitle(req.user.id, req.params.id, req.body, {
        ip: req.ip,
        superAdmin: (req.user.roles || []).includes('super_admin'),
      })
    );
  })
);

router.put(
  '/packs/:slug',
  elevated,
  requirePermission('catalog.publish'),
  asyncHandler(async (req, res) => {
    res.json(
      await enterprise.upsertPack(
        req.user.id,
        { ...req.body, slug: req.params.slug },
        { ip: req.ip }
      )
    );
  })
);

router.get(
  '/acquisitions',
  requirePermission('acquisition.manage'),
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/acquisitionService').list({
        status: req.query.status,
        tenantId: req.user.roles?.includes('super_admin') ? req.query.tenantId : req.user.tenantId,
      })
    );
  })
);
router.post(
  '/acquisitions',
  requirePermission('acquisition.manage'),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await require('../services/acquisitionService').create(req.user.id, req.body, { ip: req.ip })
    );
  })
);
router.patch(
  '/acquisitions/:id',
  requirePermission('acquisition.manage'),
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/acquisitionService').update(req.user.id, req.params.id, req.body, {
        ip: req.ip,
      })
    );
  })
);

router.get(
  '/rights',
  requirePermission('rights.manage'),
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/contentRightsAdminService').list({
        contentId: req.query.contentId,
        tenantId: req.user.tenantId,
      })
    );
  })
);
router.post(
  '/rights',
  requirePermission('rights.manage'),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await require('../services/contentRightsAdminService').create(req.user.id, req.body, {
        ip: req.ip,
      })
    );
  })
);
router.patch(
  '/rights/:id',
  requirePermission('rights.manage'),
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/contentRightsAdminService').update(
        req.user.id,
        req.params.id,
        req.body,
        { ip: req.ip }
      )
    );
  })
);

router.get(
  '/tenants',
  superOnly,
  asyncHandler(async (_req, res) => {
    res.json(await require('../services/tenantAdminService').list());
  })
);
router.post(
  '/tenants',
  superOnly,
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await require('../services/tenantAdminService').create(req.user.id, req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      })
    );
  })
);
router.patch(
  '/tenants/:id',
  superOnly,
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/tenantAdminService').update(req.user.id, req.params.id, req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        user: req.user,
        mfaCode: req.body.mfaCode || req.headers['x-mfa-code'],
      })
    );
  })
);

router.get(
  '/approvals',
  superOnly,
  asyncHandler(async (_req, res) => {
    res.json(await require('../services/fourEyesService').listPending());
  })
);
router.post(
  '/approvals/:id/decide',
  superOnly,
  asyncHandler(async (req, res) => {
    res.json(
      await require('../services/fourEyesService').decide(req.user.id, req.params.id, {
        approve: req.body.approve !== false,
        reason: req.body.reason,
      }, { ip: req.ip })
    );
  })
);

router.get(
  '/rbac/permissions',
  superOnly,
  asyncHandler(async (_req, res) => {
    const { query } = require('../config/database');
    const roles = await query(
      `SELECT r.code, r.name,
              COALESCE(json_agg(rp.permission_code) FILTER (WHERE rp.permission_code IS NOT NULL), '[]') AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_code = r.code
       GROUP BY r.code, r.name
       ORDER BY r.code`
    );
    res.json({ roles: roles.rows });
  })
);

module.exports = router;
