'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Menu, PanelLeftClose, PanelLeftOpen, PenLine, Repeat, Route, SlidersHorizontal, Upload, type LucideIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { db } from '@/lib/db';
import { LANGS, applyStoredLang, setLang, t, useLang, type DictKey } from '@/lib/i18n';
import { appHref, pageOf, type Page } from '@/lib/paths';
import { lessonStats } from '@/lib/progress';
import { cn } from '@/lib/utils';

const NAV: { page: Page; label: DictKey; icon: LucideIcon }[] = [
  { page: '/', label: 'nav.roadmap', icon: Route },
  { page: '/practice', label: 'nav.practice', icon: PenLine },
  { page: '/import', label: 'nav.import', icon: Upload },
  { page: '/settings', label: 'nav.settings', icon: SlidersHorizontal },
];

const COLLAPSE_KEY = 'dictaloop-sidebar-collapsed';

// The current page and the collapsed flag come from the browser, read through
// external-store snapshots so the server-rendered HTML (home page, expanded) hydrates cleanly.
const noopSubscribe = () => () => {};
const usePage = () => useSyncExternalStore(noopSubscribe, () => pageOf(window.location.pathname), (): Page => '/');

const collapseListeners = new Set<() => void>();
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };
const useCollapsed = () => useSyncExternalStore(
  listener => { collapseListeners.add(listener); return () => { collapseListeners.delete(listener); }; },
  readCollapsed,
  () => false,
);
function setCollapsed(value: boolean) {
  try { localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
  collapseListeners.forEach(listener => listener());
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <a href={appHref('/')} className="flex items-center gap-2.5 rounded-lg p-1.5 text-neutral-900 no-underline">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-neutral-900 text-white">
        <Repeat className="size-[18px]" aria-hidden />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">{t('app.name')}</span>
          <span className="text-xs text-neutral-500">{t('app.subtitle')}</span>
        </span>
      )}
    </a>
  );
}

function NavLinks({ active, compact, roadmapCount }: { active: Page; compact?: boolean; roadmapCount?: string }) {
  return (
    <nav aria-label={t('nav.aria')} className="flex flex-col gap-0.5">
      {NAV.map(({ page, label, icon: Icon }) => {
        const current = page === active;
        return (
          <a
            key={page}
            href={appHref(page)}
            aria-current={current ? 'page' : undefined}
            title={compact ? t(label) : undefined}
            className={cn(
              'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm no-underline transition-colors',
              current ? 'bg-white font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]' : 'text-neutral-700 hover:bg-black/[0.04]',
              compact && 'justify-center px-0',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!compact && <span className="flex-1">{t(label)}</span>}
            {!compact && page === '/' && roadmapCount && <span className="text-xs text-neutral-500">{roadmapCount}</span>}
          </a>
        );
      })}
    </nav>
  );
}

function LanguageSwitch() {
  const lang = useLang();
  return (
    <div role="group" aria-label={t('lang.aria')} className="flex gap-0.5 rounded-[9px] border border-neutral-200 bg-neutral-100 p-[3px]">
      {LANGS.map(option => (
        <button
          key={option.code}
          type="button"
          aria-pressed={lang === option.code}
          onClick={() => setLang(option.code)}
          className={cn('flex-1 rounded-[7px] py-1.5 text-[13px]', lang === option.code ? 'bg-white font-medium text-neutral-900 shadow-sm' : 'text-neutral-600')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useLang();
  const active = usePage();
  const collapsed = useCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const roadmapCount = lessons?.length ? `${lessons.filter(lesson => lessonStats(lesson).status === 'done').length}/${lessons.length}` : undefined;

  useEffect(() => { applyStoredLang(); }, []);

  const toggleCollapsed = () => setCollapsed(!collapsed);

  return (
    <div className="flex min-h-dvh bg-white text-[14px] text-neutral-900">
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col gap-3 border-r border-[#ececec] bg-[#f8f8f8] px-2.5 py-3 md:flex', collapsed ? 'w-16' : 'w-60')}>
        <Brand compact={collapsed} />
        <NavLinks active={active} compact={collapsed} roadmapCount={roadmapCount} />
        <div className="flex-1" />
        {!collapsed && <LanguageSwitch />}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('nav.expand') : undefined}
          className={cn('flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-neutral-600 hover:bg-black/[0.04]', collapsed && 'justify-center px-0')}
        >
          {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          {!collapsed && t('nav.collapse')}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[#ececec] px-2 py-1.5 md:hidden">
          <Brand />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label={t('nav.openMenu')} className="grid size-11 place-items-center rounded-lg text-neutral-700 hover:bg-neutral-100">
                <Menu className="size-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-3 bg-[#f8f8f8] p-3">
              <SheetTitle className="sr-only">{t('nav.aria')}</SheetTitle>
              <Brand />
              <NavLinks active={active} roadmapCount={roadmapCount} />
              <div className="flex-1" />
              <LanguageSwitch />
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
    </div>
  );
}
