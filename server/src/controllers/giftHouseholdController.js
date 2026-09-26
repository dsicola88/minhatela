'use strict';

const giftService = require('../services/giftService');
const householdService = require('../services/householdService');
const premiereService = require('../services/premiereService');
const recommendationService = require('../services/recommendationService');

async function purchaseGift(req, res) {
  const result = await giftService.purchase(req.user.id, req.body, { ip: req.ip });
  res.status(201).json(result);
}

async function redeemGift(req, res) {
  const result = await giftService.redeem(
    req.user.id,
    req.body.code || req.body.giftCode,
    { ip: req.ip }
  );
  res.json(result);
}

async function myGifts(req, res) {
  const result = await giftService.myGifts(req.user.id);
  res.json(result);
}

async function householdMine(req, res) {
  const result = await householdService.getMine(req.user.id);
  res.json(result);
}

async function householdCreate(req, res) {
  const result = await householdService.create(req.user.id, { ip: req.ip });
  res.status(201).json(result);
}

async function householdInvite(req, res) {
  const result = await householdService.invite(req.user.id, req.body, { ip: req.ip });
  res.status(201).json(result);
}

async function householdAccept(req, res) {
  const result = await householdService.accept(
    req.user.id,
    req.body.code || req.body.inviteCode,
    { ip: req.ip }
  );
  res.json(result);
}

async function householdRemove(req, res) {
  const result = await householdService.remove(req.user.id, req.params.userId, {
    ip: req.ip,
  });
  res.json(result);
}

async function householdLeave(req, res) {
  const result = await householdService.leaveHousehold(req.user.id, { ip: req.ip });
  res.json(result);
}

async function premieres(req, res) {
  const result = await premiereService.list(req.user?.id);
  res.json(result);
}

async function premiereBySlug(req, res) {
  const result = await premiereService.getBySlug(req.params.slug, req.user?.id);
  res.json(result);
}

async function premiereRemind(req, res) {
  const result = await premiereService.remind(
    req.user.id,
    req.params.eventId,
    req.headers['x-profile-id'] || req.body?.profileId,
    { ip: req.ip }
  );
  res.json(result);
}

async function premiereUnremind(req, res) {
  const result = await premiereService.unremind(req.user.id, req.params.eventId);
  res.json(result);
}

async function moreLikeThis(req, res) {
  const result = await recommendationService.moreLikeThis(req.params.contentId, {
    profileId: req.headers['x-profile-id'],
    limit: Number(req.query.limit) || 12,
  });
  res.json(result);
}

module.exports = {
  purchaseGift,
  redeemGift,
  myGifts,
  householdMine,
  householdCreate,
  householdInvite,
  householdAccept,
  householdRemove,
  householdLeave,
  premieres,
  premiereBySlug,
  premiereRemind,
  premiereUnremind,
  moreLikeThis,
};
