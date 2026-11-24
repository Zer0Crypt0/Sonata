// Neden: Invidious/Piped instance ekosistemi çöktü (2026-10-22: 46 instance tarandı,
// hiçbiri ses veremiyor) — YouTube InnerTube API'sine istemci taklidiyle doğrudan erişim.
// Canlı doğrulama (2026-10-22): WEB search 18-19 sonuç ~1.2 sn; ANDROID player
// playability=OK + googlevideo URL'i no-Range 200 / bytes=0-0 206 / seek 206.
// Yeni dependency yok — saf fetch POST. Invidious/Piped fallback olarak kalır.
import type { Track, AudioSource } from '../types';

// Neden: test edilmiş değerler — değiştirme. Cihazda kanıtlı hızlı arama (~1sn, 19 sonuç).
const WEB_SEARCH = {
  clientVersion: '2.20250312.04.00',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  xName: '1',
};

// Neden: Weezer'in arama tarifi (APK'tan) — music.youtube.com daha hafif yanıt döner
// (compactVideoRenderer, sayfalama yok) ve farklı altyapıdan geçtiği için www tıkandığında
// bile çalışır. Cihazda kanıtlı: "lorn acid rain" → 18 sonuç tek rafta.
const MUSIC_SEARCH = {
  key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
  ua: 'com.google.android.youtube/19.03.35 (Linux; U; Android 12; en_GB) gzip',
  clientVersion: '21.06.252',
};

// Neden: RYT (com.soundryt.music 4.9.99) APK'sından çıkan hızlı arama tarifi —
// music.youtube + WEB_REMIX + "sadece şarkılar" params. Aynı ağda ölçüm:
// 12-14 KB / 0,55-0,71 sn, 20 şarkı. Sonata'nın eski www WEB araması aynı
// sorgularda 54-57 KB / 0,89-1,10 sn dönüyordu — fark tamamen yanıt boyutunda.
const REMIX_SEARCH = {
  key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
  clientVersion: '1.20260121.03.00',
  paramsSongs: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAUQAxAKEAk%3D',
};

// Neden: IOS istemcisi (eski tarif) googlevideo URL'lerini ~1MB'da kilitliyordu:
// no-Range 302→403, 1MB ötesi 403 → ExoPlayer "Source error". ANDROID + visitorData
// tarifi 2026-10-22'de üç testten geçti (tam dosya, Range 0-0, seek) ve PoToken
// istemiyor. Bu yüzden oynatma ANDROID'e taşındı.
const ANDROID_PLAYER = {
  clientVersion: '21.06.252',
  ua: 'com.google.android.youtube/19.03.35 (Linux; U; Android 12; en_GB) gzip',
};

// Neden: player anahtarı Weezer APK'sından alınan, yaygın kullanılan InnerTube anahtarı;
// key parametresi olmadan da çalışır ama bazı PoToken/ABR yolları anahtarla açılıyor.
const PLAYER_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';// Neden: search ve player farklı başlık setleri kullanır (player'da X-YouTube-Client-*
// YOK, sadece UA + X-Goog-Api-Format-Version) — bu yüzden başlıklar dışarıdan verilir.
async function postInnertube(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs = 8000,
  // Neden: dışarıdan iptal — kullanıcı yazmaya devam edince eski sorgunun
  // indirmesi boşa sürsün diye (ağ ve JS thread'i boşa meşgul etmesin).
  signal?: AbortSignal,
  // Neden: any — InnerTube yanıt şeması devasa ve değişken; savunmacı parsing
  // ile alan alan okunur, tam tip yazmak kırılgan olur.
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// Neden: sabit yol kırılgan (YouTube yapıyı değiştirebilir) — yanıtta recursive
// yürü, istenen renderer anahtarını gördüğün yerde topla (www: videoRenderer,
// music: compactVideoRenderer).
function collectVideoRenderers(node: any, out: any[], rendererKey = 'videoRenderer'): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out, rendererKey);
    return;
  }
  if (node[rendererKey]) {
    out.push(node[rendererKey]);
    return; // altını daha fazla kazma — renderer yaprak sayılır
  }
  for (const key of Object.keys(node)) collectVideoRenderers(node[key], out, rendererKey);
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

// Neden: music yanıtı www'den farklı — şarkılar compactVideoRenderer'da (radyo ve
// kanal kartları elenir). Alanlar: videoId, title.runs, shortBylineText.runs (kanal +
// browseId), lengthText.runs ("2:53"), thumbnail.thumbnails (en geniş).
export async function searchMusic(query: string): Promise<Track[]> {
  const data = await postInnertube(
    `https://music.youtube.com/youtubei/v1/search?key=${MUSIC_SEARCH.key}&prettyPrint=false`,
    {
      context: { client: { clientName: 'ANDROID', clientVersion: MUSIC_SEARCH.clientVersion, hl: 'en', gl: 'US' } },
      query,
    },
    {
      'Content-Type': 'application/json',
      'User-Agent': MUSIC_SEARCH.ua,
    },
    6000,
  );
  const renderers: any[] = [];
  collectVideoRenderers(data, renderers, 'compactVideoRenderer');
  const tracks = renderers.flatMap((r: any): Track[] => {
    const id: string | undefined = r.videoId;
    if (!id) return [];
    return [
      {
        id,
        title: r.title?.runs?.[0]?.text ?? '(başlıksız)',
        channel: r.shortBylineText?.runs?.[0]?.text ?? 'Bilinmeyen kanal',
        channelId: r.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
        thumb: pickWidestThumb(r.thumbnail?.thumbnails) ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        durationSec: parseLengthToSec(r.lengthText?.runs?.[0]?.text),
      },
    ];
  });
  if (tracks.length === 0) throw new Error('InnerTube Music boş sonuç döndürdü');
  return tracks;
}

// Neden: musicResponsiveListItemRenderer düzeni www'den tamamen farklı — videoId
// oynat butonunun watchEndpoint'inde, başlık/sanatçı flexColumns'ta, süre
// fixedColumns'ta. Savunmacı okunur: alan yoksa kayıt yine de üretilir.
function parseRemixItem(r: any): Track | null {
  const id: string | undefined =
    r?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
      ?.playNavigationEndpoint?.watchEndpoint?.videoId ??
    r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      ?.navigationEndpoint?.watchEndpoint?.videoId;
  if (!id) return null;
  const title: string | undefined =
    r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
  const artistRun = r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
  const durationText: string | undefined =
    r?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text ??
    r?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.simpleText;
  const thumbs: any[] | undefined =
    r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  return {
    id,
    title: title ?? '(başlıksız)',
    channel: artistRun?.text ?? 'Bilinmeyen kanal',
    channelId: artistRun?.navigationEndpoint?.browseEndpoint?.browseId,
    thumb: pickWidestThumb(thumbs) ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    durationSec: parseLengthToSec(durationText),
  };
}

// Neden: hızlı yol — tek istek, yalnız şarkı rafı (12-14 KB). Radyo/kanal/albüm
// kartları hiç gelmediği için hem indirme hem JSON.parse maliyeti düşük.
export async function searchRemix(query: string, signal?: AbortSignal): Promise<Track[]> {
  const data = await postInnertube(
    `https://music.youtube.com/youtubei/v1/search?key=${REMIX_SEARCH.key}&prettyPrint=false`,
    {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: REMIX_SEARCH.clientVersion,
          hl: 'en-GB',
          gl: 'US',
          platform: 'DESKTOP',
        },
      },
      query,
      params: REMIX_SEARCH.paramsSongs,
    },
    { 'Content-Type': 'application/json' },
    6000,
    signal,
  );
  const items: any[] = [];
  collectVideoRenderers(data, items, 'musicResponsiveListItemRenderer');
  const tracks = items.flatMap((r: any): Track[] => {
    const t = parseRemixItem(r);
    return t ? [t] : [];
  });
  if (tracks.length === 0) throw new Error('WEB_REMIX boş sonuç döndürdü');
  return tracks;
}

// Neden: tek giriş noktası — önce hızlı WEB_REMIX, başarısızsa geniş www araması.
// İptal edilen sorgu fallback'e düşmez (kullanıcı yazmaya devam ediyor).
export async function searchFast(query: string, signal?: AbortSignal): Promise<Track[]> {
  try {
    return await searchRemix(query, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  return search(query, signal);
}

export async function search(query: string, signal?: AbortSignal): Promise<Track[]> {
  const data = await postInnertube(
    'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      context: { client: { clientName: 'WEB', clientVersion: WEB_SEARCH.clientVersion, hl: 'en', gl: 'US' } },
      query,
    },
    {
      'Content-Type': 'application/json',
      'User-Agent': WEB_SEARCH.ua,
      'X-YouTube-Client-Name': WEB_SEARCH.xName,
      'X-YouTube-Client-Version': WEB_SEARCH.clientVersion,
      // Neden: başlık seti bilinçli olarak mevcut/çalışan haliyle bırakıldı —
      // aramada sorun hız değil zincir uzunluğuydu (index.ts'te çözüldü).
    },
    8000,
    signal,
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

// Neden: ÖNCE muxed progressive (formats[], örn. itag 18) — bu URL'ler Range'siz
// isteğe 200 + tam gövde döner (cihazda kanıtlı: 6.9MB, playing:true), ExoPlayer'ın
// ilk isteği hayatta kalır. Ses-only adaptive URL'ler Range'siz 302→403 verir —
// o yüzden ikinci planda. signatureCipher'lı kayıtlar (url yok) doğrudan elenir.
function pickPlayableFormat(data: any): AudioSource | null {
  const streaming = data?.streamingData ?? {};
  const progressive: InnertubeFormat[] = (streaming.formats ?? []).filter(
    (f: InnertubeFormat) => typeof f.url === 'string' && f.url.length > 0
  );
  if (progressive.length > 0) {
    const pick = [...progressive].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    return { uri: pick.url!, mime: pick.mimeType, bitrate: pick.bitrate };
  }
  const adaptive: InnertubeFormat[] = (streaming.adaptiveFormats ?? []).filter(
    (f: InnertubeFormat) => typeof f.url === 'string' && f.url!.length > 0 && (f.mimeType ?? '').includes('audio')
  );
  if (adaptive.length === 0) return null;
  const mp4 = adaptive.filter((f) => (f.mimeType ?? '').includes('mp4'));
  const pool = mp4.length > 0 ? mp4 : adaptive;
  const pick = [...pool].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  return { uri: pick.url!, mime: pick.mimeType, bitrate: pick.bitrate };
}

async function requestPlayer(videoId: string): Promise<any> {
  return postInnertube(
    `https://www.youtube.com/youtubei/v1/player?key=${PLAYER_KEY}&prettyPrint=false`,
    {
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: ANDROID_PLAYER.clientVersion,
          platform: 'MOBILE',
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
      videoId,
    },
    {
      'Content-Type': 'application/json',
      'User-Agent': ANDROID_PLAYER.ua,
      'X-Goog-Api-Format-Version': '2',
      // Neden: X-YouTube-Client-* bilinçli olarak YOK — ANDROID tarifinde başlık değil,
      // gövdedeki context.client kimliği belirleyici.
    },
  );
}

export async function resolve(id: string): Promise<AudioSource> {
  // Neden: Ağ dalgalanmasında tek tekrar yeterli — visitorData'sız tarif cihazda
  // kanıtlı çalışıyor, ekstra priming isteği sadece yavaşlatır. playabilityStatus
  // OK değilse tekrar denemek sonucu değiştirmez — sebep doğrudan fırlatılır.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await requestPlayer(id);
    const status: string | undefined = data?.playabilityStatus?.status;
    if (status !== 'OK') {
      const reason: string = data?.playabilityStatus?.reason ?? status ?? 'bilinmiyor';
      throw new Error(`oynatılamaz: ${reason}`);
    }
    const source = pickPlayableFormat(data);
    if (source) return source;
    lastErr = new Error('url içeren format yok');
  }
  throw new Error(`ses formatı yok: ${String(lastErr)}`);
}
