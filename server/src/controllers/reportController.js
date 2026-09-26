'use strict';

const reportService = require('../services/reportService');

async function report(req, res) {
  const result = await reportService.reportContent(
    req.user.id,
    req.params.contentId,
    req.body,
    {
      profileId: req.headers['x-profile-id'] || req.body?.profileId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }
  );
  res.status(201).json(result);
}

async function listOpen(req, res) {
  const result = await reportService.listOpenReports(req.query.limit);
  res.json(result);
}

async function review(req, res) {
  const result = await reportService.reviewReport(
    req.user.id,
    req.params.reportId,
    req.body,
    { ip: req.ip, userAgent: req.get('user-agent') }
  );
  res.json(result);
}

module.exports = { report, listOpen, review };
