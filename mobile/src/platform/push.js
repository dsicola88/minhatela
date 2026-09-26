import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from '../services/plans';

/**
 * Registo best-effort de push.
 * Usa expo-notifications se existir; caso contrário, token de desenvolvimento.
 */
export async function ensurePushRegistration() {
  try {
    let Notifications;
    try {
      Notifications = require('expo-notifications');
    } catch {
      return { skipped: true, reason: 'expo-notifications-not-installed' };
    }

    if (Platform.OS === 'web') {
      return { skipped: true, reason: 'web' };
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { skipped: true, reason: 'permission-denied' };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse?.data;
    if (!token) return { skipped: true, reason: 'no-token' };

    await registerPushToken({ token, platform: Platform.OS });
    return { registered: true, token };
  } catch (err) {
    return { skipped: true, reason: err.message };
  }
}
