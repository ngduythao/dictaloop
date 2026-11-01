import type { Attempt, Lesson, SentenceProgress } from './model.ts';
import type { Sentence } from './subtitles.ts';

export type LessonStatus = 'done' | 'in-progress' | 'new';

export type LessonStats = {
  total: number;
  checked: number;
  perfect: number;
  average: number;
  percent: number;
  status: LessonStatus;
};

// A lesson is done once every sentence has been checked at least once; its
// score is the mean of each sentence's best score.
export function lessonStats(lesson: Pick<Lesson, 'sentences' | 'progress'>): LessonStats {
  const total = lesson.sentences?.length ?? 0;
  const entries = Object.entries(lesson.progress)
    .filter(([index]) => Number(index) < total)
    .map(([, value]) => value);
  const checked = entries.length;
  const perfect = entries.filter(entry => entry.best >= 100).length;
  const average = checked ? Math.round(entries.reduce((sum, entry) => sum + entry.best, 0) / checked) : 0;
  const percent = total ? Math.round(checked / total * 100) : 0;
  const status: LessonStatus = total && checked >= total ? 'done' : checked ? 'in-progress' : 'new';
  return { total, checked, perfect, average, percent, status };
}

export function applyAttempt(
  progress: Record<number, SentenceProgress>,
  sentenceIndex: number,
  score: number,
  at: number,
): Record<number, SentenceProgress> {
  const previous = progress[sentenceIndex];
  return {
    ...progress,
    [sentenceIndex]: {
      best: Math.max(previous?.best ?? 0, score),
      attempts: (previous?.attempts ?? 0) + 1,
      lastAt: Math.max(previous?.lastAt ?? 0, at),
    },
  };
}

export type ReviewItem = { lessonId: string; sentenceIndex: number; best: number };

// Sentences that were checked but never fully right, in lesson order.
export function reviewItems(lessons: Pick<Lesson, 'id' | 'order' | 'sentences' | 'progress'>[]): ReviewItem[] {
  return [...lessons]
    .sort((a, b) => a.order - b.order)
    .flatMap(lesson => Object.entries(lesson.progress)
      .map(([index, value]) => ({ lessonId: lesson.id, sentenceIndex: Number(index), best: value.best }))
      .filter(item => item.best < 100 && item.sentenceIndex < (lesson.sentences?.length ?? 0))
      .sort((a, b) => a.sentenceIndex - b.sentenceIndex));
}

export type Group<T> = { index: number; items: T[] };

export function groupRounds<T>(items: T[], size = 5): Group<T>[] {
  const groups: Group<T>[] = [];
  for (let start = 0; start < items.length; start += size) groups.push({ index: groups.length, items: items.slice(start, start + size) });
  return groups;
}

export type Section = { index: number; from: number; to: number; start: number; end: number };

// Splits a lesson's sentences into sections of roughly `span` seconds each.
export function groupSections(sentences: Sentence[], span = 60): Section[] {
  const sections: Section[] = [];
  sentences.forEach((sentence, index) => {
    const current = sections[sections.length - 1];
    if (!current || sentence.start >= current.start + span) {
      sections.push({ index: sections.length, from: index, to: index, start: sentence.start, end: sentence.end });
    } else {
      current.to = index;
      current.end = Math.max(current.end, sentence.end);
    }
  });
  return sections;
}

const dayKey = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

// Consecutive practice days ending today, or yesterday if today has no practice yet.
export function streakDays(times: number[], now = Date.now()): number {
  const days = new Set(times.map(dayKey));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function overallAccuracy(lessons: Pick<Lesson, 'progress'>[]): number {
  const bests = lessons.flatMap(lesson => Object.values(lesson.progress).map(entry => entry.best));
  return bests.length ? Math.round(bests.reduce((sum, best) => sum + best, 0) / bests.length) : 0;
}

export function checkedSentenceCount(attempts: Pick<Attempt, 'lessonId' | 'sentenceIndex'>[]): number {
  return new Set(attempts.map(attempt => `${attempt.lessonId}:${attempt.sentenceIndex}`)).size;
}

// The lesson to resume: the most recently opened unfinished one, else the first unfinished in order.
export function currentLesson<T extends Pick<Lesson, 'order' | 'sentences' | 'progress' | 'lastOpenedAt'>>(lessons: T[]): T | undefined {
  const unfinished = lessons.filter(lesson => lessonStats(lesson).status !== 'done');
  const opened = unfinished.filter(lesson => lesson.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
  return opened[0] ?? [...unfinished].sort((a, b) => a.order - b.order)[0];
}

export function formatDuration(seconds: number, lang: 'vi' | 'en' = 'vi'): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60);
  if (hours) return lang === 'vi' ? `${hours} giờ ${minutes} phút` : `${hours} h ${minutes} min`;
  return lang === 'vi' ? `${minutes} phút` : `${minutes} min`;
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
