'use strict';

const analyticsService = require('../services/analyticsService');

async function ingest(req, res) {
  const result = await analyticsService.ingest(req.user.id, req.body);
  res.status(202).json(result);
}

module.exports = { ingest };
