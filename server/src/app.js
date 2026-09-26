'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { env } = require('./config/env');
const { healthCheck } = require('./config/database');
const { requestId } = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimit } = require('./middleware/rateLimit');
const { requireAuth, requireRoles } = require('./middleware/auth');
const { logger } = require('./utils/logger');
const { asyncHandler } = require('./utils/asyncHandler');

const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const watchRoutes = require('./routes/watchRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const creatorStudioRoutes = require('./routes/creatorStudioRoutes');
const adRoutes = require('./routes/adRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');
const accountRoutes = require('./routes/accountRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const { parentalRouter, downloadRouter } = require('./routes/parentalDownloadRoutes');
const promoRoutes = require('./routes/promoRoutes');
const browseRoutes = require('./routes/browseRoutes');
const { pushRouter, plansRouter } = require('./routes/pushPlansRoutes');
const legalRoutes = require('./routes/legalRoutes');
const helpReferralRoutes = require('./routes/helpReferralRoutes');
const watchTogetherRoutes = require('./routes/watchTogetherRoutes');
const {
  giftsRouter,
  householdRouter,
  premieresRouter,
} = require('./routes/giftHouseholdRoutes');
const phase23Routes = require('./routes/phase23Routes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));

  // Comprovativos: só owner ou admin (não static público)
  app.get(
    '/uploads/proofs/:filename',
    requireAuth,
    asyncHandler(async (req, res) => {
      const filename = path.basename(req.params.filename || '');
      if (!filename || filename.includes('..')) {
        return res.status(400).json({ error: true, code: 'INVALID_PATH' });
      }
      const proofPath = `/uploads/proofs/${filename}`;
      const { query } = require('./config/database');
      const owned = await query(
        `SELECT id FROM transactions WHERE proof_url = $1 AND user_id = $2 LIMIT 1`,
        [proofPath, req.user.id]
      );
      const isAdmin =
        req.user.isAdmin ||
        (req.user.roles || []).some((r) => ['admin', 'super_admin', 'moderator'].includes(r));
      if (!owned.rowCount && !isAdmin) {
        return res.status(404).json({ error: true, code: 'NOT_FOUND' });
      }
      return res.sendFile(path.join(env.uploadsDir, 'proofs', filename));
    })
  );
  app.use(
    '/uploads',
    (req, res, next) => {
      if (String(req.path || '').startsWith('/proofs')) {
        return res.status(401).json({ error: true, code: 'UNAUTHORIZED' });
      }
      return next();
    },
    express.static(path.join(env.uploadsDir))
  );

  app.post(
    '/webhooks/bunny',
    rateLimit({ windowMs: 60_000, max: 120 }),
    require('./utils/asyncHandler').asyncHandler(async (req, res) => {
      const result = await require('./services/bunnyWebhookService').handleBunnyWebhook(req);
      res.json(result);
    })
  );

  app.get('/health', (_req, res) => {
    res.json({
      service: 'minhatela-api',
      status: 'ok',
      market: 'AO',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      const ok = await healthCheck();
      return res.status(ok ? 200 : 503).json({
        ready: ok,
        postgres: ok ? 'ok' : 'down',
        market: 'AO',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('ready.failed', { message: error.message });
      return res.status(503).json({ ready: false });
    }
  });

  app.get(
    '/ops',
    requireAuth,
    requireRoles('admin', 'super_admin', 'moderator'),
    async (_req, res) => {
      try {
        const status = await require('./services/opsService').collectOpsStatus();
        // Nunca expor secrets Bunny
        const safe = { ...status };
        delete safe.bunnyApiKey;
        delete safe.tokenAuthKey;
        res.status(status.ready ? 200 : 503).json(safe);
      } catch (error) {
        logger.error('ops.failed', { message: error.message });
        res.status(500).json({ error: true, message: 'ops unavailable' });
      }
    }
  );

  app.get(
    '/metrics',
    requireAuth,
    requireRoles('admin', 'super_admin', 'moderator'),
    async (_req, res) => {
      try {
        const metrics = await require('./services/metricsService').collectMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('metrics.failed', { message: error.message });
        res.status(500).json({ error: true, message: 'metrics unavailable' });
      }
    }
  );

  app.get('/health/database', async (_req, res) => {
    try {
      const ok = await healthCheck();
      res.status(ok ? 200 : 503).json({
        service: 'postgres',
        status: ok ? 'ok' : 'down',
      });
    } catch (error) {
      logger.error('health.database_failed', { message: error.message });
      res.status(503).json({ service: 'postgres', status: 'down' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/me', engagementRoutes);
  app.use('/api/parental', parentalRouter);
  app.use('/api/downloads', downloadRouter);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/content', catalogRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/discovery', discoveryRoutes);
  app.use('/api/browse', browseRoutes);
  app.use('/api/watch', watchRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/creator-studio', creatorStudioRoutes);
  app.use('/api/creators', creatorStudioRoutes);
  app.use('/api/ads', adRoutes);
  app.use('/api/advertisers', adRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/promos', promoRoutes);
  app.use('/api/push', pushRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/legal', legalRoutes);
  app.use('/api/support', helpReferralRoutes);
  app.use('/api/watch-together', watchTogetherRoutes);
  app.use('/api/gifts', giftsRouter);
  app.use('/api/household', householdRouter);
  app.use('/api/premieres', premieresRouter);
  app.use('/api', phase23Routes);
  app.use(
    '/api/surveys',
    requireAuth,
    (() => {
      const r = require('express').Router();
      const { asyncHandler } = require('./utils/asyncHandler');
      const c = require('./controllers/phase26Controller');
      r.get('/pending', asyncHandler(c.pendingSurvey));
      r.post('/respond', asyncHandler(c.respondSurvey));
      return r;
    })()
  );
  app.use('/api/admin', adminRoutes);

  // Deep link SEO / Open Graph (crawlers WhatsApp/Facebook)
  app.get(
    '/share/:id',
    require('./utils/asyncHandler').asyncHandler(async (req, res) => {
      const card = await require('./services/catalogService').getShareCard(req.params.id);
      const { renderShareOgHtml } = require('./utils/ogShare');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderShareOgHtml(card));
    })
  );

  // Compatibilidade controlada com endpoint antigo de playback
  app.get('/api/catalog/playback/:id', require('./middleware/auth').requireAuth, (req, res) => {
    res.status(410).json({
      error: true,
      code: 'ENDPOINT_DEPRECATED',
      message: 'Use POST /api/watch/:contentId/start',
      requestId: req.requestId,
    });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
