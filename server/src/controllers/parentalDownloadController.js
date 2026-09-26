'use strict';

const parentalService = require('../services/parentalService');
const downloadService = require('../services/downloadService');

function deviceMeta(req) {
  return {
    deviceKey: req.headers['x-device-key'] || req.body?.deviceKey,
    deviceName: req.headers['x-device-name'] || req.body?.deviceName || 'Dispositivo',
    platform: req.headers['x-device-platform'] || req.body?.platform || 'unknown',
    ip: req.ip,
  };
}

async function listBlocked(req, res) {
  const result = await parentalService.listBlocked(req.user.id, req.params.profileId);
  res.json(result);
}

async function blockTitle(req, res) {
  const result = await parentalService.blockTitle(
    req.user.id,
    req.params.profileId,
    req.params.contentId
  );
  res.status(201).json(result);
}

async function unblockTitle(req, res) {
  const result = await parentalService.unblockTitle(
    req.user.id,
    req.params.profileId,
    req.params.contentId
  );
  res.json(result);
}

async function listDownloads(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await downloadService.listDownloads(req.user.id, profileId);
  res.json(result);
}

async function requestDownload(req, res) {
  const meta = deviceMeta(req);
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await downloadService.requestDownload({
    userId: req.user.id,
    contentId: req.params.contentId,
    profileId,
    quality: req.body.quality,
    ...meta,
  });
  res.status(201).json(result);
}

async function refreshLicense(req, res) {
  const meta = deviceMeta(req);
  const result = await downloadService.refreshLicense({
    userId: req.user.id,
    licenseId: req.params.licenseId,
    deviceKey: meta.deviceKey,
    ip: meta.ip,
  });
  res.json(result);
}

async function revokeDownload(req, res) {
  const result = await downloadService.revokeDownload(req.user.id, req.params.licenseId);
  res.json(result);
}

async function markPlayed(req, res) {
  const meta = deviceMeta(req);
  const result = await downloadService.markPlayed(
    req.user.id,
    req.params.licenseId,
    meta.deviceKey
  );
  res.json(result);
}

module.exports = {
  listBlocked,
  blockTitle,
  unblockTitle,
  listDownloads,
  requestDownload,
  refreshLicense,
  revokeDownload,
  markPlayed,
};
