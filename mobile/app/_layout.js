import '../global.css';
import '../src/theme/web.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { LanguageProvider } from '../src/i18n';
import { FocusProvider } from '../src/tv/FocusContext';
import { useDeviceProfile } from '../src/platform/device';
import { colors } from '../src/theme/tokens';

function AppShell() {
  const { remoteFriendly } = useDeviceProfile();

  return (
    <FocusProvider enabled={remoteFriendly}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.black },
          animation: 'fade',
        }}
      />
    </FocusProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black }}>
      <SafeAreaProvider>
        <LanguageProvider defaultLocale="pt">
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
