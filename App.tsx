// Neden: Uygulamanın tek durum sahibi burası — ekranlar safdır.
// Akış: Arama → rankTracks (orijinaller üstte) → oynat → sıra/otomatik devam → liste kalıcılığı.
// UI: Spotify klonu kabuğu — Start ana ekran + mini now-playing çubuğu + 3 sekmeli alt bar; player tam ekran.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, StatusBar, Image, ActivityIndicator,
  Animated, Easing, Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import SearchScreen from './src/components/SearchScreen';
import PlayerScreen from './src/components/PlayerScreen';
import PlaylistScreen from './src/components/PlaylistScreen';
import { searchTracks, resolveAudio } from './src/sources';
import { rankTracks } from './src/ranking';
import { loadPlaylist, savePlaylist } from './src/playlist';
import { recordPlay } from './src/history';
import { useHomeData } from './src/home-data';
import HomeScreen from './src/components/HomeScreen';
import * as player from './src/player';
import { colors, radius, shadows, spacing } from './src/theme';
import type { Track } from './src/types';

type Tab = 'home' | 'search' | 'player' | 'list';

// Neden: RN SafeAreaView Android'de status bar inset'ini uygulamıyor (deprecated,
// Android'de no-op) — chipler saat/pil altında kalmasın diye manuel üst inset.
const TOP_INSET = StatusBar.currentHeight ?? 0;

// Neden: alt bar kayan nokta hangi sekmede — animasyon hedefi buradan hesaplanır.
const TAB_ORDER: Tab[] = ['home', 'search', 'list'];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  // Neden: Player tam ekran açılır/kapanır; kapanınca gelinen sekmeye dönülür.
  const prevTabRef = useRef<Tab>('home');

  // Arama durumu
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Çalma durumu
  const [queue, setQueue] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [resolving, setResolving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Liste
  const [playlist, setPlaylist] = useState<Track[]>([]);

  // Neden: Otomatik-sonraki (didJustFinish) callback'i render kapanışında
  // eski state görür — ref ile güncel sıra her zaman taze tutulur.
  const playRef = useRef<(t: Track, ctx: Track[]) => void>(() => {});
  const queueRef = useRef<{ queue: Track[]; current: Track | null }>({
    queue: [], current: null,
  });
  useEffect(() => {
    queueRef.current = { queue, current };
  }, [queue, current]);

  // --- Listeyi yükle (ilk açılış) ---
  useEffect(() => {
    loadPlaylist().then(setPlaylist).catch(() => {});
  }, []);

  // --- Ana ekran verisi (Spotify tarzı raflar: recent/recommended/radio) ---
  const home = useHomeData();

  // --- Sekme geçiş animasyonu (crossfade + slide; nokta spring ile kayar) ---
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const dotX = useRef(new Animated.Value(0)).current; // 0=home, 1=search, 2=list
  const tabW = Dimensions.get('window').width / 3;

  const switchTab = useCallback((next: Tab) => {
    if (next === tab) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(slide, { toValue: -12, duration: 120, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setTab(next);
      slide.setValue(12);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, {
          toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
    const idx = TAB_ORDER.indexOf(next);
    // left native driver'ı desteklemez — nokta JS thread'den sürülür.
    if (idx >= 0) {
      Animated.spring(dotX, {
        toValue: idx, useNativeDriver: false, friction: 8, tension: 50,
      }).start();
    }
  }, [tab, fade, slide, dotX]);

  // --- Oynatma çekirdeği ---
  const playTrack = useCallback(async (track: Track, context: Track[]) => {
    setCurrent(track);
    setQueue(context);
    setResolving(true);
    try {
      const src = await resolveAudio(track); // sağlayıcı zinciri içinde failover
      await player.loadAndPlay(src);
      setPlaying(true);
      await recordPlay(track); // başarılı oynatma → geçmişe yaz (öneri/radyo beslenir)
    } catch (e) {
      setPlaying(false);
      Alert.alert('Çalınamadı', String(e instanceof Error ? e.message : e));
    } finally {
      setResolving(false);
    }
  }, []);
  useEffect(() => {
    playRef.current = playTrack;
  }, [playTrack]);

  // --- Otomatik sıradaki (şarkı bittiğinde) ---
  useEffect(() => {
    const off = player.onFinished(() => {
      const { queue: q, current: c } = queueRef.current;
      if (!c) return;
      const idx = q.findIndex((t) => t.id === c.id);
      if (idx >= 0 && idx + 1 < q.length) {
        playRef.current(q[idx + 1], q);
      } else {
        setPlaying(false);
      }
    });
    return off; // tek abonelik; unmount'ta temizle
  }, []);

  // --- 500ms ilerleme poll'u (expo-audio status event'i yerine basit ve güvenilir) ---
  useEffect(() => {
    const timer = setInterval(() => {
      setPosition(player.getCurrentTime());
      setDuration(player.getDuration());
      setPlaying(player.isPlaying());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // --- Arama ---
  const handleSearch = useCallback(async (q: string) => {
    setSearching(true);
    setSearchError(null);
    try {
      const raw = await searchTracks(q);
      setResults(rankTracks(raw, q)); // orijinaller üstte — asıl istenen özellik
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, []);

  // --- Liste işlemleri (kalıcılık dahil) ---
  const addToPlaylist = useCallback((t: Track) => {
    setPlaylist((prev) => {
      if (prev.some((x) => x.id === t.id)) return prev; // çift ekleme yok
      const next = [...prev, t];
      savePlaylist(next);
      return next;
    });
  }, []);

  const removeFromPlaylist = useCallback((t: Track) => {
    setPlaylist((prev) => {
      const next = prev.filter((x) => x.id !== t.id);
      savePlaylist(next);
      return next;
    });
  }, []);

  // --- Kontroller ---
  const toggle = useCallback(() => {
    if (player.isPlaying()) player.pause();
    else player.play();
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    if (!current) return;
    const idx = queue.findIndex((t) => t.id === current.id);
    const next = idx + dir;
    if (idx >= 0 && next >= 0 && next < queue.length) playTrack(queue[next], queue);
  }, [current, queue, playTrack]);

  const seek = useCallback((ratio: number) => {
    const d = player.getDuration();
    if (d > 0) player.seekTo(ratio * d);
  }, []);

  const openPlayer = useCallback(() => {
    setTab((cur) => {
      if (cur !== 'player') prevTabRef.current = cur;
      return 'player';
    });
  }, []);
  const closePlayer = useCallback(() => setTab(prevTabRef.current), []);

  const miniRatio = duration > 0 ? Math.min(1, position / duration) : 0;

  // --- Tam ekran now-playing (Spotify: bara dokununca açılır) ---
  if (tab === 'player') {
    return (
      <View style={[styles.root, { paddingTop: TOP_INSET }]}>
        <StatusBar barStyle="light-content" />
        <PlayerScreen
          track={current}
          playing={playing}
          position={position}
          duration={duration}
          resolving={resolving}
          onToggle={toggle}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onSeek={seek}
          onClose={closePlayer}
          onAdd={addToPlaylist}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: TOP_INSET }]}>
      {/* backgroundColor RN 0.88+ edge-to-edge'de kaldırıldı — sadece barStyle */}
      <StatusBar barStyle="light-content" />

      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {tab === 'home' && (
          <HomeScreen
            data={home}
            onPlay={(t, ctx) => { playTrack(t, ctx); openPlayer(); }}
            onAdd={addToPlaylist}
            onOpenSearch={() => switchTab('search')}
            onOpenLibrary={() => switchTab('list')}
          />
        )}
        {tab === 'search' && (
          <SearchScreen
            results={results}
            loading={searching}
            error={searchError}
            onSearch={handleSearch}
            onPlay={(t, ctx) => { playTrack(t, ctx); }}
            onAdd={addToPlaylist}
          />
        )}
        {tab === 'list' && (
          <PlaylistScreen
            tracks={playlist}
            onPlay={(t, ctx) => { playTrack(t, ctx); openPlayer(); }}
            onRemove={removeFromPlaylist}
          />
        )}
      </Animated.View>

      {/* Mini şimdi-çalıyor çubuğu (Spotify now-playing bar) */}
      {current != null && (
        <Pressable
          style={styles.mini}
          onPress={openPlayer}
          accessibilityRole="button"
          accessibilityLabel={`Şimdi çalıyor: ${current.title}. Tam ekranı aç`}
        >
          <View style={styles.miniProgressTrack} pointerEvents="none">
            <View style={[styles.miniProgressFill, { width: `${miniRatio * 100}%` }]} />
          </View>
          <View style={styles.miniRow}>
            {current.thumb ? (
              <Image source={{ uri: current.thumb }} style={styles.miniArt} />
            ) : (
              <View style={styles.miniArtFallback} />
            )}
            <View style={styles.miniText}>
              <Text style={styles.miniTitle} numberOfLines={1}>{current.title}</Text>
              <Text style={styles.miniSub} numberOfLines={1}>{current.channel}</Text>
            </View>
            <MaterialIcons
              name="devices"
              size={20}
              color={colors.textSecondary}
              accessibilityLabel="Cihaz: bu telefon"
            />
            <MaterialIcons
              name="check-circle"
              size={20}
              color={colors.accent}
              accessibilityLabel="Bağlı"
            />
            <Pressable
              onPress={toggle}
              hitSlop={12}
              style={styles.miniPlay}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Duraklat' : 'Oynat'}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <MaterialIcons
                  name={playing ? 'pause' : 'play-arrow'}
                  size={24}
                  color={colors.black}
                />
              )}
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Alt gezinme (Spotify: Start + Ara + Kitaplık; Çalan bara dokunarak açılır) */}
      <View style={styles.tabs}>
        {([
          ['home', 'Start', 'home'],
          ['search', 'Ara', 'search'],
          ['list', 'Kitaplık', 'library-music'],
        ] as const).map(([key, label, icon]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              style={styles.tab}
              onPress={() => switchTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <MaterialIcons
                name={icon}
                size={24}
                color={active ? colors.text : colors.textSecondary}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        {/* Tek kayan gösterge — spring ile aktif sekmeye kayar */}
        <Animated.View
          style={[
            styles.tabDot,
            {
              left: dotX.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [tabW / 2 - 2, tabW * 1.5 - 2, tabW * 2.5 - 2],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  mini: { backgroundColor: colors.miniBar, ...shadows.mini },
  miniProgressTrack: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: colors.overlay,
  },
  miniProgressFill: { height: 2, backgroundColor: colors.accent },
  miniRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  miniArt: {
    width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  miniArtFallback: {
    width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  miniText: { flex: 1 },
  miniTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  miniSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  miniPlay: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.navBg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: 6, minHeight: 56, // BottomNav (DESIGN.md §6)
  },
  tabText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  tabDot: {
    position: 'absolute', bottom: 4, // left interpolasyonla inline verilir
    width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent,
  },
});
