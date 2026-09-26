import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { fetchGenre, fetchGenres } from '../services/browse';
import Focusable from '../tv/Focusable';
import { EmptyState, ErrorState } from '../components/StateViews';

export default function BrowseGenre({ genre: initialGenre, onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const cardWidth = isCompact ? (width - 48) / 2 : 160;
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState(initialGenre || '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGenres = useCallback(async () => {
    const data = await fetchGenres();
    const list = data.genres || [];
    setGenres(list);
    if (!genre && list[0]) setGenre(list[0].name);
    return list;
  }, [genre]);

  const loadItems = useCallback(async (name) => {
    if (!name) return;
    setLoading(true);
    try {
      setError('');
      const data = await fetchGenre(name);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar género');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await loadGenres();
        const name = initialGenre || list[0]?.name;
        if (name) {
          setGenre(name);
          await loadItems(name);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err.message || 'Falha ao carregar');
        setLoading(false);
      }
    })();
  }, [initialGenre, loadGenres, loadItems]);

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
        <Focusable id="browse-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          {genre || 'Géneros'}
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        {genres.map((g) => (
          <Focusable
            key={g.slug}
            id={`genre-${g.slug}`}
            onPress={() => {
              setGenre(g.name);
              loadItems(g.name);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: g.name === genre ? colors.gold : colors.border,
            }}
          >
            <Text
              style={{
                color: g.name === genre ? colors.gold : colors.textSecondary,
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {g.name}
            </Text>
          </Focusable>
        ))}
      </ScrollView>

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
          {error ? <ErrorState message={error} onRetry={() => loadItems(genre)} /> : null}
          {!error && !items.length ? (
            <View style={{ width: '100%' }}>
              <EmptyState title="Sem títulos" subtitle="Tente outro género." />
            </View>
          ) : null}
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect?.(item)}
              style={{ width: cardWidth }}
            >
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
          ))}
        </ScrollView>
      )}
    </View>
  );
}
