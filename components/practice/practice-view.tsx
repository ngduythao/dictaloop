'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, FileUp, List, Loader2, Play, Repeat, Square } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { button } from '@/components/app/styles';
import { EmptyRoadmap } from '@/components/roadmap/roadmap-view';
import { PageHeader } from '@/components/shell/page-header';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { YouTubePlayer } from '@/components/youtube-player';
import { useMediaPlayer, type MediaKind } from '@/hooks/use-media-player';
import { db } from '@/lib/db';
import { isVideoName } from '@/lib/folder-import';
import { t, useLang } from '@/lib/i18n';
import { loadMedia, saveMedia } from '@/lib/media-store';
import type { Lesson } from '@/lib/model';
import { appHref } from '@/lib/paths';
import { currentLesson, lessonStats } from '@/lib/progress';
import { recordAttempt, setLessonSentences, touchSession, updateLesson } from '@/lib/repo';
import { RATE_OPTIONS, REPEAT_OPTIONS, useSettings } from '@/lib/settings';
import { compareAnswer, parseSubtitles, type AnswerComparison, type Sentence } from '@/lib/subtitles';
import { transcribe, type TranscribeStage } from '@/lib/transcribe';
import { translateToVietnamese, translationSupported } from '@/lib/translate';
import { cn } from '@/lib/utils';
import { ResultCard } from './result-card';
import { SentenceOutline, type SentenceLang } from './sentence-outline';
import { DEFAULT_VIDEO_TOOLS, VideoStage, VideoToolsDialog, type VideoTools } from './video-stage';

type Query = { lessonId: string | null; review: boolean };
const noopSubscribe = () => () => {};
let cachedQuery: { search: string; value: Query } | null = null;
function readQuery(): Query {
  const search = window.location.search;
  if (cachedQuery?.search !== search) {
    const params = new URLSearchParams(search);
    cachedQuery = { search, value: { lessonId: params.get('lesson'), review: params.get('review') === '1' } };
  }
  return cachedQuery.value;
}
const serverQuery: Query = { lessonId: null, review: false };
const useQuery = () => useSyncExternalStore(noopSubscribe, readQuery, () => serverQuery);

function mediaKind(lesson: Lesson): MediaKind {
  const source = lesson.source;
  if (source.kind === 'youtube') return 'youtube';
  if (source.kind === 'file') return source.mime.startsWith('video/') || isVideoName(source.fileName) ? 'video' : 'audio';
  return isVideoName(new URL(source.url).pathname) ? 'video' : 'audio';
}

export function PracticeView() {
  useLang();
  const query = useQuery();
  const lessons = useLiveQuery(() => db.lessons.toArray(), []);
  const lesson = lessons && (query.lessonId ? lessons.find(item => item.id === query.lessonId) : currentLesson(lessons) ?? lessons[0]);
  const playlist = useLiveQuery(() => (lesson ? db.playlists.get(lesson.playlistId) : undefined), [lesson?.playlistId]);

  if (!lessons) return <PageHeader crumbs={[{ label: t('pr.title') }]} />;
  if (!lessons.length) return <><PageHeader crumbs={[{ label: t('pr.title') }]} /><EmptyRoadmap /></>;
  if (!lesson) return <><PageHeader crumbs={[{ label: t('roadmap.title'), href: appHref('/') }]} /><p className="px-10 py-10 text-sm text-neutral-600">{t('pr.notFound')}</p></>;
  return <LessonPractice key={lesson.id} lesson={lesson} playlistTitle={playlist?.title} review={query.review} />;
}

function LessonPractice({ lesson, playlistTitle, review }: { lesson: Lesson; playlistTitle?: string; review: boolean }) {
  const settings = useSettings();
  const kind = mediaKind(lesson);
  const player = useMediaPlayer(kind);
  const sentences: Sentence[] = lesson.sentences ?? [];
  const [reviewList] = useState(() => review ? sentences.map((_, i) => i).filter(i => (lesson.progress[i]?.best ?? 100) < 100) : null);
  const firstUnchecked = sentences.findIndex((_, i) => !lesson.progress[i]);
  const [index, setIndex] = useState(() => {
    if (reviewList) return reviewList[0] ?? 0;
    const start = lesson.position ?? (firstUnchecked >= 0 ? firstUnchecked : 0);
    return Math.min(Math.max(0, start), Math.max(0, sentences.length - 1));
  });
  const [repeats, setRepeats] = useState(settings.repeats);
  const [rate, setRate] = useState(settings.rate);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, AnswerComparison>>({});
  const [message, setMessage] = useState('');
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [tools, setTools] = useState<VideoTools>(DEFAULT_VIDEO_TOOLS);
  const [sentenceLang, setSentenceLang] = useState<SentenceLang>('en');
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translationStatus, setTranslationStatus] = useState('');
  const [transcription, setTranscription] = useState<{ stage: TranscribeStage; percent: number } | null>(null);
  const [media, setMedia] = useState<{ src?: string; blob?: Blob; missing?: boolean }>(() => lesson.source.kind === 'url' ? { src: lesson.source.url } : {});
  const [outlineOpen, setOutlineOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);

  const sentence = sentences[index];
  const answer = drafts[index] ?? '';
  const result = results[index];
  const stats = lessonStats({ sentences, progress: lesson.progress });
  const position = reviewList ? reviewList.indexOf(index) : index;
  const total = reviewList ? reviewList.length : sentences.length;
  const nextIndex = reviewList ? reviewList[position + 1] : index + 1 < sentences.length ? index + 1 : undefined;
  const prevIndex = reviewList ? reviewList[position - 1] : index > 0 ? index - 1 : undefined;

  useEffect(() => { void updateLesson(lesson.id, { lastOpenedAt: Date.now() }); }, [lesson.id]);

  // Keyed on the stored path, not the lesson object: every save hands back a new object.
  // A re-chosen file is saved under the same path, so `mediaVersion` forces a reload.
  const filePath = lesson.source.kind === 'file' ? lesson.source.path : '';
  const [mediaVersion, setMediaVersion] = useState(0);
  useEffect(() => {
    if (!filePath) return;
    let url = '';
    let cancelled = false;
    void loadMedia(filePath).then(blob => {
      if (cancelled) return;
      if (!blob) { setMedia({ missing: true }); return; }
      url = URL.createObjectURL(blob);
      setMedia({ src: url, blob });
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [filePath, mediaVersion]);

  function go(next: number | undefined, autoplay = false) {
    if (next === undefined) return;
    player.stop();
    setIndex(next);
    setMessage('');
    setOutlineOpen(false);
    void updateLesson(lesson.id, { position: next });
    if (autoplay) void playSentence(next);
  }

  async function playSentence(at = index) {
    const clip = sentences[at];
    if (!clip) return;
    if (player.duration && clip.end > player.duration + 0.5) { setMessage(t('play.endBeyond')); return; }
    setMessage('');
    const finished = await player.playClip(clip, repeats, rate);
    if (finished) {
      setMessage(t('pr.writePrompt'));
      input.current?.focus();
    }
  }

  async function check() {
    const text = answer.trim();
    if (!sentence || !text) return;
    const comparison = compareAnswer(text, sentence.text);
    setResults(current => ({ ...current, [index]: comparison }));
    const at = Date.now();
    await recordAttempt({ lessonId: lesson.id, sentenceIndex: index, answer: text, score: comparison.score, correct: comparison.correct, at });
    await touchSession(lesson.id, comparison.correct, at);
  }

  async function recognise() {
    setMessage('');
    setTranscription({ stage: 'reading', percent: 0 });
    try {
      let blob = media.blob;
      if (!blob) {
        const response = await fetch(media.src ?? '');
        if (!response.ok) throw new Error(t('asr.cannotRead'));
        blob = await response.blob();
      }
      const next = await transcribe(blob, (stage, percent) => setTranscription({ stage, percent }));
      await setLessonSentences(lesson.id, next, 'whisper', t('asr.label'));
      setIndex(0);
      setMessage(t('asr.done', { n: next.length }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('asr.failed'));
    } finally {
      setTranscription(null);
    }
  }

  async function applySubtitleFile(file: File) {
    const parsed = parseSubtitles(await file.text());
    if (!parsed.length) { setMessage(t('subs.noTimeline')); return; }
    await setLessonSentences(lesson.id, parsed, file.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt', file.name);
    setIndex(0);
    setMessage(t('subs.segmentsReady', { n: parsed.length }));
  }

  async function replaceMedia(file: File) {
    if (lesson.source.kind !== 'file') return;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'media';
    const path = await saveMedia(`${lesson.id}.${extension}`, file);
    await updateLesson(lesson.id, { source: { kind: 'file', path, fileName: file.name, mime: file.type, size: file.size } });
    setMediaVersion(version => version + 1);
  }

  async function changeSentenceLang(mode: SentenceLang) {
    setSentenceLang(mode);
    if (mode === 'en') return;
    const missing = sentences.map((_, i) => i).filter(i => !translations[i]);
    try {
      for (const [n, i] of missing.entries()) {
        setTranslationStatus(t('tr.progress', { i: n + 1, n: missing.length }));
        const translated = await translateToVietnamese(sentences[i].text, setTranslationStatus);
        setTranslations(current => ({ ...current, [i]: translated }));
      }
      setTranslationStatus('');
    } catch (error) {
      setTranslationStatus(error instanceof Error ? error.message : t('tr.failed'));
    }
  }

  function adjustBoundary(key: 'start' | 'end', value: number) {
    if (!sentence || !Number.isFinite(value)) return;
    const next = sentences.map((item, i) => i === index ? { ...item, [key]: Math.max(0, value) } : item);
    void updateLesson(lesson.id, { sentences: next });
  }

  const cycle = <T,>(options: T[], value: T) => options[(options.indexOf(value) + 1) % options.length];

  const answerBox = (
    <textarea
      ref={input}
      id="answer"
      rows={3}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      value={answer}
      placeholder={t('pr.placeholder')}
      onChange={event => {
        const value = event.target.value;
        setDrafts(current => ({ ...current, [index]: value }));
        setResults(current => { const { [index]: _dropped, ...rest } = current; void _dropped; return rest; });
      }}
      onKeyDown={event => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          if (result) go(nextIndex, true); else void check();
        }
      }}
      className="w-full resize-y rounded-[10px] border border-transparent bg-neutral-100 px-3.5 py-3 text-[17px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-500 focus:border-neutral-300 focus:bg-background"
    />
  );

  const outline = sentences.length > 0 && (
    <SentenceOutline
      lesson={lesson}
      sentences={sentences}
      index={index}
      onSelect={i => go(i)}
      sentenceLang={sentenceLang}
      onSentenceLang={mode => void changeSentenceLang(mode)}
      translations={translations}
      translationStatus={translationStatus}
      canTranslate={translationSupported()}
    />
  );

  const isVisual = kind !== 'audio';
  const mediaElement = kind === 'youtube' && lesson.source.kind === 'youtube'
    ? <YouTubePlayer {...player.youtubeProps} videoId={lesson.source.videoId} volume={1} muted={false} rate={rate} />
    : media.src
      ? kind === 'video'
        ? <video {...player.elementProps} src={media.src} playsInline preload="auto" className="size-full object-contain" />
        : <audio {...player.elementProps} src={media.src} preload="auto" />
      : null;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: t('roadmap.title'), href: appHref('/') },
          ...(playlistTitle ? [{ label: playlistTitle, href: appHref('/') }] : []),
          { label: lesson.title },
        ]}
        actions={sentences.length > 0 && (
          <>
            <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
              <SheetTrigger asChild>
                <button type="button" className={cn(button.secondary, 'lg:hidden')} aria-label={t('pr.openSentences')}><List className="size-4" aria-hidden />{index + 1}/{sentences.length}</button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(92vw,380px)] overflow-y-auto p-3 pt-12">
                <SheetTitle className="sr-only">{t('pr.sentences')}</SheetTitle>
                {outline}
              </SheetContent>
            </Sheet>
            {isVisual && <VideoToolsDialog tools={tools} onChange={setTools} />}
            <label className="flex items-center gap-2 text-[13px] text-neutral-700">
              <input type="checkbox" checked={showSubtitles} onChange={event => setShowSubtitles(event.target.checked)} className="size-4 accent-neutral-900" />
              {t('pr.showSubtitles')}
            </label>
            <button type="button" className={cn(button.primary, 'max-md:hidden')} disabled={!answer.trim()} onClick={() => void check()}>
              {t('pr.check')}<span className="text-xs text-neutral-300">⌘↵</span>
            </button>
          </>
        )}
      />

      <div className="flex flex-1 flex-wrap items-start">
        <main className="flex min-w-0 max-w-[900px] flex-[999_1_480px] flex-col gap-5 px-4 pb-24 pt-6 md:px-10">
          {message && <p role="status" className="m-0 rounded-[10px] bg-neutral-100 px-4 py-2.5 text-sm text-neutral-700">{message}</p>}

          {media.missing ? (
            <section className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 p-5">
              <p className="m-0 text-sm leading-relaxed text-neutral-700">{t('pr.mediaMissing')}</p>
              <button type="button" className={button.primary} onClick={() => mediaInput.current?.click()}><FileUp className="size-4" aria-hidden />{t('pr.chooseMedia')}</button>
              <input ref={mediaInput} type="file" accept="audio/*,video/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void replaceMedia(file); }} />
            </section>
          ) : !sentences.length ? (
            <section className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 p-5">
              <h2 className="m-0 text-base font-semibold">{t('pr.recogniseTitle')}</h2>
              <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-neutral-600">{t('pr.recogniseBody')}</p>
              {transcription ? (
                <div className="flex w-full max-w-md flex-col gap-2" role="status">
                  <div className="h-1.5 rounded-full bg-neutral-200"><div className="h-1.5 rounded-full bg-neutral-900 transition-[width]" style={{ width: `${transcription.stage === 'recognize' ? 100 : transcription.percent}%` }} /></div>
                  <span className="flex items-center gap-2 text-[13px] text-neutral-600">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    {transcription.stage === 'reading' ? t('pr.stageReading') : transcription.stage === 'download' ? t('pr.stageDownload', { p: transcription.percent }) : t('pr.stageRecognize')}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={button.primary} disabled={!media.src && !media.blob} onClick={() => void recognise()}>{t('pr.recogniseStart')}</button>
                  <button type="button" className={button.secondary} onClick={() => subtitleInput.current?.click()}><FileUp className="size-4" aria-hidden />{t('pr.recogniseSubtitles')}</button>
                  <input ref={subtitleInput} type="file" accept=".srt,.vtt,text/vtt" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void applySubtitleFile(file); }} />
                </div>
              )}
            </section>
          ) : (
            <>
              <section aria-label={t('pr.sentences')} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-medium text-neutral-900">{reviewList ? t('pr.reviewOf', { i: position + 1, n: total }) : t('pr.sentenceOf', { i: index + 1, n: total })}</span>
                  {sentence && <span className="text-neutral-500">{sentence.start.toFixed(1)}s – {sentence.end.toFixed(1)}s</span>}
                </div>
                {sentences.length <= 160 && (
                  <div aria-hidden className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${sentences.length}, minmax(0, 1fr))` }}>
                    {sentences.map((_, i) => {
                      const best = lesson.progress[i]?.best;
                      return <span key={i} className={cn('h-1.5 rounded-full', best === undefined ? 'bg-neutral-200' : best >= 100 ? 'bg-neutral-900' : 'bg-neutral-400', i === index && 'outline outline-2 outline-offset-2 outline-neutral-900')} />;
                    })}
                  </div>
                )}
              </section>

              {isVisual ? (
                <VideoStage
                  tools={tools}
                  onTools={setTools}
                  subtitle={showSubtitles ? sentence?.text : undefined}
                  overlay={tools.writeOnVideo ? answerBox : undefined}
                >
                  {mediaElement}
                </VideoStage>
              ) : mediaElement}

              <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-neutral-100 p-3">
                <button type="button" aria-label={t('pr.prev')} className={button.icon} disabled={prevIndex === undefined} onClick={() => go(prevIndex)}><ChevronLeft className="size-[18px]" aria-hidden /></button>
                {player.clipPlaying ? (
                  <button type="button" className="inline-flex min-h-11 items-center gap-2.5 rounded-[10px] bg-background px-4 font-medium shadow-sm" onClick={player.stop}><Square className="size-3.5 fill-current" aria-hidden />{t('pr.stopSentence')}</button>
                ) : (
                  <button type="button" className="inline-flex min-h-11 items-center gap-2.5 rounded-[10px] bg-background px-4 font-medium shadow-sm disabled:opacity-40" disabled={!media.src && kind !== 'youtube'} onClick={() => void playSentence()}><Play className="size-4 fill-current" aria-hidden />{t('pr.playSentence', { n: index + 1 })}</button>
                )}
                <button type="button" aria-label={t('pr.next')} className={button.icon} disabled={nextIndex === undefined} onClick={() => go(nextIndex)}><ChevronRight className="size-[18px]" aria-hidden /></button>
                <span className="flex-1" />
                <button type="button" aria-label={t('pr.repeatsAria', { n: repeats })} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-background px-2.5 text-[13px] text-neutral-700" onClick={() => setRepeats(cycle(REPEAT_OPTIONS, repeats))}><Repeat className="size-3.5" aria-hidden />{t('pr.repeatsButton', { n: repeats })}</button>
                <button type="button" aria-label={t('pr.speedAria', { r: rate })} className="inline-flex min-h-8 items-center rounded-lg bg-background px-2.5 text-[13px] text-neutral-700" onClick={() => setRate(cycle(RATE_OPTIONS, rate))}>{rate}×</button>
                {player.clipPlaying && <span className="text-[13px] text-neutral-600">{t('pr.playingRound', { i: player.round, n: repeats })}</span>}
              </div>
              {player.error && <p role="alert" className="m-0 text-sm text-danger">{t('pr.loadFailed')}</p>}

              {!isVisual && showSubtitles && sentence && <p className="m-0 rounded-[10px] border border-dashed border-neutral-300 px-4 py-3 text-[15px] leading-relaxed text-neutral-700">{sentence.text}</p>}

              {!(isVisual && tools.writeOnVideo) && (
                <section className="flex flex-col gap-2">
                  <label htmlFor="answer" className="text-[13px] text-neutral-600">{t('pr.yourAnswer')}</label>
                  {answerBox}
                </section>
              )}

              {result && sentence && (
                <ResultCard
                  target={sentence.text}
                  comparison={result}
                  onReplay={() => void playSentence()}
                  onNext={nextIndex !== undefined ? () => go(nextIndex, true) : undefined}
                  nextLabel={t('pr.nextSentence')}
                />
              )}
              {result && nextIndex === undefined && (
                reviewList
                  ? <p className="m-0 text-sm text-neutral-600">{t('pr.reviewDone')}</p>
                  : stats.status === 'done' && <a href={appHref('/')} className={cn(button.primary, 'self-start')}>{t('pr.finished')}</a>
              )}

              {sentence && (
                <details className="border-y border-line py-3.5 text-[15px] text-neutral-600">
                  <summary className="cursor-pointer">{t('pr.timing')}</summary>
                  <p className="mb-0 mt-3 text-[13px] leading-relaxed">{t('pr.timingNote')}</p>
                  <div className="mt-3 flex gap-4">
                    {(['start', 'end'] as const).map(key => (
                      <label key={key} className="flex flex-1 flex-col gap-1.5 text-[13px]">
                        {t(key === 'start' ? 'pr.start' : 'pr.end')}
                        <input type="number" step={0.1} min={0} value={sentence[key]} onChange={event => adjustBoundary(key, Number(event.target.value))} className="min-h-9 rounded-lg bg-neutral-100 px-3 text-sm text-neutral-900" />
                      </label>
                    ))}
                  </div>
                </details>
              )}

              {lesson.transcriptText && (
                <details className="text-[15px] text-neutral-600">
                  <summary className="cursor-pointer">{t('pr.transcript')}</summary>
                  <p className="mb-0 mt-2 text-[13px]">{t('pr.transcriptHint')}</p>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 font-sans text-sm leading-relaxed text-neutral-800">{lesson.transcriptText}</pre>
                </details>
              )}
            </>
          )}
        </main>

        {outline && <aside className="sticky top-0 hidden w-[360px] shrink-0 px-5 py-5 lg:block">{outline}</aside>}
      </div>

      {sentence && !media.missing && (
        // Thumb-reach actions on phones; the header holds them on larger screens.
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-line bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:hidden">
          <button type="button" className={cn(button.secondary, 'min-h-12 flex-1 rounded-xl')} onClick={() => (player.clipPlaying ? player.stop() : void playSentence())}>
            {player.clipPlaying ? <Square className="size-3.5 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
            {player.clipPlaying ? t('pr.stopSentence') : t('pr.replay')}
          </button>
          {result && nextIndex !== undefined ? (
            <button type="button" className={cn(button.primary, 'min-h-12 flex-[1.4] rounded-xl')} onClick={() => go(nextIndex, true)}>{t('pr.nextSentence')}<ChevronRight className="size-4" aria-hidden /></button>
          ) : (
            <button type="button" className={cn(button.primary, 'min-h-12 flex-[1.4] rounded-xl')} disabled={!answer.trim()} onClick={() => void check()}>{t('pr.check')}</button>
          )}
        </div>
      )}
    </>
  );
}
