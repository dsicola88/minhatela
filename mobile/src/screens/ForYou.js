import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { fetchForYouHub } from '../services/forYou';

export default function ForYou({ onBack, onOpenDetails }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await fetchForYouHub();
      setRows(res.rows || []);
      setMeta(res);
    } catch (err) {
      setError(err.message || 'Falha ao carregar Para si');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

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
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="foryou-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Para si</Text>
          {meta?.notInterestedCount ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {meta.notInterestedCount} títulos ocultos das recomendações
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
      >
        <Text
          style={{
            color: colors.textSecondary,
            paddingHorizontal: width < 768 ? 16 : 40,
            paddingTop: 20,
            paddingBottom: 8,
            lineHeight: 22,
          }}
        >
          Personalizado com o seu histórico, Originais MinhaTela e preferências.
        </Text>

        {!rows.length ? (
          <EmptyState
            title="Ainda a aprender"
            subtitle="Assista a alguns títulos para melhorar as recomendações."
          />
        ) : (
          rows.map((row) => (
            <MovieRow
              key={row.id}
              title={row.title}
              videos={row.videos || []}
              onSelect={(item) => onOpenDetails?.(item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
