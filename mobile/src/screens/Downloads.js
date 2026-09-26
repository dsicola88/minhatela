import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import {
  listDownloads,
  refreshDownloadLicense,
  revokeDownload,
} from '../services/downloads';
import Focusable from '../tv/Focusable';
import { EmptyState, ErrorState } from '../components/StateViews';

export default function Downloads({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [limits, setLimits] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await listDownloads();
      setItems(data.downloads || []);
      setLimits(data.limits || null);
    } catch (err) {
      setError(err.message || 'Falha ao carregar downloads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openLicense(item) {
    setBusyId(item.id);
    try {
      const data = await refreshDownloadLicense(item.id);
      const url = data?.playback?.downloadUrl;
      if (!url) throw new Error('URL de download indisponível');
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      setError(err.message || 'Falha ao renovar licença');
    } finally {
      setBusyId(null);
    }
  }

  async function removeLicense(item) {
    setBusyId(item.id);
    try {
      await revokeDownload(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err.message || 'Falha ao remover');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Focusable id="dl-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Downloads
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 64,
          }}
        >
          {limits ? (
            <Text style={{ color: colors.muted, marginBottom: 20, fontSize: 13 }}>
              {limits.active} / {limits.maxActive} activos · Plano{' '}
              {limits.plan === 'premium' ? 'Premium' : 'Gratuito'}
              {Platform.OS === 'web'
                ? ' · Em web o ficheiro abre no browser; no telemóvel fica disponível offline após descarregar.'
                : ' · Licença ligada a este dispositivo.'}
            </Text>
          ) : null}

          {error ? <ErrorState message={error} onRetry={load} /> : null}

          {!error && items.length === 0 ? (
            <EmptyState
              title="Sem downloads"
              subtitle="Na ficha do título, toque em Descarregar para ver offline (ideal Unitel/Movicel)."
            />
          ) : null}

          {items.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                gap: 14,
                marginBottom: 18,
                paddingBottom: 18,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Image
                source={{ uri: item.posterUrl }}
                style={{ width: 72, height: 108, borderRadius: 4, backgroundColor: '#111' }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {(item.quality || '').toUpperCase()} · expira{' '}
                  {item.expiresAt
                    ? new Date(item.expiresAt).toLocaleDateString('pt-AO')
                    : '—'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {item.playCount || 0} / {item.maxPlays || 0} reproduções · {item.deviceName}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                  <Pressable onPress={() => openLicense(item)} disabled={busyId === item.id}>
                    <Text style={{ color: colors.gold, fontWeight: '700' }}>
                      {busyId === item.id ? '…' : 'Abrir / renovar'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => removeLicense(item)} disabled={busyId === item.id}>
                    <Text style={{ color: colors.red, fontWeight: '600' }}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
