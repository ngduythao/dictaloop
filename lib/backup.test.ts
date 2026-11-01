import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackupError, createBackup, parseBackup, planMerge } from './backup.ts';
import type { Lesson } from './model.ts';

const lesson = (id: string, progress: Lesson['progress'] = {}): Lesson => ({
  id, playlistId: 'p', order: 0, title: id, createdAt: 1,
  source: { kind: 'url', url: `https://example.com/${id}.mp3` },
  sentences: [{ start: 0, end: 1, text: 'Hi.' }], subtitleSource: 'srt', progress,
});

test('a backup round-trips through JSON without local ids', () => {
  const backup = createBackup({
    playlists: [{ id: 'p', title: 'VOA', createdAt: 1 }],
    lessons: [lesson('a')],
    attempts: [{ id: 7, lessonId: 'a', sentenceIndex: 0, answer: 'hi', score: 100, correct: true, at: 5 }],
    sessions: [{ id: 3, lessonId: 'a', startedAt: 1, endedAt: 9, checked: 1, correct: 1 }],
  }, 42);
  const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(parsed.exportedAt, 42);
  assert.equal('id' in parsed.attempts[0], false);
  assert.equal('id' in parsed.sessions[0], false);
});

test('rejects files that are not backups, newer or damaged', () => {
  assert.throws(() => parseBackup({ hello: 1 }), BackupError);
  assert.throws(() => parseBackup({ app: 'dictaloop', version: 99 }), /newer-version/);
  assert.throws(() => parseBackup({ app: 'dictaloop', version: 1, playlists: [], lessons: [{ id: 1 }], attempts: [], sessions: [] }), /damaged/);
});

test('merge keeps local media, takes the best progress and skips duplicates', () => {
  const local = lesson('a', { 0: { best: 60, attempts: 2, lastAt: 10 } });
  local.source = { kind: 'file', path: 'media/a', fileName: 'a.mp3', mime: 'audio/mpeg', size: 1 };
  const existing = {
    playlists: [{ id: 'p', title: 'VOA', createdAt: 1 }],
    lessons: [local],
    attempts: [{ lessonId: 'a', sentenceIndex: 0, answer: 'x', score: 60, correct: false, at: 10 }],
    sessions: [],
  };
  const incoming = createBackup({
    playlists: [{ id: 'p', title: 'VOA', createdAt: 1 }, { id: 'q', title: 'New', createdAt: 2 }],
    lessons: [lesson('a', { 0: { best: 90, attempts: 1, lastAt: 20 } }), lesson('b')],
    attempts: [
      { lessonId: 'a', sentenceIndex: 0, answer: 'x', score: 60, correct: false, at: 10 },
      { lessonId: 'a', sentenceIndex: 0, answer: 'y', score: 90, correct: false, at: 20 },
    ],
    sessions: [{ lessonId: 'a', startedAt: 5, endedAt: 30, checked: 1, correct: 0 }],
  });
  const plan = planMerge(existing, incoming);
  assert.deepEqual(plan.playlists.map(item => item.id), ['q']);
  const merged = plan.lessons.find(item => item.id === 'a')!;
  assert.equal(merged.source.kind, 'file');
  assert.deepEqual(merged.progress[0], { best: 90, attempts: 2, lastAt: 20 });
  assert.ok(plan.lessons.some(item => item.id === 'b'));
  assert.deepEqual(plan.attempts.map(item => item.at), [20]);
  assert.equal(plan.sessions.length, 1);
});
