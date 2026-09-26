'use strict';

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    err.isOperational || status < 500
      ? err.message
      : 'Erro interno do servidor';

  logger.error('http.error', {
    requestId: req.requestId,
    status,
    code,
    message: err.message,
    path: req.path,
    method: req.method,
  });

  const payload = {
    error: true,
    code,
    message,
    requestId: req.requestId,
  };

  if (err.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}

module.exports = { errorHandler };
