import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pairFiles, titleFromFileName } from './folder-import.ts';

const file = (name: string) => ({ name });

test('titles come from file names, prefixes and slugs cleaned up', () => {
  assert.equal(titleFromFileName('VOA_002_Study-Shows-How-Earth-s-Orbit-Affects-Ice-Ages.mp3'), "Study Shows How Earth's Orbit Affects Ice Ages");
  assert.equal(titleFromFileName('VOA_053_Don-t-Miss-a-Thing-With-Eagle-Eyes.mp3'), "Don't Miss a Thing With Eagle Eyes");
  assert.equal(titleFromFileName('03 - Lecture on climate.m4a'), 'Lecture on climate');
  assert.equal(titleFromFileName('podcast_episode.mp3'), 'podcast episode');
  assert.equal(titleFromFileName('2024.mp3'), '2024');
});

test('media is paired with same-named subtitles and transcripts, sorted naturally', () => {
  const groups = pairFiles([
    file('VOA_010_Ten.mp3'), file('VOA_002_Two.SRT'), file('VOA_002_Two.mp3'),
    file('VOA_010_Ten.txt'), file('notes.txt'), file('VOA_002_Two.vtt'), file('cover.jpg'),
  ]);
  assert.deepEqual(groups.map(group => [group.media.name, group.subtitle?.name, group.transcript?.name]), [
    ['VOA_002_Two.mp3', 'VOA_002_Two.SRT', undefined],
    ['VOA_010_Ten.mp3', undefined, 'VOA_010_Ten.txt'],
  ]);
});

test('a folder with no media gives no lessons', () => {
  assert.deepEqual(pairFiles([file('a.srt'), file('b.txt')]), []);
});
