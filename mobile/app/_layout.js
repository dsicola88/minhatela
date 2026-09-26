import '../global.css';
import '../src/theme/web.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { LanguageProvider } from '../src/i18n';
import { FocusProvider } from '../src/tv/FocusContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useDeviceProfile } from '../src/platform/device';

function AppShell() {
  const { remoteFriendly } = useDeviceProfile();
  const { themeId, colors, statusBarStyle } = useTheme();

  return (
    <FocusProvider enabled={remoteFriendly}>
      <StatusBar style={statusBarStyle} />
      <Stack
        key={themeId}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.black },
          animation: 'fade',
        }}
      />
    </FocusProvider>
  );
}

function ThemedRoot() {
  const { colors } = useTheme();
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

export default function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark">
      <ThemedRoot />
    </ThemeProvider>
  );
}
