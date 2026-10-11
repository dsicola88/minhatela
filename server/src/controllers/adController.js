'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const adPlatformService = require('../services/adPlatformService');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');

const adsDir = path.join(env.uploadsDir, 'ads');
fs.mkdirSync(adsDir, { recursive: true });

const adUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, adsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() === '.mp4' ? '.mp4' : '';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || '.mp4'}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'video/mp4' ||
      String(file.originalname || '')
        .toLowerCase()
        .endsWith('.mp4');
    if (!ok) return cb(new Error('Apenas vídeo MP4'));
    cb(null, true);
  },
});

async function register(req, res) {
  const result = await adPlatformService.registerAdvertiser(req.user.id, req.body);
  res.status(result.alreadyExists ? 200 : 201).json(result);
}

async function portal(req, res) {
  const result = await adPlatformService.getPortal(req.user.id, req.query);
  res.json(result);
}

async function listCampaigns(req, res) {
  res.json(await adPlatformService.listMyCampaigns(req.user.id, req.query));
}

async function getCampaign(req, res) {
  res.json(await adPlatformService.getMyCampaign(req.user.id, req.params.id));
}

async function createCampaign(req, res) {
  const result = await adPlatformService.createCampaign(req.user.id, req.body);
  res.status(201).json(result);
}

async function pauseCampaign(req, res) {
  res.json(await adPlatformService.pauseMyCampaign(req.user.id, req.params.id));
}

async function reports(req, res) {
  const result = await adPlatformService.getReports(req.user.id, req.query);
  if (String(req.query.format || '') === 'csv') {
    const csv = adPlatformService.reportsToCsv(result);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="minhatela-anuncios.csv"');
    return res.send(csv);
  }
  res.json(result);
}

async function uploadCreative(req, res) {
  await adPlatformService.requireAdvertiser(req.user.id);
  if (!req.file) throw createError(400, 'Ficheiro obrigatório', 'VALIDATION');
  const mediaUrl = `/uploads/ads/${req.file.filename}`;
  res.status(201).json({ mediaUrl, mimeType: req.file.mimetype, sizeBytes: req.file.size });
}

async function decision(req, res) {
  const result = await adPlatformService.decideAd({
    contentId: req.body.contentId,
    monetization: req.body.monetization || 'avod',
    userId: req.user.id,
    placement: req.body.placement || 'pre_roll',
    contentGenre: req.body.contentGenre || null,
    device: req.body.device || null,
  });
  res.json({ decision: result });
}

async function start(req, res) {
  res.json(await adPlatformService.startImpression(req.user.id, req.params.impressionId));
}

async function complete(req, res) {
  res.json(
    await adPlatformService.completeImpression(req.user.id, req.params.impressionId)
  );
}

async function click(req, res) {
  res.json(await adPlatformService.recordClick(req.user.id, req.params.impressionId));
}

module.exports = {
  register,
  portal,
  listCampaigns,
  getCampaign,
  createCampaign,
  pauseCampaign,
  reports,
  uploadCreative,
  adUpload,
  decision,
  start,
  complete,
  click,
};
