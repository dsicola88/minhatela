'use strict';

const watchPartyService = require('../services/watchPartyService');
const peopleFeedbackService = require('../services/peopleFeedbackService');

async function createParty(req, res) {
  const result = await watchPartyService.create(req.user.id, req.body, {
    profileId: req.headers['x-profile-id'] || req.body?.profileId,
  });
  res.status(201).json(result);
}

async function joinParty(req, res) {
  const result = await watchPartyService.join(
    req.user.id,
    req.body?.code || req.params.code,
    req.body,
    { profileId: req.headers['x-profile-id'] }
  );
  res.json(result);
}

async function partyState(req, res) {
  const result = await watchPartyService.state(req.user.id, req.params.roomId);
  res.json(result);
}

async function partySync(req, res) {
  const result = await watchPartyService.sync(req.user.id, req.params.roomId, req.body);
  res.json(result);
}

async function partyEnd(req, res) {
  const result = await watchPartyService.end(req.user.id, req.params.roomId);
  res.json(result);
}

async function partyLeave(req, res) {
  const result = await watchPartyService.leave(req.user.id, req.params.roomId);
  res.json(result);
}

async function person(req, res) {
  const result = await peopleFeedbackService.getPerson(req.params.slug);
  res.json(result);
}

async function cast(req, res) {
  const result = await peopleFeedbackService.castForContent(req.params.contentId);
  res.json(result);
}

async function chapters(req, res) {
  const result = await peopleFeedbackService.chaptersForContent(req.params.contentId);
  res.json(result);
}

async function feedback(req, res) {
  const result = await peopleFeedbackService.submitFeedback(req.user.id, req.body, {
    profileId: req.headers['x-profile-id'],
  });
  res.status(201).json(result);
}

async function stillChallenge(req, res) {
  const result = await peopleFeedbackService.challengeStillWatching(req.user.id, req.body);
  res.status(201).json(result);
}

async function stillConfirm(req, res) {
  const result = await peopleFeedbackService.confirmStillWatching(
    req.user.id,
    req.params.challengeId
  );
  res.json(result);
}

async function stillPending(req, res) {
  const result = await peopleFeedbackService.pendingStillWatching(
    req.user.id,
    req.query.sessionId
  );
  res.json(result);
}

module.exports = {
  createParty,
  joinParty,
  partyState,
  partySync,
  partyEnd,
  partyLeave,
  person,
  cast,
  chapters,
  feedback,
  stillChallenge,
  stillConfirm,
  stillPending,
};
