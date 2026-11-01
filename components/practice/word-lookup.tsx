'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { t } from '@/lib/i18n';
import { lookupDefinition, translateToVietnamese, translationSupported, type Definition } from '@/lib/translate';
import { cn } from '@/lib/utils';

type State = { definition?: Definition; definitionError?: boolean; translation?: string; translationError?: boolean };

// A word in a sentence that opens its English definition and Vietnamese meaning.
export function LookupWord({ text, className }: { text: string; className?: string }) {
  const word = text.toLowerCase().replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');
  const [state, setState] = useState<State>({});

  const load = () => {
    if (!word || state.definition || state.definitionError) return;
    void lookupDefinition(word)
      .then(definition => setState(current => ({ ...current, definition })))
      .catch(() => setState(current => ({ ...current, definitionError: true })));
    if (translationSupported()) {
      void translateToVietnamese(word)
        .then(translation => setState(current => ({ ...current, translation })))
        .catch(() => setState(current => ({ ...current, translationError: true })));
    }
  };

  if (!word) return <span className={className}>{text}</span>;
  return (
    <Popover onOpenChange={open => { if (open) load(); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn('rounded px-[1px] text-left hover:bg-neutral-100 focus-visible:bg-neutral-100', className)}>{text}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-sm">
        <p className="m-0 text-base font-semibold">{word}{state.definition?.partOfSpeech && <span className="ml-2 text-xs font-normal italic text-neutral-500">{state.definition.partOfSpeech}</span>}</p>
        {translationSupported() && (
          <p className="m-0 mt-2 font-medium">{state.translation ?? (state.translationError ? t('word.viUnavailable') : t('word.viPreparing'))}</p>
        )}
        <p className="m-0 mt-2 leading-relaxed text-neutral-600">
          {state.definition ? state.definition.definition ?? t('word.notFoundLong') : state.definitionError ? t('word.notFoundLong') : t('word.loading')}
        </p>
      </PopoverContent>
    </Popover>
  );
}
