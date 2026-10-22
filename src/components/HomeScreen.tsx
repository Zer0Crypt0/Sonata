// Neden: Spotify "Start" ekranı (DESIGN.md §7, plan §2) — chip + son çalınanlar +
// öneri + radyo. Saf kabuk: veri HomeData prop'undan, eylemler callback'lerden.
// "Tekrar dene" iç yükleyiciyle gerçekten yeniden dener (App'in hook'u tek atımlık).
import React, { memo, useState } from 'react';
import { View, Text, ScrollView, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { HomeData } from '../home-data';
import { useHomeData } from '../home-data';
import type { Track } from '../types';
import ChipRow from './ChipRow';
import RecentGrid from './RecentGrid';
import TrackCarousel from './TrackCarousel';
import RadioCarousel from './RadioCarousel';
import { colors, radius, spacing } from '../theme';

export interface HomeScreenProps {
  data: HomeData;
  onPlay: (t: Track, ctx: Track[]) => void;
  onAdd: (t: Track) => void;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
}

const CHIPS = [
  { key: 'all', label: 'Tümü' },
  { key: 'music', label: 'Müzik' },
  { key: 'lists', label: 'Listeler' },
];

interface LoadedProps extends HomeScreenProps {
  onRetry: () => void;
}

// Neden: yükleniyor durumu statik skeleton (DESIGN.md §8) — dekoratif animasyon tabu.
function Skeleton() {
  return (
    <View style={styles.state} accessibilityLabel="Yükleniyor">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skelRow}>
          <View style={styles.skelThumb} />
          <View style={styles.skelLines}>
            <View style={styles.skelLine} />
            <View style={[styles.skelLine, styles.skelLineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <MaterialIcons name="error-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.errorText}>{message}</Text>
      <Pressable
        style={styles.cta}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Tekrar dene"
      >
        <Text style={styles.ctaText}>Tekrar dene</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <View style={styles.state}>
      <MaterialIcons name="music-note" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyText}>Henüz bir şey dinlemedin</Text>
      <Pressable
        style={styles.cta}
        onPress={onSearch}
        accessibilityRole="button"
        accessibilityLabel="Ara"
      >
        <Text style={styles.ctaText}>Ara</Text>
      </Pressable>
    </View>
  );
}

function HomeLoaded({ data, onPlay, onAdd, onOpenSearch, onOpenLibrary, onRetry }: LoadedProps) {
  const [chip, setChip] = useState('all');
  const empty =
    !data.loading &&
    data.error == null &&
    data.recent.length === 0 &&
    data.recommended.length === 0 &&
    data.radio.length === 0;
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ChipRow
          options={CHIPS}
          activeKey={chip}
          onChange={(key) => {
            // "Listeler" içerik filtresi değil — kütüphane sekmesine geçiştir.
            if (key === 'lists') {
              onOpenLibrary();
              return;
            }
            setChip(key);
          }}
        />
        {data.loading ? (
          <Skeleton />
        ) : data.error != null ? (
          <ErrorState message={data.error} onRetry={onRetry} />
        ) : empty ? (
          <EmptyState onSearch={onOpenSearch} />
        ) : (
          <View style={styles.sections}>
            <RecentGrid tracks={data.recent} onPlay={onPlay} />
            <TrackCarousel
              title="Şimdi Müzik Dinle"
              tracks={data.recommended}
              onPlay={onPlay}
              onAdd={onAdd}
            />
            {chip !== 'music' && (
              <RadioCarousel title="Popüler Radyo" stations={data.radio} onPlay={onPlay} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Neden: App'in useHomeData'sı mount'ta bir kez çalışır — hata sonrası "Tekrar dene"
// yeni bir hook örneğiyle gerçekten yeniden yükler (koşullu hook YOK, ayrı bileşen).
function HomeFresh({
  onPlay,
  onAdd,
  onOpenSearch,
  onOpenLibrary,
  onRetry,
}: Omit<LoadedProps, 'data'>) {
  const fresh = useHomeData();
  return (
    <HomeLoaded
      data={fresh}
      onPlay={onPlay}
      onAdd={onAdd}
      onOpenSearch={onOpenSearch}
      onOpenLibrary={onOpenLibrary}
      onRetry={onRetry}
    />
  );
}

function HomeScreenInner({ data, onPlay, onAdd, onOpenSearch, onOpenLibrary }: HomeScreenProps) {
  const [retrySeq, setRetrySeq] = useState(0);
  const retry = () => setRetrySeq((n) => n + 1);
  // Prop'tan gelen veri hatalıysa VE kullanıcı tekrar istediyse iç yükleyiciye geç.
  if (data.error != null && retrySeq > 0) {
    return (
      <HomeFresh
        key={retrySeq}
        onPlay={onPlay}
        onAdd={onAdd}
        onOpenSearch={onOpenSearch}
        onOpenLibrary={onOpenLibrary}
        onRetry={retry}
      />
    );
  }
  return (
    <HomeLoaded
      data={data}
      onPlay={onPlay}
      onAdd={onAdd}
      onOpenSearch={onOpenSearch}
      onOpenLibrary={onOpenLibrary}
      onRetry={retry}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    gap: spacing.sm,
    // Rezerve: mini oynatıcı (~68) + alt bar (~64) + nefes payı
    paddingBottom: 148,
  },
  sections: { gap: spacing.lg },
  state: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%' },
  skelThumb: { width: 56, height: 56, borderRadius: radius.thumb, backgroundColor: colors.bgElevated },
  skelLines: { flex: 1, gap: spacing.sm },
  skelLine: { height: 12, borderRadius: 4, backgroundColor: colors.bgElevated, width: '70%' },
  skelLineShort: { height: 10, width: '45%' },
  errorText: { color: colors.danger, textAlign: 'center' },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  ctaText: { color: colors.black, fontWeight: '700', fontSize: 15 },
});

export default memo(HomeScreenInner);
