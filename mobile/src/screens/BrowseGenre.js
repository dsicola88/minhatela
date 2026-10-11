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
import { ThemedStatusBar } from '../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { fetchGenres } from '../services/browse';
import { searchContent, fetchFacets } from '../services/discovery';
import Focusable from '../tv/Focusable';
import { EmptyState, ErrorState } from '../components/StateViews';
import { titleMeta } from './catalogLabels';

export default function BrowseGenre({ genre: initialGenre, onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const cardWidth = isCompact ? (width - 48) / 2 : 160;
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState(initialGenre || '');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('added');
  const [sorts, setSorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGenres = useCallback(async () => {
    const data = await fetchGenres();
    const list = data.genres || [];
    setGenres(list);
    setGenre((current) => current || list[0]?.name || '');
    return list;
  }, []);

  const loadItems = useCallback(async (name, nextSort, offset, append) => {
    if (!name) return;
    if (!append) setLoading(true);
    try {
      setError('');
      const data = await searchContent('', {
        genre: name,
        sort: nextSort || 'added',
        limit: 24,
        offset: offset || 0,
      });
      const page = data.results || [];
      setItems((current) => (append ? [...current, ...page] : page));
      setTotal(Number(data.total ?? page.length));
    } catch (err) {
      setError(err.message || 'Falha ao carregar género');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list] = await Promise.all([
          loadGenres(),
          fetchFacets().then((data) => setSorts((data.sorts || []).filter((item) => item.id !== 'relevance'))).catch(() => {}),
        ]);
        const name = initialGenre || list[0]?.name;
        if (name) {
          setGenre(name);
          await loadItems(name, 'added', 0, false);
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
      <ThemedStatusBar />
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
              setSort('added');
              loadItems(g.name, 'added', 0, false);
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: isCompact ? 16 : 40, paddingBottom: 8 }}>
        {sorts.map((item) => (
          <Focusable
            key={item.id}
            id={`browse-sort-${item.id}`}
            onPress={() => {
              setSort(item.id);
              loadItems(genre, item.id, 0, false);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginRight: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: sort === item.id ? colors.text : colors.border,
              backgroundColor: sort === item.id ? colors.text : 'transparent',
            }}
          >
            <Text style={{ color: sort === item.id ? colors.black : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{item.label}</Text>
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
          {error ? <ErrorState message={error} onRetry={() => loadItems(genre, sort, 0, false)} /> : null}
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
              <Text numberOfLines={2} style={{ color: colors.text, marginTop: 8, fontWeight: '700' }}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                {titleMeta(item)}
              </Text>
            </Pressable>
          ))}
          {items.length < total ? (
            <Pressable onPress={() => loadItems(genre, sort, items.length, true)} style={{ width: '100%', alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Mostrar mais</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
