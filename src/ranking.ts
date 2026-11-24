// Neden: Kullanıcının asıl derdi — aramada "slowed+reverb" yüklemeleri orijinalin
// önüne geçmesin. Saf fonksiyonel skorlama; source katmanından bağımsız.
import type { Track } from './types';

// Türkçe/İngilizce kirletici ifadeler (orijinali düşürecek yüklemeler)
const DEMOTE_WORDS = [
  'slowed', 'reverb', 'nightcore', 'sped up', 'speed up', '8d', 'bass boosted',
  'boosted', 'remix', 'loop', '1 hour', '1hr', '1 hour', 'extended', 'cover',
  'karaoke', 'instrumental', 'type beat', 'reaction', 'lyric video', 'lyrics',
];

// Neden: `toLocaleLowerCase('tr')` Hermes'te çağrı başına ~70 ms yiyordu (cihazda
// 20 sonuçlu sıralama 4,7 sn sürüyordu — kullanıcının "sonuçlar geç geliyor"
// şikâyetinin asıl sebebi buydu). Türkçe karakterler zaten tek tek eşleniyor,
// `toLowerCase()` aynı sonucu verip ~1000 kat hızlı.
// Memoize: aynı başlık/kanal/sorgu tekrar tekrar normalize edilmesin.
const normCache = new Map<string, string>();

// Normalizasyon: Türkçe karakter + noktalama + fazla boşluk farklarını yut,
// "Lorn - ANVIL" ile "lorn anvil" aynı olsun diye.
function norm(s: string): string {
  const hit = normCache.get(s);
  if (hit !== undefined) return hit;
  const out = s
    .toLowerCase()
    .replace(/[ıİ]/g, 'i').replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normCache.size > 400) normCache.clear(); // sözlük sınırsız büyümesin
  normCache.set(s, out);
  return out;
}

// Sorgu "slowed" içeriyorsa kullanıcı ORİJİNAL istemiyordur — niyeti tersine çevir.
function queryIntentDemotes(query: string): boolean {
  const q = norm(query);
  return DEMOTE_WORDS.some((w) => q.includes(norm(w)));
}

/**
 * Skorlama kuralları (nedenleri):
 * - Kanal = aranan sanatçı adı → +60 (official/artist channel her zaman orijinaldir)
 * - Başlık sanatçı adını içeriyor → +25
 * - Kirletici kelime varsa → -50 (ama sorgu da kirletici istiyorsa +40: niyeti uygula)
 * - Popülerlik (log10 görüntülenme) → max +20 (orijinaller genelde en çok izlenen)
 * - Süre 2-9 dk aralığı → +10 (shorts/10saatlık loop'lar için -20)
 */
export function scoreTrack(t: Track, query: string): number {
  const q = norm(query);
  const title = norm(t.title);
  const channel = norm(t.channel);
  // Aranan sanatçı adı: sorgudan kirleticileri ve "official" gibi ekleri at
  const artist = norm(
    q.split(' ').filter((w) => !DEMOTE_WORDS.includes(w) && w !== 'official').join(' ')
  );
  const intentDemote = queryIntentDemotes(query);

  let score = 0;

  if (artist && channel && (channel === artist || channel.includes(artist))) {
    score += 60; // sanatçının kendi kanalı → en güçlü orijinal sinyali
  }
  if (artist && title.includes(artist)) {
    score += 25;
  }

  const hasDemote = DEMOTE_WORDS.some((w) => title.includes(norm(w)));
  if (hasDemote) {
    score += intentDemote ? 40 : -50; // kullanıcı "slowed" aradıysa slowed üstte
  }

  if (t.views && t.views > 0) {
    score += Math.min(20, Math.log10(t.views + 10) * 3);
  }

  if (t.durationSec != null) {
    if (t.durationSec >= 120 && t.durationSec <= 540) score += 10;
    else score -= 20; // shorts (<2dk) veya 9 dakikadan uzun loop'lar
  }

  // Kamera/görüntü kalitesi ipucu: başlıkta "4k"/"hq" olumlu sinyal
  if (/\b(hq|4k|official audio|official music video)\b/.test(title)) score += 8;

  return score;
}

// Neden: "Songs" filtresi editleri TAMamen çıkarır — skor düşürmek yetmez.
// DEMOTE_WORDS mantığı burada tekilleşir; SearchScreen kopyalamaz.
export function isOriginalTrack(t: Track): boolean {
  const title = norm(t.title);
  return !DEMOTE_WORDS.some((w) => title.includes(norm(w)));
}

// Sıralı sonuç döndürür; skor eşitliğinde görüntülenmeye göre karar ver.
// Neden: skor her karşılaştırmada yeniden hesaplanıyordu (20 sonuç ~80 karşılaştırma);
// bir kez hesaplanıp sıralanır.
export function rankTracks(tracks: Track[], query: string): Track[] {
  return tracks
    .map((t) => ({ t, s: scoreTrack(t, query) }))
    .sort((a, b) => b.s - a.s || (b.t.views ?? 0) - (a.t.views ?? 0))
    .map((x) => x.t);
}
