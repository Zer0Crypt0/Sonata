// Neden: Bellek-içi arama önbelleği uygulama kapanınca kayboluyordu — aynı sorgu
// (özellikle "Son aramalar"dan seçilen) her açılışta ~1 sn yeniden bekletmesin.
// Diskte tutulan tek şey Track listesi (~4 KB/sorgu); sır/token yok.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from './types';

const STORAGE_KEY = 'sonata.searchCache.v1';
const TTL = 6 * 60 * 60 * 1000; // 6 saat — arama sonuçları saatler içinde kayda değer değişmiyor
const MAX_ENTRIES = 40; // LRU: en yeni 40 sorgu (≈160 KB)

type Entry = { at: number; tracks: Track[] };
type Store = Record<string, Entry>;

let store: Store | null = null;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Neden: tek uçuş — ilk arama diskten yüklemeyi beklerken ikinci kez okuma yapmasın.
async function load(): Promise<void> {
  if (store) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Store) : {};
      store = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // Bozuk/okunamayan önbellek uygulamayı engellemez — boş kabul et.
      store = {};
    }
  })();
  return loading;
}

function prune(current: Store): Store {
  const entries = Object.entries(current)
    .filter(([, e]) => e && Array.isArray(e.tracks))
    .sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0))
    .slice(0, MAX_ENTRIES);
  return Object.fromEntries(entries);
}

// Neden: geçersiz (TTL dışı) kayıt diskte kalmasın diye okurken de süzülür.
export async function get(key: string): Promise<Track[] | null> {
  await load();
  const entry = store?.[key];
  if (!entry || !Array.isArray(entry.tracks)) return null;
  if (Date.now() - (entry.at ?? 0) > TTL) return null;
  return entry.tracks;
}

// Neden: yazma 1 sn geciktirilir — hızlı yazarken her tuşta diske yazıp
// JS thread'ini meşgul etmesin; sadece son hâl diske gider.
export function put(key: string, tracks: Track[]): void {
  if (!store) return; // disk henüz yüklenmediyse sadece bellek-içi önbellekle devam et
  store = prune({ ...store, [key]: { at: Date.now(), tracks } });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = store;
    if (!snapshot) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {
      // yazma hatası aramayı etkilemez — bir sonraki sefer ağdan gelir
    });
  }, 1000);
}
