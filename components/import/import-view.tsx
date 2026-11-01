'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { AudioLines, Check, FileText, Film, FolderOpen, Link2, Plus, Upload, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { button, input, segmented } from '@/components/app/styles';
import { PageHeader } from '@/components/shell/page-header';
import { db } from '@/lib/db';
import { isVideoName, pairFiles } from '@/lib/folder-import';
import { t, tn, useLang } from '@/lib/i18n';
import { requestPersistence, saveMedia } from '@/lib/media-store';
import { appHref } from '@/lib/paths';
import { addLessons, createPlaylist, newLessonId, type NewLesson } from '@/lib/repo';
import { fetchSubtitles, fetchYouTubeTranscript, parseHttpUrl, probeDuration, titleFromUrl, youtubeVideoId } from '@/lib/sources';
import { parseSubtitles } from '@/lib/subtitles';
import { cn } from '@/lib/utils';

type Pending =
  | { key: string; kind: 'file'; title: string; media: File; subtitle?: File; transcript?: File }
  | { key: string; kind: 'url'; title: string; url: string; subtitleUrl?: string }
  | { key: string; kind: 'youtube'; title: string; url: string; videoId: string };

const NEW_PLAYLIST = '__new';

const formatSize = (bytes: number) => bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;

async function toLesson(item: Pending): Promise<NewLesson> {
  if (item.kind === 'file') {
    const id = newLessonId();
    const extension = item.media.name.split('.').pop()?.toLowerCase() || 'media';
    const path = await saveMedia(`${id}.${extension}`, item.media);
    const sentences = item.subtitle ? parseSubtitles(await item.subtitle.text()) : [];
    const blobUrl = URL.createObjectURL(item.media);
    const durationSec = await probeDuration(blobUrl).finally(() => URL.revokeObjectURL(blobUrl));
    return {
      id,
      title: item.title,
      source: { kind: 'file', path, fileName: item.media.name, mime: item.media.type, size: item.media.size },
      sentences,
      subtitleSource: item.subtitle?.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
      subtitleName: item.subtitle?.name,
      transcriptText: item.transcript ? await item.transcript.text() : undefined,
      durationSec,
    };
  }
  if (item.kind === 'youtube') {
    const transcript = await fetchYouTubeTranscript(item.videoId);
    return {
      title: item.title || transcript.title,
      source: { kind: 'youtube', videoId: item.videoId, url: item.url },
      sentences: transcript.sentences,
      subtitleSource: 'youtube',
      subtitleName: transcript.label,
      durationSec: transcript.duration,
    };
  }
  const sentences = item.subtitleUrl ? await fetchSubtitles(item.subtitleUrl) : [];
  return {
    title: item.title,
    source: { kind: 'url', url: item.url },
    sentences,
    subtitleSource: item.subtitleUrl?.toLowerCase().includes('.vtt') ? 'vtt' : 'srt',
    subtitleName: item.subtitleUrl ? decodeURIComponent(new URL(item.subtitleUrl).pathname.split('/').pop() || '') : undefined,
    durationSec: await probeDuration(item.url),
  };
}

export function ImportView() {
  useLang();
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), []);
  const [playlistChoice, setPlaylistChoice] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [source, setSource] = useState<'device' | 'link'>('device');
  const [pending, setPending] = useState<Pending[]>([]);
  const [url, setUrl] = useState('');
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const selectedPlaylist = playlistChoice || playlists?.[playlists.length - 1]?.id || NEW_PLAYLIST;
  const creatingPlaylist = selectedPlaylist === NEW_PLAYLIST;

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const groups = pairFiles(files);
    if (!groups.length) {
      setMessages([t('imp.noMedia')]);
      return;
    }
    setMessages([]);
    const folder = files[0]?.webkitRelativePath?.split('/')[0];
    if (folder && !playlistName) setPlaylistName(folder);
    setPending(current => [
      ...current,
      ...groups.map(group => ({ key: `${group.media.name}-${group.media.size}-${Math.random()}`, kind: 'file' as const, title: group.title, media: group.media, subtitle: group.subtitle, transcript: group.transcript })),
    ]);
  }

  function addLink() {
    try {
      const parsed = parseHttpUrl(url);
      const videoId = youtubeVideoId(parsed);
      setPending(current => [...current, videoId
        ? { key: `yt-${videoId}-${Math.random()}`, kind: 'youtube', title: '', url: parsed.href, videoId }
        : { key: `url-${parsed.href}-${Math.random()}`, kind: 'url', title: titleFromUrl(parsed), url: parsed.href, subtitleUrl: subtitleUrl.trim() || undefined }]);
      setUrl('');
      setSubtitleUrl('');
      setMessages([]);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : t('url.importFailed')]);
    }
  }

  async function startImport() {
    if (!pending.length) return;
    setMessages([]);
    setProgress({ done: 0, total: pending.length });
    void requestPersistence();
    const playlistId = creatingPlaylist ? (await createPlaylist(playlistName.trim() || t('imp.defaultPlaylist'))).id : selectedPlaylist;
    const lessons: NewLesson[] = [], failures: string[] = [];
    for (const [index, item] of pending.entries()) {
      try {
        lessons.push(await toLesson(item));
      } catch (error) {
        failures.push(t('imp.failedItem', { title: item.title || item.kind, reason: error instanceof Error ? error.message : String(error) }));
      }
      setProgress({ done: index + 1, total: pending.length });
    }
    if (lessons.length) await addLessons(playlistId, lessons);
    setPending([]);
    setProgress(null);
    setMessages([...(lessons.length ? [tn('imp.done', lessons.length, { n: lessons.length })] : []), ...failures]);
    if (lessons.length && !failures.length) setTimeout(() => { window.location.href = appHref('/'); }, 900);
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: t('roadmap.title'), href: appHref('/') }, { label: t('imp.title') }]}
        actions={
          <button type="button" className={button.primary} disabled={!pending.length || Boolean(progress)} onClick={() => void startImport()}>
            {progress ? t('imp.importing', { i: progress.done, n: progress.total }) : tn('imp.start', pending.length, { n: pending.length })}
          </button>
        }
      />
      <div className="flex flex-1 flex-wrap items-start">
        <main className="flex min-w-0 max-w-[860px] flex-[999_1_480px] flex-col gap-6 px-4 pb-10 pt-6 md:px-10">
          {messages.length > 0 && (
            <div role="status" className="flex flex-col gap-1 rounded-[10px] bg-neutral-100 px-4 py-3 text-sm">
              {messages.map(message => <p key={message} className="m-0">{message}</p>)}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex min-w-[220px] flex-1 flex-col gap-2">
              <span className="text-[13px] text-neutral-600">{t('imp.playlist')}</span>
              <select value={selectedPlaylist} onChange={event => setPlaylistChoice(event.target.value)} className={cn(input, 'min-h-10 appearance-auto')}>
                {playlists?.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}
                <option value={NEW_PLAYLIST}>{t('imp.newPlaylist')}</option>
              </select>
            </label>
            {creatingPlaylist && (
              <label className="flex min-w-[220px] flex-1 flex-col gap-2">
                <span className="text-[13px] text-neutral-600">{t('imp.playlistName')}</span>
                <input value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder={t('imp.defaultPlaylist')} className={cn(input, 'min-h-10')} />
              </label>
            )}
          </div>

          <section className="flex flex-col gap-3" aria-label={t('imp.source')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[15px] font-semibold">{t('imp.source')}</h2>
              <div className={segmented.group} role="tablist" aria-label={t('imp.source')}>
                <button type="button" role="tab" aria-selected={source === 'device'} className={segmented.item(source === 'device')} onClick={() => setSource('device')}>{t('imp.fromDevice')}</button>
                <button type="button" role="tab" aria-selected={source === 'link'} className={segmented.item(source === 'link')} onClick={() => setSource('link')}>{t('imp.fromLink')}</button>
              </div>
            </div>

            {source === 'device' ? (
              <div
                onDragOver={event => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn('flex flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-dashed px-5 py-8 text-center', dragging ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300')}
              >
                <span className="grid size-10 place-items-center rounded-[10px] bg-neutral-100 text-neutral-700"><Upload className="size-[18px]" aria-hidden /></span>
                <span className="text-[15px] font-medium">{t('imp.dropTitle')}</span>
                <span className="max-w-[52ch] text-[13px] leading-relaxed text-neutral-600">{t('imp.dropHint')}</span>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <button type="button" className={button.secondary} onClick={() => fileInput.current?.click()}><Plus className="size-4" aria-hidden />{t('imp.chooseFiles')}</button>
                  <button type="button" className={button.secondary} onClick={() => folderInput.current?.click()}><FolderOpen className="size-4" aria-hidden />{t('imp.chooseFolder')}</button>
                </div>
                <input ref={fileInput} type="file" multiple accept="audio/*,video/*,.srt,.vtt,.txt" className="hidden" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
                <input ref={element => { element?.setAttribute('webkitdirectory', ''); folderInput.current = element; }} type="file" multiple className="hidden" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] text-neutral-600">{t('imp.urlLabel')}</span>
                  <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" inputMode="url" className={cn(input, 'min-h-10')} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] text-neutral-600">{t('imp.subUrlLabel')}</span>
                  <input value={subtitleUrl} onChange={event => setSubtitleUrl(event.target.value)} placeholder="https://…/subtitle.srt" inputMode="url" className={cn(input, 'min-h-10')} />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={button.secondary} disabled={!url.trim()} onClick={addLink}><Link2 className="size-4" aria-hidden />{t('imp.addLink')}</button>
                  <span className="text-[13px] text-neutral-600">{t('imp.linkNote')}</span>
                </div>
              </div>
            )}
          </section>

          {pending.length > 0 && (
            <section className="flex flex-col gap-2" aria-label={tn('imp.pending', pending.length, { n: pending.length })}>
              <h2 className="m-0 text-[15px] font-semibold">{tn('imp.pending', pending.length, { n: pending.length })}</h2>
              <ul className="m-0 flex list-none flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 p-0">
                {pending.map(item => {
                  const Icon = item.kind === 'file' ? (isVideoName(item.media.name) ? Film : AudioLines) : Link2;
                  const detail = item.kind === 'file' ? `${item.media.name} · ${formatSize(item.media.size)}` : item.url;
                  const status = item.kind === 'youtube' ? t('imp.youtube')
                    : (item.kind === 'file' && item.subtitle) || (item.kind === 'url' && item.subtitleUrl) ? t('imp.hasSubtitle')
                      : t('imp.autoRecognise');
                  return (
                    <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-neutral-100 text-neutral-700"><Icon className="size-4" aria-hidden /></span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <input
                          aria-label={t('imp.titleAria')}
                          value={item.title}
                          placeholder={item.kind === 'youtube' ? 'YouTube' : undefined}
                          onChange={event => setPending(current => current.map(entry => entry.key === item.key ? { ...entry, title: event.target.value } : entry))}
                          className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium outline-none hover:border-neutral-200 focus:border-neutral-300"
                        />
                        <span className="truncate px-1 text-xs text-neutral-500">{detail}</span>
                      </span>
                      <span className="hidden shrink-0 flex-col items-end gap-1 text-xs text-neutral-600 sm:flex">
                        <span className="inline-flex items-center gap-1">{status !== t('imp.autoRecognise') && <Check className="size-3.5 text-success" aria-hidden />}{status}</span>
                        {item.kind === 'file' && item.transcript && <span className="inline-flex items-center gap-1"><FileText className="size-3.5" aria-hidden />{t('imp.hasTranscript')}</span>}
                      </span>
                      <button type="button" aria-label={t('imp.remove')} className={cn(button.icon, 'size-9')} onClick={() => setPending(current => current.filter(entry => entry.key !== item.key))}>
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </main>

        <aside className="flex max-w-full flex-[1_1_300px] flex-col gap-5 self-stretch border-l border-line px-6 py-7 max-md:border-l-0 max-md:border-t">
          {([['imp.helpSourcesTitle', 'imp.helpSources'], ['imp.helpFolderTitle', 'imp.helpFolder'], ['imp.helpPrivacyTitle', 'imp.helpPrivacy']] as const).map(([title, body]) => (
            <div key={title} className="flex flex-col gap-1.5">
              <h3 className="m-0 text-[15px] font-semibold">{t(title)}</h3>
              <p className="m-0 text-sm leading-relaxed text-neutral-600">{t(body)}</p>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
