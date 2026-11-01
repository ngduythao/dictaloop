'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { YouTubePlayerHandle } from '@/components/youtube-player';

// One playback API over an <audio>/<video> element or the YouTube player,
// plus sentence playback: play a clip N times, pausing between rounds.

export type MediaKind = 'audio' | 'video' | 'youtube';
export type Clip = { start: number; end: number };

export function useMediaPlayer(kind: MediaKind) {
  const element = useRef<HTMLMediaElement | null>(null);
  const youtube = useRef<YouTubePlayerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [round, setRound] = useState(0);
  const [clipPlaying, setClipPlaying] = useState(false);
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTime = useCallback(() => kind === 'youtube' ? youtube.current?.getCurrentTime() ?? 0 : element.current?.currentTime ?? 0, [kind]);
  const pause = useCallback(() => { if (kind === 'youtube') youtube.current?.pause(); else element.current?.pause(); }, [kind]);
  const seek = useCallback((value: number) => {
    if (kind === 'youtube') youtube.current?.seek(value);
    else if (element.current) element.current.currentTime = value;
  }, [kind]);
  const play = useCallback(async (rate: number) => {
    if (kind === 'youtube') {
      youtube.current?.setRate(rate);
      await youtube.current?.play();
    } else if (element.current) {
      element.current.playbackRate = rate;
      await element.current.play();
    }
  }, [kind]);

  const stop = useCallback(() => {
    run.current++;
    if (timer.current) clearTimeout(timer.current);
    pause();
    setClipPlaying(false);
  }, [pause]);

  // Plays `clip` `repeats` times; resolves true when every round finished.
  const playClip = useCallback((clip: Clip, repeats: number, rate: number) => new Promise<boolean>(resolve => {
    stop();
    const id = run.current;
    setClipPlaying(true);
    const playRound = async (n: number) => {
      if (id !== run.current) return resolve(false);
      setRound(n);
      try {
        seek(clip.start);
        await play(rate);
        if (id !== run.current) { pause(); return resolve(false); }
        const startedAt = performance.now();
        const monitor = () => {
          if (id !== run.current) return resolve(false);
          // YouTube reports the old position for a moment after seeking.
          const settling = kind === 'youtube' && performance.now() - startedAt < 650;
          if (!settling && currentTime() >= clip.end) {
            pause();
            if (n < repeats) timer.current = setTimeout(() => void playRound(n + 1), 700);
            else { setClipPlaying(false); resolve(true); }
          } else {
            timer.current = setTimeout(monitor, kind === 'youtube' ? 80 : 20);
          }
        };
        monitor();
      } catch {
        if (id === run.current) { setClipPlaying(false); setError(true); }
        resolve(false);
      }
    };
    void playRound(1);
  }), [currentTime, kind, pause, play, seek, stop]);

  useEffect(() => () => {
    run.current++;
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const elementProps = {
    ref: (node: HTMLMediaElement | null) => { element.current = node; },
    onLoadedMetadata: (event: { currentTarget: HTMLMediaElement }) => { setReady(true); setError(false); setDuration(event.currentTarget.duration || 0); },
    onTimeUpdate: (event: { currentTarget: HTMLMediaElement }) => setTime(event.currentTarget.currentTime),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onError: () => setError(true),
  };

  const youtubeProps = {
    ref: youtube,
    onReady: (value: number) => { setReady(true); setError(false); setDuration(value); },
    onState: (value: number, total: number, isPlaying: boolean) => { setTime(value); setDuration(total); setPlaying(isPlaying); },
    onError: () => setError(true),
  };

  return { ready, duration, time, playing, error, round, clipPlaying, playClip, stop, seek, play, pause, elementProps, youtubeProps };
}
