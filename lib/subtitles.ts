export type Sentence = { start: number; end: number; text: string };
export type TimedTranscriptChunk = Sentence;
const endsSentence = (text: string) => {
  const value = text.trim().replace(/["”')\]]+$/, '');
  return /[!?]$/.test(value) || /(?:^|[^.])\.$/.test(value);
};

function splitTimedChunk(chunk: TimedTranscriptChunk): TimedTranscriptChunk[] {
  const parts = chunk.text.match(/[^.!?]+(?:[.!?]+["”')\]]*)?|[.!?]+/g)?.map(part => part.trim()).filter(Boolean) || [];
  if (parts.length <= 1) return [{ ...chunk, text: chunk.text.trim() }];
  const totalWeight = parts.reduce((sum, part) => sum + Math.max(1, part.replace(/\s/g, '').length), 0);
  const duration = Math.max(0, chunk.end - chunk.start);
  let elapsedWeight = 0;
  return parts.map((text, index) => {
    const start = chunk.start + duration * elapsedWeight / totalWeight;
    elapsedWeight += Math.max(1, text.replace(/\s/g, '').length);
    const end = index === parts.length - 1 ? chunk.end : chunk.start + duration * elapsedWeight / totalWeight;
    return { start, end, text };
  });
}

export function mergeTranscriptChunks(chunks: TimedTranscriptChunk[], maxDuration = 15, maxGap = 1.5, maxWords = 30): Sentence[] {
  const pieces = chunks
    .filter(chunk => chunk.text.trim() && Number.isFinite(chunk.start) && Number.isFinite(chunk.end) && chunk.end > chunk.start)
    .sort((a, b) => a.start - b.start)
    .flatMap(splitTimedChunk);
  const result: Sentence[] = [];
  let current: Sentence | undefined;
  const flush = () => {
    if (!current) return;
    result.push({ ...current, text: current.text.replace(/\s+/g, ' ').trim() });
    current = undefined;
  };
  for (const piece of pieces) {
    const gap = current ? piece.start - current.end : 0;
    const nextDuration = current ? piece.end - current.start : piece.end - piece.start;
    const nextWords = current ? `${current.text} ${piece.text}`.trim().split(/\s+/).length : piece.text.trim().split(/\s+/).length;
    if (current && (gap > maxGap || nextDuration > maxDuration || nextWords > maxWords)) flush();
    current = current
      ? { start: current.start, end: Math.max(current.end, piece.end), text: `${current.text} ${piece.text}` }
      : { ...piece };
    if (endsSentence(current.text) || current.end - current.start >= maxDuration) flush();
  }
  flush();
  return result;
}

const seconds = (s: string) => s.replace(',', '.').split(':').reduce((n, p) => n * 60 + Number(p), 0);
export function parseSubtitles(input: string): Sentence[] {
  const cues: Sentence[] = [];
  for (const block of input.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const m = lines[i].match(/((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/);
    if (!m) continue;
    const text = lines.slice(i + 1).join(' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const start = seconds(m[1]), end = seconds(m[2]);
    if (text && Number.isFinite(start) && end > start) cues.push({ start, end, text });
  }
  cues.sort((a,b) => a.start-b.start);
  const result: Sentence[] = [];
  let current: Sentence | undefined;
  for (const cue of cues) {
    if (current && cue.start-current.end > 1.5) { result.push(current); current=undefined; }
    current = current ? { start: current.start, end: Math.max(current.end,cue.end), text: current.text+' '+cue.text } : {...cue};
    if (endsSentence(current.text)) {result.push(current);current=undefined;}
  }
  if(current) result.push(current);
  return result;
}
const SMALL_NUMBERS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 };
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90,
  hundredth: 100, thousandth: 1e3, millionth: 1e6,
};
const isNumberWord = (word: string) => word in SMALL_NUMBERS || word in TENS || word in SCALES || word === 'hundred';

const isDigit = (word: string) => word in SMALL_NUMBERS && SMALL_NUMBERS[word] < 10;

// Turns runs of number words into digits ("eleven thousand" -> "11000",
// "twenty seventh" -> "27", "one point five" -> "1.5", "27th" -> "27") so an answer
// written in words or digits is graded the same, the way IELTS accepts either.
// Both the answer and the target go through this, so a word like "one" or
// "second" turning into a digit on both sides never causes a mismatch.
function numberWordsToDigits(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const startsRun = isNumberWord(words[i]) || words[i] in ORDINALS
      || (words[i] === 'a' && (words[i + 1] === 'hundred' || words[i + 1] in SCALES));
    if (!startsRun) {
      out.push(words[i++].replace(/^(\d+)(st|nd|rd|th)$/, '$1'));
      continue;
    }
    let total = 0, current = 0, j = i;
    if (words[j] === 'a') { current = 1; j++; }
    for (; j < words.length; j++) {
      const word = words[j];
      if (word === 'and' && j > i && isNumberWord(words[j + 1] ?? '')) continue;
      if (word in SMALL_NUMBERS) current += SMALL_NUMBERS[word];
      else if (word in TENS) current += TENS[word];
      else if (word === 'hundred') current = (current || 1) * 100;
      else if (word in SCALES) { total += (current || 1) * SCALES[word]; current = 0; }
      else if (word in ORDINALS) {
        const value = ORDINALS[word];
        current = value >= 100 ? (current || 1) * value : current + value;
        j++;
        break; // an ordinal ends the number
      } else break;
    }
    let value = String(total + current);
    if (words[j] === 'point' && isDigit(words[j + 1] ?? '')) {
      let decimals = '';
      for (j++; j < words.length && isDigit(words[j]); j++) decimals += SMALL_NUMBERS[words[j]];
      value += '.' + decimals;
    }
    out.push(value);
    i = j;
  }
  return out;
}

export function normalize(s: string) {
  const cleaned = s.toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')       // 11,000 -> 11000
    .replace(/%/g, ' percent ')
    .replace(/\bper cent\b/g, 'percent')
    .replace(/[-‐‑–—/]/g, ' ')                   // long-term -> long term
    .replace(/(\d)\.(?=\d)/g, '$1§')              // keep decimal points: 1.5
    .replace(/[^a-z0-9'§\s]/g, ' ')
    .replace(/§/g, '.')
    .replace(/(^|\s)'+|'+(?=\s|$)/g, ' ');        // quotes around words, not "earth's"
  const words = cleaned.split(/\s+/).filter(Boolean);
  return numberWordsToDigits(words).join(' ');
}

export type AnswerComparison = {
  correct: boolean;
  score: number;
  missing: string[];
  extra: string[];
  // The target's normalized words and whether each was matched by the answer.
  targetWords: string[];
  matched: boolean[];
};

export function compareAnswer(input: string, target: string): AnswerComparison {
  const inputWords = normalize(input).split(' ').filter(Boolean);
  const targetWords = normalize(target).split(' ').filter(Boolean);
  const rows = targetWords.length + 1;
  const columns = inputWords.length + 1;
  const lcs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < columns; j++) {
      lcs[i][j] = targetWords[i - 1] === inputWords[j - 1]
        ? lcs[i - 1][j - 1] + 1
        : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    }
  }

  const matchedTarget = new Set<number>();
  const matchedInput = new Set<number>();
  let i = targetWords.length;
  let j = inputWords.length;
  while (i > 0 && j > 0) {
    if (targetWords[i - 1] === inputWords[j - 1]) {
      matchedTarget.add(i - 1);
      matchedInput.add(j - 1);
      i--;
      j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const matches = lcs[targetWords.length][inputWords.length];
  const total = Math.max(targetWords.length, inputWords.length, 1);
  return {
    correct: normalize(input) === normalize(target),
    score: Math.round(matches / total * 100),
    missing: targetWords.filter((_, wordIndex) => !matchedTarget.has(wordIndex)),
    extra: inputWords.filter((_, wordIndex) => !matchedInput.has(wordIndex)),
    targetWords,
    matched: targetWords.map((_, wordIndex) => matchedTarget.has(wordIndex)),
  };
}

export type MarkedWord = { text: string; missing: boolean };

// Splits the original target sentence (case and punctuation kept) into words,
// flagging the ones the answer missed. Words are lined up with the normalized
// target one by one; a word whose normalization merges with its neighbours
// (spelled-out numbers) is never flagged by mistake, and alignment resumes after it.
export function markTargetWords(target: string, comparison: Pick<AnswerComparison, 'targetWords' | 'matched'>): MarkedWord[] {
  const { targetWords, matched } = comparison;
  let position = 0;
  return target.split(/\s+/).filter(Boolean).map(text => {
    const tokens = normalize(text).split(' ').filter(Boolean);
    if (!tokens.length) return { text, missing: false };
    const alignsAt = (start: number) => tokens.every((token, offset) => targetWords[start + offset] === token);
    // After a merged number the words drift apart: look a few tokens ahead to line up again.
    const skip = [0, 1, 2, 3].find(ahead => alignsAt(position + ahead));
    if (skip === undefined) return { text, missing: false };
    position += skip;
    const missing = tokens.some((_, offset) => !matched[position + offset]);
    position += tokens.length;
    return { text, missing };
  });
}
