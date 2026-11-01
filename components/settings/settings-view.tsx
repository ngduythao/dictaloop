'use client';

import { Download, HardDrive, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { button, segmented } from '@/components/app/styles';
import { PageHeader } from '@/components/shell/page-header';
import { BackupError } from '@/lib/backup';
import { db } from '@/lib/db';
import { LANGS, setLang, t, useLang } from '@/lib/i18n';
import { requestPersistence, storageUsage } from '@/lib/media-store';
import { RATE_OPTIONS, REPEAT_OPTIONS, updateSettings, useSettings } from '@/lib/settings';
import { deletePlaylist, exportBackup, importBackup } from '@/lib/repo';

const formatBytes = (bytes: number) => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-[#ececec] py-6 last:border-b-0">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        {hint && <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-neutral-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const lang = useLang();
  const settings = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);

  const refreshStorage = () => void storageUsage().then(setStorage);
  useEffect(refreshStorage, []);

  async function download() {
    const backup = await exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dictaloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(t('settings.exported'));
  }

  async function restore(file: File) {
    try {
      const result = await importBackup(JSON.parse(await file.text()));
      setMessage(t('settings.imported', result));
    } catch (error) {
      const reason = error instanceof BackupError ? error.message : 'damaged';
      setMessage(t(reason === 'not-a-backup' ? 'settings.importErrorNotBackup' : reason === 'newer-version' ? 'settings.importErrorNewer' : 'settings.importErrorDamaged'));
    }
  }

  async function deleteEverything() {
    if (!window.confirm(t('settings.dangerConfirm'))) return;
    for (const playlist of await db.playlists.toArray()) await deletePlaylist(playlist.id);
    await db.lessons.clear();
    await db.attempts.clear();
    await db.sessions.clear();
    await db.blobs.clear();
    setMessage(t('settings.deleted'));
    refreshStorage();
  }

  return (
    <>
      <PageHeader crumbs={[{ label: t('settings.title') }]} />
      <main className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-2 md:px-10">
        {message && <p role="status" className="mt-5 rounded-[10px] bg-neutral-100 px-4 py-3 text-sm">{message}</p>}

        <Section title={t('settings.language')}>
          <div className={segmented.group} role="group" aria-label={t('settings.language')}>
            {LANGS.map(option => (
              <button key={option.code} type="button" aria-pressed={lang === option.code} className={segmented.item(lang === option.code)} onClick={() => setLang(option.code)}>{option.label}</button>
            ))}
          </div>
        </Section>

        <Section title={t('settings.practice')} hint={t('settings.practiceHint')}>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-neutral-600">{t('settings.repeats')}</span>
              <div className={segmented.group} role="group" aria-label={t('settings.repeats')}>
                {REPEAT_OPTIONS.map(value => (
                  <button key={value} type="button" aria-pressed={settings.repeats === value} className={segmented.item(settings.repeats === value)} onClick={() => updateSettings({ repeats: value })}>{value}×</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-neutral-600">{t('settings.speed')}</span>
              <div className={segmented.group} role="group" aria-label={t('settings.speed')}>
                {RATE_OPTIONS.map(value => (
                  <button key={value} type="button" aria-pressed={settings.rate === value} className={segmented.item(settings.rate === value)} onClick={() => updateSettings({ rate: value })}>{value}×</button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title={t('settings.backup')} hint={t('settings.backupHint')}>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className={button.primary} onClick={() => void download()}><Download className="size-4" aria-hidden />{t('settings.export')}</button>
            <button type="button" className={button.secondary} onClick={() => fileInput.current?.click()}><Upload className="size-4" aria-hidden />{t('settings.import')}</button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void restore(file); }} />
          </div>
        </Section>

        <Section title={t('settings.storage')}>
          {storage && (
            <div className="flex flex-col gap-2 text-sm">
              <p className="m-0 flex items-center gap-2"><HardDrive className="size-4 text-neutral-500" aria-hidden />{t('settings.storageUsed', { used: formatBytes(storage.usage), quota: formatBytes(storage.quota) })}</p>
              <p className="m-0 text-neutral-600">{t(storage.persisted ? 'settings.persisted' : 'settings.notPersisted')}</p>
              {!storage.persisted && (
                <button type="button" className={`${button.secondary} self-start`} onClick={() => void requestPersistence().then(refreshStorage)}>{t('settings.requestPersist')}</button>
              )}
            </div>
          )}
        </Section>

        <Section title={t('settings.danger')} hint={t('settings.dangerHint')}>
          <button type="button" className={`${button.danger} self-start`} onClick={() => void deleteEverything()}><Trash2 className="size-4" aria-hidden />{t('settings.danger')}</button>
        </Section>
      </main>
    </>
  );
}
