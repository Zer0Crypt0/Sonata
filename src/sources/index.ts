// Neden: Ekranlar SADECE bu modülü bilir — sağlayıcı zinciri (InnerTube → Invidious → Piped)
// burada saklanır; biri ölünce uygulama ölmez, sıradaki denenir.
import type { Track, AudioSource, PlaylistCard, ProfileCard } from '../types';
import * as youtube from './youtube';
import * as invidious from './invidious';
import * as piped from './piped';

// Neden: Sıralı zincir en kötü 2×timeout bekletir — paralel yarışta ilk dönen
// kazanır (toplam ~4sn yerine ~2sn). Boş dönen sağlayıcı elenir; hepsi
// boşsa/batarsa hata fırlatılır.
const SEARCH_TIMEOUT_MS = 3000;

// Neden: Aynı sorgu üst üste yazılır/dokunulur — 5 dk içindeyse ağa hiç
// gitmeden dön (tekrar arama ~anında). Bellek-içi Map yeterli; kalıcılık gerekmez.
const cache = new Map<string, { at: number; tracks: Track[] }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dk

function withTimeout(p: (q: string) => Promise<Track[]>, query: string, ms: number): Promise<Track[]> {
  return Promise.race([
    p(query),
    new Promise<Track[]>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export async function searchTracks(query: string): Promise<Track[]> {
  const key = query.trim().toLocaleLowerCase('tr');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.tracks; // ağa gitme
  // Neden: InnerTube tek istek — en hızlı ve en sağlamı; Invidious/Piped fallback.
  const providers = [youtube.search, invidious.search, piped.search];
  const settled = await Promise.allSettled(providers.map((p) => withTimeout(p, query, SEARCH_TIMEOUT_MS)));
  // Neden: Promise.any boş diziyi başarı sayar — önce boş olmayan ilk sonuç alınır.
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.length > 0) {
      cache.set(key, { at: Date.now(), tracks: s.value });
      return s.value;
    }
  }
  const reasons = settled.map((s) => (s.status === 'rejected' ? String(s.reason) : 'boş')).join('; ');
  throw new Error(`Arama kaynağı yok: ${reasons}`);
}

// Neden: Albümler/Listeler/Profiller sekmeleri Invidious'a özel uçlar kullanır
// (Piped'da karşılığı yok) — doğrudan export, timeout getJSON içinde (8sn).
export async function searchPlaylists(query: string): Promise<PlaylistCard[]> {
  return invidious.searchPlaylists(query);
}

export async function searchChannels(query: string): Promise<ProfileCard[]> {
  return invidious.searchChannels(query);
}

export async function getChannelPlaylists(channelId: string): Promise<PlaylistCard[]> {
  return invidious.getChannelPlaylists(channelId);
}

// Neden: Invidious 403 verirse Piped'in sırasını beklemek boşa zaman —
// ikisi paralel yarışır, ilk başarılı URI kazanır (searchTracks ile aynı desen).
const RESOLVE_TIMEOUT_MS = 8000;

export async function resolveAudio(track: Track): Promise<AudioSource> {
  // Neden: InnerTube tek istek — en hızlı ve en sağlamı; Invidious/Piped fallback.
  const providers = [youtube.resolve, invidious.resolve, piped.resolve];
  const settled = await Promise.allSettled(
    providers.map((p) =>
      Promise.race([
        p(track.id),
        new Promise<AudioSource>((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), RESOLVE_TIMEOUT_MS)
        ),
      ])
    )
  );
  for (const s of settled) {
    if (s.status === 'fulfilled') return s.value;
  }
  const reasons = settled
    .map((s) => (s.status === 'rejected' ? String(s.reason) : 'boş'))
    .join('; ');
  throw new Error(`Ses akışı alınamadı "${track.title}": ${reasons}`);
}
