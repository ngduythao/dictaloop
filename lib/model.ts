import type { Sentence } from './subtitles.ts';

// Shapes stored on the device (IndexedDB). Kept free of Dexie so pure helpers
// and tests can import them under plain Node.

export type LessonSource =
  | { kind: 'file'; path: string; fileName: string; mime: string; size: number }
  | { kind: 'url'; url: string }
  | { kind: 'youtube'; videoId: string; url: string };

export type SubtitleSource = 'srt' | 'vtt' | 'whisper' | 'youtube';

export type SentenceProgress = { best: number; attempts: number; lastAt: number };

export interface Playlist {
  id: string;
  title: string;
  createdAt: number;
}

export interface Lesson {
  id: string;
  playlistId: string;
  order: number;
  title: string;
  source: LessonSource;
  durationSec?: number;
  sentences: Sentence[] | null;
  subtitleSource: SubtitleSource | null;
  subtitleName?: string;
  transcriptText?: string;
  progress: Record<number, SentenceProgress>;
  position?: number;
  createdAt: number;
  lastOpenedAt?: number;
}

export interface Attempt {
  id?: number;
  lessonId: string;
  sentenceIndex: number;
  answer: string;
  score: number;
  correct: boolean;
  at: number;
}

export interface Session {
  id?: number;
  lessonId: string;
  startedAt: number;
  endedAt: number;
  checked: number;
  correct: number;
}
