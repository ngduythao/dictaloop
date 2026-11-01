import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareAnswer, markTargetWords, normalize, parseSubtitles } from './subtitles.ts';

test('ignores case, punctuation and extra spaces', () => {
  assert.equal(normalize('  A recent  study, suggests… '), 'a recent study suggests');
  assert.ok(compareAnswer('a RECENT study suggests', 'A recent study suggests.').correct);
});

test('numbers count the same in digits or words', () => {
  const target = 'The next ice age will begin in about 11,000 years.';
  assert.ok(compareAnswer('the next ice age will begin in about 11000 years', target).correct);
  assert.ok(compareAnswer('the next ice age will begin in about eleven thousand years', target).correct);
  assert.ok(compareAnswer('over the last nine hundred thousand years', 'over the last 900,000 years').correct);
  assert.ok(compareAnswer('one hundred and five people', '105 people').correct);
  assert.ok(compareAnswer('a hundred people', '100 people').correct);
  assert.ok(compareAnswer('it ended in sixty six thousand years', 'It ended in 66,000 years').correct);
});

test('ordinals, decimals and percent', () => {
  assert.ok(compareAnswer('on February twenty-seventh', 'on February 27th').correct);
  assert.ok(compareAnswer('on February 27', 'on February 27th').correct);
  assert.ok(compareAnswer('one point five metres', '1.5 metres').correct);
  assert.ok(!compareAnswer('15 metres', '1.5 metres').correct, 'a decimal point must not vanish');
  assert.ok(compareAnswer('fifty percent', '50%').correct);
  assert.ok(compareAnswer('50 per cent', '50 percent').correct);
});

test('hyphens and slashes split words instead of gluing them', () => {
  assert.ok(compareAnswer('long term climate', "long-term climate").correct);
  assert.ok(compareAnswer('a million year record', 'a million-year record').correct);
  assert.ok(compareAnswer('either or', 'either/or').correct);
});

test('apostrophes inside words stay, quotes around words go', () => {
  assert.equal(normalize("Earth's orbit"), "earth's orbit");
  assert.ok(compareAnswer("the earth's orbit", 'the Earth’s orbit').correct);
  assert.ok(compareAnswer('to mushroom', "'To Mushroom'").correct);
});

test('reports missing and extra words with a score', () => {
  const result = compareAnswer('a recent study suggest the next', 'A recent study suggests the next');
  assert.equal(result.correct, false);
  assert.deepEqual(result.missing, ['suggests']);
  assert.deepEqual(result.extra, ['suggest']);
  assert.equal(result.score, 83);
});

test('parses SRT cues into sentences', () => {
  const srt = '1\n00:00:00,000 --> 00:00:02,000\nHello there,\n\n2\n00:00:02,000 --> 00:00:04,500\nhow are you?\n\n3\n00:00:05,000 --> 00:00:06,000\nFine.\n';
  assert.deepEqual(parseSubtitles(srt), [
    { start: 0, end: 4.5, text: 'Hello there, how are you?' },
    { start: 5, end: 6, text: 'Fine.' },
  ]);
});

test('marks the missed words in the original sentence', () => {
  const target = 'An ice age is a period of reduced temperatures, causing ice to cover large areas.';
  const marked = markTargetWords(target, compareAnswer('An ice age is a period of reduced temperature causing ice to cover large area', target));
  assert.deepEqual(marked.filter(word => word.missing).map(word => word.text), ['temperatures,', 'areas.']);
  assert.equal(marked.map(word => word.text).join(' '), target, 'the sentence is shown exactly as written');
});

test('spelled-out numbers in the target never get flagged by mistake', () => {
  const target = 'It ended eleven thousand years ago.';
  const marked = markTargetWords(target, compareAnswer('it ended 11000 years ago', target));
  assert.deepEqual(marked.filter(word => word.missing), []);
  const later = markTargetWords(target, compareAnswer('it ended eleven thousand year ago', target));
  assert.deepEqual(later.filter(word => word.missing).map(word => word.text), ['years'], 'words after the number are still checked');
});
