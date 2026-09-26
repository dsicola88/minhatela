'use strict';

const authService = require('../services/authService');

function deviceMeta(req) {
  return {
    deviceName: req.headers['x-device-name'] || req.body?.deviceName || 'Dispositivo',
    platform: req.headers['x-device-platform'] || req.body?.platform || 'unknown',
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
}

async function register(req, res) {
  const result = await authService.register(req.body, deviceMeta(req));
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.body, deviceMeta(req));
  res.json(result);
}

async function refresh(req, res) {
  const result = await authService.refresh({
    refreshToken: req.body.refreshToken,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(result);
}

async function logout(req, res) {
  const result = await authService.logout(req.user?.sessionId, req.user?.id);
  res.json(result);
}

async function sessions(req, res) {
  const result = await authService.listSessions(req.user.id, req.user.sessionId);
  res.json(result);
}

async function revokeSession(req, res) {
  const result = await authService.revokeSession(req.user.id, req.params.sessionId);
  res.json(result);
}

async function revokeOthers(req, res) {
  const result = await authService.revokeOtherSessions(req.user.id, req.user.sessionId);
  res.json(result);
}

async function me(req, res) {
  const user = await authService.me(req.user.id);
  res.json(user);
}

async function profiles(req, res) {
  const result = await authService.listProfiles(req.user.id);
  res.json(result);
}

async function forgotPassword(req, res) {
  const result = await authService.requestPasswordReset({
    email: req.body.email,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    appBaseUrl: req.body.appBaseUrl,
  });
  res.json(result);
}

async function resetPassword(req, res) {
  const result = await authService.resetPassword({
    token: req.body.token,
    password: req.body.password,
  });
  res.json(result);
}

async function changePassword(req, res) {
  const result = await authService.changePassword(
    req.user.id,
    {
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword || req.body.password,
    },
    req.user.sessionId
  );
  res.json(result);
}

async function verifyEmail(req, res) {
  const result = await authService.verifyEmail({
    token: req.body.token || req.query.token,
  });
  res.json(result);
}

async function resendVerification(req, res) {
  const result = await authService.resendVerification(req.user.id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(result);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  sessions,
  revokeSession,
  revokeOthers,
  me,
  profiles,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
};
