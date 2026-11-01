# Dictaloop

**Hear it. Loop it. Write it.** Dictaloop is a dictation trainer for English learners: import audio or video, listen sentence by sentence as many times as you need, type what you hear and see exactly which words you missed.

Everything runs in the browser and stays on your device. There is no account and no server.

> Dictaloop started as a fork of [HellxEggplant/listen-write](https://github.com/HellxEggplant/listen-write). That repository has **no open-source license**, so this fork is for personal use until the original author grants one. Do not publish or redistribute it before then.

## Quick start

Requires Node.js 22.18 or later and [pnpm](https://pnpm.io/installation) (the version is pinned in `package.json`; `npm install -g pnpm` installs it).

```bash
pnpm install
pnpm start
```

Open http://localhost:4173. `pnpm start` builds the site and serves it the way Vercel will.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm start` | Build, then serve the site at http://localhost:4173 |
| `pnpm dev` | Development server with hot reload at http://localhost:5173 |
| `pnpm build` | Build the static site into `dist/client/` |
| `pnpm preview` | Serve the last build without rebuilding |
| `pnpm check` | Tests, type check and lint, the same checks as before a commit |

## Features

- **Roadmap**: lessons grouped in rounds of five, the lesson to continue, day streak, sentences checked, average accuracy, practice history, and a review queue of sentences that are not fully right yet
- **Practice**: plays each sentence N times at the speed you choose; check with ⌘/Ctrl + Enter; missed words are highlighted in the original sentence and your wrong words are struck through
- **Fair grading**: case and punctuation are ignored, numbers count in digits or words (`11,000` = `eleven thousand`, `27th` = `twenty-seventh`, `50%` = `fifty percent`), `long-term` = `long term`
- **Import**: files or a whole folder (same-named `.srt`/`.vtt` subtitles and `.txt` transcripts are matched automatically, lessons are ordered by file name), direct media links with an optional subtitle link, and YouTube links with their subtitles
- **No subtitles?** Whisper (`whisper-tiny.en`) recognises the audio on your device and splits it into sentences. A 4.5-minute lesson takes about 30 seconds on a recent Mac, including the one-time model download; it runs once per lesson
- **Learning aids**: click a word for its English definition and Vietnamese meaning; show sentences in English, Vietnamese or both (Chrome's on-device translator, Chrome 138+ on desktop)
- **Video tools**: a draggable mask for burned-in subtitles and an answer box over the video
- **English or Vietnamese interface**, installable as a PWA, works offline once loaded

## Where your data lives

| Data | Stored in |
| --- | --- |
| Media files you import | The browser's Origin Private File System (IndexedDB fallback) |
| Lessons, sentences, progress, attempts, sessions | IndexedDB (Dexie) |
| Preferences (language, plays, speed) | localStorage |

Data belongs to one browser at one address on one device: `pnpm start` (port 4173) and `pnpm dev` (port 5173) keep separate data. To move to another device, use **Settings → Export backup** and import the file there; media files are not included, so the app asks you to choose them again. On iPhone, add the app to the Home Screen, or Safari may clear site data after 7 days without a visit.

## Deploying

The site deploys to Vercel as a static export: import the GitHub repository in Vercel and keep the defaults, since `vercel.json` sets the install and build commands, the `dist/client` output and clean URLs (`/practice` serves `practice.html`). Every push to `main` deploys; `.github/workflows/ci.yml` runs `pnpm check` and `pnpm build` on pushes and pull requests.

YouTube subtitles on the static site go through the original author's transcript service (`transcriptApiBase` in `lib/sources.ts`); `pnpm dev` serves that route itself.

## Project layout

- `app/(app)/` routes: `/` roadmap, `/practice?lesson=<id>[&review=1]`, `/import`, `/settings`
- `components/` UI by page (`roadmap`, `practice`, `import`, `settings`), the app shell and six UI primitives in `components/ui`
- `lib/` data and logic: `db.ts`, `repo.ts`, `media-store.ts`, `progress.ts`, `subtitles.ts` (parsing and grading), `folder-import.ts`, `backup.ts`, `transcribe.ts` + `transcribe.worker.ts` (Whisper), `translate.ts`, `sources.ts`
- `lib/i18n.en.ts`, `lib/i18n.vi.ts` interface strings; add a language by adding a file with the same keys (TypeScript reports missing keys)
- `scripts/serve.mjs` local static server for the build
