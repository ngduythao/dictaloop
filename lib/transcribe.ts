import { t } from './i18n';
import { mergeTranscriptChunks, type Sentence } from './subtitles';
// Vite's ?worker import: `new URL(..., import.meta.url)` resolves to a file:// URL in vinext's client build.
import TranscribeWorker from './transcribe.worker?worker';

// On-device subtitles: decode the media to 16 kHz mono, run Whisper in a worker,
// then merge its timed chunks into dictation sentences.

export type TranscribeStage = 'reading' | 'download' | 'recognize';
const MAX_TRANSCRIBE_BYTES = 300 * 1024 * 1024;

async function decodeAudio(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0).slice();
  } finally {
    await context.close();
  }
}

type WorkerMessage = {
  type: 'status' | 'progress' | 'error' | 'result';
  stage?: 'download' | 'recognize';
  value?: number;
  message?: string;
  result?: { text: string; chunks?: Array<{ text: string; timestamp: [number | null, number | null] }> };
};

export async function transcribe(media: Blob, onProgress: (stage: TranscribeStage, percent: number) => void): Promise<Sentence[]> {
  if (media.size > MAX_TRANSCRIBE_BYTES) throw new Error(t('asr.tooLarge'));
  onProgress('reading', 0);
  const audio = await decodeAudio(media);
  const duration = audio.length / 16000;
  const worker = new TranscribeWorker();
  try {
    return await new Promise<Sentence[]>((resolve, reject) => {
      let stage: TranscribeStage = 'download';
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        if (data.type === 'status' && data.stage) {
          stage = data.stage;
          onProgress(stage, stage === 'recognize' ? 100 : 0);
        }
        if (data.type === 'progress') onProgress(stage, data.value || 0);
        if (data.type === 'error') reject(new Error(data.message || t('asr.failedShort')));
        if (data.type === 'result' && data.result) {
          const chunks = (data.result.chunks || [])
            .map(chunk => ({ start: chunk.timestamp?.[0] ?? 0, end: chunk.timestamp?.[1] ?? duration, text: chunk.text.trim() }))
            .filter(chunk => chunk.text && chunk.end > chunk.start);
          const fallback = data.result.text.trim() ? [{ start: 0, end: duration, text: data.result.text.trim() }] : [];
          const sentences = mergeTranscriptChunks(chunks.length ? chunks : fallback);
          if (!sentences.length) reject(new Error(t('asr.noSpeech')));
          else resolve(sentences);
        }
      };
      worker.onerror = () => reject(new Error(t('asr.workerFailed')));
      worker.postMessage({ audio }, [audio.buffer]);
    });
  } finally {
    worker.terminate();
  }
}
