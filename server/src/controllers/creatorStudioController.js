'use strict';

const creatorStudioService = require('../services/creatorStudioService');

async function register(req, res) {
  const result = await creatorStudioService.registerCreator(req.user.id, req.body);
  res.status(result.alreadyExists ? 200 : 201).json(result);
}

async function home(req, res) {
  const result = await creatorStudioService.getStudioHome(req.user.id);
  res.json(result);
}

async function createContent(req, res) {
  const result = await creatorStudioService.createContent(req.user.id, req.body);
  res.status(201).json(result);
}

async function updateContent(req, res) {
  const result = await creatorStudioService.updateContent(
    req.user.id,
    req.params.id,
    req.body
  );
  res.json(result);
}

async function submit(req, res) {
  const result = await creatorStudioService.submitContent(req.user.id, req.params.id);
  res.json(result);
}

async function createBunnySlot(req, res) {
  const result = await creatorStudioService.createBunnySlot(req.user.id, req.body || {});
  res.status(201).json(result);
}

module.exports = {
  register,
  home,
  createContent,
  updateContent,
  submit,
  createBunnySlot,
};
