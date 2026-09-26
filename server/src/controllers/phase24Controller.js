'use strict';

const phase24Service = require('../services/phase24Service');
const accountService = require('../services/accountService');

async function experiments(req, res) {
  const result = await phase24Service.getExperiments(req.user.id);
  res.json(result);
}

async function trending(req, res) {
  const result = await phase24Service.trendingSearches();
  res.json(result);
}

async function updatePlaybackPrefs(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  if (!profileId) {
    return res.status(400).json({ error: true, code: 'PROFILE_REQUIRED', message: 'Perfil obrigatório' });
  }
  const result = await accountService.updateProfile(req.user.id, profileId, {
    preferredAudio: req.body.preferredAudio || req.body.audio,
    preferredSubtitles: req.body.preferredSubtitles || req.body.subtitles,
    subtitleSize: req.body.subtitleSize,
    preferredQuality: req.body.preferredQuality || req.body.quality,
  });
  res.json({ preferences: result });
}

module.exports = { experiments, trending, updatePlaybackPrefs };
