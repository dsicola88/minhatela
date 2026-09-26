import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import { LoadingState, ErrorState } from '../components/StateViews';
import Focusable from '../tv/Focusable';
import { runNetworkDiagnostics } from '../services/phase23';
import { getDataSaver } from '../platform/preferences';

export default function NetworkDiagnostics({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const t0 = Date.now();
      const dataSaver = await getDataSaver();
      let effectiveType;
      let downlink;
      let rtt;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.connection) {
        effectiveType = navigator.connection.effectiveType;
        downlink = navigator.connection.downlink
          ? Math.round(navigator.connection.downlink * 1000)
          : undefined;
        rtt = navigator.connection.rtt;
      }
      const clientLatency = Date.now() - t0;
      const res = await runNetworkDiagnostics({
        latencyMs: clientLatency + (rtt || 0),
        downlinkKbps: downlink,
        effectiveType,
        dataSaver,
        platform: Platform.OS,
        saveData: Boolean(navigator?.connection?.saveData),
      });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Falha no diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Focusable id="net-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
          Diagnóstico de rede
        </Text>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={run} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={run} tintColor={colors.gold} />}
        >
          <Text style={{ color: colors.textSecondary, marginBottom: 24, lineHeight: 22 }}>
            Teste optimizado para Unitel / Movicel · recomenda qualidade antes de assistir.
          </Text>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.gold,
              borderRadius: 8,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>QUALIDADE RECOMENDADA</Text>
            <Text style={{ color: colors.gold, fontSize: 36, fontWeight: '900' }}>
              {result?.recommendedQuality || 'auto'}
            </Text>
            {result?.carrierHint ? (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                Rede: {result.carrierHint}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: width > 500 ? 'row' : 'column', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Latência</Text>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                {result?.latencyMs ?? '—'} ms
              </Text>
            </View>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Downlink</Text>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                {result?.downlinkKbps != null ? `${result.downlinkKbps} kbps` : '—'}
              </Text>
            </View>
          </View>

          {(result?.tips || []).map((tip) => (
            <Text key={tip} style={{ color: colors.textSecondary, marginBottom: 10, lineHeight: 20 }}>
              · {tip}
            </Text>
          ))}

          <Pressable
            onPress={run}
            style={{
              marginTop: 24,
              backgroundColor: colors.red,
              paddingVertical: 14,
              alignItems: 'center',
              borderRadius: 4,
              maxWidth: 280,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>Repetir teste</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
