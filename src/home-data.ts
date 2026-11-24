// Neden: Ana ekran tek hook'tan beslenir — UI yarısı veri çekme mantığı görmez,
// sadece HomeData'yı çizer. 30 sn ağ zaman aşımı: takılan instance
// ekranı sonsuz yükleniyor durumunda bırakmasın.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RadioStation, Track } from './types';

// Neden: Öneri+radyo her açılışta ~9 arama demek — YouTube mobil IP'yi kısıyor
// (cihazda kanıtlı: aralıklı "Arama kaynağı yok"). Diskte 1 saatlik raf önbelleği:
// açılış anında eski raflar çizilir, tazeleme arka planda sessizce olur.
const HOME_CACHE_KEY = 'sonata.home.v1';
const HOME_CACHE_TTL = 60 * 60 * 1000; // 1 saat
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
    // Önce disk: varsa anında çiz, ekran boş beklemesin.
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (raw && alive) {
          const parsed = JSON.parse(raw);
          if (parsed && Date.now() - parsed.at < HOME_CACHE_TTL) {
            setRecent(parsed.recent ?? []);
            setRecommended(parsed.recommended ?? []);
            setRadio(parsed.radio ?? []);
            setLoading(false);
          }
        }
      } catch {
        // Önbellek okunamazsa ağa düş — sessiz geç
      }
    })();
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
        const freshRecent = getRecentTracks(12);
        setRecent(freshRecent);
        setRecommended(recs);
        setRadio(stations);
        setLoading(false);
        // Neden: sonraki açılış anında gelsin — yazma hatası ekranı etkilemez.
        try {
          await AsyncStorage.setItem(
            HOME_CACHE_KEY,
            JSON.stringify({ at: Date.now(), recent: freshRecent, recommended: recs, radio: stations }),
          );
        } catch {
          // yutma: önbellek yazılamazsa bir dahaki sefere ağdan gelir
        }
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
