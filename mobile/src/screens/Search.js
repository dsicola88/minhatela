import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { searchContent, fetchFacets, suggestSearch } from '../services/discovery';
import { fetchTrendingSearches } from '../services/phase24';
import Focusable from '../tv/Focusable';

function Chip({ label, active, onPress, id }) {
  return (
    <Focusable
      id={id}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: active ? colors.text : colors.border,
        backgroundColor: active ? colors.text : 'transparent',
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: active ? colors.black : colors.textSecondary,
          fontWeight: '700',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Focusable>
  );
}

export default function Search({ onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [facets, setFacets] = useState({ kinds: [], monetization: [], genres: [] });
  const [kind, setKind] = useState(null);
  const [monetization, setMonetization] = useState(null);
  const [genre, setGenre] = useState(null);
  const [suggestions, setSuggestions] = useState({ titles: [], genres: [], creators: [] });
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    fetchFacets()
      .then(setFacets)
      .catch(() => {});
    fetchTrendingSearches()
      .then((r) => setTrending(r.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!q || q.trim().length < 1) {
      setSuggestions({ titles: [], genres: [], creators: [] });
      return undefined;
    }
    const timer = setTimeout(() => {
      suggestSearch(q.trim(), 6)
        .then(setSuggestions)
        .catch(() => setSuggestions({ titles: [], genres: [], creators: [] }));
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  const runSearch = useCallback(async (term, filters) => {
    const hasFilters = Boolean(filters.kind || filters.monetization || filters.genre);
    if ((!term || term.trim().length < 2) && !hasFilters) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await searchContent(term.trim(), filters);
      setResults(data.results || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Falha na pesquisa');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const filters = { kind, monetization, genre };
    const timer = setTimeout(() => runSearch(q, filters), 350);
    return () => clearTimeout(timer);
  }, [q, kind, monetization, genre, runSearch]);

  const cardWidth = isCompact ? (width - 48) / 2 : 200;
  const toggle = (current, value, setter) => setter(current === value ? null : value);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#181818',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Filmes, séries, criadores, géneros…"
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              color: colors.text,
              paddingVertical: 12,
              paddingHorizontal: 10,
              fontSize: 16,
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 12,
          alignItems: 'center',
        }}
        style={{ maxHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {(facets.kinds || []).map((item) => (
          <Chip
            key={item.id}
            id={`kind-${item.id}`}
            label={item.label}
            active={kind === item.id}
            onPress={() => toggle(kind, item.id, setKind)}
          />
        ))}
        {(facets.monetization || []).map((item) => (
          <Chip
            key={item.id}
            id={`mon-${item.id}`}
            label={item.label}
            active={monetization === item.id}
            onPress={() => toggle(monetization, item.id, setMonetization)}
          />
        ))}
        {(facets.genres || []).slice(0, 8).map((item) => (
          <Chip
            key={item.id}
            id={`genre-${item.id}`}
            label={item.label}
            active={genre === item.id}
            onPress={() => toggle(genre, item.id, setGenre)}
          />
        ))}
      </ScrollView>

      {!searched && !q && trending.length ? (
        <View
          style={{
            paddingHorizontal: isCompact ? 16 : 40,
            paddingVertical: 12,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text
            style={{
              color: colors.gold,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.2,
              marginBottom: 10,
            }}
          >
            PESQUISAS EM ALTA · ANGOLA
          </Text>
          {trending.map((item) => (
            <Pressable
              key={item.query}
              onPress={() => {
                setQ(item.query);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.red, fontWeight: '900', width: 24 }}>{item.rank}</Text>
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{item.query}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{item.count}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!searched && (suggestions.titles?.length || suggestions.genres?.length) ? (
        <View
          style={{
            paddingHorizontal: isCompact ? 16 : 40,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text
            style={{
              color: colors.gold,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.2,
              marginBottom: 10,
            }}
          >
            SUGESTÕES
          </Text>
          {(suggestions.titles || []).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect?.(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={{ width: 40, height: 56, borderRadius: 2, backgroundColor: '#111' }}
                />
              ) : (
                <View style={{ width: 40, height: 56, backgroundColor: '#111', borderRadius: 2 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {(item.kind || 'movie').toUpperCase()}
                  {item.releaseYear ? ` · ${item.releaseYear}` : ''}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
          {(suggestions.genres || []).map((g) => (
            <Pressable
              key={`g-${g.label}`}
              onPress={() => {
                setGenre(g.label);
                setQ('');
              }}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Género · <Text style={{ color: colors.gold, fontWeight: '700' }}>{g.label}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading ? <LoadingState label="A pesquisar…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => runSearch(q, { kind, monetization, genre })} /> : null}

      {!loading && searched && results.length === 0 ? (
        <EmptyState
          title="Sem resultados"
          subtitle="Ajuste os filtros ou tente outro termo."
        />
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 40,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {results.map((item) => (
          <Pressable key={item.id} onPress={() => onSelect?.(item)} style={{ width: cardWidth }}>
            <View
              style={{
                aspectRatio: 16 / 9,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: '#111111',
              }}
            >
              <Image
                source={{ uri: item.posterUrl || item.backdropUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              {item.badge ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    borderWidth: 1,
                    borderColor: colors.gold,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: colors.gold, fontSize: 9, fontWeight: '800' }}>
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              style={{ color: colors.text, marginTop: 8, fontWeight: '600', fontSize: 13 }}
            >
              {item.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {(item.kind === 'series' ? 'SÉRIE · ' : '') + (item.monetization || '').toUpperCase()}
              {item.genre ? ` · ${item.genre}` : ''}
              {item.releaseYear ? ` · ${item.releaseYear}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
