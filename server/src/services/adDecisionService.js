'use strict';

/**
 * Ad Decision — delega para Ad Platform.
 * Mantém contrato estável para o Watch Service.
 */
const adPlatformService = require('./adPlatformService');

async function decide({ contentId, monetization, userId, placement, contentGenre, device }) {
  return adPlatformService.decideAd({
    contentId,
    monetization,
    userId,
    placement: placement || 'pre_roll',
    contentGenre,
    device,
  });
}

module.exports = { decide };
