// Neden: Ana ekran tek hook'tan beslenir — UI yarısı veri çekme mantığı görmez,
// sadece HomeData'yı çizer. 30 sn ağ zaman aşımı: takılan instance
// ekranı sonsuz yükleniyor durumunda bırakmasın.
import { useEffect, useState } from 'react';
import type { RadioStation, Track } from './types';
import { loadHistory } from './history';
import { getRecommendations, getRecentTracks } from './recommendations';
import { getRadioStations } from './radio';

export interface HomeData {
  recent: Track[];
  recommended: Track[];
  radio: RadioStation[];
  loading: boolean;
  error: string | null;
}

const LOAD_TIMEOUT_MS = 30000;

export function useHomeData(): HomeData {
  const [recent, setRecent] = useState<Track[]>([]);
  const [recommended, setRecommended] = useState<Track[]>([]);
  const [radio, setRadio] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Zaman aşımı: ağ takılırsa ekran sonsuz sporda kalmasın.
    const timer = setTimeout(() => {
      if (alive) {
        setError('Öneriler alınamadı');
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);
    (async () => {
      try {
        await loadHistory(); // senkron getRecentTracks için önbelleği ısıt
        const [recs, stations] = await Promise.all([
          getRecommendations(10),
          getRadioStations(6),
        ]);
        if (!alive) return;
        clearTimeout(timer);
        setRecent(getRecentTracks(12));
        setRecommended(recs);
        setRadio(stations);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        clearTimeout(timer);
        console.warn('[home-data] yükleme hatası:', e);
        setError('Öneriler alınamadı');
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return { recent, recommended, radio, loading, error };
}
