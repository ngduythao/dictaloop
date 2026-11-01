import { NextRequest, NextResponse } from 'next/server';
import { mergeTranscriptChunks } from '@/lib/subtitles';

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
};
type YouTubeChunk = { start: number; end: number; text: string; breakAfter: boolean };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
};

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)));
}

function parseTimedText(xml: string) {
  const chunks: YouTubeChunk[] = [];
  const paragraph = /<p\b[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  for (const match of xml.matchAll(paragraph)) {
    const start = Number(match[1]) / 1000;
    const duration = Number(match[2]) / 1000;
    const rawText = decodeXml(match[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    const text = rawText.replace(/[♪♫]+/g, '').replace(/\s+/g, ' ').trim();
    const spoken = /[a-z]/i.test(text) && !/^\s*[[(].*[)\]]\s*$/i.test(text);
    if (spoken && duration > 0) chunks.push({ start, end: start + duration, text, breakAfter: /[♪♫]/.test(rawText) });
  }
  if (chunks.length) return chunks;
  const classic = /<text\b[^>]*\bstart="([\d.]+)"[^>]*\bdur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  for (const match of xml.matchAll(classic)) {
    const start = Number(match[1]);
    const duration = Number(match[2]);
    const rawText = decodeXml(match[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    const text = rawText.replace(/[♪♫]+/g, '').replace(/\s+/g, ' ').trim();
    const spoken = /[a-z]/i.test(text) && !/^\s*[[(].*[)\]]\s*$/i.test(text);
    if (spoken && duration > 0) chunks.push({ start, end: start + duration, text, breakAfter: /[♪♫]/.test(rawText) });
  }
  return chunks;
}

function segmentYouTubeChunks(chunks: YouTubeChunk[]) {
  const result = [] as ReturnType<typeof mergeTranscriptChunks>;
  let group: YouTubeChunk[] = [];
  const flush = () => {
    if (!group.length) return;
    result.push(...mergeTranscriptChunks(group, 11, 1.1, 22).map(({ start, end, text }) => ({ start, end, text })));
    group = [];
  };
  for (const chunk of chunks) {
    group.push(chunk);
    if (chunk.breakAfter) flush();
  }
  flush();
  return result;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!/^[\w-]{11}$/.test(id)) {
    return NextResponse.json({ error: 'Link YouTube không đúng định dạng.' }, { status: 400, headers: corsHeaders });
  }
  try {
    const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' } },
        videoId: id,
      }),
    });
    if (!playerResponse.ok) throw new Error('YouTube tạm thời chưa trả về thông tin video.');
    const player = await playerResponse.json() as {
      playabilityStatus?: { status?: string; reason?: string };
      videoDetails?: { title?: string; lengthSeconds?: string };
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
    };
    if (player.playabilityStatus?.status !== 'OK') {
      throw new Error(player.playabilityStatus?.reason || 'Video YouTube này không phát được.');
    }
    const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const englishTracks = tracks.filter(track => /^en(?:-|$)/i.test(track.languageCode));
    const track = englishTracks.find(item => item.kind !== 'asr') || englishTracks[0];
    if (!track) throw new Error('Video này không có phụ đề tiếng Anh dùng được. Hãy chọn video khác có phụ đề tiếng Anh.');
    const captionUrl = new URL(track.baseUrl);
    if (!captionUrl.hostname.endsWith('.youtube.com')) throw new Error('Link phụ đề không hợp lệ.');
    const captionResponse = await fetch(captionUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await captionResponse.text();
    const chunks = parseTimedText(xml);
    if (!chunks.length) throw new Error('YouTube không trả về phụ đề tiếng Anh đọc được.');
    const sentences = segmentYouTubeChunks(chunks);
    const label = track.name?.simpleText || track.name?.runs?.map(item => item.text || '').join('') || 'English';
    return NextResponse.json({
      id,
      title: player.videoDetails?.title || `YouTube · ${id}`,
      duration: Number(player.videoDetails?.lengthSeconds) || sentences.at(-1)?.end || 0,
      language: track.languageCode,
      label,
      autoGenerated: track.kind === 'asr',
      sentences,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không đọc được phụ đề YouTube.' },
      { status: 422, headers: corsHeaders },
    );
  }
}
