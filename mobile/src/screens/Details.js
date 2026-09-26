import { useEffect, useMemo, useState, createElement } from 'react';
import {
  View,
  Text,
  ImageBackground,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/ui';
import { colors, layout } from '../theme/tokens';
import { fetchVideoDetails } from '../services/catalog';
import {
  addFavorite,
  removeFavorite,
  rateContent,
  setReminder,
} from '../services/discovery';
import { getApiBaseUrl } from '../services/api';
import Focusable from '../tv/Focusable';
import Constants from 'expo-constants';
import { requestDownload, blockTitle } from '../services/downloads';
import { getActiveProfile } from '../services/auth';
import { reportContent } from '../services/legal';
import { setNotInterested, markAsWatched } from '../services/forYou';
import {
  getWhatsappShare,
  followSeries,
  unfollowSeries,
  getFollowState,
} from '../services/phase23';

export default function Details({
  videoId,
  visible,
  onClose,
  onWatch,
  onCheckout,
  onPerson,
  onWatchTogether,
}) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState(null);
  const [access, setAccess] = useState(null);
  const [playEpisode, setPlayEpisode] = useState(null);
  const [related, setRelated] = useState([]);
  const [favorited, setFavorited] = useState(false);
  const [social, setSocial] = useState({ userRating: null, stats: { up: 0, down: 0 }, reminded: false });
  const [cast, setCast] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [preference, setPreference] = useState({ notInterested: false, markedWatched: false });
  const [prefMsg, setPrefMsg] = useState('');
  const [following, setFollowing] = useState(false);
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [error, setError] = useState('');
  const [dlStatus, setDlStatus] = useState('');
  const [blockStatus, setBlockStatus] = useState('');

  useEffect(() => {
    if (!visible || !videoId) return undefined;
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      setShowTrailer(false);
      try {
        const data = await fetchVideoDetails(videoId);
        if (!mounted) return;
        const content = data.video || data.content;
        setVideo(content);
        setAccess(data.access);
        setPlayEpisode(data.playEpisode || null);
        setRelated(data.related || []);
        setFavorited(Boolean(data.favorited));
        setSocial(
          data.social || { userRating: null, stats: { up: 0, down: 0 }, reminded: false }
        );
        setCast(data.cast || content?.castPeople || []);
        setChapters(data.chapters || content?.chapters || []);
        setPreference(data.preference || { notInterested: false, markedWatched: false });
        setPrefMsg('');
        setFollowing(false);
        setSeasonIndex(0);
        setDlStatus('');
        setBlockStatus('');
        if ((data.video || data.content)?.kind === 'series') {
          getFollowState((data.video || data.content).id)
            .then((r) => {
              if (mounted) setFollowing(Boolean(r.following));
            })
            .catch(() => {});
        }      } catch (err) {
        if (mounted) setError(err.message || 'Falha ao carregar detalhes');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visible, videoId]);

  const isSeries = video?.kind === 'series';
  const seasons = video?.seasons || [];
  const activeSeason = seasons[seasonIndex] || null;
  const comingSoon = Boolean(video?.comingSoon || access?.denialCode === 'COMING_SOON');

  const watchTarget = useMemo(() => {
    if (isSeries && playEpisode) return playEpisode;
    return video;
  }, [isSeries, playEpisode, video]);

  const actionHandler = useMemo(() => {
    if (!access || !watchTarget) return null;
    if (access.action === 'watch') return () => onWatch?.(watchTarget);
    if (access.action === 'subscribe') {
      return () => onCheckout?.({ type: 'subscription', video: watchTarget });
    }
    if (access.action === 'rent') {
      return () => onCheckout?.({ type: 'rental', video: watchTarget });
    }
    if (access.action === 'remind' || access.action === 'notify') {
      return async () => {
        const next = !social.reminded;
        await setReminder(video.id, next);
        setSocial((s) => ({ ...s, reminded: next }));
        setAccess((a) =>
          a
            ? {
                ...a,
                label: next ? 'Lembrete activo' : 'Lembrar-me',
              }
            : a
        );
      };
    }
    return null;
  }, [access, onCheckout, onWatch, watchTarget, social.reminded, video]);

  async function handleRate(value) {
    try {
      const stars = value === 'up' ? 5 : value === 'down' ? 1 : Number(value);
      const res = await rateContent(video.id, stars);
      setSocial((s) => ({
        ...s,
        userRating: res.stars ?? res.rating,
        stars: res.stars ?? res.rating,
        legacyThumbs: (res.stars ?? res.rating) >= 4 ? 'up' : (res.stars ?? res.rating) <= 2 ? 'down' : null,
        stats: res.stats || s.stats,
        communityRating: res.communityRating || s.communityRating,
      }));
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    if (!video) return;
    const appBase =
      Constants.expoConfig?.extra?.appPublicUrl ||
      process.env.EXPO_PUBLIC_APP_PUBLIC_URL ||
      getApiBaseUrl().replace(':4000', ':8081');
    const url = `${appBase}/title/${video.id}`;
    const message = `Assista «${video.title}» na MinhaTela\n${url}`;
    try {
      if (Platform.OS === 'web' && navigator?.share) {
        await navigator.share({ title: video.title, text: message, url });
        return;
      }
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        return;
      }
      await Share.share({ message, url, title: video.title });
    } catch {
      // dismiss / cancel
    }
  }

  async function handleWhatsapp() {
    if (!video) return;
    try {
      const res = await getWhatsappShare(video.id);
      const url = res.whatsappUrl;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      setPrefMsg(err.message || 'Falha WhatsApp');
    }
  }

  async function handleFollowToggle() {
    if (!video || !isSeries) return;
    try {
      if (following) {
        await unfollowSeries(video.id);
        setFollowing(false);
        setPrefMsg('Deixou de seguir');
      } else {
        const res = await followSeries(video.id);
        setFollowing(true);
        setPrefMsg(res.message || 'A seguir série');
      }
    } catch (err) {
      setPrefMsg(err.message || 'Falha');
    }
  }

  async function handleDownload() {
    if (!video || isSeries) return;
    setDlStatus('A preparar…');
    try {
      const res = await requestDownload(video.id, {
        quality: video.monetization === 'avod' ? '480p' : '720p',
      });
      setDlStatus(
        res?.playback?.downloadUrl
          ? 'Licença pronta · veja em Downloads'
          : 'Download autorizado'
      );
    } catch (err) {
      setDlStatus(err.message || 'Download indisponível');
    }
  }

  async function handleBlock() {
    if (!video) return;
    try {
      const profile = await getActiveProfile();
      if (!profile?.id) {
        setBlockStatus('Seleccione um perfil');
        return;
      }
      await blockTitle(profile.id, video.id);
      setBlockStatus('Título bloqueado neste perfil');
      setTimeout(() => onClose?.(), 900);
    } catch (err) {
      setBlockStatus(err.message || 'Falha ao bloquear');
    }
  }

  async function handleReport() {
    if (!video) return;
    try {
      const res = await reportContent(video.id, {
        reason: 'inappropriate',
        details: 'Denúncia via ficha de detalhes',
      });
      setDlStatus(res.message || 'Denúncia registada');
    } catch (err) {
      setDlStatus(err.message || 'Falha ao denunciar');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.72)' : colors.black,
          justifyContent: 'center',
          alignItems: 'center',
          padding: isCompact ? 0 : 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 920,
            height: isCompact ? height : Math.min(height * 0.9, 820),
            backgroundColor: colors.elevated,
            borderRadius: isCompact ? 0 : 10,
            overflow: 'hidden',
            borderWidth: isCompact ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.red} size="large" />
            </View>
          ) : error ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Text style={{ color: colors.red, marginBottom: 16 }}>{error}</Text>
              <PrimaryButton label="Fechar" onPress={onClose} variant="outline" />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} bounces={false}>
              <ImageBackground
                source={{ uri: video.backdropUrl || video.posterUrl }}
                style={{ height: isCompact ? 240 : 320 }}
              >
                <LinearGradient
                  colors={['transparent', colors.elevated]}
                  style={{ flex: 1, justifyContent: 'space-between', padding: 16 }}
                >
                  <Pressable
                    onPress={onClose}
                    style={{
                      alignSelf: 'flex-end',
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={20} color={colors.text} />
                  </Pressable>
                </LinearGradient>
              </ImageBackground>

              <View
                style={{
                  paddingHorizontal: isCompact ? 16 : 28,
                  paddingBottom: 36,
                  marginTop: -40,
                  maxWidth: layout.maxContentWidth,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: isCompact ? 26 : 34,
                    fontWeight: '800',
                    marginBottom: 8,
                  }}
                >
                  {video.title}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  {isSeries ? <Badge label="SÉRIE" gold /> : null}
                  <Badge label={(video.monetization || '').toUpperCase()} gold={!isSeries} />
                  {video.releaseYear ? <Badge label={String(video.releaseYear)} /> : null}
                  {video.maturityRating ? <Badge label={`${video.maturityRating}+`} /> : null}
                  {isSeries && video.seasonCount ? (
                    <Badge label={`${video.seasonCount} temp. · ${video.episodeCount} ep.`} />
                  ) : null}
                  {access?.expiresAt ? <Badge label="Aluguer activo" gold /> : null}
                </View>
                {(video.advisories || []).length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {video.advisories.map((tag) => (
                      <View
                        key={tag}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 2,
                        }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                          {String(tag).replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <PrimaryButton
                    label={access?.label || 'Assistir'}
                    onPress={actionHandler || undefined}
                    disabled={!actionHandler}
                    variant={access?.action === 'watch' ? 'light' : 'primary'}
                    style={{ minWidth: 180 }}
                  />
                  {video.trailerUrl ? (
                    <PrimaryButton
                      label="Trailer"
                      variant="outline"
                      onPress={() => setShowTrailer(true)}
                      style={{ minWidth: 120 }}
                    />
                  ) : null}
                  <PrimaryButton
                    label={favorited ? 'Na Minha Lista' : '+ A Minha Lista'}
                    variant="outline"
                    onPress={async () => {
                      try {
                        if (favorited) {
                          await removeFavorite(video.id);
                          setFavorited(false);
                        } else {
                          await addFavorite(video.id);
                          setFavorited(true);
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    style={{ minWidth: 150 }}
                  />
                  <PrimaryButton
                    label={preference.notInterested ? 'Mostrar nas recs' : 'Não tenho interesse'}
                    variant="outline"
                    onPress={async () => {
                      try {
                        const next = !preference.notInterested;
                        await setNotInterested(video.id, next);
                        setPreference((p) => ({ ...p, notInterested: next }));
                        setPrefMsg(next ? 'Oculto das recomendações' : 'Voltará a aparecer');
                      } catch (err) {
                        setPrefMsg(err.message || 'Falha');
                      }
                    }}
                    style={{ minWidth: 170 }}
                  />
                  {!isSeries ? (
                    <PrimaryButton
                      label={preference.markedWatched ? 'Marcado como visto' : 'Marcar como visto'}
                      variant="outline"
                      onPress={async () => {
                        try {
                          await markAsWatched(video.id);
                          setPreference((p) => ({ ...p, markedWatched: true }));
                          setPrefMsg('Marcado como visto');
                        } catch (err) {
                          setPrefMsg(err.message || 'Falha');
                        }
                      }}
                      style={{ minWidth: 160 }}
                    />
                  ) : null}
                  {video?.isOriginal ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: colors.gold,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 12 }}>
                        ORIGINAL
                      </Text>
                    </View>
                  ) : null}
                  {prefMsg ? (
                    <Text style={{ color: colors.gold, fontSize: 12, alignSelf: 'center' }}>
                      {prefMsg}
                    </Text>
                  ) : null}
                  {isSeries ? (
                    <PrimaryButton
                      label={following ? 'A seguir' : 'Seguir série'}
                      variant="outline"
                      onPress={handleFollowToggle}
                      style={{ minWidth: 140 }}
                    />
                  ) : null}
                  <Focusable
                    id="details-share"
                    onPress={handleShare}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="share-outline" size={22} color={colors.text} />
                  </Focusable>
                  <Focusable
                    id="details-whatsapp"
                    onPress={handleWhatsapp}
                    accessibilityLabel="Partilhar no WhatsApp"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: '#25D366',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                  </Focusable>
                  {!isSeries && access?.action === 'watch' ? (
                    <Focusable
                      id="details-download"
                      onPress={handleDownload}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="download-outline" size={22} color={colors.text} />
                    </Focusable>
                  ) : null}
                  <Focusable
                    id="details-block"
                    onPress={handleBlock}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="eye-off-outline" size={22} color={colors.text} />
                  </Focusable>
                  <Focusable
                    id="details-report"
                    onPress={handleReport}
                    accessibilityLabel="Denunciar conteúdo"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color={colors.text} />
                  </Focusable>
                  {access?.action === 'watch' && !isSeries ? (
                    <Focusable
                      id="details-party"
                      onPress={() => onWatchTogether?.(video)}
                      accessibilityLabel="Watch Together"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: colors.gold,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="people-outline" size={20} color={colors.gold} />
                    </Focusable>
                  ) : null}
                </View>
                {dlStatus ? (
                  <Text style={{ color: colors.gold, fontSize: 12, marginBottom: 10 }}>{dlStatus}</Text>
                ) : null}
                {blockStatus ? (
                  <Text style={{ color: colors.red, fontSize: 12, marginBottom: 10 }}>{blockStatus}</Text>
                ) : null}

                {!comingSoon ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 18,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Classificar</Text>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Focusable key={n} id={`rate-star-${n}`} onPress={() => handleRate(n)}>
                        <Ionicons
                          name={
                            Number(social.stars || social.userRating) >= n
                              ? 'star'
                              : 'star-outline'
                          }
                          size={22}
                          color={
                            Number(social.stars || social.userRating) >= n
                              ? colors.gold
                              : colors.text
                          }
                        />
                      </Focusable>
                    ))}
                    {social.communityRating?.avg ? (
                      <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 8 }}>
                        ★ {Number(social.communityRating.avg).toFixed(1)} (
                        {social.communityRating.count || 0})
                      </Text>
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {social.stats?.up || 0} · {social.stats?.down || 0}
                      </Text>
                    )}
                  </View>
                ) : null}

                {access?.message ? (
                  <Text style={{ color: colors.textSecondary, marginBottom: 18 }}>
                    {access.message}
                  </Text>
                ) : null}

                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24, marginBottom: 18 }}>
                  {video.synopsisFull}
                </Text>

                {video.cast ? <Meta label="Elenco" value={video.cast} /> : null}
                {cast.length ? (
                  <View style={{ marginTop: 12, marginBottom: 8 }}>
                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
                      ELENCO
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {cast.map((person) => (
                        <Pressable
                          key={`${person.id}-${person.role}`}
                          onPress={() => onPerson?.(person)}
                          style={{ marginRight: 14, width: 88, alignItems: 'center' }}
                        >
                          <View
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 32,
                              backgroundColor: '#1a1a1a',
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              marginBottom: 6,
                            }}
                          >
                            {person.photoUrl ? (
                              <Image
                                source={{ uri: person.photoUrl }}
                                style={{ width: '100%', height: '100%' }}
                              />
                            ) : (
                              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 20 }}>
                                {(person.fullName || '?').slice(0, 1)}
                              </Text>
                            )}
                          </View>
                          <Text
                            numberOfLines={2}
                            style={{ color: colors.text, fontSize: 11, textAlign: 'center', fontWeight: '600' }}
                          >
                            {person.fullName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {chapters.length ? (
                  <View style={{ marginTop: 12, marginBottom: 8 }}>
                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
                      CAPÍTULOS
                    </Text>
                    {chapters.map((ch) => (
                      <Text key={ch.id} style={{ color: colors.textSecondary, marginBottom: 4 }}>
                        {Math.floor(ch.startSeconds / 60)}:
                        {String(ch.startSeconds % 60).padStart(2, '0')} · {ch.title}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {video.creatorName ? <Meta label="Criador" value={video.creatorName} /> : null}

                {isSeries && seasons.length ? (
                  <View style={{ marginTop: 24 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: 18,
                        marginBottom: 12,
                      }}
                    >
                      Episódios
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      {seasons.map((season, idx) => (
                        <Focusable
                          key={season.seasonNumber}
                          id={`season-${season.seasonNumber}`}
                          onPress={() => setSeasonIndex(idx)}
                          style={{
                            marginRight: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: idx === seasonIndex ? colors.text : colors.border,
                            backgroundColor: idx === seasonIndex ? colors.text : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              color: idx === seasonIndex ? colors.black : colors.textSecondary,
                              fontWeight: '700',
                              fontSize: 13,
                            }}
                          >
                            Temporada {season.seasonNumber}
                          </Text>
                        </Focusable>
                      ))}
                    </ScrollView>

                    {(activeSeason?.episodes || []).map((ep) => (
                      <Focusable
                        key={ep.id}
                        id={`ep-${ep.id}`}
                        onPress={() => onWatch?.(ep)}
                        style={{
                          flexDirection: 'row',
                          gap: 14,
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                          opacity: ep.spoilerHidden ? 0.72 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 18 }}>
                            {ep.episodeNumber}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                            {ep.spoilerHidden
                              ? `Episódio ${ep.episodeNumber}`
                              : `${ep.label} · ${ep.displayTitle || ep.episodeTitle || ep.title}`}
                          </Text>
                          {ep.spoilerHidden ? (
                            <Text
                              style={{
                                color: colors.gold,
                                fontSize: 12,
                                marginTop: 4,
                                fontWeight: '600',
                              }}
                            >
                              Sinopse oculta · anti-spoilers
                            </Text>
                          ) : (
                            <Text
                              numberOfLines={2}
                              style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}
                            >
                              {ep.synopsisShort}
                            </Text>
                          )}
                          {ep.progress?.percentage ? (
                            <View
                              style={{
                                marginTop: 8,
                                height: 3,
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <View
                                style={{
                                  width: `${ep.progress.percentage}%`,
                                  height: '100%',
                                  backgroundColor: colors.red,
                                }}
                              />
                            </View>
                          ) : null}
                        </View>
                        <Ionicons
                          name="play-circle"
                          size={28}
                          color={colors.text}
                          style={{ alignSelf: 'center' }}
                        />
                      </Focusable>
                    ))}
                  </View>
                ) : null}

                {related.length ? (
                  <View style={{ marginTop: 20 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: 18,
                        marginBottom: 12,
                      }}
                    >
                      Conteúdos relacionados
                    </Text>
                    {related.slice(0, 6).map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => onWatch?.(item)}
                        style={{
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{item.title}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {(item.kind === 'series' ? 'SÉRIE · ' : '') +
                            (item.monetization || '').toUpperCase()}
                          {item.releaseYear ? ` · ${item.releaseYear}` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}

          {showTrailer && video?.trailerUrl ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.92)',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <Pressable
                onPress={() => setShowTrailer(false)}
                style={{
                  alignSelf: 'flex-end',
                  marginBottom: 12,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
              <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
                {Platform.OS === 'web'
                  ? createElement('iframe', {
                      title: 'Trailer',
                      src: video.trailerUrl,
                      style: { border: 0, width: '100%', height: '100%' },
                      allow: 'autoplay; encrypted-media; picture-in-picture',
                      allowFullScreen: true,
                    })
                  : (
                    <Text style={{ color: colors.text, textAlign: 'center', marginTop: 40 }}>
                      Abra no browser para ver o trailer
                    </Text>
                  )}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Badge({ label, gold }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: gold ? colors.gold : colors.border,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 2,
      }}
    >
      <Text
        style={{
          color: gold ? colors.gold : colors.textSecondary,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Meta({ label, value }) {
  return (
    <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 20 }}>
      <Text style={{ color: colors.muted }}>{label}: </Text>
      <Text style={{ color: colors.textSecondary }}>{value}</Text>
    </Text>
  );
}
