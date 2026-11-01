import { createBackup, parseBackup, planMerge, type Backup } from './backup';
import { db } from './db';
import { deleteMedia } from './media-store';
import type { Attempt, Lesson, LessonSource, Playlist, SubtitleSource } from './model';
import { applyAttempt } from './progress';
import type { Sentence } from './subtitles';

const newId = () => crypto.randomUUID();

export async function createPlaylist(title: string): Promise<Playlist> {
  const playlist = { id: newId(), title, createdAt: Date.now() };
  await db.playlists.add(playlist);
  return playlist;
}

async function nextOrder(playlistId: string): Promise<number> {
  const last = await db.lessons.where('[playlistId+order]').between([playlistId, -Infinity], [playlistId, Infinity]).last();
  return last ? last.order + 1 : 0;
}

export type NewLesson = {
  id?: string;
  title: string;
  source: LessonSource;
  sentences?: Sentence[] | null;
  subtitleSource?: SubtitleSource | null;
  subtitleName?: string;
  transcriptText?: string;
  durationSec?: number;
};

export async function addLessons(playlistId: string, items: NewLesson[]): Promise<Lesson[]> {
  let order = await nextOrder(playlistId);
  const lessons: Lesson[] = items.map(item => ({
    id: item.id ?? newId(),
    playlistId,
    order: order++,
    title: item.title,
    source: item.source,
    durationSec: item.durationSec,
    sentences: item.sentences?.length ? item.sentences : null,
    subtitleSource: item.sentences?.length ? item.subtitleSource ?? null : null,
    subtitleName: item.subtitleName,
    transcriptText: item.transcriptText,
    progress: {},
    createdAt: Date.now(),
  }));
  await db.lessons.bulkAdd(lessons);
  return lessons;
}

export const newLessonId = newId;

export async function updateLesson(id: string, changes: Partial<Omit<Lesson, 'id'>>): Promise<void> {
  await db.lessons.update(id, changes);
}

// Saving new subtitles resets progress: sentence numbers no longer line up.
export async function setLessonSentences(id: string, sentences: Sentence[], subtitleSource: SubtitleSource, subtitleName: string): Promise<void> {
  await db.lessons.update(id, { sentences, subtitleSource, subtitleName, progress: {}, position: 0 });
}

export async function recordAttempt(attempt: Omit<Attempt, 'id'>): Promise<void> {
  await db.transaction('rw', db.attempts, db.lessons, async () => {
    await db.attempts.add(attempt);
    const lesson = await db.lessons.get(attempt.lessonId);
    if (lesson) await db.lessons.update(lesson.id, { progress: applyAttempt(lesson.progress, attempt.sentenceIndex, attempt.score, attempt.at) });
  });
}

// One practice session per lesson visit; extended while checks keep coming.
export async function touchSession(lessonId: string, correct: boolean, now = Date.now(), gapMs = 30 * 60_000): Promise<void> {
  const last = await db.sessions.where('lessonId').equals(lessonId).last();
  if (last && now - last.endedAt <= gapMs) {
    await db.sessions.update(last.id!, { endedAt: now, checked: last.checked + 1, correct: last.correct + (correct ? 1 : 0) });
  } else {
    await db.sessions.add({ lessonId, startedAt: now, endedAt: now, checked: 1, correct: correct ? 1 : 0 });
  }
}

export async function deleteLesson(id: string): Promise<void> {
  const lesson = await db.lessons.get(id);
  await db.transaction('rw', db.lessons, db.attempts, db.sessions, async () => {
    await db.lessons.delete(id);
    await db.attempts.where('lessonId').equals(id).delete();
    await db.sessions.where('lessonId').equals(id).delete();
  });
  if (lesson?.source.kind === 'file') await deleteMedia(lesson.source.path);
}

export async function deletePlaylist(id: string): Promise<void> {
  const lessons = await db.lessons.where('playlistId').equals(id).toArray();
  for (const lesson of lessons) await deleteLesson(lesson.id);
  await db.playlists.delete(id);
}

export async function exportBackup(): Promise<Backup> {
  const [playlists, lessons, attempts, sessions] = await Promise.all([
    db.playlists.toArray(), db.lessons.toArray(), db.attempts.toArray(), db.sessions.toArray(),
  ]);
  return createBackup({ playlists, lessons, attempts, sessions });
}

export async function importBackup(json: unknown): Promise<{ lessons: number; attempts: number }> {
  const incoming = parseBackup(json);
  const [playlists, lessons, attempts, sessions] = await Promise.all([
    db.playlists.toArray(), db.lessons.toArray(), db.attempts.toArray(), db.sessions.toArray(),
  ]);
  const plan = planMerge({ playlists, lessons, attempts, sessions }, incoming);
  await db.transaction('rw', db.playlists, db.lessons, db.attempts, db.sessions, async () => {
    await db.playlists.bulkAdd(plan.playlists);
    await db.lessons.bulkPut(plan.lessons);
    await db.attempts.bulkAdd(plan.attempts);
    await db.sessions.bulkAdd(plan.sessions);
  });
  return { lessons: plan.lessons.length, attempts: plan.attempts.length };
}
