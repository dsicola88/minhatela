import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import MovieRow from '../components/MovieRow';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews';
import Focusable from '../tv/Focusable';
import {
  fetchLanguagesHub,
  fetchByLanguage,
  fetchByCategory,
} from '../services/phase23';

export default function LanguagesHub({ onBack, onOpenDetails }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hub, setHub] = useState(null);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHub = useCallback(async () => {
    try {
      setError('');
      const res = await fetchLanguagesHub();
      setHub(res);
      const first = res.languages?.[0]?.code || res.categories?.[0]?.slug;
      if (first) {
        setActive(res.languages?.[0] ? { type: 'lang', key: first } : { type: 'cat', key: first });
      }
    } catch (err) {
      setError(err.message || 'Falha ao carregar hub');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!active) return;
    try {
      const res =
        active.type === 'lang'
          ? await fetchByLanguage(active.key)
          : await fetchByCategory(active.key);
      setItems(res.items || []);
    } catch {
      setItems([]);
    }
  }, [active]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadHub} />;

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
        <Focusable id="lang-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
          Categorias & Idiomas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadHub} tintColor={colors.gold} />}
      >
        <Text
          style={{
            color: colors.textSecondary,
            paddingHorizontal: width < 768 ? 16 : 40,
            paddingTop: 16,
            marginBottom: 12,
          }}
        >
          Explore por idioma (PT, EN, línguas nacionais) e categorias.
        </Text>

        <Text
          style={{
            color: colors.gold,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.2,
            paddingHorizontal: width < 768 ? 16 : 40,
            marginBottom: 10,
          }}
        >
          IDIOMAS
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: width < 768 ? 16 : 40, gap: 8, marginBottom: 20 }}
        >
          {(hub?.languages || []).map((l) => {
            const selected = active?.type === 'lang' && active.key === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => setActive({ type: 'lang', key: l.code })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: selected ? colors.gold : colors.border,
                  backgroundColor: selected ? 'rgba(247,212,23,0.12)' : 'transparent',
                }}
              >
                <Text style={{ color: selected ? colors.gold : colors.text, fontWeight: '700' }}>
                  {l.label} · {l.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text
          style={{
            color: colors.gold,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.2,
            paddingHorizontal: width < 768 ? 16 : 40,
            marginBottom: 10,
          }}
        >
          CATEGORIAS
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: width < 768 ? 16 : 40, gap: 8, marginBottom: 24 }}
        >
          {(hub?.categories || []).map((c) => {
            const selected = active?.type === 'cat' && active.key === c.slug;
            return (
              <Pressable
                key={c.slug}
                onPress={() => setActive({ type: 'cat', key: c.slug })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: selected ? colors.red : colors.border,
                  backgroundColor: selected ? 'rgba(206,17,38,0.15)' : 'transparent',
                }}
              >
                <Text style={{ color: selected ? colors.text : colors.textSecondary, fontWeight: '700' }}>
                  {c.title} · {c.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!items.length ? (
          <EmptyState title="Sem títulos" subtitle="Escolha outro filtro." />
        ) : (
          <MovieRow
            title={
              active?.type === 'lang'
                ? `Idioma · ${active.key}`
                : `Categoria · ${active?.key || ''}`
            }
            videos={items}
            onSelect={(item) => onOpenDetails?.(item)}
          />
        )}
      </ScrollView>
    </View>
  );
}
