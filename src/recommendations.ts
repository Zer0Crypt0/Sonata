// Neden: Spotify "Sizin için" rafı — geçmişteki sanatçılardan yeni parçalar.
// Kanal başına failover zaten sources katmanında var; burada kanal atlanırsa
// sıradaki denenir, tek kanalın ölmesi rafı öldürmez.
import type { Track } from './types';
import { searchTracks } from './sources';
import { rankTracks } from './ranking';
import { getHistoryCache, loadHistory } from './history';

// Geçmişten en yeni N benzersiz kanal (oynanma sırasına göre).
function topChannels(count: number): string[] {
  const out: string[] = [];
  for (const e of getHistoryCache()) {
    const c = e.track.channel.trim();
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= count) break;
  }
  return out;
}

export async function getRecommendations(limit = 10): Promise<Track[]> {
  // Önbellek soğuk olabilir (uygulamanın ilk açılışı) — diske bir kez bak.
  if (getHistoryCache().length === 0) await loadHistory();
  const channels = topChannels(3);
  const seen = new Set(getHistoryCache().map((e) => e.track.id)); // geçmiştekiler elenir
  const out: Track[] = [];
  for (const channel of channels) {
    try {
      const ranked = rankTracks(await searchTracks(channel), channel);
      for (const t of ranked) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
        if (out.length >= limit) return out;
      }
    } catch (e) {
      console.warn(`[recommendations] kanal atlandı (${channel}):`, e);
    }
  }
  return out.slice(0, limit);
}

// Render sırasında senkron çağrılır — useHomeData önce loadHistory() ile ısıtır.
export function getRecentTracks(limit = 12): Track[] {
  return getHistoryCache()
    .slice(0, limit)
    .map((e) => e.track);
}
