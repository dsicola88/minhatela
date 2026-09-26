import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../theme/tokens';
import { PrimaryButton } from '../components/ui';
import { getApiBaseUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Focusable from '../tv/Focusable';

export default function TitleShareScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated, ready } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/catalog/share/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Título não encontrado');
        if (mounted) setCard(data);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.red, marginBottom: 16 }}>{error}</Text>
          <PrimaryButton label="Ir para Home" onPress={() => router.replace('/home')} />
        </View>
      ) : (
        <ImageBackground
          source={{ uri: card.backdropUrl || card.posterUrl }}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)', colors.black]}
            style={{
              padding: width < 768 ? 24 : 48,
              paddingBottom: 64,
            }}
          >
            <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }}>
              MINHATELA
            </Text>
            <Text style={{ color: colors.text, fontSize: width < 768 ? 32 : 48, fontWeight: '800' }}>
              {card.title}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16, lineHeight: 24, maxWidth: 560 }}>
              {card.synopsis}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>
              {(card.kind === 'series' ? 'SÉRIE · ' : '') + (card.monetization || '').toUpperCase()}
              {card.releaseYear ? ` · ${card.releaseYear}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              {isAuthenticated ? (
                <PrimaryButton
                  label="Assistir / Detalhes"
                  variant="light"
                  onPress={() => router.replace('/home')}
                />
              ) : (
                <PrimaryButton
                  label="Entrar para assistir"
                  variant="light"
                  onPress={() => router.push('/login')}
                />
              )}
              <Focusable
                id="share-copy"
                onPress={async () => {
                  const url = card.shareUrl;
                  if (Platform.OS === 'web' && navigator?.clipboard) {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="link" size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {copied ? 'Copiado' : 'Copiar link'}
                </Text>
              </Focusable>
            </View>
          </LinearGradient>
        </ImageBackground>
      )}
    </View>
  );
}
