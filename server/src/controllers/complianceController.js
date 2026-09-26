'use strict';

const complianceService = require('../services/complianceService');

async function privacy(req, res) {
  const result = await complianceService.getPrivacyOverview(req.user.id);
  res.json(result);
}

async function exportData(req, res) {
  const result = await complianceService.exportMyData(req.user.id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(result);
}

async function getExport(req, res) {
  const result = await complianceService.getExport(req.user.id, req.params.exportId);
  res.json(result);
}

async function requestDelete(req, res) {
  const result = await complianceService.requestAccountDeletion(
    req.user.id,
    { password: req.body?.password, confirm: req.body?.confirm },
    {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: req.user.sessionId,
    }
  );
  res.json(result);
}

async function cancelDelete(req, res) {
  const result = await complianceService.cancelAccountDeletion(req.user.id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(result);
}

module.exports = {
  privacy,
  exportData,
  getExport,
  requestDelete,
  cancelDelete,
};
