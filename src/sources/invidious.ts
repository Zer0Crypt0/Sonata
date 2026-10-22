// Neden: Invidious, YouTube'un aramasını ve ses akışını sunan açık API'dir.
// Tek instance'la sınırlı kalmak ölürcesine riskli — sırayla denenen instance listesi tutuyoruz.
// Canlı doğrulama (2026-10-15): invidious.f5.si hem /search hem /videos (googlevideo URL) 200 döndü.
import type { Track, AudioSource, PlaylistCard, ProfileCard } from '../types';

const INSTANCES = [
  'https://invidious.f5.si', // doğrulanmış çalışan
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
  'https://invidious.privacyredirect.com',
  'https://invidious.materialio.us',
  'https://invidious.perennialte.ch',
  'https://invidious.einfachzocken.eu',
  'https://invidious.darkness.services',
];

// Neden: instance'lar dakikalarca takılabilir; uygulama UI'ı dondurmamak için
// sabit timeout + iptal gerekli.
async function getJSON(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Neden: bazı instance'lar bot User-Agent'ı 403 ile reddeder —
    // tarayıcı kimliği + Accept header'larıyla normal istemci gibi görün.
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

interface InvVideo {
  type?: string;
  title?: string;
  videoId?: string;
  author?: string;
  authorId?: string;
  videoThumbnails?: { url: string; quality?: string }[];
  lengthSeconds?: number;
  viewCount?: number;
}

export async function search(query: string): Promise<Track[]> {
  let lastErr: unknown = null;
  for (const base of INSTANCES) {
    try {
      const data = (await getJSON(
        `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
      )) as InvVideo[];
      const tracks = data
        .filter((v) => v.type === 'video' && v.videoId)
        .map<Track>((v) => ({
          id: v.videoId!,
          title: v.title ?? '(başlıksız)',
          channel: v.author ?? 'Bilinmeyen kanal',
          channelId: v.authorId,
          // Neden: Doğrudan i.ytimg.com — instance `/vi/` yolu text/html
          // dönüyor (cihazda test edildi: 200 + 7KB HTML, Image render edemez).
          // videoId'den kurulan ytimg URL'si instance'tan bağımsız + hızlı.
          thumb: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
          durationSec: v.lengthSeconds,
          views: v.viewCount,
        }));
      if (tracks.length > 0) return tracks; // ilk başarılı instance kazanır
      lastErr = new Error(`${base} boş sonuç döndürdü`);
    } catch (e) {
      lastErr = e; // sessizce yutma: sıradaki instance'a geç, son hatayı sakla
    }
  }
  throw new Error(`Arama başarısız (tüm instance'lar denendi): ${String(lastErr)}`);
}

// Neden: Albümler/Listeler/Profiller sekmeleri — Invidious type'lı arama +
// kanal playlist'leri. Alanlar savunmacı okunur (instance'lar eksik alan dönebilir).
interface InvPlaylist {
  type?: string;
  title?: string;
  playlistId?: string;
  playlistThumbnail?: string;
  author?: string;
  authorId?: string;
  videoCount?: number;
}

interface InvChannel {
  type?: string;
  author?: string;
  authorId?: string;
  authorThumbnails?: { url: string; width?: number }[];
  subCount?: number;
  videoCount?: number;
}

// Neden: üç yeni uç da aynı instance turunu kullanır — tek helper, üç sarmalayıcı.
async function getFromInstances<T>(path: (base: string) => string): Promise<T> {
  let lastErr: unknown = null;
  for (const base of INSTANCES) {
    try {
      return (await getJSON(path(base))) as T;
    } catch (e) {
      lastErr = e; // sıradaki instance'a geç
    }
  }
  throw new Error(`tüm instance'lar denendi: ${String(lastErr)}`);
}

// Playlists sekmesi: 「query」 ile eşleşen çalma listeleri (ham, filtre SearchScreen'de).
export async function searchPlaylists(query: string): Promise<PlaylistCard[]> {
  const data = await getFromInstances<InvPlaylist[]>(
    (base) => `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=playlist`
  );
  return (Array.isArray(data) ? data : [])
    .filter((p) => p.playlistId && p.title)
    .map<PlaylistCard>((p) => ({
      id: p.playlistId!,
      title: p.title!,
      thumb: p.playlistThumbnail,
      itemCount: p.videoCount,
      author: p.author ?? 'Bilinmeyen',
      authorId: p.authorId,
    }));
}

// Profiles sekmesi: 「query」 ile eşleşen kanallar (ham, eşleşme SearchScreen'de).
export async function searchChannels(query: string): Promise<ProfileCard[]> {
  const data = await getFromInstances<InvChannel[]>(
    (base) => `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=channel`
  );
  const list = Array.isArray(data) ? data : [];
  const q = query.trim().toLocaleLowerCase('tr');
  return list
    .filter((c) => c.authorId && c.author)
    .map<ProfileCard>((c) => {
      const thumbs = c.authorThumbnails ?? [];
      const avatar = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url;
      const name = c.author!;
      return {
        id: c.authorId!,
        name,
        avatar,
        subscriberCount: c.subCount,
        // Neden: sanatçı rozeti burada değil — aranan ad SearchScreen'de bilinir,
        // burada ham eşleşme bayrağı: ad sorguyu içeriyor/yakınsa true.
        isArtist:
          name.toLocaleLowerCase('tr').includes(q) ||
          q.split(' ').some((w) => w.length > 2 && name.toLocaleLowerCase('tr').includes(w)),
      };
    });
}

// Albums sekmesi: sanatçının kanalındaki playlist'ler (albüm/karışık liste niyetine).
export async function getChannelPlaylists(channelId: string): Promise<PlaylistCard[]> {
  const data = await getFromInstances<InvPlaylist[] | { playlists?: InvPlaylist[] }>(
    (base) => `${base}/api/v1/channels/${channelId}/playlists`
  );
  // Neden: bazı instance'lar dizi, bazıları {playlists:[...]} döner — ikisini de yut.
  const list = Array.isArray(data) ? data : (data.playlists ?? []);
  return list
    .filter((p) => p.playlistId && p.title)
    .map<PlaylistCard>((p) => ({
      id: p.playlistId!,
      title: p.title!,
      thumb: p.playlistThumbnail,
      itemCount: p.videoCount,
      author: p.author ?? '',
      authorId: p.authorId,
    }));
}

interface InvFormat {
  type?: string;
  url?: string;
  bitrate?: number;
  itag?: number;
}

export async function resolve(id: string): Promise<AudioSource> {
  let lastErr: unknown = null;
  for (const base of INSTANCES) {
    try {
      // Neden: 9 instance × 8s = 72s'lik döngü, resolveAudio'nun 8s yarış
      // timeout'unu asla geçemez → instance başına 3s, 8s içinde 2-3 deneme.
      const data = (await getJSON(
        `${base}/api/v1/videos/${id}?fields=adaptiveFormats,title`,
        3000
      )) as { adaptiveFormats?: InvFormat[] };
      const audio = (data.adaptiveFormats ?? []).filter(
        (f) => f.url && (f.type ?? '').includes('audio')
      );
      if (audio.length === 0) throw new Error('ses formatı yok');
      // Tercih sırası: m4a/aac (en uyumlu) → en yüksek bitrate;
      // Opus Android'de çalışır ama evrensel değil, son çare.
      const mp4 = audio.filter((f) => (f.type ?? '').includes('mp4'));
      const pool = mp4.length > 0 ? mp4 : audio;
      pool.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      return { uri: pool[0].url!, mime: pool[0].type, bitrate: pool[0].bitrate };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Ses çözümlenemedi (videoId=${id}): ${String(lastErr)}`);
}
