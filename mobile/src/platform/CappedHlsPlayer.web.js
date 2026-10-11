import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

/**
 * Web: o iframe da Bunny não aceita tecto de qualidade.
 * Este leitor pede o manifesto já filtrado (cap=480).
 */
export default function CappedHlsPlayer({ uri, paused, playerRef, onTime, onEnded, onAutoplayBlocked }) {
  const ref = useRef(null);
  const onTimeRef = useRef(onTime);
  const onEndedRef = useRef(onEnded);
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  const pausedRef = useRef(paused);
  onTimeRef.current = onTime;
  onEndedRef.current = onEnded;
  onAutoplayBlockedRef.current = onAutoplayBlocked;
  pausedRef.current = paused;

  useEffect(() => {
    const video = ref.current;
    if (!video || !uri) return undefined;
    let hls = null;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = uri;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: false });
      hls.loadSource(uri);
      hls.attachMedia(video);
    } else {
      video.src = uri;
    }
    const onTimeUpdate = () => {
      onTimeRef.current?.({
        seconds: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      });
    };
    const onFinish = () => onEndedRef.current?.();
    const tryPlay = () => {
      if (pausedRef.current) return;
      const pending = video.play();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(() => onAutoplayBlockedRef.current?.());
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onFinish);
    video.addEventListener('canplay', tryPlay);
    if (hls) hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
    if (playerRef) {
      playerRef.current = {
        setPositionAsync: async (ms) => {
          video.currentTime = Math.max(0, Number(ms) || 0) / 1000;
        },
        playAsync: () => video.play(),
        pauseAsync: async () => {
          video.pause();
        },
      };
    }
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onFinish);
      video.removeEventListener('canplay', tryPlay);
      hls?.destroy();
      if (playerRef) playerRef.current = null;
    };
  }, [uri, playerRef]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused]);

  return (
    <video
      ref={ref}
      playsInline
      style={{ width: '100%', height: '100%', background: '#000' }}
    />
  );
}
