import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export function ThemedStatusBar() {
  const { statusBarStyle } = useTheme();
  return <StatusBar style={statusBarStyle} />;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  compact = false,
  style,
  palette,
}) {
  const p = palette || colors;
  const isLightTheme = p.id === 'light';
  const variants = {
    primary: {
      backgroundColor: p.red,
      borderColor: p.red,
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: isLightTheme ? 'rgba(24,24,27,0.08)' : 'rgba(109,109,110,0.7)',
      borderColor: 'transparent',
      textColor: p.text,
    },
    light: {
      backgroundColor: isLightTheme ? '#18181B' : '#FFFFFF',
      borderColor: isLightTheme ? '#18181B' : '#FFFFFF',
      textColor: isLightTheme ? '#FFFFFF' : '#000000',
    },
    gold: {
      backgroundColor: p.gold,
      borderColor: p.gold,
      textColor: '#000000',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: p.border,
      textColor: p.text,
    },
  };

  const theme = variants[variant] || variants.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }) => [
        {
          backgroundColor: theme.backgroundColor,
          borderWidth: 1,
          borderColor: hovered ? p.gold : theme.borderColor,
          paddingVertical: compact ? 8 : 14,
          paddingHorizontal: compact ? 12 : 18,
          borderRadius: compact ? 6 : 4,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          minHeight: compact ? 36 : 48,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.textColor} />
      ) : (
        <Text style={{ color: theme.textColor, fontWeight: '700', fontSize: compact ? 13 : 15 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ScreenShell({ children, style }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.black }, style]}>
      {children}
    </View>
  );
}

export function GoogleSignInButton({ onPress, disabled = false, loading = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Continuar com Google"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DADCE0',
        borderRadius: 4,
        minHeight: 48,
        paddingHorizontal: 18,
        opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={{ color: '#1F1F1F', fontWeight: '700', fontSize: 15 }}>
            Continuar com Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Lido na renderização, para o tema claro e o escuro não ficarem congelados. */
export function cardSurface(extra) {
  return {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...extra,
  };
}

export function fieldSurface(extra) {
  return {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    ...extra,
  };
}

export function FieldLabel({ children, palette }) {
  const p = palette || colors;
  return (
    <Text
      style={{
        color: p.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </Text>
  );
}
