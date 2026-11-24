// Neden: Tek bir oynatıcı instance'ı — parçalar arası geçişte eski oturum
// açık kalmasın diye replace() ile kaynak değişimi yapılır (expo-audio API'si).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { AudioSource } from './types';

let player: AudioPlayer | null = null;
let currentUri: string | null = null;
let audioModeReady = false;
// GEÇİCİ tanı: status geçiş takibi (aynı durumda tekrar tekrar log basmamak için)
let lastLoaded: boolean | null = null;
let lastBuffering: boolean | null = null;
let lastPlaying: boolean | null = null;

// Neden: Arka planda/ekran kapalıyken müzik devam etsin + sessiz anahtar
// sessiz modda müziği kapatmasın — müzik uygulamasının temel beklentisi.
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  console.log('[player] audioMode: başlıyor'); // GEÇİCİ tanı
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers', // arama/gelen çağrıda ses kısılır, kesilmez
    });
    audioModeReady = true;
    console.log('[player] audioMode: tamam'); // GEÇİCİ tanı
  } catch (e) {
    // Ses modu kurulamazsa oynatma yine çalışabilir; hata UI'a taşınır
    console.warn('[player] setAudioModeAsync başarısız:', e);
  }
}

export async function loadAndPlay(source: AudioSource): Promise<void> {
  console.log('[player] loadAndPlay:', source.uri.slice(0, 120)); // GEÇİCİ tanı
  await ensureAudioMode();
  if (!player) {
    player = createAudioPlayer({ uri: source.uri });
    currentUri = source.uri;
    console.log('[player] yeni player yaratıldı'); // GEÇİCİ tanı
    // GEÇİCİ tanı: durum geçişlerini ve native hataları Metro'ya yaz
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.error) {
        console.log('[player] status HATA:', s.error);
        return;
      }
      if (s.isLoaded !== lastLoaded || s.isBuffering !== lastBuffering || s.playing !== lastPlaying) {
        lastLoaded = s.isLoaded;
        lastBuffering = s.isBuffering;
        lastPlaying = s.playing;
        console.log('[player] status:', JSON.stringify({
          loaded: s.isLoaded, buffering: s.isBuffering, playing: s.playing,
          time: s.currentTime, dur: s.duration,
        }));
      }
    });
    player.play();
    return;
  }
  // replace(): mevcut oynatıcıyı yeniden kullan, kaynak değiştir (seek 0'a)
  player.replace({ uri: source.uri });
  currentUri = source.uri;
  console.log('[player] replace tamam'); // GEÇİCİ tanı
  player.play();
}

export function play(): void {
  try {
    player?.play();
  } catch (e) {
    console.warn('[player] play hatası:', e);
  }
}

export function pause(): void {
  try {
    player?.pause();
  } catch (e) {
    console.warn('[player] pause hatası:', e);
  }
}

// saniye cinsinden; expo-audio seekTo asenkron
export async function seekTo(seconds: number): Promise<void> {
  try {
    await player?.seekTo(seconds);
  } catch (e) {
    console.warn('[player] seek hatası:', e);
  }
}

export function getCurrentTime(): number {
  return player?.currentTime ?? 0;
}

export function getDuration(): number {
  return player?.duration ?? 0;
}

export function isPlaying(): boolean {
  return player?.playing ?? false;
}

export function getCurrentUri(): string | null {
  return currentUri;
}

// Neden: UI her 500ms'de bir ilerleme çubuğunu tazelemek ister; tek abonelik
// noktası burası (expo-audio status event'i).
export function subscribe(cb: () => void): () => void {
  const sub = player?.addListener('playbackStatusUpdate', cb);
  return () => sub?.remove();
}

// Şarkı bitince UI'ın sırayı ilerletmesi için
export function onFinished(cb: () => void): () => void {
  const sub = player?.addListener('playbackStatusUpdate', (s) => {
    if (s.didJustFinish) cb();
  });
  return () => sub?.remove();
}
