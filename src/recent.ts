// Neden: Sorgu boşken Spotify gibi son aramaları göster — kullanıcı tekrar yazmasın.
// AsyncStorage (playlist.ts ile aynı pattern); ek bağımlılık yok.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from './types';

const KEY = 'sonata.recentSearches.v1';
const MAX = 10; // Spotify "Son" listesi: son 10 arama

export interface RecentSearchItem {
  query: string;
  firstResult?: Track; // satıra dokununca anında çalınır + kapak/sanatçı gösterilir
  searchedAt: number; // Date.now() — epoch ms
}

export async function loadRecentSearches(): Promise<RecentSearchItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('bozuk format');
    // searchedAt desc — en yeni en üstte
    return (parsed as RecentSearchItem[])
      .sort((a, b) => b.searchedAt - a.searchedAt)
      .slice(0, MAX);
  } catch (e) {
    console.warn('[recent] okuma hatası, boş liste dönüldü:', e);
    return [];
  }
}

export async function saveRecentSearch(query: string, firstResult?: Track): Promise<void> {
  try {
    const q = query.trim();
    if (q.length === 0) return; // boş sorgu geçmişe yazılmaz
    const prev = await loadRecentSearches();
    // Aynı sorgu varsa güncelle + en üste taşı (çift kayıt yok)
    const rest = prev.filter((r) => r.query.toLocaleLowerCase('tr') !== q.toLocaleLowerCase('tr'));
    const next: RecentSearchItem[] = [{ query: q, firstResult, searchedAt: Date.now() }, ...rest].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[recent] yazma hatası:', e);
  }
}

export async function removeRecentSearch(query: string): Promise<void> {
  try {
    const prev = await loadRecentSearches();
    const next = prev.filter((r) => r.query !== query);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[recent] silme hatası:', e);
  }
}
