import type { Attempt, Lesson, Playlist, Session } from './model.ts';

// Backups move progress between devices. They hold lesson metadata, progress,
// attempts and sessions, never the media files themselves.

const BACKUP_APP = 'dictaloop';
const BACKUP_VERSION = 1;

export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  playlists: Playlist[];
  lessons: Lesson[];
  attempts: Attempt[];
  sessions: Session[];
};

export function createBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now = Date.now()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    playlists: data.playlists,
    lessons: data.lessons,
    attempts: data.attempts.map(withoutId),
    sessions: data.sessions.map(withoutId),
  };
}

export class BackupError extends Error {}

// Local auto-increment ids mean nothing on another device.
function withoutId<T extends { id?: number }>(item: T): T {
  const copy = { ...item };
  delete copy.id;
  return copy;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isArrayOf = (value: unknown, check: (item: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every(item => isObject(item) && check(item));

export function parseBackup(input: unknown): Backup {
  if (!isObject(input) || input.app !== BACKUP_APP) throw new BackupError('not-a-backup');
  if (typeof input.version !== 'number' || input.version > BACKUP_VERSION) throw new BackupError('newer-version');
  const valid =
    isArrayOf(input.playlists, item => typeof item.id === 'string' && typeof item.title === 'string') &&
    isArrayOf(input.lessons, item => typeof item.id === 'string' && typeof item.playlistId === 'string' && isObject(item.source) && isObject(item.progress)) &&
    isArrayOf(input.attempts, item => typeof item.lessonId === 'string' && typeof item.sentenceIndex === 'number' && typeof item.at === 'number') &&
    isArrayOf(input.sessions, item => typeof item.lessonId === 'string' && typeof item.startedAt === 'number');
  if (!valid) throw new BackupError('damaged');
  return input as unknown as Backup;
}

export type MergePlan = {
  playlists: Playlist[];
  lessons: Lesson[];
  attempts: Attempt[];
  sessions: Session[];
};

// What to write so the device ends up with the union of both: new items are
// added; a lesson on both sides keeps this device's media and takes the best
// progress of the two. Attempts and sessions already present are skipped.
export function planMerge(existing: Omit<Backup, 'app' | 'version' | 'exportedAt'>, incoming: Backup): MergePlan {
  const playlistIds = new Set(existing.playlists.map(item => item.id));
  const lessonsById = new Map(existing.lessons.map(item => [item.id, item]));
  const attemptKeys = new Set(existing.attempts.map(item => `${item.lessonId}|${item.sentenceIndex}|${item.at}`));
  const sessionKeys = new Set(existing.sessions.map(item => `${item.lessonId}|${item.startedAt}`));

  const lessons = incoming.lessons.map(lesson => {
    const local = lessonsById.get(lesson.id);
    if (!local) return lesson;
    const progress = { ...local.progress };
    for (const [index, value] of Object.entries(lesson.progress)) {
      const mine = progress[Number(index)];
      progress[Number(index)] = mine
        ? { best: Math.max(mine.best, value.best), attempts: Math.max(mine.attempts, value.attempts), lastAt: Math.max(mine.lastAt, value.lastAt) }
        : value;
    }
    return {
      ...local,
      sentences: local.sentences ?? lesson.sentences,
      subtitleSource: local.subtitleSource ?? lesson.subtitleSource,
      progress,
      position: Math.max(local.position ?? 0, lesson.position ?? 0),
      lastOpenedAt: Math.max(local.lastOpenedAt ?? 0, lesson.lastOpenedAt ?? 0) || undefined,
    };
  });

  return {
    playlists: incoming.playlists.filter(item => !playlistIds.has(item.id)),
    lessons,
    attempts: incoming.attempts.filter(item => !attemptKeys.has(`${item.lessonId}|${item.sentenceIndex}|${item.at}`)).map(withoutId),
    sessions: incoming.sessions.filter(item => !sessionKeys.has(`${item.lessonId}|${item.startedAt}`)).map(withoutId),
  };
}
