import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { colors, brand, layout } from '../theme/tokens';
import { forgotPassword } from '../services/auth';
import { t } from '../i18n/pt';

export default function ForgotPassword({ onBack, onDevToken }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const cardWidth = useMemo(() => Math.min(440, isCompact ? width - 32 : 440), [isCompact, width]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
      if (result.devResetToken) onDevToken?.(result);
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
      >
        <View style={{ width: cardWidth, maxWidth: layout.maxContentWidth }}>
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 2, marginBottom: 18 }}>
            {brand.name.toUpperCase()}
          </Text>
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopWidth: 3,
              borderTopColor: colors.gold,
              padding: isCompact ? 22 : 32,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: 8 }}>
              Recuperar acesso
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 22, lineHeight: 22 }}>
              Introduza o email da conta. Se existir, receberá um link seguro (válido 30 minutos).
            </Text>

            <FieldLabel>{t('email')}</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="nome@email.com"
              placeholderTextColor={colors.muted}
              style={inputStyle}
            />

            {error ? <Text style={{ color: colors.red, marginTop: 12 }}>{error}</Text> : null}
            {message ? <Text style={{ color: colors.success, marginTop: 12 }}>{message}</Text> : null}

            <PrimaryButton
              label={t('sendReset')}
              onPress={handleSubmit}
              loading={loading}
              variant="gold"
              style={{ marginTop: 20 }}
            />

            <Pressable onPress={onBack} style={{ marginTop: 22 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                {t('backToLogin')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#181818',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 4,
  color: colors.text,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
};
