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
import { fetchNewAndHot } from '../services/browse';
import Focusable from '../tv/Focusable';
import { EmptyState, ErrorState } from '../components/StateViews';

export default function NewAndHot({ onBack, onSelect }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchNewAndHot();
      setTabs(data.tabs || []);
      setActive(0);
    } catch (err) {
      setError(err.message || 'Falha ao carregar Novidades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = tabs[active];

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
        <Focusable id="newhot-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Novidades & Em Alta
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
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: isCompact ? 16 : 40,
              paddingVertical: 14,
              gap: 10,
            }}
          >
            {tabs.map((tab, idx) => (
              <Focusable
                key={tab.id}
                id={`newhot-tab-${tab.id}`}
                onPress={() => setActive(idx)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: idx === active ? colors.text : colors.border,
                  backgroundColor: idx === active ? colors.text : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: idx === active ? colors.black : colors.textSecondary,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {tab.title}
                </Text>
              </Focusable>
            ))}
          </ScrollView>

          <ScrollView
            contentContainerStyle={{
              padding: isCompact ? 16 : 40,
              maxWidth: layout.maxContentWidth,
              width: '100%',
              alignSelf: 'center',
              paddingBottom: 64,
            }}
          >
            {error ? <ErrorState message={error} onRetry={load} /> : null}
            {current ? (
              <>
                <Text style={{ color: colors.muted, marginBottom: 18 }}>{current.subtitle}</Text>
                {!current.items?.length ? (
                  <EmptyState title="Sem títulos nesta secção" />
                ) : (
                  current.items.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => onSelect?.(item)}
                      style={{
                        flexDirection: 'row',
                        gap: 14,
                        marginBottom: 18,
                        alignItems: 'center',
                      }}
                    >
                      {item.rank ? (
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 36,
                            fontWeight: '900',
                            width: 40,
                            textAlign: 'center',
                          }}
                        >
                          {item.rank}
                        </Text>
                      ) : null}
                      <Image
                        source={{ uri: item.posterUrl || item.backdropUrl }}
                        style={{
                          width: item.rank ? 90 : 120,
                          height: item.rank ? 135 : 68,
                          borderRadius: 4,
                          backgroundColor: '#111',
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                          {item.title}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                          {(item.kind === 'series' ? 'SÉRIE · ' : '') +
                            (item.monetization || '').toUpperCase()}
                          {item.badge ? ` · ${item.badge}` : ''}
                        </Text>
                        {item.synopsisShort ? (
                          <Text
                            numberOfLines={2}
                            style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}
                          >
                            {item.synopsisShort}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            ) : null}
          </ScrollView>
        </>
      )}
    </View>
  );
}
