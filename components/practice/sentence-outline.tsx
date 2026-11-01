'use client';

import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { segmented } from '@/components/app/styles';
import { t, tn, useLang } from '@/lib/i18n';
import type { Lesson } from '@/lib/model';
import { formatClock, formatDuration, groupSections, lessonStats } from '@/lib/progress';
import type { Sentence } from '@/lib/subtitles';
import { cn } from '@/lib/utils';

export type SentenceLang = 'en' | 'vi' | 'both';

type Props = {
  lesson: Lesson;
  sentences: Sentence[];
  index: number;
  onSelect(index: number): void;
  sentenceLang: SentenceLang;
  onSentenceLang(mode: SentenceLang): void;
  translations: Record<number, string>;
  translationStatus: string;
  canTranslate: boolean;
};

export function SentenceOutline({ lesson, sentences, index, onSelect, sentenceLang, onSentenceLang, translations, translationStatus, canTranslate }: Props) {
  const lang = useLang();
  const stats = lessonStats({ sentences, progress: lesson.progress });
  const sections = groupSections(sentences);
  const currentSection = sections.find(section => index >= section.from && index <= section.to)?.index ?? 0;
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const isOpen = (section: number) => open[section] ?? section === currentSection;
  const duration = lesson.durationSec ?? sentences.at(-1)?.end ?? 0;

  return (
    <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-2 border-b border-line px-4 pb-3.5 pt-4">
        <h2 className="m-0 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{lesson.title}</h2>
        <p className="m-0 text-[13px] text-neutral-500">{tn('pr.lessonMeta', sentences.length, { duration: formatDuration(duration, lang), n: sentences.length })}</p>
        <p className="m-0 mt-1.5 text-sm font-medium">{t('pr.percentChecked', { p: stats.percent })}</p>
        <div aria-hidden className="h-1 rounded-full bg-line"><div className="h-1 rounded-full bg-neutral-900" style={{ width: `${stats.percent}%` }} /></div>
        {canTranslate && (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className={segmented.group} role="group" aria-label={t('pr.sentenceLang')}>
              {(['en', 'vi', 'both'] as const).map(mode => (
                <button key={mode} type="button" aria-pressed={sentenceLang === mode} className={segmented.item(sentenceLang === mode)} onClick={() => onSentenceLang(mode)}>
                  {t(mode === 'en' ? 'pr.langEn' : mode === 'vi' ? 'pr.langVi' : 'pr.langBoth')}
                </button>
              ))}
            </div>
            {translationStatus && sentenceLang !== 'en' && <p className="m-0 text-xs text-neutral-500">{translationStatus}</p>}
          </div>
        )}
      </div>

      <div className="flex max-h-[min(70vh,760px)] flex-col overflow-y-auto py-1.5">
        {sections.map(section => {
          const expanded = isOpen(section.index);
          return (
            <div key={section.index}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(current => ({ ...current, [section.index]: !expanded }))}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left font-semibold hover:bg-neutral-50"
              >
                {expanded ? <ChevronDown className="size-4 text-neutral-500" aria-hidden /> : <ChevronRight className="size-4 text-neutral-500" aria-hidden />}
                <span className="flex-1">{t('pr.section', { n: section.index + 1 })}</span>
                <span className="text-xs font-normal text-neutral-500">{formatClock(section.start)} – {formatClock(section.end)}</span>
              </button>
              {expanded && sentences.slice(section.from, section.to + 1).map((sentence, offset) => {
                const sentenceIndex = section.from + offset;
                const progress = lesson.progress[sentenceIndex];
                const current = sentenceIndex === index;
                const translation = translations[sentenceIndex];
                return (
                  <button
                    key={sentenceIndex}
                    type="button"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onSelect(sentenceIndex)}
                    className={cn('flex w-full items-start gap-2.5 py-2 pl-[38px] pr-3.5 text-left', current ? 'bg-neutral-100' : 'hover:bg-neutral-50')}
                  >
                    <span className="w-[18px] shrink-0 pt-0.5 text-xs text-neutral-500">{String(sentenceIndex + 1).padStart(2, '0')}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {sentenceLang !== 'vi' && <span className={cn('line-clamp-2 text-sm leading-snug', current ? 'font-medium text-neutral-900' : 'text-neutral-700')}>{sentence.text}</span>}
                      {sentenceLang !== 'en' && <span className="line-clamp-2 text-[13px] leading-snug text-neutral-500">{translation ?? '…'}</span>}
                    </span>
                    {progress && (progress.best >= 100
                      ? <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-label={t('pr.correctAria')} />
                      : <span className="shrink-0 pt-0.5 text-xs text-warning">{progress.best}%</span>)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
