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
import Focusable from '../tv/Focusable';
import { listPremieres, remindPremiere, unremindPremiere } from '../services/gifts';
import { joinPremiere } from '../services/phase26';

function formatCountdown(seconds) {
  if (!seconds || seconds <= 0) return 'Em breve';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Premieres({ onBack, onOpenTitle, onWatchLive }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await listPremieres();
      setEvents(res.events || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar estreias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleRemind(ev) {
    try {
      if (ev.reminded) await unremindPremiere(ev.id);
      else await remindPremiere(ev.id);
      await load();
    } catch {
      /* ignore */
    }
  }

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
        }}
      >
        <Focusable id="premieres-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
          Estreias
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 60,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
      >
        <Text style={{ color: colors.textSecondary, marginBottom: 24, lineHeight: 22 }}>
          Contagem decrescente para estreias e eventos ao vivo em Angola.
        </Text>

        {events.length === 0 ? (
          <EmptyState title="Sem estreias" subtitle="Volte em breve para novidades." />
        ) : (
          events.map((ev) => (
            <Pressable
              key={ev.id}
              onPress={() => ev.contentId && onOpenTitle?.(ev.contentId)}
              style={{
                marginBottom: 20,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 20,
                flexDirection: width > 600 ? 'row' : 'column',
                gap: 16,
              }}
            >
              {ev.posterUrl || ev.backdropUrl ? (
                <Image
                  source={{ uri: ev.posterUrl || ev.backdropUrl }}
                  style={{
                    width: width > 600 ? 120 : '100%',
                    height: width > 600 ? 170 : 180,
                    borderRadius: 4,
                    backgroundColor: colors.surface,
                  }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {ev.phase === 'live' || ev.isLive ? (
                    <View
                      style={{
                        backgroundColor: colors.red,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 2,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>AO VIVO</Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 12 }}>
                      {formatCountdown(ev.countdownSeconds)}
                    </Text>
                  )}
                </View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
                  {ev.title}
                </Text>
                {ev.synopsis ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                    {ev.synopsis}
                  </Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                  {ev.startsAt
                    ? new Date(ev.startsAt).toLocaleString('pt-AO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : ''}
                </Text>
                <Pressable
                  onPress={() => toggleRemind(ev)}
                  style={{
                    marginTop: 14,
                    alignSelf: 'flex-start',
                    borderWidth: 1,
                    borderColor: ev.reminded ? colors.gold : colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      color: ev.reminded ? colors.gold : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {ev.reminded ? 'Lembrete activo' : 'Lembrar-me'}
                  </Text>
                </Pressable>
                {ev.canJoin || ev.phase === 'live' || ev.isLive ? (
                  <Pressable
                    onPress={async () => {
                      try {
                        const data = await joinPremiere(ev.id);
                        onWatchLive?.(data);
                      } catch (err) {
                        setError(err.message || 'Não foi possível entrar na estreia');
                      }
                    }}
                    style={{
                      marginTop: 10,
                      alignSelf: 'flex-start',
                      backgroundColor: colors.red,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800' }}>Entrar ao vivo</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
