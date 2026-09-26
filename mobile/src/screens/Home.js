import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Modal,
  Text,
  Pressable,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Navbar from '../components/Navbar';
import Billboard from '../components/Billboard';
import MovieRow from '../components/MovieRow';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import { fetchHomeCatalog } from '../services/catalog';
import { fetchUnreadCount } from '../services/engagement';
import { fetchPendingSurvey, respondSurvey } from '../services/phase26';
import { useI18n } from '../i18n';

export default function Home({
  onOpenDetails,
  onPlay,
  onProfile,
  onAdmin,
  onCreatorStudio,
  onAds,
  onSearch,
  onNotifications,
  onMyList,
  onNewHot,
  onPremieres,
  onForYou,
  onLanguages,
  onBrowse,
}) {
  const { t } = useI18n();
  const [scrollY, setScrollY] = useState(0);
  const [featured, setFeatured] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const [survey, setSurvey] = useState(null);
  const [nps, setNps] = useState(null);
  const [surveyComment, setSurveyComment] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [data, notif, surveyData] = await Promise.all([
        fetchHomeCatalog(),
        fetchUnreadCount().catch(() => ({ unread: 0 })),
        fetchPendingSurvey().catch(() => ({ pending: null })),
      ]);
      setFeatured(data.featured);
      setRows(data.rows || []);
      setUnread(notif.unread || 0);
      if (surveyData?.pending) setSurvey(surveyData.pending);
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitNps() {
    if (nps == null) return;
    try {
      await respondSurvey({
        promptKey: survey.key || 'app_nps_session',
        nps,
        comment: surveyComment,
      });
    } catch {
      /* ignore */
    }
    setSurvey(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <Navbar
        scrollY={scrollY}
        onProfile={onProfile}
        onSearch={onSearch}
        onAdmin={onAdmin}
        onCreatorStudio={onCreatorStudio}
        onAds={onAds}
        onNotifications={onNotifications}
        onMyList={onMyList}
        onNewHot={onNewHot}
        onPremieres={onPremieres}
        onForYou={onForYou}
        onLanguages={onLanguages}
        onBrowse={onBrowse}
        unreadCount={unread}
      />

      {loading ? (
        <LoadingState />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          scrollEventThrottle={16}
          onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.red}
            />
          }
        >
          <Billboard item={featured} onPlay={onPlay} onMoreInfo={onOpenDetails} />

          {error ? <ErrorState message={error} onRetry={load} /> : null}

          <View
            style={{
              marginTop: -24,
              paddingBottom: 64,
              maxWidth: layout.maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            {!error && rows.length === 0 ? (
              <EmptyState title={t('emptyCatalog')} subtitle={t('emptySubtitle')} />
            ) : null}

            {rows.map((row) => {
              const isContinue =
                row.slug === 'continuar-a-assistir' || row.id === 'continue-watching';
              return (
                <MovieRow
                  key={row.id}
                  title={row.title}
                  videos={row.videos}
                  resumeMode={isContinue}
                  onSelect={(item) => {
                    if (isContinue) onPlay?.(item);
                    else onOpenDetails?.(item);
                  }}
                />
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal visible={Boolean(survey)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#141414',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              maxWidth: 420,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
              {survey?.title || 'Como está a MinhaTela?'}
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              {survey?.subtitle || 'A sua opinião ajuda a melhorar a experiência em Angola.'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setNps(n)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: nps === n ? colors.gold : '#222',
                  }}
                >
                  <Text
                    style={{
                      color: nps === n ? colors.black : colors.text,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={surveyComment}
              onChangeText={setSurveyComment}
              placeholder="Comentário opcional"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 10,
                borderRadius: 4,
                marginBottom: 14,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setSurvey(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 4,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: '700' }}>Agora não</Text>
              </Pressable>
              <Pressable
                onPress={submitNps}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: colors.red,
                  borderRadius: 4,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
