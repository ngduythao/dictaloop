import { useSyncExternalStore } from 'react';
import { DARK_QUERY, THEME_COLORS, THEME_STORAGE_KEY } from './theme-script';

// Colour theme, kept per browser. 'system' follows the device setting. The
// resolved theme is the `data-theme` attribute on <html>, first set by THEME_SCRIPT.

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: Theme[] = ['system', 'light', 'dark'];

let current: Theme | null = null;
const listeners = new Set<() => void>();

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* localStorage unavailable */ }
  return 'system';
}

function getTheme(): Theme {
  if (current === null && typeof window !== 'undefined') current = loadTheme();
  return current ?? 'system';
}

const isDark = () => document.documentElement.dataset.theme === 'dark';

// React can add its own copy of the tag after hydration, so update every one.
const syncThemeColor = () => document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', THEME_COLORS[isDark() ? 'dark' : 'light']));

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  syncThemeColor();
  listeners.forEach(listener => listener());
}

export function setTheme(theme: Theme): void {
  current = theme;
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch { /* ignore */ }
  apply(theme);
}

// Flip between light and dark from whatever is showing now.
export function toggleTheme(): void {
  setTheme(isDark() ? 'light' : 'dark');
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

if (typeof window !== 'undefined') {
  syncThemeColor();
  matchMedia(DARK_QUERY).addEventListener('change', () => { if (getTheme() === 'system') apply('system'); });
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'system');
}
