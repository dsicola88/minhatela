'use strict';

const notificationService = require('../services/notificationService');
const engagementService = require('../services/engagementService');
const paymentService = require('../services/paymentService');

async function listNotifications(req, res) {
  const result = await notificationService.list(req.user.id, {
    limit: req.query.limit,
    unreadOnly: req.query.unread === '1',
  });
  res.json(result);
}

async function unread(req, res) {
  const result = await notificationService.unreadCount(req.user.id);
  res.json(result);
}

async function markRead(req, res) {
  const result = await notificationService.markRead(req.user.id, req.params.id);
  res.json(result);
}

async function markAllRead(req, res) {
  const result = await notificationService.markAllRead(req.user.id);
  res.json(result);
}

async function watchHistory(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await engagementService.getWatchHistory(req.user.id, profileId);
  res.json(result);
}

async function clearHistory(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId || null;
  const result = await engagementService.clearHistory(req.user.id, profileId);
  res.json(result);
}

async function removeHistoryItem(req, res) {
  const profileId = req.headers['x-profile-id'] || req.query.profileId || null;
  const result = await engagementService.removeHistoryItem(
    req.user.id,
    profileId,
    req.params.contentId
  );
  res.json(result);
}

async function hideContinueItem(req, res) {
  const profileId = req.headers['x-profile-id'] || req.body.profileId || null;
  const result = await engagementService.hideContinueItem(
    req.user.id,
    profileId,
    req.params.contentId
  );
  res.json(result);
}

async function myPayments(req, res) {
  const result = await paymentService.listMyTransactions(req.user.id);
  res.json(result);
}

module.exports = {
  listNotifications,
  unread,
  markRead,
  markAllRead,
  watchHistory,
  clearHistory,
  removeHistoryItem,
  hideContinueItem,
  myPayments,
};
