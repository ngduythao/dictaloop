'use client';

import { Share } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { t } from '@/lib/i18n';

// iOS Safari evicts site data after 7 days without a visit unless the app is
// added to the Home Screen, so iPhone users get a one-time nudge.

const KEY = 'dictaloop-install-hint-dismissed';
const listeners = new Set<() => void>();

function shouldShow(): boolean {
  try {
    if (localStorage.getItem(KEY) === '1') return false;
  } catch { /* ignore */ }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

export function InstallHint() {
  const show = useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    shouldShow,
    () => false,
  );
  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    listeners.forEach(listener => listener());
  };
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl bg-[#f8f8f8] p-4 text-sm">
      <Share className="mt-0.5 size-4 shrink-0 text-neutral-700" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <strong className="font-semibold">{t('pwa.title')}</strong>
        <p className="m-0 leading-relaxed text-neutral-600">{t('pwa.body')}</p>
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-medium hover:bg-neutral-200">{t('pwa.dismiss')}</button>
    </div>
  );
}
