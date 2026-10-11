'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const adPlatformService = require('../services/adPlatformService');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');

const adsDir = path.join(env.uploadsDir, 'ads');
fs.mkdirSync(adsDir, { recursive: true });

const CREATIVE_TYPES = {
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/png': { ext: '.png', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'image/gif': { ext: '.gif', kind: 'image' },
};

const CREATIVE_EXT = {
  '.mp4': CREATIVE_TYPES['video/mp4'],
  '.webm': CREATIVE_TYPES['video/webm'],
  '.mov': CREATIVE_TYPES['video/quicktime'],
  '.jpg': CREATIVE_TYPES['image/jpeg'],
  '.jpeg': CREATIVE_TYPES['image/jpeg'],
  '.png': CREATIVE_TYPES['image/png'],
  '.webp': CREATIVE_TYPES['image/webp'],
  '.gif': CREATIVE_TYPES['image/gif'],
};

function creativeFileMeta(file) {
  const byMime = CREATIVE_TYPES[String(file.mimetype || '').toLowerCase()];
  if (byMime) return byMime;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return CREATIVE_EXT[ext] || null;
}

const adUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, adsDir),
    filename: (_req, file, cb) => {
      const meta = creativeFileMeta(file);
      const ext = meta?.ext || '.bin';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!creativeFileMeta(file)) {
      return cb(new Error('Use uma imagem (JPG, PNG, WEBP) ou um vídeo (MP4, WEBM, MOV)'));
    }
    cb(null, true);
  },
});

function receiveCreative(req, res, next) {
  adUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'O ficheiro passa de 30 MB'
        : err.message || 'Ficheiro não aceite';
    next(createError(400, message, 'VALIDATION'));
  });
}

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
  const meta = creativeFileMeta(req.file);
  const mediaUrl = `/uploads/ads/${req.file.filename}`;
  res.status(201).json({
    mediaUrl,
    mediaKind: meta?.kind || 'video',
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
  });
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
  receiveCreative,
  adUpload,
  decision,
  start,
  complete,
  click,
};
