import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../theme/tokens';
import { t } from '../i18n/pt';

export function LoadingState({ label = t('loading') }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ActivityIndicator color={colors.red} size="large" />
      <Text style={{ color: colors.muted, marginTop: 14 }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <Text style={{ color: colors.red, textAlign: 'center', marginBottom: 16 }}>
        {message || t('errorGeneric')}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>Tentar novamente</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonCard({ width = 280 }) {
  return (
    <View
      style={{
        width,
        aspectRatio: 16 / 9,
        borderRadius: 4,
        backgroundColor: colors.elevated,
        marginRight: 10,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: 1, backgroundColor: '#1a1a1a' }} />
      <View style={{ height: 3, backgroundColor: colors.red, width: '35%', opacity: 0.35 }} />
    </View>
  );
}
