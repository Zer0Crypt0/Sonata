// Neden: Spotify klonunun tek renk/ölçü kaynağı — ekranlar hardcoded hex yazmaz.
// Palet DESIGN.md §1 (Spotify): miniBar/navBg/danger tutarlılık düzeltmesi DESIGN notu.
// Eski anahtarlar (green, searchPill, rowPressed, scrubTrack, overlay, radius.sm/md)
// geriye uyumluluk için korunur — SearchScreen/PlayerScreen/PlaylistScreen kullanır.
export const colors = {
  // Yüzeyler (Spotify dark)
  bg: '#121212',
  bgElevated: '#181818',
  surface: '#1f1f1f', // chip pasif, buton
  card: '#282828', // satır hover / fallback kapak
  searchPill: '#2a2a2a',
  rowPressed: '#232323',
  navBg: '#121212',
  border: '#282828',
  miniBar: '#181818',

  // Marka — kullanılacak tek yeşil accent; green geriye uyumluluk için durur
  accent: '#1ed760',
  accentDim: 'rgba(30,215,96,0.14)',
  green: '#1DB954',
  greenBright: '#1ed760',

  // Metin
  text: '#FFFFFF',
  textSecondary: '#b3b3b3',
  textTertiary: '#727272',

  // Kontroller
  white: '#FFFFFF',
  black: '#000000',
  scrubTrack: '#4d4d4d',
  danger: '#f3727f',
  overlay: 'rgba(255,255,255,0.14)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radius = {
  sm: 4, // geriye uyumluluk (eski ekranlar)
  md: 8, // geriye uyumluluk (eski ekranlar)
  pill: 999, // geriye uyumluluk (eski ekranlar)
  chip: 999,
  card: 8,
  thumb: 6,
  button: 999,
} as const;

// Neden: koyu temada gölge ağır olur — DESIGN.md §5.
// iOS shadow* + Android elevation bir arada (tek tarafta kaybolmasın).
// Not: as const YOK — readonly alanlar StyleSheet tipine atanmaz.
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mini: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
};
