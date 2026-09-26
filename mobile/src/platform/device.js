import { Platform, useWindowDimensions } from 'react-native';

/**
 * Detecção de dispositivo para UX híbrida (Mobile / Desktop / Smart TV).
 * Android TV / Fire TV reportam tipicamente uiMode=television via Platform constants.
 */
export function getDeviceProfile(width) {
  const isWeb = Platform.OS === 'web';
  const uiMode = Platform.constants?.uiMode || Platform.constants?.UIManager?.uiMode;
  const isAndroidTv =
    Platform.OS === 'android' &&
    (String(uiMode || '').toLowerCase().includes('television') ||
      Platform.isTV === true);

  const isLargeScreen = (width || 0) >= 1280;
  const isTV = Boolean(isAndroidTv || Platform.isTV || (isWeb && isLargeScreen && isTvUserAgent()));

  return {
    isWeb,
    isTV,
    isMobile: !isWeb && !isTV && (Platform.OS === 'ios' || Platform.OS === 'android'),
    isDesktopWeb: isWeb && !isTV && (width || 0) >= 1024,
    focusScale: isTV ? 1.08 : 1.04,
    cardMinWidth: isTV ? 320 : undefined,
    navFontSize: isTV ? 22 : undefined,
    remoteFriendly: isTV || isWeb,
  };
}

function isTvUserAgent() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /TV|SmartTV|AppleTV|BRAVIA|Web0S|Tizen|CrKey/i.test(ua);
}

export function useDeviceProfile() {
  const { width, height } = useWindowDimensions();
  return { ...getDeviceProfile(width), width, height };
}
