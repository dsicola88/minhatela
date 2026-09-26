'use strict';

class AppError extends Error {
  constructor(statusCode, message, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

function createError(statusCode, message, code = 'APP_ERROR', details = null) {
  return new AppError(statusCode, message, code, details);
}

module.exports = { AppError, createError };
