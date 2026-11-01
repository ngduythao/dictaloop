import { useSyncExternalStore } from 'react';
import { en } from './i18n.en';
import { vi } from './i18n.vi';

// UI language store. `t()` works outside React (event handlers, async loaders);
// components call `useLang()` so a language switch re-renders them.

export type Lang = 'vi' | 'en';
export type DictKey = keyof typeof vi;
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const STORAGE_KEY = 'dictaloop-lang';
const dicts: Record<Lang, Record<DictKey, string>> = { vi, en };

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') return stored;
  } catch { /* localStorage unavailable (SSR, private mode) */ }
  // English by default (the interface itself is practice); Vietnamese is opt-in.
  return 'en';
}

// The pre-rendered HTML is English; the saved choice is applied after mount
// (applyStoredLang) so hydration sees the same text the server rendered.
let currentLang: Lang = 'en';
const listeners = new Set<() => void>();

export function applyStoredLang(): void {
  setLang(loadLang());
}

function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en');
}

// `{name}` placeholders are filled from `params`; a missing key falls back to English.
export function t(key: DictKey, params?: Record<string, string | number>): string {
  const template = dicts[currentLang][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

// Plural-aware lookup: uses `<key>.one` when `count` is 1 (English needs it;
// the Vietnamese `.one` strings are the same as the plural ones).
export function tn(key: DictKey, count: number, params?: Record<string, string | number>): string {
  const singular = `${key}.one`;
  return count === 1 && singular in dicts[currentLang] ? t(singular as DictKey, params) : t(key, params);
}
