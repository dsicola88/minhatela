'use strict';

const discoveryService = require('../services/discoveryService');
const recommendationService = require('../services/recommendationService');

async function search(req, res) {
  const result = await discoveryService.search(req.user.id, {
    q: req.query.q,
    limit: req.query.limit,
    profileId: req.headers['x-profile-id'] || req.query.profileId,
    kind: req.query.kind,
    monetization: req.query.monetization,
    genre: req.query.genre,
    year: req.query.year,
  });
  res.json(result);
}

async function facets(_req, res) {
  const result = await discoveryService.facets();
  res.json(result);
}

async function related(req, res) {
  const result = await discoveryService.related(req.params.id);
  res.json(result);
}

async function recommendations(req, res) {
  const profileId = req.headers['x-profile-id'] || null;
  const [forYou, because] = await Promise.all([
    recommendationService.forProfile(profileId),
    recommendationService.becauseYouWatched(profileId),
  ]);
  res.json({
    forYou,
    becauseYouWatched: because,
  });
}

async function favorites(req, res) {
  const profileId = req.headers['x-profile-id'];
  if (!profileId) {
    return res.status(400).json({
      error: true,
      code: 'PROFILE_REQUIRED',
      message: 'Header X-Profile-Id obrigatório',
    });
  }
  const result = await discoveryService.favorites(req.user.id, profileId);
  res.json(result);
}

async function addFavorite(req, res) {
  const profileId = req.headers['x-profile-id'];
  const result = await discoveryService.toggleFavorite(
    req.user.id,
    profileId,
    req.params.id,
    true
  );
  res.status(201).json(result);
}

async function removeFavorite(req, res) {
  const profileId = req.headers['x-profile-id'];
  const result = await discoveryService.toggleFavorite(
    req.user.id,
    profileId,
    req.params.id,
    false
  );
  res.json(result);
}

async function rate(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await discoveryService.rateContent(
    req.user.id,
    profileId,
    req.params.id,
    req.body.stars ?? req.body.rating
  );
  res.json(result);
}

async function remind(req, res) {
  const enable = req.body.enable !== false;
  const result = await discoveryService.setReminder(req.user.id, req.params.id, enable);
  res.json(result);
}

async function reminders(req, res) {
  const result = await discoveryService.listReminders(req.user.id);
  res.json(result);
}

async function suggest(req, res) {
  const suggestService = require('../services/suggestService');
  const result = await suggestService.suggest(req.user.id, {
    q: req.query.q,
    limit: req.query.limit,
    profileId: req.headers['x-profile-id'] || req.query.profileId,
  });
  res.json(result);
}

module.exports = {
  search,
  suggest,
  facets,
  related,
  recommendations,
  favorites,
  addFavorite,
  removeFavorite,
  rate,
  remind,
  reminders,
};
