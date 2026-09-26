'use strict';

const { createError } = require('../utils/errors');

function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length) {
    throw createError(
      400,
      `Campos obrigatórios em falta: ${missing.join(', ')}`,
      'VALIDATION',
      { missing }
    );
  }
}

module.exports = { requireFields };
