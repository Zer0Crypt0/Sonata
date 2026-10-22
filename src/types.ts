// Neden: Tüm katmanlar arasında tek ve sabit veri sözleşmesi olsun —
// kaynak sağlayıcıları (Invidious/Piped) farklı JSON döndürür, burada eşitlenir.
export interface Track {
  id: string; // YouTube videoId
  title: string;
  channel: string;
  channelId?: string;
  thumb?: string;
  durationSec?: number;
  views?: number;
}

export interface AudioSource {
  uri: string;
  mime?: string; // mp4 (aac) tercih edilir: her cihazda oynar; opus Android'de sorunsuz
  bitrate?: number;
}

// Neden: Ana ekranın "Son çalınanlar" rafı — ne, ne zaman çalındı.
export interface RecentEntry {
  track: Track;
  playedAt: number; // Date.now() — epoch ms
}

// Neden: Arama Albümler/Listeler sekmeleri — Invidious playlist/channel
// sonuçlarının kart karşılığı (Track değil: çalınabilir tek parça yok).
export interface PlaylistCard {
  id: string; // playlistId
  title: string;
  thumb?: string;
  itemCount?: number;
  author: string;
  authorId?: string;
}

// Neden: Arama Profiller sekmesi — kanal sonuçları (sanatçı veya dinleyici).
export interface ProfileCard {
  id: string; // channelId (authorId)
  name: string;
  avatar?: string;
  subscriberCount?: number;
  isArtist: boolean; // adı aranan sanatçıyla eşleşiyor mu
}

// Neden: Ana ekranın "Radyo" kartları — her sanatçı bir istasyon.
export interface RadioStation {
  id: string; // 'radio-' + kanalın ilk 3 harfi (+ çakışmada sıra eki)
  title: string; // kanal/sanatçı adı
  seedTrackId?: string;
  thumb?: string;
  tracks: Track[];
}
