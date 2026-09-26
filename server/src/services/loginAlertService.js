'use strict';

const forYouRepository = require('../repositories/forYouRepository');
const featureFlagService = require('./featureFlagService');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const { logger } = require('../utils/logger');

/**
 * Dispara alerta de novo login se parecer dispositivo/sessão nova.
 */
async function maybeAlertNewLogin(user, session, meta = {}) {
  try {
    await featureFlagService.assertEnabled('login_alerts_enabled');
  } catch {
    return null;
  }

  // Preferência por perfil principal — se algum perfil tem login_alerts=false, respeitar via user default
  // Aqui usamos default TRUE; perfil flag é apply no account update
  const recent = await forYouRepository.recentLoginAlert(user.id, 1);
  const sameDevice = recent.some(
    (a) =>
      a.device_name === (meta.deviceName || null) &&
      a.platform === (meta.platform || null) &&
      a.ip === (meta.ip || null)
  );
  if (sameDevice) return null;

  const known = await forYouRepository.countKnownDevices(user.id);
  // Primeiro login / única sessão → sem alerta (onboarding)
  if (known <= 1 && recent.length === 0) {
    const alert = await forYouRepository.createLoginAlert({
      userId: user.id,
      sessionId: session?.id,
      deviceName: meta.deviceName,
      platform: meta.platform,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await forYouRepository.markAlertNotified(alert.id);
    return { alert, skipped: 'first_device' };
  }

  const alert = await forYouRepository.createLoginAlert({
    userId: user.id,
    sessionId: session?.id,
    deviceName: meta.deviceName,
    platform: meta.platform,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const where = [meta.deviceName, meta.platform, meta.ip].filter(Boolean).join(' · ') || 'dispositivo desconhecido';

  try {
    await notificationService.notify({
      userId: user.id,
      type: 'security',
      title: 'Novo início de sessão',
      body: `Detectámos um login na MinhaTela: ${where}. Se não foi você, altere a palavra-passe.`,
    });
  } catch (err) {
    logger.warn('login_alert.notify_failed', { message: err.message });
  }

  try {
    await emailService.sendTransactional({
      to: user.email,
      subject: 'Novo login · MinhaTela',
      text: `Olá. Detectámos um novo início de sessão na sua conta MinhaTela (${where}). Se não reconhece, altere a palavra-passe imediatamente na Conta.`,
      template: 'login_alert',
      meta: { where, deviceName: meta.deviceName, platform: meta.platform, ip: meta.ip },
    });
  } catch (err) {
    logger.warn('login_alert.email_failed', { message: err.message });
  }

  await forYouRepository.markAlertNotified(alert.id);
  return { alert, notified: true };
}

module.exports = { maybeAlertNewLogin };
