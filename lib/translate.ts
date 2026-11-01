import { t } from './i18n';

// English -> Vietnamese with Chrome's on-device Translator API (Chrome 138+ on
// desktop); English definitions from the free dictionaryapi.dev service.

type LocalTranslator = { translate(text: string): Promise<string> };
type TranslatorFactory = {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: { addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void }) => void;
  }): Promise<LocalTranslator>;
};

declare global {
  interface Window { Translator?: TranslatorFactory }
}

let translator: Promise<LocalTranslator> | null = null;
const cache = new Map<string, string>();

export function translationSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Translator);
}

function getTranslator(onStatus?: (status: string) => void): Promise<LocalTranslator> {
  translator ??= (async () => {
    const factory = window.Translator;
    if (!factory) throw new Error(t('tr.unsupportedBrowser'));
    const availability = await factory.availability({ sourceLanguage: 'en', targetLanguage: 'vi' });
    if (availability === 'unavailable') throw new Error(t('tr.unsupportedPair'));
    onStatus?.(availability === 'downloadable' ? t('tr.downloading') : t('tr.preparing'));
    return factory.create({
      sourceLanguage: 'en',
      targetLanguage: 'vi',
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', event => onStatus?.(t('tr.downloadingPct', { p: Math.round(event.loaded * 100) })));
      },
    });
  })().catch(error => {
    translator = null;
    throw error;
  });
  return translator;
}

export async function translateToVietnamese(text: string, onStatus?: (status: string) => void): Promise<string> {
  const cached = cache.get(text);
  if (cached) return cached;
  const translated = await (await getTranslator(onStatus)).translate(text);
  cache.set(text, translated);
  return translated;
}

export type Definition = { definition?: string; partOfSpeech?: string };
const definitions = new Map<string, Promise<Definition>>();

export function lookupDefinition(word: string): Promise<Definition> {
  const key = word.toLowerCase();
  let pending = definitions.get(key);
  if (!pending) {
    pending = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
      .then(async response => {
        if (!response.ok) throw new Error(t('word.notFound'));
        const entries = await response.json() as Array<{ meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }> }>;
        const meaning = entries[0]?.meanings?.find(item => item.definitions?.[0]?.definition);
        return { definition: meaning?.definitions?.[0]?.definition, partOfSpeech: meaning?.partOfSpeech };
      });
    pending.catch(() => definitions.delete(key));
    definitions.set(key, pending);
  }
  return pending;
}
