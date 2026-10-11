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
import { titleMeta } from './catalogLabels';

const PAGE = 24;

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
        marginBottom: 8,
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

function Group({ title, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

export default function Search({ onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [facets, setFacets] = useState({
    kinds: [],
    monetization: [],
    genres: [],
    years: [],
    creators: [],
    subtitles: [],
    sorts: [],
  });
  const [kind, setKind] = useState(null);
  const [monetization, setMonetization] = useState(null);
  const [genre, setGenre] = useState(null);
  const [year, setYear] = useState(null);
  const [creator, setCreator] = useState(null);
  const [subtitle, setSubtitle] = useState(null);
  const [sort, setSort] = useState('relevance');
  const [suggestions, setSuggestions] = useState({ titles: [], genres: [], creators: [], people: [] });
  const [trending, setTrending] = useState([]);

  const filters = { kind, monetization, genre, year, creator, subtitle, sort };
  const activeCount = [kind, monetization, genre, year, creator, subtitle].filter(Boolean).length;

  useEffect(() => {
    fetchFacets()
      .then((data) => setFacets((current) => ({ ...current, ...data })))
      .catch(() => {});
    fetchTrendingSearches()
      .then((r) => setTrending(r.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!q || q.trim().length < 1) {
      setSuggestions({ titles: [], genres: [], creators: [], people: [] });
      return undefined;
    }
    const timer = setTimeout(() => {
      suggestSearch(q.trim(), 8)
        .then((data) => setSuggestions({ people: [], creators: [], genres: [], titles: [], ...data }))
        .catch(() => setSuggestions({ titles: [], genres: [], creators: [], people: [] }));
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  const runSearch = useCallback(async (term, nextFilters, offset, append) => {
    const hasFilters = Boolean(
      nextFilters.kind || nextFilters.monetization || nextFilters.genre || nextFilters.year || nextFilters.creator || nextFilters.subtitle
    );
    if ((!term || term.trim().length < 2) && !hasFilters) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const data = await searchContent(term.trim(), { ...nextFilters, limit: PAGE, offset });
      const page = data.results || [];
      setResults((current) => (append ? [...current, ...page] : page));
      setTotal(Number(data.total ?? page.length));
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Falha na pesquisa');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(q, filters, 0, false), 350);
    return () => clearTimeout(timer);
  }, [q, kind, monetization, genre, year, creator, subtitle, sort, runSearch]);

  const cardWidth = isCompact ? (width - 48) / 2 : 168;
  const toggle = (current, value, setter) => setter(current === value ? null : value);
  const pad = isCompact ? 16 : 40;

  function clearFilters() {
    setKind(null);
    setMonetization(null);
    setGenre(null);
    setYear(null);
    setCreator(null);
    setSubtitle(null);
    setSort('relevance');
  }

  const showSuggest = !searched && (suggestions.titles?.length || suggestions.genres?.length || suggestions.creators?.length || suggestions.people?.length);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: pad,
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
            placeholder="Filmes, séries, pessoas, criadores…"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, paddingVertical: 12, paddingHorizontal: 10, fontSize: 16 }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 12, alignItems: 'center' }}
        >
          {(facets.sorts || []).map((item) => (
            <Chip
              key={item.id}
              id={`sort-${item.id}`}
              label={item.label}
              active={sort === item.id}
              onPress={() => setSort(item.id)}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, gap: 12, marginBottom: 8 }}>
          <Pressable onPress={() => setFiltersOpen((open) => !open)}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              Filtros{activeCount ? ` (${activeCount})` : ''}
            </Text>
          </Pressable>
          {activeCount ? (
            <Pressable onPress={clearFilters}>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>Limpar</Text>
            </Pressable>
          ) : null}
          {searched ? (
            <Text style={{ color: colors.muted, marginLeft: 'auto' }}>
              {total} {total === 1 ? 'título' : 'títulos'}
            </Text>
          ) : null}
        </View>

        {filtersOpen ? (
          <View style={{ paddingHorizontal: pad, paddingBottom: 8, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center' }}>
            <Group title="TIPO">
              {(facets.kinds || []).map((item) => (
                <Chip key={item.id} id={`kind-${item.id}`} label={item.label} active={kind === item.id} onPress={() => toggle(kind, item.id, setKind)} />
              ))}
            </Group>
            <Group title="ACESSO">
              {(facets.monetization || []).map((item) => (
                <Chip key={item.id} id={`mon-${item.id}`} label={item.label} active={monetization === item.id} onPress={() => toggle(monetization, item.id, setMonetization)} />
              ))}
            </Group>
            <Group title="GÉNERO">
              {(facets.genres || []).map((item) => (
                <Chip key={item.id} id={`genre-${item.id}`} label={item.label} active={genre === item.id} onPress={() => toggle(genre, item.id, setGenre)} />
              ))}
            </Group>
            <Group title="ANO">
              {(facets.years || []).map((item) => (
                <Chip key={item.id} id={`year-${item.id}`} label={item.label} active={year === item.id} onPress={() => toggle(year, item.id, setYear)} />
              ))}
            </Group>
            <Group title="LEGENDAS">
              {(facets.subtitles || []).map((item) => (
                <Chip key={item.id} id={`sub-${item.id}`} label={item.label} active={subtitle === item.id} onPress={() => toggle(subtitle, item.id, setSubtitle)} />
              ))}
            </Group>
            <Group title="CRIADOR">
              {(facets.creators || []).map((item) => (
                <Chip key={item.id} id={`creator-${item.id}`} label={item.label} active={creator === item.id} onPress={() => toggle(creator, item.id, setCreator)} />
              ))}
            </Group>
          </View>
        ) : null}

        {!searched && !q && trending.length ? (
          <View style={{ paddingHorizontal: pad, paddingVertical: 12, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center' }}>
            <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 }}>
              PESQUISAS EM ALTA · ANGOLA
            </Text>
            {trending.map((item) => (
              <Pressable key={item.query} onPress={() => setQ(item.query)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.red, fontWeight: '900', width: 24 }}>{item.rank}</Text>
                <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{item.query}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.count}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {showSuggest ? (
          <View style={{ paddingHorizontal: pad, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center' }}>
            <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 }}>SUGESTÕES</Text>
            {(suggestions.titles || []).map((item) => (
              <Pressable key={item.id} onPress={() => onSelect?.(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {item.posterUrl ? (
                  <Image source={{ uri: item.posterUrl }} style={{ width: 40, height: 60, borderRadius: 2, backgroundColor: '#111' }} />
                ) : (
                  <View style={{ width: 40, height: 60, backgroundColor: '#111', borderRadius: 2 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{titleMeta(item)}</Text>
                </View>
              </Pressable>
            ))}
            {(suggestions.people || []).map((person) => (
              <Pressable key={`p-${person.label}`} onPress={() => setQ(person.label)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: colors.textSecondary }}>Pessoa · <Text style={{ color: colors.text, fontWeight: '700' }}>{person.label}</Text></Text>
              </Pressable>
            ))}
            {(suggestions.creators || []).map((item) => (
              <Pressable key={`c-${item.label}`} onPress={() => { setCreator(item.label); setQ(''); setFiltersOpen(true); }} style={{ paddingVertical: 10 }}>
                <Text style={{ color: colors.textSecondary }}>Criador · <Text style={{ color: colors.gold, fontWeight: '700' }}>{item.label}</Text></Text>
              </Pressable>
            ))}
            {(suggestions.genres || []).map((g) => (
              <Pressable key={`g-${g.label}`} onPress={() => { setGenre(g.label); setQ(''); setFiltersOpen(true); }} style={{ paddingVertical: 10 }}>
                <Text style={{ color: colors.textSecondary }}>Género · <Text style={{ color: colors.gold, fontWeight: '700' }}>{g.label}</Text></Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {loading ? <LoadingState label="A pesquisar…" /> : null}
        {error ? <ErrorState message={error} onRetry={() => runSearch(q, filters, 0, false)} /> : null}
        {!loading && searched && results.length === 0 ? (
          <EmptyState title="Sem resultados" subtitle="Ajuste os filtros ou tente outro termo." />
        ) : null}

        <View style={{ padding: pad, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {results.map((item) => (
            <Pressable key={item.id} onPress={() => onSelect?.(item)} style={{ width: cardWidth }}>
              <View style={{ aspectRatio: 2 / 3, borderRadius: 4, overflow: 'hidden', backgroundColor: '#111111' }}>
                <Image source={{ uri: item.posterUrl || item.backdropUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                {item.badge ? (
                  <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: colors.gold, fontSize: 9, fontWeight: '800' }}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={{ color: colors.text, marginTop: 8, fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
              <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{titleMeta(item)}</Text>
            </Pressable>
          ))}
        </View>

        {searched && results.length < total ? (
          <Pressable
            onPress={() => runSearch(q, filters, results.length, true)}
            disabled={loadingMore}
            style={{ alignSelf: 'center', marginTop: 8, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>{loadingMore ? 'A carregar…' : 'Mostrar mais'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
