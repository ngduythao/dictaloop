import { useSyncExternalStore } from 'react';

// Per-device preferences, kept in localStorage (small, synchronous, per browser).

export type Settings = { repeats: number; rate: number };

export const REPEAT_OPTIONS = [1, 2, 3, 4, 5];
export const RATE_OPTIONS = [0.75, 0.85, 1, 1.1, 1.25];

const STORAGE_KEY = 'dictaloop-settings';
const DEFAULTS: Settings = { repeats: 2, rate: 1 };

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    return {
      repeats: REPEAT_OPTIONS.includes(Number(stored.repeats)) ? Number(stored.repeats) : DEFAULTS.repeats,
      rate: RATE_OPTIONS.includes(Number(stored.rate)) ? Number(stored.rate) : DEFAULTS.rate,
    };
  } catch {
    return DEFAULTS;
  }
}

function getSettings(): Settings {
  if (!loaded && typeof window !== 'undefined') {
    current = load();
    loaded = true;
  }
  return current;
}

export function updateSettings(changes: Partial<Settings>): void {
  current = { ...getSettings(), ...changes };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
