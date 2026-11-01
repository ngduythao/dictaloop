'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Check, ChevronDown, ChevronRight, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { button, input } from '@/components/app/styles';
import { InstallHint } from '@/components/shell/install-hint';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/lib/db';
import { t, tn, useLang, type Lang } from '@/lib/i18n';
import type { Lesson, Session } from '@/lib/model';
import { appHref } from '@/lib/paths';
import { checkedSentenceCount, currentLesson, formatClock, formatDuration, groupRounds, lessonStats, overallAccuracy, reviewItems, streakDays } from '@/lib/progress';
import { deleteLesson } from '@/lib/repo';
import { cn } from '@/lib/utils';

const PLAYLIST_KEY = 'dictaloop-playlist';
const lessonNumber = (lesson: Lesson) => String(lesson.order + 1).padStart(3, '0');

export function EmptyRoadmap() {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center gap-3 px-6 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-neutral-100 text-neutral-700"><Upload className="size-5" aria-hidden /></span>
      <h1 className="m-0 text-xl font-semibold">{t('roadmap.emptyTitle')}</h1>
      <p className="m-0 text-sm leading-relaxed text-neutral-600">{t('roadmap.emptyBody')}</p>
      <a href={appHref('/import')} className={`${button.primary} mt-2`}>{t('roadmap.emptyAction')}</a>
    </div>
  );
}

function sessionDay(time: number, lang: Lang) {
  const date = new Date(time), today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const clock = date.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `${t('rm.today')} · ${clock}`;
  if (date.toDateString() === yesterday.toDateString()) return `${t('rm.yesterday')} · ${clock}`;
  return `${date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit' })} · ${clock}`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-subtle px-4 py-3.5">
      <span className="text-[13px] text-neutral-600">{label}</span>
      <span className="text-[22px] font-semibold tracking-[-0.01em]">{value}</span>
    </div>
  );
}

function LessonRow({ lesson, isCurrent, isNext }: { lesson: Lesson; isCurrent: boolean; isNext: boolean }) {
  const stats = lessonStats(lesson);
  const duration = lesson.durationSec ? formatClock(lesson.durationSec) : undefined;
  const meta = [duration, lesson.sentences ? tn('rm.sentencesCount', lesson.sentences.length, { n: lesson.sentences.length }) : t('rm.needsSubtitles')].filter(Boolean).join(' · ');
  const remove = async () => {
    if (window.confirm(t('rm.deleteConfirm', { title: lesson.title }))) await deleteLesson(lesson.id);
  };
  return (
    <li className={cn('group flex items-center', isCurrent && 'bg-neutral-100')}>
      <a href={appHref('/practice', { lesson: lesson.id })} aria-current={isCurrent ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 pr-2 text-neutral-900 no-underline md:pl-10">
        <span className="w-7 shrink-0 text-xs text-neutral-500">{lessonNumber(lesson)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate', isCurrent ? 'font-semibold' : 'font-medium')}>{lesson.title}</span>
          <span className="text-xs text-neutral-500">{meta}</span>
        </span>
        {stats.status === 'done' ? (
          <span className="flex items-center gap-2 text-[13px] text-neutral-600">{stats.average}%<Check className="size-[18px] text-success" strokeWidth={2.6} aria-label={t('rm.statusDone')} /></span>
        ) : stats.status === 'in-progress' ? (
          <span className={cn('inline-flex min-h-[22px] items-center rounded-full px-2 text-xs font-medium', isCurrent ? 'bg-neutral-900 text-surface' : 'bg-neutral-200 text-neutral-800')}>{t('rm.statusInProgress', { p: stats.percent })}</span>
        ) : (
          <span className="text-[13px] text-neutral-500">{isNext ? t('rm.statusNext') : t('rm.statusNew')}</span>
        )}
      </a>
      <button type="button" aria-label={t('rm.delete', { title: lesson.title })} onClick={() => void remove()} className="mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-700 focus-visible:opacity-100 group-hover:opacity-100">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

export function RoadmapView() {
  const lang = useLang();
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), []);
  const allLessons = useLiveQuery(() => db.lessons.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().limit(200).toArray(), []);
  const attempts = useLiveQuery(() => db.attempts.toArray(), []);
  const [chosen, setChosen] = useState<string | null>(() => {
    try { return typeof window === 'undefined' ? null : localStorage.getItem(PLAYLIST_KEY); } catch { return null; }
  });
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});

  if (!playlists || !allLessons || !sessions || !attempts) return <PageHeader crumbs={[{ label: t('roadmap.title') }]} />;
  if (!allLessons.length) return <><PageHeader crumbs={[{ label: t('roadmap.title') }]} /><EmptyRoadmap /></>;

  const withLessons = playlists.filter(playlist => allLessons.some(lesson => lesson.playlistId === playlist.id));
  const playlist = withLessons.find(item => item.id === chosen) ?? withLessons.at(-1) ?? playlists[0];
  const lessons = allLessons.filter(lesson => lesson.playlistId === playlist.id).sort((a, b) => a.order - b.order);
  const lessonIds = new Set(lessons.map(lesson => lesson.id));
  const playlistSessions = sessions.filter(session => lessonIds.has(session.lessonId));
  const playlistAttempts = attempts.filter(attempt => lessonIds.has(attempt.lessonId));

  const statuses = new Map(lessons.map(lesson => [lesson.id, lessonStats(lesson)]));
  const done = lessons.filter(lesson => statuses.get(lesson.id)!.status === 'done').length;
  const current = currentLesson(lessons);
  const nextUp = lessons.find(lesson => lesson.id !== current?.id && statuses.get(lesson.id)!.status === 'new' && lesson.order > (current?.order ?? -1));
  const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0);
  const withTranscripts = lessons.filter(lesson => lesson.transcriptText).length;
  const review = reviewItems(lessons);
  const reviewLesson = review[0] && lessons.find(lesson => lesson.id === review[0].lessonId);
  const rounds = groupRounds(lessons);
  const currentRound = current ? Math.floor(lessons.indexOf(current) / 5) : 0;
  const isRoundOpen = (index: number) => openRounds[index] ?? (index === currentRound || index === currentRound + 1);
  const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const currentStats = current ? statuses.get(current.id)! : undefined;

  return (
    <>
      <PageHeader
        crumbs={[{ label: t('roadmap.title') }, { label: playlist.title }]}
        actions={
          <>
            <a href={appHref('/import')} className={button.secondary}><Plus className="size-4" aria-hidden />{t('rm.addLessons')}</a>
            {current && (
              <a href={appHref('/practice', { lesson: current.id })} className={button.primary}>
                {currentStats?.status === 'in-progress' ? t('rm.continue', { n: lessonNumber(current) }) : t('rm.start', { n: lessonNumber(current) })}
                <ArrowRight className="size-[15px]" aria-hidden />
              </a>
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-wrap items-start">
        <main className="flex min-w-0 max-w-[920px] flex-[999_1_520px] flex-col gap-6 px-4 pb-12 pt-7 md:px-10">
          <InstallHint />
          {withLessons.length > 1 && (
            <label className="flex max-w-xs flex-col gap-1.5">
              <span className="text-[13px] text-neutral-600">{t('rm.switchPlaylist')}</span>
              <select value={playlist.id} onChange={event => { setChosen(event.target.value); try { localStorage.setItem(PLAYLIST_KEY, event.target.value); } catch { /* ignore */ } }} className={cn(input, 'min-h-10')}>
                {withLessons.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          )}

          <section className="flex flex-col gap-3.5" aria-label={playlist.title}>
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{playlist.title}</h1>
              <p className="m-0 text-sm text-neutral-500">
                {tn('rm.meta', lessons.length, { n: lessons.length, duration: formatDuration(totalDuration, lang) })}
                {withTranscripts > 0 && ` · ${tn('rm.withTranscripts', withTranscripts, { n: withTranscripts })}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div aria-hidden className="h-1.5 flex-1 rounded-full bg-line"><div className="h-1.5 rounded-full bg-neutral-900" style={{ width: `${lessons.length ? done / lessons.length * 100 : 0}%` }} /></div>
              <span className="text-sm font-medium">{t('rm.lessonsDone', { done, total: lessons.length })}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label={t('rm.streak')} value={(streak => tn('rm.streakValue', streak, { n: streak }))(streakDays(playlistSessions.map(session => session.endedAt)))} />
              <StatTile label={t('rm.checked')} value={String(checkedSentenceCount(playlistAttempts))} />
              <StatTile label={t('rm.accuracy')} value={`${overallAccuracy(lessons)}%`} />
            </div>
          </section>

          {current && currentStats ? (
            <section className="flex flex-wrap items-center gap-4 rounded-[14px] border-[1.5px] border-neutral-900 px-4 py-4 sm:flex-nowrap">
              <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-neutral-100 text-[13px] font-semibold">{lessonNumber(current)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-semibold tracking-[0.04em] text-neutral-600">{currentStats.status === 'in-progress' ? t('rm.current') : t('rm.upNextLabel')}</span>
                <span className="truncate text-base font-semibold">{current.title}</span>
                <span className="text-[13px] text-neutral-500">{t('rm.currentMeta', { category: '', duration: current.durationSec ? formatClock(current.durationSec) : '–', checked: currentStats.checked, total: currentStats.total })}</span>
                <div aria-hidden className="mt-1 h-1 rounded-full bg-line"><div className="h-1 rounded-full bg-neutral-900" style={{ width: `${currentStats.percent}%` }} /></div>
              </div>
              <a href={appHref('/practice', { lesson: current.id })} className={cn(button.primary, 'min-h-10')}>{currentStats.status === 'in-progress' ? t('rm.continueShort') : t('rm.startShort')}</a>
            </section>
          ) : (
            <p className="m-0 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">{t('rm.finishedAll')}</p>
          )}

          <section className="overflow-hidden rounded-[14px] border border-neutral-200" aria-label={t('rm.rounds')}>
            {rounds.map(round => {
              const open = isRoundOpen(round.index);
              const roundDone = round.items.filter(lesson => statuses.get(lesson.id)!.status === 'done').length;
              const roundDuration = round.items.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0);
              return (
                <div key={round.index} className="border-b border-line last:border-b-0">
                  <button type="button" aria-expanded={open} onClick={() => setOpenRounds(state => ({ ...state, [round.index]: !open }))} className="flex w-full items-center gap-2.5 bg-surface px-4 py-3.5 text-left hover:bg-neutral-50">
                    {open ? <ChevronDown className="size-4 text-neutral-500" aria-hidden /> : <ChevronRight className="size-4 text-neutral-500" aria-hidden />}
                    <span className="flex-1 text-[15px] font-semibold">{t('rm.round', { n: round.index + 1 })}</span>
                    <span className="text-[13px] text-neutral-500">{t('rm.roundMeta', { done: roundDone, total: round.items.length, duration: formatDuration(roundDuration, lang) })}</span>
                  </button>
                  {open && (
                    <ul className="m-0 list-none border-t border-line p-0">
                      {round.items.map(lesson => <LessonRow key={lesson.id} lesson={lesson} isCurrent={lesson.id === current?.id} isNext={lesson.id === nextUp?.id} />)}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        </main>

        <aside className="flex max-w-full flex-[1_1_320px] flex-col gap-6 self-stretch border-l border-line px-6 py-7 max-md:border-l-0 max-md:border-t">
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[15px] font-semibold">{t('rm.history')}</h2>
            {playlistSessions.length ? (
              <ol className="m-0 flex list-none flex-col p-0">
                {playlistSessions.slice(0, 8).map((session: Session, index, list) => {
                  const lesson = lessonById.get(session.lessonId);
                  const minutes = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000));
                  return (
                    <li key={session.id ?? `${session.lessonId}-${session.startedAt}`} className="flex gap-3">
                      <span aria-hidden className="flex flex-col items-center">
                        <span className={cn('mt-[5px] size-[9px] rounded-full', index === 0 ? 'bg-neutral-900' : 'bg-neutral-400')} />
                        {index < list.length - 1 && <span className="w-px flex-1 bg-neutral-200" />}
                      </span>
                      <span className="flex flex-col gap-0.5 pb-4">
                        <span className="text-xs text-neutral-500">{sessionDay(session.endedAt, lang)}</span>
                        <span className="font-medium">{lesson ? tn('rm.sessionTitle', session.checked, { n: lessonNumber(lesson), checked: session.checked }) : session.checked}</span>
                        <span className="text-[13px] text-neutral-600">{t('rm.sessionMeta', { correct: session.correct, minutes })}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="m-0 text-sm leading-relaxed text-neutral-600">{t('rm.historyEmpty')}</p>
            )}
          </section>

          <section className="flex flex-col gap-2.5 rounded-xl bg-subtle p-4">
            <h2 className="m-0 text-[15px] font-semibold">{t('rm.review')}</h2>
            <p className="m-0 text-[13px] leading-relaxed text-neutral-600">{review.length ? tn('rm.reviewBody', review.length, { n: review.length }) : t('rm.reviewNone')}</p>
            {reviewLesson && (
              <a href={appHref('/practice', { lesson: reviewLesson.id, review: 1 })} className="inline-flex min-h-9 items-center self-start rounded-[9px] bg-surface px-3.5 text-sm font-medium text-neutral-900 no-underline shadow-sm">{t('rm.reviewButton', { n: review.length })}</a>
            )}
          </section>

          <p className="m-0 text-[13px] leading-relaxed text-neutral-600">{t('rm.rounds')}</p>
        </aside>
      </div>
    </>
  );
}
