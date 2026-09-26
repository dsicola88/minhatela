import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../src/theme/tokens';
import { PrimaryButton } from '../src/components/ui';
import { verifyEmail } from '../src/services/plans';

export default function VerifyEmailRoute() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setMessage('Link inválido');
        setLoading(false);
        return;
      }
      try {
        const res = await verifyEmail(String(token));
        if (!mounted) return;
        setOk(true);
        setMessage(res.message || 'Email confirmado');
      } catch (err) {
        if (!mounted) return;
        setMessage(err.message || 'Falha na verificação');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <StatusBar style="light" />
      {loading ? (
        <ActivityIndicator color={colors.red} size="large" />
      ) : (
        <>
          <Text
            style={{
              color: ok ? colors.gold : colors.red,
              fontSize: 20,
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {ok ? 'Email confirmado' : 'Verificação falhou'}
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 28 }}>
            {message}
          </Text>
          <PrimaryButton
            label="Continuar"
            variant="light"
            onPress={() => router.replace(ok ? '/home' : '/login')}
          />
        </>
      )}
    </View>
  );
}
