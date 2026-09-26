'use strict';

const accountService = require('../services/accountService');
const deviceStreamService = require('../services/deviceStreamService');

async function getAccount(req, res) {
  const result = await accountService.getAccount(req.user.id);
  res.json(result);
}

async function listDevices(req, res) {
  const result = await deviceStreamService.listDevices(req.user.id);
  if (Array.isArray(result)) {
    return res.json({ devices: result });
  }
  res.json(result);
}

async function trustDevice(req, res) {
  const result = await require('../services/phase24Service').setDeviceTrusted(
    req.user.id,
    req.params.deviceId,
    req.body.trusted !== false,
    { ip: req.ip }
  );
  res.json(result);
}

async function renameDevice(req, res) {
  const result = await require('../services/phase24Service').renameDevice(
    req.user.id,
    req.params.deviceId,
    req.body.name || req.body.deviceName,
    { ip: req.ip }
  );
  res.json(result);
}

async function revokeDevice(req, res) {
  const result = await deviceStreamService.revokeDevice(req.user.id, req.params.deviceId);
  res.json(result);
}

async function streamStatus(req, res) {
  const result = await deviceStreamService.streamStatus(req.user.id);
  res.json(result);
}

async function listProfiles(req, res) {
  const result = await accountService.listProfiles(req.user.id);
  res.json(result);
}

async function createProfile(req, res) {
  const result = await accountService.createProfile(req.user.id, req.body);
  res.status(201).json(result);
}

async function updateProfile(req, res) {
  const result = await accountService.updateProfile(
    req.user.id,
    req.params.profileId,
    req.body
  );
  res.json(result);
}

async function deleteProfile(req, res) {
  const result = await accountService.deleteProfile(req.user.id, req.params.profileId);
  res.json(result);
}

async function unlockProfile(req, res) {
  const result = await accountService.unlockProfile(
    req.user.id,
    req.params.profileId,
    req.body.pin
  );
  res.json(result);
}

module.exports = {
  getAccount,
  listDevices,
  trustDevice,
  renameDevice,
  revokeDevice,
  streamStatus,
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  unlockProfile,
};
