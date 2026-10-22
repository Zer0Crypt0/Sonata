// Neden: "Son çalınanlar" + öneri/radyo istasyonları geçmişten beslenir —
// AsyncStorage kalıcı kılar, bellek önbelleği senkron okumaya köprü kurar
// (getRecentTracks render sırasında çağrılır, AsyncStorage ise asenkron).
// Kalıp playlist.ts ile aynı: KEY 'sonata.<ad>.v1', try/catch, yutma.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentEntry, Track } from './types';

const KEY = 'sonata.history.v1';
const MAX_ENTRIES = 50;

// Neden: senkron okuma için — loadHistory/recordPlay her yazışta tazeler.
let cache: RecentEntry[] | null = null;

// Bozuk kaydı ele: diske yarım yazılmış JSON uygulamayı devirmesin.
function validEntry(e: unknown): e is RecentEntry {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as { track?: unknown; playedAt?: unknown };
  const t = o.track as { id?: unknown; title?: unknown; channel?: unknown } | null;
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.channel === 'string' &&
    typeof o.playedAt === 'number'
  );
}

// Sıralı (playedAt desc) döner; disk boş/bozuksa [].
export async function loadHistory(): Promise<RecentEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      cache = [];
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('bozuk format');
    const entries = parsed.filter(validEntry).sort((a, b) => b.playedAt - a.playedAt);
    cache = entries;
    return entries;
  } catch (e) {
    console.warn('[history] okuma hatası, boş liste dönüldü:', e);
    cache = [];
    return [];
  }
}

// Senkron okuma — önbellek soğuksa [] döner; useHomeData önce loadHistory() çağırır.
export function getHistoryCache(): RecentEntry[] {
  return cache ?? [];
}

// Aynı ID varsa GÜNCELLE (eski kaydı sil, en üste yaz); son 50 kayıt saklanır.
export async function recordPlay(track: Track): Promise<void> {
  try {
    const prev = cache ?? (await loadHistory());
    const rest = prev.filter((e) => e.track.id !== track.id);
    const next = [{ track, playedAt: Date.now() }, ...rest].slice(0, MAX_ENTRIES);
    cache = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    // Yutma: geçmiş yazılamasa da müzik durmasın; log yeterli
    console.warn('[history] yazma hatası:', e);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
    cache = [];
  } catch (e) {
    console.warn('[history] temizleme hatası:', e);
  }
}
