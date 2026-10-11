'use strict';

/** Livro do estúdio. Reversões são valores positivos que reduzem o líquido. */
function settleLedger(entries = [], payouts = []) {
  let creditsKz = 0;
  let reversalsKz = 0;
  for (const entry of entries) {
    const amount = Number(entry.amountKz ?? entry.amount_kz) || 0;
    if (amount < 0) {
      return { error: 'NEGATIVE_LINE' };
    }
    if (entry.source === 'reversal') reversalsKz += amount;
    else creditsKz += amount;
  }
  const netKz = creditsKz - reversalsKz;
  let reservedOrPaidKz = 0;
  let paidKz = 0;
  let pendingKz = 0;
  let rejectedKz = 0;
  for (const payout of payouts) {
    const amount = Number(payout.amountKz ?? payout.amount_kz) || 0;
    if (payout.status === 'pending') {
      pendingKz += amount;
      reservedOrPaidKz += amount;
    } else if (payout.status === 'paid') {
      paidKz += amount;
      reservedOrPaidKz += amount;
    } else if (payout.status === 'rejected') {
      rejectedKz += amount;
    }
  }
  return {
    creditsKz,
    reversalsKz,
    netKz,
    pendingKz,
    paidKz,
    rejectedKz,
    reservedOrPaidKz,
    availableKz: Math.max(0, netKz - reservedOrPaidKz),
    deficitKz: Math.max(0, reservedOrPaidKz - netKz),
  };
}

function claimTrace(store, key) {
  if (!key || store.has(key)) return false;
  store.add(key);
  return true;
}

function forCreator(entries, creatorId) {
  return entries.filter((entry) => entry.creatorId === creatorId);
}

module.exports = { settleLedger, claimTrace, forCreator };
