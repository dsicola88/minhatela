import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { fetchFavorites, removeFavorite } from '../services/discovery';
import Focusable from '../tv/Focusable';
import { EmptyState, ErrorState } from '../components/StateViews';

export default function MyList({ onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const cardWidth = isCompact ? (width - 48) / 2 : 180;

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchFavorites();
      setItems(data.favorites || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar a lista');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <Focusable id="mylist-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          A Minha Lista
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
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            paddingBottom: 64,
          }}
        >
          {error ? <ErrorState message={error} onRetry={load} /> : null}
          {!error && items.length === 0 ? (
            <View style={{ width: '100%' }}>
              <EmptyState
                title="Lista vazia"
                subtitle="Toque em «+ A Minha Lista» nos títulos que quer guardar."
              />
            </View>
          ) : null}
          {items.map((item) => (
            <View key={item.id} style={{ width: cardWidth }}>
              <Pressable onPress={() => onSelect?.(item)}>
                <View
                  style={{
                    aspectRatio: 2 / 3,
                    borderRadius: 4,
                    overflow: 'hidden',
                    backgroundColor: '#111',
                  }}
                >
                  <Image
                    source={{ uri: item.posterUrl || item.backdropUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                <Text numberOfLines={2} style={{ color: colors.text, marginTop: 8, fontWeight: '600' }}>
                  {item.title}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await removeFavorite(item.id);
                  setItems((prev) => prev.filter((x) => x.id !== item.id));
                }}
                style={{ marginTop: 6 }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>Remover</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
