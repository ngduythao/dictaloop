import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lesson } from './model.ts';
import { applyAttempt, currentLesson, formatClock, formatDuration, groupRounds, groupSections, lessonStats, overallAccuracy, reviewItems, streakDays } from './progress.ts';

type TestLesson = Pick<Lesson, 'id' | 'order' | 'sentences' | 'progress' | 'lastOpenedAt'>;

const sentences = (n: number) => Array.from({ length: n }, (_, i) => ({ start: i * 10, end: i * 10 + 9, text: `s${i}` }));

test('lesson stats: new, in progress, done', () => {
  assert.equal(lessonStats({ sentences: sentences(3), progress: {} }).status, 'new');
  const partial = lessonStats({ sentences: sentences(3), progress: { 0: { best: 100, attempts: 1, lastAt: 1 }, 2: { best: 80, attempts: 2, lastAt: 2 } } });
  assert.deepEqual(partial, { total: 3, checked: 2, perfect: 1, average: 90, percent: 67, status: 'in-progress' });
  const done = lessonStats({ sentences: sentences(2), progress: { 0: { best: 100, attempts: 1, lastAt: 1 }, 1: { best: 50, attempts: 1, lastAt: 1 } } });
  assert.equal(done.status, 'done');
  assert.equal(lessonStats({ sentences: null, progress: {} }).status, 'new', 'a lesson without subtitles is never done');
});

test('progress outside the current sentences is ignored', () => {
  const stats = lessonStats({ sentences: sentences(1), progress: { 0: { best: 100, attempts: 1, lastAt: 1 }, 5: { best: 10, attempts: 1, lastAt: 1 } } });
  assert.equal(stats.checked, 1);
  assert.equal(stats.status, 'done');
});

test('applyAttempt keeps the best score and counts attempts', () => {
  let progress = applyAttempt({}, 2, 70, 100);
  progress = applyAttempt(progress, 2, 50, 200);
  assert.deepEqual(progress[2], { best: 70, attempts: 2, lastAt: 200 });
});

test('review items are checked sentences below 100%, in lesson order', () => {
  const lessons: TestLesson[] = [
    { id: 'b', order: 1, sentences: sentences(3), progress: { 1: { best: 90, attempts: 1, lastAt: 1 } } },
    { id: 'a', order: 0, sentences: sentences(3), progress: { 2: { best: 40, attempts: 1, lastAt: 1 }, 0: { best: 100, attempts: 1, lastAt: 1 } } },
  ];
  assert.deepEqual(reviewItems(lessons), [
    { lessonId: 'a', sentenceIndex: 2, best: 40 },
    { lessonId: 'b', sentenceIndex: 1, best: 90 },
  ]);
});

test('rounds of five and sections of about a minute', () => {
  assert.deepEqual(groupRounds([1, 2, 3, 4, 5, 6, 7]).map(group => group.items), [[1, 2, 3, 4, 5], [6, 7]]);
  const sections = groupSections(sentences(14));
  assert.deepEqual(sections.map(section => [section.from, section.to]), [[0, 5], [6, 11], [12, 13]]);
  assert.equal(sections[0].end, 59);
  assert.deepEqual(groupSections([]), []);
});

test('streak counts consecutive days ending today or yesterday', () => {
  const day = 86_400_000, now = new Date(2026, 9, 31, 20).getTime();
  assert.equal(streakDays([now, now - day, now - 2 * day], now), 3);
  assert.equal(streakDays([now - day, now - 2 * day], now), 2, 'not practised yet today');
  assert.equal(streakDays([now - 3 * day], now), 0);
  assert.equal(streakDays([], now), 0);
});

test('accuracy, resume target and formatting', () => {
  assert.equal(overallAccuracy([{ progress: { 0: { best: 100, attempts: 1, lastAt: 1 } } }, { progress: { 0: { best: 80, attempts: 1, lastAt: 1 } } }]), 90);
  assert.equal(overallAccuracy([]), 0);
  const lessons: TestLesson[] = [
    { id: 'done', order: 0, sentences: sentences(1), progress: { 0: { best: 100, attempts: 1, lastAt: 1 } }, lastOpenedAt: 50 },
    { id: 'second', order: 1, sentences: sentences(2), progress: {} },
    { id: 'third', order: 2, sentences: sentences(2), progress: {}, lastOpenedAt: 10 },
  ];
  assert.equal(currentLesson(lessons)?.id, 'third', 'the last opened unfinished lesson wins');
  assert.equal(currentLesson(lessons.slice(0, 2))?.id, 'second');
  assert.equal(formatDuration(20_520), '5 giờ 42 phút');
  assert.equal(formatDuration(271, 'en'), '4 min');
  assert.equal(formatClock(271), '4:31');
});
