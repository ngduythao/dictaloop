'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { button } from '@/components/app/styles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type VideoTools = {
  maskEnabled: boolean;
  maskBottom: number;
  maskHeight: number;
  writeOnVideo: boolean;
  boxTop: number;
  boxWidth: number;
  boxOpacity: number;
};

export const DEFAULT_VIDEO_TOOLS: VideoTools = { maskEnabled: false, maskBottom: 8, maskHeight: 46, writeOnVideo: false, boxTop: 62, boxWidth: 90, boxOpacity: 85 };

function Range({ label, value, unit, min, max, step = 1, onChange }: { label: string; value: number; unit: string; min: number; max: number; step?: number; onChange(value: number): void }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex justify-between text-neutral-700">{label}<b className="font-medium">{value}{unit}</b></span>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={next => onChange(next[0])} aria-label={label} />
    </label>
  );
}

export function VideoToolsDialog({ tools, onChange }: { tools: VideoTools; onChange(tools: VideoTools): void }) {
  const set = (changes: Partial<VideoTools>) => onChange({ ...tools, ...changes });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={button.secondary}><SlidersHorizontal className="size-4" aria-hidden />{t('pr.videoSettings')}</button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pr.videoSettings')}</DialogTitle>
          <DialogDescription>{t('mask.desc')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <label className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5"><span className="font-medium">{t('mask.enable')}</span><span className="text-[13px] text-neutral-600">{t('mask.enableHint')}</span></span>
            <Switch checked={tools.maskEnabled} onCheckedChange={value => set({ maskEnabled: value })} aria-label={t('mask.toggleAria')} />
          </label>
          {tools.maskEnabled && (
            <>
              <Range label={t('mask.verticalAria')} value={tools.maskBottom} unit="%" min={0} max={88} onChange={value => set({ maskBottom: value })} />
              <Range label={t('mask.height')} value={tools.maskHeight} unit="px" min={24} max={140} step={2} onChange={value => set({ maskHeight: value })} />
            </>
          )}
          <label className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-4">
            <span className="flex flex-col gap-0.5"><span className="font-medium">{t('pr.writeOnVideo')}</span><span className="text-[13px] text-neutral-600">{t('pr.writeOnVideoHint')}</span></span>
            <Switch checked={tools.writeOnVideo} onCheckedChange={value => set({ writeOnVideo: value })} aria-label={t('pr.writeOnVideo')} />
          </label>
          {tools.writeOnVideo && (
            <>
              <Range label={t('box.vertical')} value={tools.boxTop} unit="%" min={10} max={80} onChange={value => set({ boxTop: value })} />
              <Range label={t('box.width')} value={tools.boxWidth} unit="%" min={50} max={96} onChange={value => set({ boxWidth: value })} />
              <Range label={t('box.opacity')} value={tools.boxOpacity} unit="%" min={30} max={100} onChange={value => set({ boxOpacity: value })} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The dark stage that holds a video or the YouTube player, with the optional
// draggable mask over burned-in subtitles, the subtitle line and the answer box.
export function VideoStage({ children, tools, onTools, subtitle, overlay }: { children: ReactNode; tools: VideoTools; onTools(tools: VideoTools): void; subtitle?: string; overlay?: ReactNode }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-[#111]"
      onPointerMove={event => {
        if (!dragging) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onTools({ ...tools, maskBottom: Math.max(0, Math.min(88, Math.round((rect.bottom - event.clientY) / rect.height * 100))) });
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
    >
      {children}
      {tools.maskEnabled && (
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('mask.positionAria')}
          aria-valuemin={0}
          aria-valuemax={88}
          aria-valuenow={tools.maskBottom}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp') onTools({ ...tools, maskBottom: Math.min(88, tools.maskBottom + 1) });
            if (event.key === 'ArrowDown') onTools({ ...tools, maskBottom: Math.max(0, tools.maskBottom - 1) });
          }}
          className={cn('absolute inset-x-[2%] grid cursor-grab place-items-center rounded-md bg-black text-xs text-white/60', dragging && 'cursor-grabbing')}
          style={{ bottom: `${tools.maskBottom}%`, height: tools.maskHeight }}
        >
          {t('mask.drag')}
        </div>
      )}
      {subtitle && <div className="absolute inset-x-[6%] bottom-[10%] rounded-md bg-black/70 px-3 py-1.5 text-center text-base text-white">{subtitle}</div>}
      {overlay && (
        <div className="absolute left-1/2 -translate-x-1/2 rounded-lg p-2" style={{ top: `${tools.boxTop}%`, width: `${tools.boxWidth}%`, backgroundColor: `rgb(255 255 255 / ${tools.boxOpacity}%)` }}>
          {overlay}
        </div>
      )}
    </div>
  );
}
