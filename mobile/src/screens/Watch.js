import { createElement, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { colors } from '../theme/tokens';
import {
  startWatch,
  saveWatchProgress,
  heartbeatWatchSession,
  endWatchSession,
  reportWatchQoe,
} from '../services/catalog';
import {
  submitPlaybackFeedback,
  challengeStillWatching,
  confirmStillWatching,
} from '../services/watchTogether';
import { getActiveProfile } from '../services/auth';
import { useI18n } from '../i18n';
import Focusable from '../tv/Focusable';
import { getDataSaver, applyDataSaverToEmbedUrl } from '../platform/preferences';
import { updatePlaybackPrefs } from '../services/phase24';

const PROGRESS_INTERVAL_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 30000;
const STILL_WATCHING_AFTER_MS = 45 * 60 * 1000;

function reportQoeSafe(payload) {
  reportWatchQoe(payload).catch(() => {});
}

export default function Watch({ videoId, onBack, onNextEpisode, onWatchTogether, onOpenTitle }) {
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [recapSkipped, setRecapSkipped] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(null);
  const [stillChallenge, setStillChallenge] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showMoreLike, setShowMoreLike] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [showTracks, setShowTracks] = useState(false);
  const [audioPref, setAudioPref] = useState('pt');
  const [subsPref, setSubsPref] = useState('off');
  const hideTimer = useRef(null);
  const progressTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const stillTimer = useRef(null);
  const countdownTimer = useRef(null);
  const sessionIdRef = useRef(null);
  const contentIdRef = useRef(videoId);
  const positionRef = useRef(30);
  const durationRef = useRef(0);
  const profileIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    setSession(null);
    setIntroSkipped(false);
    setRecapSkipped(false);
    setShowNext(false);
    setNextCountdown(null);
    setPinRequired(false);
    setPinError('');

    async function boot(pin) {
      try {
        if (Platform.OS !== 'web') {
          await ScreenCapture.preventScreenCaptureAsync();
        }

        const profile = await getActiveProfile();
        profileIdRef.current = profile?.id || null;
        const data = await startWatch(videoId, { profileId: profile?.id, pin });
        if (!mounted) return;
        const dataSaver = await getDataSaver();
        if (data?.playback?.embedUrl) {
          data.playback.embedUrl = applyDataSaverToEmbedUrl(
            data.playback.embedUrl,
            dataSaver
          );
        }
        setSession(data);
        setPinRequired(false);
        setAudioPref(data?.preferences?.preferredAudio || 'pt');
        setSubsPref(data?.preferences?.preferredSubtitles || 'off');
        sessionIdRef.current = data.sessionId;
        contentIdRef.current = data?.content?.id || videoId;
        durationRef.current = data?.content?.durationSeconds || 0;
        if (data?.resume?.positionSeconds) {
          positionRef.current = data.resume.positionSeconds;
        } else {
          positionRef.current = 5;
        }

        reportQoeSafe({
          eventType: 'startup',
          contentId: contentIdRef.current,
          sessionId: data.sessionId,
          profileId: profileIdRef.current,
          startupMs: 0,
          quality: dataSaver ? '480p' : 'auto',
          platform: Platform.OS,
        });

        stillTimer.current = setTimeout(() => {
          challengeStillWatching({
            sessionId: data.sessionId,
            contentId: contentIdRef.current,
          })
            .then((ch) => setStillChallenge(ch))
            .catch(() => {});
        }, STILL_WATCHING_AFTER_MS);

        progressTimer.current = setInterval(async () => {
          if (!profileIdRef.current) return;
          positionRef.current += Math.floor(PROGRESS_INTERVAL_MS / 1000);
          const duration = durationRef.current || positionRef.current + 60;
          const creditsAt = data?.player?.creditsStartSeconds;
          if (creditsAt && positionRef.current >= creditsAt) {
            setShowMoreLike(true);
            if (data?.nextEpisode && data?.player?.autoplayNext !== false) {
              setShowNext(true);
            }
            setShowFeedback(true);
            pokeControls();
          }
          try {
            await saveWatchProgress(contentIdRef.current, {
              positionSeconds: positionRef.current,
              durationSeconds: duration,
            });
          } catch {
            // telemetria silenciosa
          }
        }, PROGRESS_INTERVAL_MS);

        heartbeatTimer.current = setInterval(async () => {
          if (!sessionIdRef.current) return;
          try {
            await heartbeatWatchSession(sessionIdRef.current);
          } catch {
            // ignore
          }
        }, HEARTBEAT_INTERVAL_MS);
      } catch (err) {
        if (err.code === 'PIN_REQUIRED_PLAY' || err.code === 'PIN_INVALID') {
          if (mounted) {
            setPinRequired(true);
            setPinError(err.code === 'PIN_INVALID' ? 'PIN incorrecto' : '');
            setLoading(false);
          }
          return;
        }
        reportQoeSafe({
          eventType: 'error',
          contentId: videoId,
          profileId: profileIdRef.current,
          errorCode: err.code || 'WATCH_START_FAILED',
          platform: Platform.OS,
          metadata: { message: err.message },
        });
        if (mounted) setError(err.message || t('errorGeneric'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();

    return () => {
      mounted = false;
      if (Platform.OS !== 'web') {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      }
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (stillTimer.current) clearTimeout(stillTimer.current);

      if (profileIdRef.current && contentIdRef.current) {
        saveWatchProgress(contentIdRef.current, {
          positionSeconds: positionRef.current,
          durationSeconds: durationRef.current || positionRef.current + 60,
        }).catch(() => {});
      }
      if (sessionIdRef.current) {
        endWatchSession(sessionIdRef.current).catch(() => {});
      }
    };
  }, [videoId, t]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const blockContext = (event) => event.preventDefault();
    document.addEventListener('contextmenu', blockContext);
    return () => document.removeEventListener('contextmenu', blockContext);
  }, []);

  function pokeControls() {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4200);
  }

  function seekBy(delta) {
    positionRef.current = Math.max(0, positionRef.current + delta);
    saveWatchProgress(contentIdRef.current, {
      positionSeconds: positionRef.current,
      durationSeconds: durationRef.current || positionRef.current + 60,
    }).catch(() => {});
    pokeControls();
  }

  function skipIntro() {
    const end = session?.player?.introEndSeconds;
    if (!end) return;
    positionRef.current = end;
    setIntroSkipped(true);
    saveWatchProgress(contentIdRef.current, {
      positionSeconds: end,
      durationSeconds: durationRef.current || end + 60,
    }).catch(() => {});
    pokeControls();
  }

  function skipRecap() {
    const end = session?.player?.recapEndSeconds;
    if (!end) return;
    positionRef.current = end;
    setRecapSkipped(true);
    setIntroSkipped(true);
    saveWatchProgress(contentIdRef.current, {
      positionSeconds: end,
      durationSeconds: durationRef.current || end + 60,
    }).catch(() => {});
    pokeControls();
  }

  function goNext() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    const next = session?.nextEpisode;
    if (!next?.id) return;
    onNextEpisode?.(next);
  }

  function cancelAutoplay() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setNextCountdown(null);
    setShowNext(false);
  }

  useEffect(() => {
    if (!showNext || !session?.nextEpisode) return undefined;
    const secs = Number(session?.player?.autoplayCountdownSeconds ?? 10);
    if (!secs || secs <= 0 || session?.player?.autoplayNext === false) {
      setNextCountdown(null);
      return undefined;
    }
    setNextCountdown(secs);
    countdownTimer.current = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          const next = session?.nextEpisode;
          if (next?.id) onNextEpisode?.(next);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [showNext, session?.nextEpisode?.id, session?.player?.autoplayCountdownSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      const key = event.key;
      if (key === 'Escape' || key === 'Backspace') {
        event.preventDefault();
        onBack?.();
        return;
      }
      if (key === 'ArrowLeft' || key === 'MediaRewind') {
        event.preventDefault();
        seekBy(-10);
        return;
      }
      if (key === 'ArrowRight' || key === 'MediaFastForward') {
        event.preventDefault();
        seekBy(10);
        return;
      }
      if (key === 'n' || key === 'N') {
        if (session?.nextEpisode) {
          event.preventDefault();
          goNext();
        }
        return;
      }
      if (key === 's' || key === 'S') {
        if (session?.player?.skipIntroEnabled && !introSkipped) {
          event.preventDefault();
          skipIntro();
        }
        return;
      }
      if (key === ' ' || key === 'Enter' || key === 'MediaPlayPause') {
        event.preventDefault();
        pokeControls();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, videoId, session, introSkipped]);

  const embedUrl = session?.playback?.embedUrl;
  const content = session?.content;
  const seriesTitle = session?.series?.title;
  const epLabel =
    content?.kind === 'episode'
      ? `T${content.seasonNumber}:E${content.episodeNumber} · ${content.episodeTitle || content.title}`
      : content?.title || '';
  const title = seriesTitle ? `${seriesTitle} · ${epLabel}` : epLabel;
  const progressPct = Math.min(
    99,
    session?.resume?.percentage ||
      (durationRef.current > 0
        ? Math.round((positionRef.current / durationRef.current) * 100)
        : 8)
  );
  const canSkipIntro =
    Boolean(session?.player?.skipIntroEnabled) &&
    !introSkipped &&
    !recapSkipped &&
    positionRef.current < (session?.player?.introEndSeconds || 0);
  const canSkipRecap =
    Boolean(session?.player?.skipRecapEnabled) &&
    !recapSkipped &&
    positionRef.current < (session?.player?.recapEndSeconds || 0) &&
    positionRef.current >= (session?.player?.introEndSeconds || 0);

  async function submitPin() {
    setLoading(true);
    setPinError('');
    try {
      const profile = await getActiveProfile();
      const data = await startWatch(videoId, { profileId: profile?.id, pin: pinValue });
      const dataSaver = await getDataSaver();
      if (data?.playback?.embedUrl) {
        data.playback.embedUrl = applyDataSaverToEmbedUrl(data.playback.embedUrl, dataSaver);
      }
      setSession(data);
      setPinRequired(false);
      setAudioPref(data?.preferences?.preferredAudio || 'pt');
      setSubsPref(data?.preferences?.preferredSubtitles || 'off');
      sessionIdRef.current = data.sessionId;
      contentIdRef.current = data?.content?.id || videoId;
    } catch (err) {
      setPinError(err.message || 'PIN incorrecto');
    } finally {
      setLoading(false);
    }
  }

  function jumpToCredits() {
    const at = session?.player?.creditsStartSeconds;
    if (!at) return;
    positionRef.current = at;
    setShowMoreLike(true);
    pokeControls();
  }

  function jumpToPostCredits() {
    const at = session?.player?.postCreditsStartSeconds;
    if (!at) return;
    positionRef.current = at;
    pokeControls();
  }

  if (pinRequired) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.black,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <StatusBar style="light" />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
          PIN do perfil
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 20, textAlign: 'center' }}>
          Introduza o PIN para continuar a assistir.
        </Text>
        <TextInput
          value={pinValue}
          onChangeText={setPinValue}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          placeholder="••••"
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1,
            borderColor: colors.gold,
            color: colors.text,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: 12,
            textAlign: 'center',
            width: 180,
            paddingVertical: 12,
            marginBottom: 12,
            borderRadius: 4,
          }}
        />
        {pinError ? (
          <Text style={{ color: colors.red, marginBottom: 12 }}>{pinError}</Text>
        ) : null}
        <Pressable
          onPress={submitPin}
          style={{
            backgroundColor: colors.red,
            paddingHorizontal: 28,
            paddingVertical: 12,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Desbloquear</Text>
        </Pressable>
        <Pressable onPress={onBack}>
          <Text style={{ color: colors.muted }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar hidden />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} size="large" />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('loading')}</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.red, marginBottom: 16, textAlign: 'center' }}>{error}</Text>
          <Focusable id="watch-error-back" autoFocus onPress={onBack}>
            <Text style={{ color: colors.text, fontWeight: '700', padding: 12 }}>{t('back')}</Text>
          </Focusable>
        </View>
      ) : (
        <Pressable style={{ flex: 1 }} onPress={pokeControls}>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1 }}>
              {createElement('iframe', {
                title,
                src: embedUrl,
                style: { border: 0, width: '100%', height: '100%' },
                allow:
                  'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen',
                allowFullScreen: true,
              })}
            </View>
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{
                html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style><script>document.addEventListener('contextmenu',e=>e.preventDefault())</script></head><body><iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`,
              }}
              style={{ flex: 1, backgroundColor: colors.black, width, height }}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
            />
          )}

          {canSkipIntro ? (
            <Focusable
              id="watch-skip-intro"
              onPress={skipIntro}
              style={{
                position: 'absolute',
                right: 24,
                bottom: 120,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderWidth: 1,
                borderColor: colors.text,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', letterSpacing: 0.8 }}>
                SALTAR INTRO
              </Text>
            </Focusable>
          ) : null}

          {canSkipRecap ? (
            <Focusable
              id="watch-skip-recap"
              onPress={skipRecap}
              style={{
                position: 'absolute',
                right: 24,
                bottom: 120,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderWidth: 1,
                borderColor: colors.gold,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.gold, fontWeight: '700', letterSpacing: 0.8 }}>
                SALTAR RECAP
              </Text>
            </Focusable>
          ) : null}

          {showControls ? (
            <View
              style={{
                position: 'absolute',
                right: 20,
                top: 80,
                gap: 10,
              }}
            >
              <Focusable
                id="watch-tracks"
                onPress={() => setShowTracks((v) => !v)}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: 10,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="text-outline" size={20} color={colors.text} />
              </Focusable>
              {session?.player?.watchCreditsEnabled ? (
                <Focusable
                  id="watch-credits"
                  onPress={jumpToCredits}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>CRÉDITOS</Text>
                </Focusable>
              ) : null}
              {session?.player?.postCreditsEnabled ? (
                <Focusable
                  id="watch-post-credits"
                  onPress={jumpToPostCredits}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.gold,
                  }}
                >
                  <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700' }}>PÓS-CRÉDITOS</Text>
                </Focusable>
              ) : null}
            </View>
          ) : null}

          {showTracks ? (
            <View
              style={{
                position: 'absolute',
                right: 20,
                top: 160,
                width: 220,
                backgroundColor: 'rgba(20,20,20,0.96)',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 14,
              }}
            >
              <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', marginBottom: 8 }}>
                ÁUDIO
              </Text>
              {['pt', 'en'].map((a) => (
                <Pressable
                  key={a}
                  onPress={async () => {
                    setAudioPref(a);
                    try {
                      await updatePlaybackPrefs({ preferredAudio: a });
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={{ color: audioPref === a ? colors.gold : colors.text, fontWeight: '700' }}>
                    {a === 'pt' ? 'Português' : 'English'}
                  </Text>
                </Pressable>
              ))}
              <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', marginTop: 12, marginBottom: 8 }}>
                LEGENDAS
              </Text>
              {['off', 'pt', 'en'].map((s) => (
                <Pressable
                  key={s}
                  onPress={async () => {
                    setSubsPref(s);
                    try {
                      await updatePlaybackPrefs({ preferredSubtitles: s });
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={{ color: subsPref === s ? colors.gold : colors.text, fontWeight: '700' }}>
                    {s === 'off' ? 'Desligado' : s === 'pt' ? 'Português' : 'English'}
                  </Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowTracks(false)} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.muted, textAlign: 'center' }}>Fechar</Text>
              </Pressable>
            </View>
          ) : null}

          {showNext && session?.nextEpisode ? (
            <View
              style={{
                position: 'absolute',
                right: 24,
                bottom: 120,
                width: 300,
                backgroundColor: 'rgba(20,20,20,0.95)',
                borderWidth: 1,
                borderColor: colors.gold,
                padding: 14,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                SEGUINTE EPISÓDIO
                {nextCountdown != null && nextCountdown > 0 ? ` · ${nextCountdown}s` : ''}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 10 }} numberOfLines={2}>
                T{session.nextEpisode.seasonNumber}:E{session.nextEpisode.episodeNumber} ·{' '}
                {session.nextEpisode.episodeTitle || session.nextEpisode.title}
              </Text>
              {nextCountdown != null && nextCountdown > 0 ? (
                <View
                  style={{
                    height: 3,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    marginBottom: 12,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.max(
                        4,
                        (nextCountdown / Math.max(1, session?.player?.autoplayCountdownSeconds || 10)) *
                          100
                      )}%`,
                      backgroundColor: colors.red,
                    }}
                  />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Focusable
                  id="watch-next-ep"
                  autoFocus
                  onPress={goNext}
                  style={{
                    flex: 1,
                    backgroundColor: colors.text,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: colors.black, fontWeight: '800' }}>Assistir agora</Text>
                </Focusable>
                <Focusable
                  id="watch-next-cancel"
                  onPress={cancelAutoplay}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancelar</Text>
                </Focusable>
              </View>
            </View>
          ) : null}

          {showControls ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'space-between',
                padding: 20,
                backgroundColor: 'rgba(0,0,0,0.25)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Focusable
                  id="watch-back"
                  onPress={onBack}
                  accessibilityLabel={t('back')}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Focusable>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}
                >
                  {title}
                </Text>
                {session?.nextEpisode ? (
                  <Focusable id="watch-next-icon" onPress={goNext} accessibilityLabel="Seguinte">
                    <Ionicons name="play-skip-forward" size={24} color={colors.text} />
                  </Focusable>
                ) : null}
                <Focusable
                  id="watch-party"
                  onPress={() =>
                    onWatchTogether?.({
                      contentId: contentIdRef.current,
                      sessionId: sessionIdRef.current,
                    })
                  }
                  accessibilityLabel="Watch Together"
                >
                  <Ionicons name="people-outline" size={22} color={colors.gold} />
                </Focusable>
              </View>

              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 28,
                }}
              >
                <Focusable id="watch-seek-back" onPress={() => seekBy(-10)}>
                  <Ionicons name="play-back" size={28} color={colors.text} />
                </Focusable>
                {session?.scrub?.spriteUrl ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 70,
                      alignSelf: 'center',
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                      SCRUB PREVIEW · SPRITE
                    </Text>
                  </View>
                ) : null}
                <Focusable
                  id="watch-play"
                  autoFocus={!showNext}
                  onPress={pokeControls}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    borderWidth: 2,
                    borderColor: colors.text,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="play" size={34} color={colors.text} style={{ marginLeft: 4 }} />
                </Focusable>
                <Focusable id="watch-seek-fwd" onPress={() => seekBy(10)}>
                  <Ionicons name="play-forward" size={28} color={colors.text} />
                </Focusable>
              </View>

              <View>
                {session?.ads?.enabled && session?.ads?.creative ? (
                  <View
                    style={{
                      marginBottom: 10,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: colors.gold,
                      backgroundColor: 'rgba(247,212,23,0.08)',
                    }}
                  >
                    <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '600' }}>
                      {t('adLabel')} · {session.ads.creative.title}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={{
                    height: 4,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: `${progressPct}%`,
                      height: '100%',
                      backgroundColor: colors.red,
                    }}
                  />
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {session?.resume
                    ? `${t('resumeLabel')} · ${progressPct}%`
                    : `${t('qualityLabel')}: ${session?.player?.defaultQuality || '480p'} · Auto`}
                </Text>
              </View>
            </View>
          ) : null}

          {stillChallenge ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                top: 0,
                backgroundColor: 'rgba(0,0,0,0.82)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
                Ainda está a ver?
              </Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                Confirme para continuar a reprodução.
              </Text>
              <Focusable
                id="still-yes"
                autoFocus
                onPress={async () => {
                  try {
                    await confirmStillWatching(stillChallenge.id);
                  } catch {
                    /* ignore */
                  }
                  setStillChallenge(null);
                }}
                style={{
                  backgroundColor: colors.text,
                  paddingHorizontal: 28,
                  paddingVertical: 14,
                  borderRadius: 4,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: colors.black, fontWeight: '800' }}>Continuar a ver</Text>
              </Focusable>
              <Focusable id="still-no" onPress={onBack}>
                <Text style={{ color: colors.muted, fontWeight: '600' }}>Sair</Text>
              </Focusable>
            </View>
          ) : null}

          {showFeedback && !stillChallenge ? (
            <View
              style={{
                position: 'absolute',
                left: 20,
                bottom: 100,
                right: 20,
                maxWidth: 360,
                alignSelf: 'center',
                backgroundColor: 'rgba(20,20,20,0.96)',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 10 }}>
                Como classifica este título?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setFeedbackScore(n)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: feedbackScore === n ? colors.gold : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: feedbackScore === n ? 'rgba(247,212,23,0.15)' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: feedbackScore === n ? colors.gold : colors.text,
                        fontWeight: '800',
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={async () => {
                  if (!feedbackScore) return;
                  try {
                    const res = await submitPlaybackFeedback({
                      contentId: contentIdRef.current,
                      sessionId: sessionIdRef.current,
                      score: feedbackScore,
                      nps: feedbackScore >= 4 ? 9 : feedbackScore <= 2 ? 3 : 7,
                    });
                    setFeedbackMsg(res.message || 'Obrigado!');
                    setTimeout(() => setShowFeedback(false), 1200);
                  } catch (err) {
                    setFeedbackMsg(err.message || 'Falha');
                  }
                }}
                style={{
                  backgroundColor: colors.red,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Enviar</Text>
              </Pressable>
              {feedbackMsg ? (
                <Text style={{ color: colors.gold, marginTop: 8, fontSize: 12 }}>{feedbackMsg}</Text>
              ) : null}
              <Pressable onPress={() => setShowFeedback(false)} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.muted, textAlign: 'center' }}>Agora não</Text>
              </Pressable>
            </View>
          ) : null}

          {showMoreLike && !stillChallenge && session?.moreLikeThis?.items?.length ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.92)',
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                  Mais como isto
                  {session.moreLikeThis.seedTitle
                    ? ` · ${session.moreLikeThis.seedTitle}`
                    : ''}
                </Text>
                <Pressable onPress={() => setShowMoreLike(false)}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {session.moreLikeThis.items.slice(0, 6).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (onOpenTitle) onOpenTitle(item.id);
                      else onBack?.();
                    }}
                    style={{ width: 90 }}
                  >
                    {item.posterUrl ? (
                      <View
                        style={{
                          width: 90,
                          height: 128,
                          borderRadius: 4,
                          overflow: 'hidden',
                          backgroundColor: '#1a1a1a',
                        }}
                      >
                        {Platform.OS === 'web' ? (
                          createElement('img', {
                            src: item.posterUrl,
                            alt: item.title,
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            },
                          })
                        ) : (
                          <Text style={{ color: colors.muted, fontSize: 10, padding: 4 }}>
                            {item.title}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 90,
                          height: 128,
                          borderRadius: 4,
                          backgroundColor: '#1a1a1a',
                          padding: 6,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }} numberOfLines={3}>
                          {item.title}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}
