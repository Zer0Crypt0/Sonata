// Neden: Çalma listesi cihazda kalıcı olsun — uygulama kapanınca kaybolmasın.
// AsyncStorage (Expo Go dahil) yeterli; ek native modül gerekmez.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from './types';

const KEY = 'sonata.playlist.v1';

export async function loadPlaylist(): Promise<Track[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('bozuk format');
    return parsed as Track[];
  } catch (e) {
    console.warn('[playlist] okuma hatası, boş liste dönüldü:', e);
    return [];
  }
}

export async function savePlaylist(tracks: Track[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(tracks));
  } catch (e) {
    // Yutma: UI zaten hata anında listeyi bellekte tutuyor; log yeterli
    console.warn('[playlist] yazma hatası:', e);
  }
}
