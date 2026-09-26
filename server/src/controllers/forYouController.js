'use strict';

const forYouService = require('../services/forYouService');

async function hub(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId;
  const result = await forYouService.hub(req.user.id, profileId);
  res.json(result);
}

async function notInterested(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await forYouService.setNotInterested(
    req.user.id,
    profileId,
    req.params.contentId,
    req.body.value !== false && req.body.notInterested !== false,
    { ip: req.ip }
  );
  res.json(result);
}

async function clearNotInterested(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await forYouService.setNotInterested(
    req.user.id,
    profileId,
    req.params.contentId,
    false,
    { ip: req.ip }
  );
  res.json(result);
}

async function markWatched(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await forYouService.markWatched(
    req.user.id,
    profileId,
    req.params.contentId,
    { ip: req.ip }
  );
  res.json(result);
}

async function unmarkWatched(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId;
  const result = await forYouService.unmarkWatched(
    req.user.id,
    profileId,
    req.params.contentId
  );
  res.json(result);
}

async function preference(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId;
  const result = await forYouService.getPreference(
    req.user.id,
    profileId,
    req.params.contentId
  );
  res.json(result);
}

module.exports = {
  hub,
  notInterested,
  clearNotInterested,
  markWatched,
  unmarkWatched,
  preference,
};
