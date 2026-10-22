// Neden: Invidious/Piped instance ekosistemi çöktü (2026-10-22: 46 instance tarandı,
// hiçbiri ses veremiyor) — YouTube InnerTube API'sine istemci taklidiyle doğrudan erişim.
// Canlı doğrulama (2026-10-22): WEB search 19 sonuç; IOS player playability=OK + stream 206.
// Yeni dependency yok — saf fetch POST. Invidious/Piped fallback olarak kalır.
import type { Track, AudioSource } from '../types';

// Neden: test edilmiş değerler — değiştirme. WEB search için, IOS player için
// (ANDROID_MUSIC/VR LOGIN_REQUIRED, MWEB UNPLAYABLE, TVHTML5 404 veriyor).
const WEB_SEARCH = {
  clientVersion: '2.20250312.04.00',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  xName: '1',
};
const IOS_PLAYER = {
  clientVersion: '20.10.4',
  ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  xName: '5',
  context: {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    deviceMake: 'Apple',
    deviceModel: 'iPhone16,2',
    osName: 'iPhone',
    osVersion: '18.3.2.22D82',
    hl: 'en',
    gl: 'US',
  },
};

// Neden: search ve player uçları aynı zarfı kullanır — tek helper, iki sarmalayıcı.
async function postInnertube(
  endpoint: 'search' | 'player',
  body: unknown,
  ua: string,
  xName: string,
  clientVersion: string,
  timeoutMs = 8000,
  // Neden: any — InnerTube yanıt şeması devasa ve değişken; savunmacı parsing
  // ile alan alan okunur, tam tip yazmak kırılgan olur.
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ua,
        'X-YouTube-Client-Name': xName,
        'X-YouTube-Client-Version': clientVersion,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Neden: sabit yol kırılgan (YouTube yapıyı değiştirebilir) — yanıtta recursive
// yürü, videoRenderer anahtarını gördüğün yerde topla.
function collectVideoRenderers(node: any, out: any[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return;
  }
  if (node.videoRenderer) {
    out.push(node.videoRenderer);
    return; // altını daha fazla kazma — renderer yaprak sayılır
  }
  for (const key of Object.keys(node)) collectVideoRenderers(node[key], out);
}

// Neden: lengthText "3:41" / "1:02:15" formatında — 60^k ile saniyeye çevir.
function parseLengthToSec(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const parts = text.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function pickWidestThumb(thumbnails: any[] | undefined): string | undefined {
  if (!thumbnails || thumbnails.length === 0) return undefined;
  let best = thumbnails[0];
  for (const t of thumbnails) {
    if ((t.width ?? 0) > (best.width ?? 0)) best = t;
  }
  return best.url; // URL zaten i.ytimg.com absolute
}

export async function search(query: string): Promise<Track[]> {
  const data = await postInnertube(
    'search',
    {
      context: { client: { clientName: 'WEB', clientVersion: WEB_SEARCH.clientVersion, hl: 'en', gl: 'US' } },
      query,
    },
    WEB_SEARCH.ua,
    WEB_SEARCH.xName,
    WEB_SEARCH.clientVersion,
  );
  const renderers: any[] = [];
  collectVideoRenderers(data, renderers);
  // Neden: videoId'siz kartlar reklam/kanal/shelf — atla.
  const tracks = renderers.flatMap((r: any): Track[] => {
    const id: string | undefined = r.videoId;
    if (!id) return [];
    return [
      {
        id,
        title: r.title?.runs?.[0]?.text ?? '(başlıksız)',
        channel: r.ownerText?.runs?.[0]?.text ?? 'Bilinmeyen kanal',
        channelId: r.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
        thumb: pickWidestThumb(r.thumbnail?.thumbnails) ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        durationSec: parseLengthToSec(r.lengthText?.simpleText),
        // views: bu yanıtta güvenilir değil — doldurulmuyor
      },
    ];
  });
  if (tracks.length === 0) throw new Error('InnerTube boş sonuç döndürdü');
  return tracks;
}

interface InnertubeFormat {
  url?: string;
  mimeType?: string;
  bitrate?: number;
}

export async function resolve(id: string): Promise<AudioSource> {
  const data = await postInnertube(
    'player',
    {
      context: { client: { ...IOS_PLAYER.context } },
      videoId: id,
      contentCheckOk: true,
      racyCheckOk: true,
    },
    IOS_PLAYER.ua,
    IOS_PLAYER.xName,
    IOS_PLAYER.clientVersion,
  );
  // Neden: oynatılamaz videoda (bölge/yaş kısıtı) URL kazımak yerine sebebi söyle.
  const status: string | undefined = data?.playabilityStatus?.status;
  if (status !== 'OK') {
    const reason: string = data?.playabilityStatus?.reason ?? status ?? 'bilinmiyor';
    throw new Error(`oynatılamaz: ${reason}`);
  }
  // Neden: IOS istemcisi imzasız (deşifresiz) url verir — test edildi.
  const formats: InnertubeFormat[] = data?.streamingData?.adaptiveFormats ?? [];
  const audio = formats.filter((f) => f.url && (f.mimeType ?? '').includes('audio'));
  if (audio.length === 0) throw new Error('ses formatı yok');
  // Tercih: m4a/aac (en uyumlu) → en yüksek bitrate; Opus son çare.
  const mp4 = audio.filter((f) => (f.mimeType ?? '').includes('mp4'));
  const pool = mp4.length > 0 ? mp4 : audio;
  pool.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return { uri: pool[0].url!, mime: pool[0].mimeType, bitrate: pool[0].bitrate };
}
