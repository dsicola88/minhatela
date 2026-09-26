import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import {
  fetchWatchHistory,
  clearWatchHistory,
  removeHistoryItem,
} from '../services/engagement';
import Focusable from '../tv/Focusable';

export default function History({ onBack, onPlay }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchWatchHistory();
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmClear() {
    const ok =
      Platform.OS === 'web'
        ? window.confirm('Limpar todo o histórico deste perfil?')
        : await new Promise((resolve) => {
            Alert.alert('Limpar histórico', 'Remover todas as visualizações deste perfil?', [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Limpar', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!ok) return;
    try {
      await clearWatchHistory();
      setItems([]);
    } catch (err) {
      setError(err.message || 'Falha ao limpar');
    }
  }

  async function removeItem(item) {
    try {
      await removeHistoryItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err.message || 'Falha ao remover');
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
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="history-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Histórico
        </Text>
        {items.length ? (
          <Pressable onPress={confirmClear}>
            <Text style={{ color: colors.gold, fontWeight: '600', fontSize: 13 }}>Limpar</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
            {brand.name.toUpperCase()}
          </Text>
        )}
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
          {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
          {!items.length ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
              Ainda não há visualizações neste perfil.
            </Text>
          ) : (
            items.map((item) => (
              <View
                key={`${item.id}-${item.watchedAt}`}
                style={{
                  flexDirection: 'row',
                  gap: 14,
                  marginBottom: 16,
                  alignItems: 'center',
                }}
              >
                <Focusable
                  id={`hist-${item.id}`}
                  onPress={() => onPlay?.(item)}
                  style={{ flexDirection: 'row', gap: 14, flex: 1, alignItems: 'center' }}
                >
                  <Image
                    source={{ uri: item.posterUrl || item.backdropUrl }}
                    style={{ width: 110, height: 62, borderRadius: 4, backgroundColor: '#111' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        marginTop: 8,
                        height: 3,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${item.progress?.percentage || 0}%`,
                          height: '100%',
                          backgroundColor: colors.red,
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                      {item.completed ? 'Concluído' : `${item.progress?.percentage || 0}%`} ·{' '}
                      {new Date(item.watchedAt).toLocaleDateString('pt-AO')}
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color={colors.text} />
                </Focusable>
                <Pressable onPress={() => removeItem(item)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
