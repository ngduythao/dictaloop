'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { t } from '@/lib/i18n';

type YouTubePlayerInstance = {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  isMuted(): boolean;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  unloadModule?(module: string): void;
  unMute(): void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayerInstance;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubePlayerHandle = {
  getCurrentTime(): number;
  getDuration(): number;
  pause(): void;
  play(): Promise<void>;
  seek(seconds: number): void;
  setMuted(muted: boolean): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
};

type Props = {
  videoId: string;
  volume: number;
  muted: boolean;
  rate: number;
  onReady(duration: number): void;
  onState(time: number, duration: number, playing: boolean): void;
  onError(): void;
};

let apiPromise: Promise<YouTubeNamespace> | undefined;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error(t('yt.playerInitFailed')));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error(t('yt.playerLoadFailed')));
    document.head.appendChild(script);
  });
  return apiPromise;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, volume, muted, rate, onReady, onState, onError },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayerInstance | null>(null);
  const latest = useRef({ volume, muted, rate, onReady, onState, onError });
  latest.current = { volume, muted, rate, onReady, onState, onError };

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => player.current?.getCurrentTime() || 0,
    getDuration: () => player.current?.getDuration() || 0,
    pause: () => player.current?.pauseVideo(),
    play: async () => { player.current?.playVideo(); },
    seek: seconds => player.current?.seekTo(seconds, true),
    setMuted: value => value ? player.current?.mute() : player.current?.unMute(),
    setRate: value => player.current?.setPlaybackRate(value),
    setVolume: value => player.current?.setVolume(Math.round(value * 100)),
  }), []);

  useEffect(() => {
    let disposed = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    void loadYouTubeApi().then(YT => {
      if (disposed || !host.current) return;
      player.current = new YT.Player(host.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          cc_load_policy: 0,
          controls: 1,
          disablekb: 0,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (!player.current) return;
            player.current.setVolume(Math.round(latest.current.volume * 100));
            player.current.setPlaybackRate(latest.current.rate);
            player.current.unloadModule?.('captions');
            if (latest.current.muted) player.current.mute();
            latest.current.onReady(player.current.getDuration() || 0);
            poll = setInterval(() => {
              if (!player.current) return;
              latest.current.onState(
                player.current.getCurrentTime() || 0,
                player.current.getDuration() || 0,
                player.current.getPlayerState() === YT.PlayerState.PLAYING,
              );
            }, 150);
          },
          onStateChange: () => player.current?.unloadModule?.('captions'),
          onError: () => latest.current.onError(),
        },
      });
    }).catch(() => latest.current.onError());
    return () => {
      disposed = true;
      if (poll) clearInterval(poll);
      player.current?.destroy();
      player.current = null;
    };
  }, [videoId]);

  useEffect(() => { player.current?.setVolume(Math.round(volume * 100)); }, [volume]);
  useEffect(() => { if (muted) player.current?.mute(); else player.current?.unMute(); }, [muted]);
  useEffect(() => { player.current?.setPlaybackRate(rate); }, [rate]);

  return <div ref={host} aria-label={t('yt.playerAria')} />;
});
