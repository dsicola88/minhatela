'use strict';

const catalogService = require('../services/catalogService');

async function home(req, res) {
  const profileId = req.headers['x-profile-id'] || null;
  const result = await catalogService.getHome({
    userId: req.user?.id || null,
    profileId,
    deviceId: req.headers['x-device-id'] || null,
  });
  res.json(result);
}

async function details(req, res) {
  const result = await catalogService.getContentDetails(
    req.user.id,
    req.params.id,
    req.headers['x-profile-id'] || null
  );
  res.json({
    content: result.content,
    video: result.content,
    access: result.access,
    related: result.related,
    favorited: result.favorited,
    playEpisode: result.playEpisode || null,
    nextEpisode: result.nextEpisode || null,
    social: result.social || null,
    cast: result.cast || result.content?.castPeople || [],
    chapters: result.chapters || result.content?.chapters || [],
    preference: result.preference || { notInterested: false, markedWatched: false },
  });
}

async function share(req, res) {
  const result = await catalogService.getShareCard(req.params.id);
  const wantsHtml =
    String(req.query.format || '').toLowerCase() === 'html' ||
    (req.headers.accept || '').includes('text/html');
  if (wantsHtml) {
    const { renderShareOgHtml } = require('../utils/ogShare');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderShareOgHtml(result));
  }
  res.json(result);
}

async function preview(req, res) {
  const result = await catalogService.getTrailerPreview(
    req.params.id,
    req.user?.id,
    req.headers['x-profile-id'] || null
  );
  res.json(result);
}

module.exports = { home, details, share, preview };
