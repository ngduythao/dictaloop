# Dictaloop

Train your ear for English, one sentence at a time. Pick any audio or video, listen to each sentence as many times as you need, type what you hear and see exactly which words you missed.

Free, no sign-up, and everything stays on your device.

## Features

- **Use anything as a lesson**: audio or video files, a whole folder (matching `.srt`, `.vtt` or `.txt` files are picked up automatically), a direct link or a YouTube link with its subtitles.
- **No subtitles? No problem**: Dictaloop listens to the audio and writes them for you, right on your device. A 4 to 5 minute lesson takes about 30 seconds the first time on a recent Mac, then it's ready.
- **Listen your way**: each sentence plays several times in a row, at the speed you choose.
- **Fair grading**: capitals and punctuation are ignored, numbers count in digits or words (`11,000` = `eleven thousand`, `27th` = `twenty-seventh`, `50%` = `fifty percent`), and `long-term` = `long term`.
- **See your mistakes**: press Cmd/Ctrl + Enter to check. Missed words are highlighted, wrong words are crossed out, and sentences you got wrong come back for review.
- **Help when stuck**: click a word for its English definition and Vietnamese meaning, or show sentences in Vietnamese (Chrome 138+ on a computer).
- **Video tools**: cover burned-in subtitles with a movable mask and type your answer right on the video.
- **Track progress**: lessons in rounds of five, daily streak, accuracy and practice history.
- **Anywhere**: English or Vietnamese interface, install it like an app, works offline once loaded.

## Your data

There is no account and nothing is uploaded. Lessons and progress are saved in your browser, on this device only.

- **Switching devices**: use **Settings > Export backup**, then import the file on the new device. Audio and video files are not in the backup, so you will be asked to pick them again.
- **On iPhone**: add Dictaloop to your Home Screen, or Safari may clear your data after 7 days without a visit.

## Run it yourself

Requires Node.js 22.18+ and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
pnpm start
```

Then open http://localhost:4173.

| Command | What it does |
| --- | --- |
| `pnpm start` | Build and serve at http://localhost:4173 |
| `pnpm dev` | Dev server with hot reload at http://localhost:5173 |
| `pnpm build` | Build the static site into `dist/client/` |
| `pnpm check` | Tests, type check and lint |

Each address keeps its own data, so `pnpm start` and `pnpm dev` do not share lessons.

**Deploy**: import the repo in Vercel and keep the defaults (`vercel.json` has the settings). Every push to `main` deploys.