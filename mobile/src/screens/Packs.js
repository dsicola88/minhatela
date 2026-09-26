import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { listPacks } from '../services/phase26';

export default function Packs({ onBack, onCheckout }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await listPacks();
      setPacks(data.packs || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.red} />}
        contentContainerStyle={{
          padding: isCompact ? 16 : 40,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 64,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
          Packs TVOD
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 24 }}>
          Bundles com vários títulos · um comprovativo · acesso por horas após confirmação.
        </Text>

        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {packs.length === 0 ? (
          <EmptyState title="Sem packs activos" subtitle="Em breve novas curadorias MinhaTela." />
        ) : (
          packs.map((pack) => (
            <View
              key={pack.id}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                backgroundColor: '#111',
              }}
            >
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>
                {pack.rentalHours}h · PACK
              </Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{pack.title}</Text>
              {pack.description ? (
                <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{pack.description}</Text>
              ) : null}
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 12 }}>
                {Number(pack.priceKz).toLocaleString('pt-AO')} Kz
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
                {(pack.items || []).map((item) => (
                  <View key={item.id} style={{ marginRight: 10, width: 72 }}>
                    {item.posterUrl ? (
                      <Image
                        source={{ uri: item.posterUrl }}
                        style={{ width: 72, height: 108, borderRadius: 4, backgroundColor: '#181818' }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 72,
                          height: 108,
                          borderRadius: 4,
                          backgroundColor: '#181818',
                        }}
                      />
                    )}
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                      {item.title}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => onCheckout?.(pack)}
                style={{
                  marginTop: 16,
                  backgroundColor: colors.red,
                  paddingVertical: 12,
                  borderRadius: 4,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Comprar pack</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
