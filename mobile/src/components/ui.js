import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) {
  const variants = {
    primary: {
      backgroundColor: colors.red,
      borderColor: colors.red,
      textColor: colors.text,
    },
    secondary: {
      backgroundColor: 'rgba(109,109,110,0.7)',
      borderColor: 'transparent',
      textColor: colors.text,
    },
    light: {
      backgroundColor: colors.text,
      borderColor: colors.text,
      textColor: colors.black,
    },
    gold: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
      textColor: colors.black,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
      textColor: colors.text,
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
          borderColor: hovered ? colors.gold : theme.borderColor,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 4,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          minHeight: 48,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.textColor} />
      ) : (
        <Text style={{ color: theme.textColor, fontWeight: '700', fontSize: 15 }}>
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

export function FieldLabel({ children }) {
  return (
    <Text
      style={{
        color: colors.textSecondary,
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
