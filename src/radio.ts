// Neden: Spotify "Radyo" kartları — geçmişteki her sanatçı bir istasyon,
// istasyonun parçaları o sanatçının aramasından (orijinaller üstte) gelir.
import type { RadioStation } from './types';
import { searchTracks } from './sources';
import { rankTracks } from './ranking';
import { getHistoryCache, loadHistory } from './history';

// İstasyon kimliği: 'radio-' + kanalın ilk 3 harfi (küçük, ASCII).
// Çakışmada sıra eki ('radio-lor' doluysa 'radio-lor-2') — anahtar çakışması yok.
function stationId(channel: string, taken: Set<string>): string {
  const slug = channel
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '');
  const base = `radio-${slug.slice(0, 3) || 'mix'}`;
  let id = base;
  let i = 2;
  while (taken.has(id)) id = `${base}-${i++}`;
  taken.add(id);
  return id;
}

export async function getRadioStations(limit = 6): Promise<RadioStation[]> {
  // Önbellek soğuk olabilir (uygulamanın ilk açılışı) — diske bir kez bak.
  if (getHistoryCache().length === 0) await loadHistory();
  // Benzersiz kanallar, en yeniden eskiye.
  const channels: string[] = [];
  for (const e of getHistoryCache()) {
    const c = e.track.channel.trim();
    if (c && !channels.includes(c)) channels.push(c);
    if (channels.length >= limit) break;
  }
  const taken = new Set<string>();
  const stations: RadioStation[] = [];
  for (const channel of channels) {
    try {
      const tracks = rankTracks(await searchTracks(channel), channel);
      if (tracks.length === 0) continue;
      const seed = tracks[0];
      stations.push({
        id: stationId(channel, taken),
        title: channel,
        seedTrackId: seed.id,
        thumb: seed.thumb,
        tracks,
      });
    } catch (e) {
      console.warn(`[radio] istasyon atlandı (${channel}):`, e);
    }
  }
  return stations;
}
