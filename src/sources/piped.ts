// Neden: Invidious instance'ları topluca kapalı olabiliyor; Piped ikinci halka.
// Canlı doğrulama (2026-10-15): api.piped.private.coffee /search 200, /streams 500 döndü —
// arama fallback'i olarak değerli, çözümleme ikinci şans. Instance'lar döndükçe kendiliğinden düzelir.
import type { Track, AudioSource } from '../types';

const INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.kavin.rocks',
];

async function getJSON(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Neden: kavin.rocks okhttp UA'yı (RN Android varsayılanı) 403 ile reddediyor —
    // tarayıcı kimliğiyle normal istemci gibi görün (invidious.ts ile aynı set).
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface PipedItem {
  url?: string; // "/watch?v=VIDEOID"
  type?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploaderName?: string;
  uploaderUrl?: string; // "/channel/UC..."
  views?: number;
}

export async function search(query: string): Promise<Track[]> {
  let lastErr: unknown = null;
  for (const base of INSTANCES) {
    try {
      const data = (await getJSON(
        `${base}/search?q=${encodeURIComponent(query)}&filter=videos`
      )) as { items?: PipedItem[] };
      const tracks = (data.items ?? [])
        .filter((i) => i.type === 'stream' && i.url?.includes('v='))
        .map<Track>((i) => ({
          id: i.url!.split('v=')[1].split('&')[0],
          title: i.title ?? '(başlıksız)',
          channel: i.uploaderName ?? 'Bilinmeyen kanal',
          channelId: i.uploaderUrl?.replace('/channel/', ''),
          thumb: i.thumbnail,
          durationSec: i.duration,
          views: i.views,
        }));
      if (tracks.length > 0) return tracks;
      lastErr = new Error(`${base} boş sonuç`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Piped arama başarısız: ${String(lastErr)}`);
}

interface PipedStream {
  audioStreams?: { url?: string; mimeType?: string; bitrate?: number }[];
}

export async function resolve(id: string): Promise<AudioSource> {
  let lastErr: unknown = null;
  for (const base of INSTANCES) {
    try {
      const data = (await getJSON(`${base}/streams/${id}`)) as PipedStream;
      const pool = (data.audioStreams ?? []).filter((s) => s.url);
      if (pool.length === 0) throw new Error('ses stream yok');
      const mp4 = pool.filter((s) => (s.mimeType ?? '').includes('mp4'));
      const use = mp4.length > 0 ? mp4 : pool;
      use.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      return { uri: use[0].url!, mime: use[0].mimeType, bitrate: use[0].bitrate };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Piped ses çözümlenemedi (id=${id}): ${String(lastErr)}`);
}
