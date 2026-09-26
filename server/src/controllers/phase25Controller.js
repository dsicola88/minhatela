'use strict';

const phase25Service = require('../services/phase25Service');

async function paymentRisk(req, res) {
  const minScore = Number(req.query.minScore) || 40;
  const result = await phase25Service.adminPaymentRisk({ minScore });
  res.json(result);
}

async function encodingQueue(req, res) {
  const result = await phase25Service.adminEncodingQueue(req.query);
  res.json(result);
}

async function encodingUpdate(req, res) {
  const result = await phase25Service.adminUpdateEncoding(req.params.contentId, req.body);
  res.json(result);
}

async function scrub(req, res) {
  const contentId = req.params.contentId || req.params.id;
  const result = await phase25Service.getScrub(contentId);
  res.json(result);
}

async function oauthGoogle(req, res) {
  const meta = {
    deviceName: req.headers['x-device-name'] || req.body?.deviceName || 'Dispositivo',
    platform: req.headers['x-device-platform'] || req.body?.platform || 'unknown',
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
  const result = await phase25Service.oauthLogin('google', req.body, meta);
  res.json(result);
}

async function oauthApple(req, res) {
  const meta = {
    deviceName: req.headers['x-device-name'] || req.body?.deviceName || 'Dispositivo',
    platform: req.headers['x-device-platform'] || req.body?.platform || 'unknown',
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
  const result = await phase25Service.oauthLogin('apple', req.body, meta);
  res.json(result);
}

module.exports = {
  paymentRisk,
  encodingQueue,
  encodingUpdate,
  scrub,
  oauthGoogle,
  oauthApple,
};
