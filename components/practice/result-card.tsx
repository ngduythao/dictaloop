'use client';

import { ArrowRight, RotateCcw } from 'lucide-react';
import { button } from '@/components/app/styles';
import { t, tn } from '@/lib/i18n';
import { markTargetWords, type AnswerComparison } from '@/lib/subtitles';
import { cn } from '@/lib/utils';
import { LookupWord } from './word-lookup';

type Props = {
  target: string;
  comparison: AnswerComparison;
  onReplay(): void;
  onNext?: () => void;
  nextLabel: string;
};

export function ResultCard({ target, comparison, onReplay, onNext, nextLabel }: Props) {
  const words = markTargetWords(target, comparison);
  const toFix = Math.max(comparison.missing.length, comparison.extra.length);
  const badge = comparison.correct
    ? { text: t('pr.correctBadge'), className: 'bg-success-soft text-success' }
    : comparison.score >= 70
      ? { text: t('pr.partialBadge', { p: comparison.score }), className: 'bg-warning-soft text-warning' }
      : { text: t('pr.wrongBadge', { p: comparison.score }), className: 'bg-danger-soft text-danger' };

  return (
    <section aria-live="polite" className="flex flex-col gap-3.5 rounded-xl border border-line px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold', badge.className)}>{badge.text}</span>
        {!comparison.correct && toFix > 0 && <span className="text-[13px] text-neutral-600">{tn('pr.toFix', toFix, { n: toFix })}</span>}
      </div>
      <p className="m-0 flex flex-wrap gap-x-[0.3em] text-[17px] leading-[1.75]">
        {words.map((word, index) => (
          <LookupWord
            key={`${word.text}-${index}`}
            text={word.text}
            className={word.missing ? 'bg-warning-soft text-warning hover:bg-warning-soft-hover' : undefined}
          />
        ))}
      </p>
      {comparison.extra.length > 0 && (
        <p className="m-0 flex flex-wrap gap-2 text-[13px]">
          <span className="text-neutral-600">{t('pr.youWrote')}</span>
          {comparison.extra.map((word, index) => <s key={`${word}-${index}`} className="text-danger">{word}</s>)}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5 pt-1">
        <button type="button" className={button.secondary} onClick={onReplay}><RotateCcw className="size-[15px]" aria-hidden />{t('pr.replay')}</button>
        {onNext && <button type="button" className={button.primary} onClick={onNext}>{nextLabel}<ArrowRight className="size-[15px]" aria-hidden /></button>}
      </div>
    </section>
  );
}
