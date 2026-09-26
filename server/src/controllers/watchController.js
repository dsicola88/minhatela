'use strict';

const watchService = require('../services/watchService');
const watchProgressService = require('../services/watchProgressService');

async function start(req, res) {
  const result = await watchService.startPlayback({
    userId: req.user.id,
    contentId: req.params.contentId,
    profileId: req.headers['x-profile-id'] || req.body?.profileId || null,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    deviceKey: req.headers['x-device-key'] || req.body?.deviceKey || null,
    deviceName: req.headers['x-device-name'] || req.body?.deviceName || null,
    platform: req.headers['x-device-platform'] || req.body?.platform || null,
    pin: req.body?.pin || req.headers['x-profile-pin'] || null,
  });
  res.json(result);
}

async function progress(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body?.profileId || null;
  const result = await watchProgressService.saveProgress({
    userId: req.user.id,
    profileId,
    contentId: req.params.contentId,
    positionSeconds: req.body.positionSeconds,
    durationSeconds: req.body.durationSeconds,
    deviceId: req.headers['x-device-id'] || req.body?.deviceId || null,
  });
  res.json(result);
}

async function getProgress(req, res) {
  const profileId = req.headers['x-profile-id'] || null;
  const result = await watchProgressService.getProgress({
    userId: req.user.id,
    profileId,
    contentId: req.params.contentId,
  });
  res.json({ progress: result });
}

async function heartbeat(req, res) {
  const result = await watchService.heartbeat({
    userId: req.user.id,
    sessionId: req.params.sessionId,
  });
  res.json(result);
}

async function end(req, res) {
  const result = await watchService.endPlayback({
    userId: req.user.id,
    sessionId: req.params.sessionId,
  });
  res.json(result);
}

async function qoe(req, res) {
  const qoeService = require('../services/qoeService');
  const result = await qoeService.ingestBatch(req.user.id, req.body, {
    profileId: req.headers['x-profile-id'] || req.body?.profileId,
    platform: req.headers['x-device-platform'] || req.body?.platform,
  });
  res.status(202).json(result);
}

module.exports = { start, progress, getProgress, heartbeat, end, qoe };
