// Matching media files with their subtitles and transcripts when a whole
// folder (or several files) is imported at once.

const MEDIA_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'mp4', 'm4v', 'webm', 'mov'];
const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];
const TRANSCRIPT_EXTENSIONS = ['txt'];

type Named = { name: string };

export type ImportGroup<F extends Named> = {
  key: string;
  title: string;
  media: F;
  subtitle?: F;
  transcript?: F;
};

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const naturalCompare = (a: string, b: string) => collator.compare(a, b);

const extension = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const baseKey = (name: string) => name.replace(/\.[^.]+$/, '').trim().toLowerCase();

// "VOA_002_Study-Shows-How-Earth-s-Orbit.mp3" -> "Study Shows How Earth's Orbit"
export function titleFromFileName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  const withoutPrefix = stem.replace(/^[A-Za-z]{1,8}[_\s-]+\d{1,4}[_\s-]+/, '').replace(/^\d{1,4}[_\s.-]+/, '');
  const restored = (withoutPrefix || stem)
    .replace(/(\w)-(s|t|re|ve|ll|d|m)(?=[-_\s]|$)/gi, "$1'$2")
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return restored || stem;
}

// Pairs each media file with a subtitle/transcript that shares its file name,
// sorted naturally (VOA_2 before VOA_10). Files without media are left out.
export function pairFiles<F extends Named>(files: F[]): ImportGroup<F>[] {
  const subtitles = new Map<string, F>(), transcripts = new Map<string, F>();
  for (const file of files) {
    const ext = extension(file.name);
    if (SUBTITLE_EXTENSIONS.includes(ext) && !subtitles.has(baseKey(file.name))) subtitles.set(baseKey(file.name), file);
    if (TRANSCRIPT_EXTENSIONS.includes(ext) && !transcripts.has(baseKey(file.name))) transcripts.set(baseKey(file.name), file);
  }
  return files
    .filter(file => MEDIA_EXTENSIONS.includes(extension(file.name)))
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map(media => {
      const key = baseKey(media.name);
      return { key, title: titleFromFileName(media.name), media, subtitle: subtitles.get(key), transcript: transcripts.get(key) };
    });
}

export const isVideoName = (name: string) => ['mp4', 'm4v', 'webm', 'mov'].includes(extension(name));
