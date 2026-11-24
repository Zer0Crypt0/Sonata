// Neden: Ekranlar SADECE bu modülü bilir — sağlayıcı zinciri (InnerTube → Invidious → Piped)
// burada saklanır; biri ölünce uygulama ölmez, sıradaki denenir.
import type { Track, AudioSource, PlaylistCard, ProfileCard } from '../types';
import * as youtube from './youtube';
import * as invidious from './invidious';
import * as piped from './piped';
import * as searchCache from '../search-cache';

// Neden: InnerTube tek istek ve doğrulanmış (~1.2 sn) — önce o denenir, fallback'ler
// yalnızca o başarısız olursa çalışır. Böylece her aramada 9 ölü instance'a istek gitmez.
const SEARCH_TIMEOUT_MS = 3000;
const INNERTUBE_TIMEOUT_MS = 6000;
const RESOLVE_TIMEOUT_MS = 8000;

// Neden: Aynı sorgu üst üste yazılır/dokunulur — 5 dk içindeyse ağa hiç
// gitmeden dön (tekrar arama ~anında). Bellek-içi Map yeterli; kalıcılık gerekmez.
const cache = new Map<string, { at: number; tracks: Track[] }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dk
// Neden: Ana ekran açılışında öneri+radyo AYNI kanalı (örn. "LORN") paralel sorar —
// uçuş-halindeki sorgu tek fetch'e düşer, diğerleri aynı promise'i bekler.
// 9 paralel arama → benzersiz sorgu sayısı kadar istek (cihazda 3-4'e iner).
const inflight = new Map<string, Promise<Track[]>>();

// Neden: ilk aramanın TLS el sıkışması ~0.4 sn yiyor (cihaz ölçümü: soğuk TTFB
// 1.41 sn, sıcak 0.96 sn). Açılışta tek küçük istek bağlantıyı ısıtır; hata yutulur.
// Artık birincil arama music.youtube'a gidiyor — ısıtma da oraya yapılır.
void fetch('https://music.youtube.com/robots.txt').catch(() => {});

// Neden: Invidious/Piped 2026 itibarıyla ses veremiyor; her istekte tekrar denemek
// aramayı geciktiriyor. Ölü işaretlenen sağlayıcı 10 dk atlanır, süre sonunda
// kendiliğinden yeniden denenir (instance'lar dönebilir).
const DEAD_TTL = 10 * 60 * 1000;
const deadUntil = new Map<string, number>();

function alive(name: string): boolean {
  const until = deadUntil.get(name);
  return !until || Date.now() > until;
}

function markDead(name: string): void {
  deadUntil.set(name, Date.now() + DEAD_TTL);
}

function markAlive(name: string): void {
  deadUntil.delete(name);
}

// Neden: Tek yerde timeout + sağlık hafızası: başarı sağlayıcıyı canlı, hata ölü işaretler.
// `remember=false` → bu sağlayıcı asla "ölü" işaretlenmez. InnerTube tek gerçek kaynak
// olduğu için kullanılır: tek bir yavaş istek onu 10 dk devre dışı bırakmamalı.
function withTimeout<T>(name: string, run: () => Promise<T>, ms: number, remember = true): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, rej) => {
    timer = setTimeout(() => {
      if (remember) markDead(name);
      rej(new Error(`${name}: timeout`));
    }, ms);
  });
  const work = run().then(
    (value) => {
      markAlive(name);
      return value;
    },
    (err) => {
      if (remember) markDead(name);
      throw err;
    },
  );
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Neden: YouTube aynı videoyu iki rafta birden döndürebiliyor (ölçüm: "bjork"
// yanıtında 28 renderer, 27 benzersiz videoId) — liste çift satır gösterip React
// "duplicate key" hatası veriyordu. İlk görülen kayıt korunur, sıra bozulmaz.
function uniqueById(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

// Neden: açılışta öneri (3) + radyo (6) = 9 arama aynı anda ağa çıkıyordu; kullanıcı
// hemen yazınca ilk araması bu 9 isteğin arkasında bekliyordu (cihazda 9 sn'ye kadar).
// Kullanıcı araması (signal taşıyan) hiç beklemez; arka plan en fazla 2 eşzamanlı gider.
const BG_LIMIT = 2;
let bgActive = 0;
const bgWaiters: (() => void)[] = [];

async function withBgSlot<T>(run: () => Promise<T>): Promise<T> {
  if (bgActive >= BG_LIMIT || bgWaiters.length > 0) {
    await new Promise<void>((resolve) => bgWaiters.push(resolve));
  } else {
    bgActive++;
  }
  try {
    return await run();
  } finally {
    // Neden: boşalan slot doğrudan sıradakine devredilir — sayaç 0'a düşüp
    // araya yeni bir çağrı girmesin.
    const next = bgWaiters.shift();
    if (next) next();
    else bgActive--;
  }
}

// Neden: `signal` — kullanıcı yazmaya devam edince önceki sorgu iptal edilir;
// indirme ve JSON.parse boşa sürmez, doğru sorgunun cevabı kuyruğa takılmaz.
export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const key = query.trim().toLocaleLowerCase('tr');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.tracks; // ağa gitme
  // Neden: uçuştaki sorgu paylaşımı yalnızca iptalsiz çağrılarda (ana ekran
  // öneri/radyo). İptal edilebilir bir promise'e bağlanmak, iptal edildiğinde
  // aynı sorguyu bekleyen diğer çağıranı da öldürürdü.
  if (!signal) {
    const flying = inflight.get(key);
    if (flying) return flying; // aynı sorgu havada — tek fetch'i paylaş
  }

  const run = (async (): Promise<Track[]> => {
  // L2: disk — uygulama yeniden açıldığında da aynı sorgu ağa gitmeden dönsün.
  // Neden: tekilleştirme burada da uygulanır — düzeltmeden önce yazılmış disk
  // kayıtları çift video içerebiliyor (React "duplicate key" hatası geri gelmesin).
  const fromDisk = await searchCache.get(key);
  if (fromDisk && fromDisk.length > 0) {
    const tracks = uniqueById(fromDisk);
    cache.set(key, { at: Date.now(), tracks });
    return tracks;
  }

  // 1) TEK istek: WEB araması. Ölçüm (2026-10-28): 62-72 KB / ~1.0 sn, 18-19 sonuç.
  // Neden music.youtube tarifi kaldırıldı: aynı sonuçlar için 806-940 KB indiriyor
  // (JSON'u 2.8-3.0 MB) ve Promise.any kaybedeni iptal etmediği için o veri her
  // aramada boşuna iniyordu — yazarken üst üste binince sonuç saniyelerce gecikiyordu.
  // Neden: remember=false — InnerTube geçici hatada "ölü" sayılmaz, sonraki aramada yine denenir.
  if (alive('innertube')) {
    try {
      const tracks = uniqueById(
        // Neden: searchFast = WEB_REMIX (12-14 KB, ~0,6 sn) → www WEB fallback.
        // Arka plan çağrıları (signal yok) kuyruğa girer; kullanıcı araması girmez.
        await withTimeout(
          'innertube',
          () => (signal ? youtube.searchFast(query, signal) : withBgSlot(() => youtube.searchFast(query))),
          INNERTUBE_TIMEOUT_MS,
          false,
        ),
      );
      // Neden: iptal edilen çağrı önbelleğe yazılmaz — eksik/yarım sonuç kalmasın.
      if (!signal?.aborted) {
        cache.set(key, { at: Date.now(), tracks });
        searchCache.put(key, tracks);
      }
      return tracks;
    } catch (e) {
      // Neden: iptal bir arıza değil — ölü sağlayıcı denemelerine düşmeden çık.
      if (signal?.aborted) throw e;
      // boş/batık → fallback'e geç
    }
  }

    // Neden: iptal edildiyse ölü instance'ları beklemek anlamsız.
    if (signal?.aborted) throw new Error('arama iptal edildi');

    // 2) Yalnızca InnerTube başarısızsa: Invidious/Piped paralel yarışır, ilk dolu sonuç kazanır.
    const fallbacks = (['invidious', 'piped'] as const).filter(alive);
    const settled = await Promise.allSettled(
      fallbacks.map((name) =>
        withTimeout(name, () => (name === 'invidious' ? invidious.search(query) : piped.search(query)), SEARCH_TIMEOUT_MS),
      ),
    );
    for (const s of settled) {
      // Neden: Promise.any boş diziyi başarı sayar — önce boş olmayan ilk sonuç alınır.
      if (s.status === 'fulfilled' && s.value.length > 0) {
        const tracks = uniqueById(s.value);
        cache.set(key, { at: Date.now(), tracks });
        searchCache.put(key, tracks);
        return tracks;
      }
    }
    const reasons = settled.map((s) => (s.status === 'rejected' ? String(s.reason) : 'boş')).join('; ');
    throw new Error(`Arama kaynağı yok: ${reasons || 'tüm sağlayıcılar ölü işaretli'}`);
  })();
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    if (inflight.get(key) === run) inflight.delete(key);
  }
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

export async function resolveAudio(track: Track): Promise<AudioSource> {
  // 1) InnerTube (ANDROID + visitorData) — doğrulanmış tek istek.
  if (alive('innertube')) {
    try {
      return await withTimeout('innertube', () => youtube.resolve(track.id), RESOLVE_TIMEOUT_MS, false);
    } catch {
      // fallback'e geç
    }
  }

  // 2) Invidious/Piped paralel yarış (ölü işaretliler atlanır).
  const fallbacks = (['invidious', 'piped'] as const).filter(alive);
  const settled = await Promise.allSettled(
    fallbacks.map((name) =>
      withTimeout(name, () => (name === 'invidious' ? invidious.resolve(track.id) : piped.resolve(track.id)), RESOLVE_TIMEOUT_MS),
    ),
  );
  for (const s of settled) {
    if (s.status === 'fulfilled') return s.value;
  }
  const reasons = settled.map((s) => (s.status === 'rejected' ? String(s.reason) : 'boş')).join('; ');
  throw new Error(`Ses akışı alınamadı "${track.title}": ${reasons || 'tüm sağlayıcılar ölü işaretli'}`);
}
