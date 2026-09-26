'use strict';

/** Valores monetários em Kwanza inteiros (sem floating point). */
function assertPositiveKz(amount) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Valor monetário inválido');
  }
  return value;
}

function formatKz(amount) {
  return `${Number(amount).toLocaleString('pt-AO')} Kz`;
}

module.exports = { assertPositiveKz, formatKz };
