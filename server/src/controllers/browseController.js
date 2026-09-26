'use strict';

const browseService = require('../services/browseService');

async function newAndHot(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await browseService.newAndHot({
    userId: req.user.id,
    profileId,
  });
  res.json(result);
}

async function genres(_req, res) {
  const result = await browseService.genres();
  res.json(result);
}

async function byGenre(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await browseService.byGenre({
    userId: req.user.id,
    profileId,
    genre: req.params.genre || req.query.genre,
  });
  res.json(result);
}

async function browse(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await browseService.browseRows({
    userId: req.user.id,
    profileId,
  });
  res.json(result);
}

async function collections(req, res) {
  const editorialService = require('../services/editorialService');
  const profileId = req.headers['x-profile-id'] || null;
  let maturityMax = 18;
  if (profileId) {
    const profile = await require('../repositories/profileRepository').findOwned(
      profileId,
      req.user.id
    );
    maturityMax = profile?.maturity_max ?? 18;
  }
  const rows = await editorialService.listForHome(maturityMax);
  res.json({ collections: rows });
}

async function collectionBySlug(req, res) {
  const editorialService = require('../services/editorialService');
  const profileId = req.headers['x-profile-id'] || null;
  let maturityMax = 18;
  if (profileId) {
    const profile = await require('../repositories/profileRepository').findOwned(
      profileId,
      req.user.id
    );
    maturityMax = profile?.maturity_max ?? 18;
  }
  const row = await editorialService.getCollection(req.params.slug, maturityMax);
  res.json(row);
}

module.exports = { newAndHot, genres, byGenre, browse, collections, collectionBySlug };
