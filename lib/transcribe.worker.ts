import './worker-window-shim';
import { pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from '@huggingface/transformers';

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    if (!transcriber) {
      self.postMessage({ type: 'status', stage: 'download' });
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback: (progress: ProgressInfo) => {
          if ('progress' in progress && typeof progress.progress === 'number') self.postMessage({ type: 'progress', value: Math.round(progress.progress) });
        },
      });
    }
    self.postMessage({ type: 'status', stage: 'recognize' });
    const result = await transcriber(event.data.audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Subtitle recognition failed' });
  }
};
