'use strict';

const MIN_PAYOUT_KZ = 5000;
const EDITABLE_WORKFLOW = new Set(['draft', 'rejected']);
const BLOCKED_ENCODING = new Set(['processing', 'encoding', 'queued', 'error', 'failed']);

function canEditContent(status) {
  return EDITABLE_WORKFLOW.has(status);
}

function payoutRefusal(amountKz, availableKz) {
  const amount = Number(amountKz);
  if (!Number.isInteger(amount) || amount <= 0) return 'VALIDATION';
  if (amount < MIN_PAYOUT_KZ) return 'MIN_PAYOUT';
  if (amount > Number(availableKz)) return 'INSUFFICIENT_BALANCE';
  return null;
}

function rightsConfirmed(body) {
  return body?.rightsConfirmed === true;
}

function encodingBlocksPublish(status) {
  return BLOCKED_ENCODING.has(String(status || '').toLowerCase());
}

function periodDays(period) {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return null;
}

module.exports = {
  MIN_PAYOUT_KZ,
  canEditContent,
  payoutRefusal,
  rightsConfirmed,
  encodingBlocksPublish,
  periodDays,
};
