// The Whisper worker has no `window`, but its dependencies read it at startup:
// vinext replaces `typeof window` with "object" at compile time, so guards such as
// `typeof window !== 'undefined' && window.document` in @huggingface/transformers
// collapse to a bare `window.document`, and in dev Vite's /@vite/client (pulled in
// by onnxruntime-web) reads `window` too. Point `window` at the worker itself;
// `window.document` then stays undefined, so the libraries still see a worker.
// (The `in` check because `typeof window` is replaced as well.)
if (!('window' in globalThis)) {
  (globalThis as { window?: typeof globalThis }).window = globalThis;
}

export {};
