// Neden: Şimdi-çalıyor ekranı — Spotify now-playing düzeni: büyük kapak, seek çubuğu,
// beyaz oynat butonu. Kapak chevron-down ile küçülür; + listeye ekler.
// Pozisyon App.tsx'ten 500ms poll ile gelir.
import React, { useRef } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Track } from '../types';
import { colors, radius, spacing } from '../theme';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  track: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  resolving: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (ratio: number) => void; // 0..1 — dokunulan yerin oranı
  onClose: () => void; // chevron-down → mini bara dön
  onAdd: (track: Track) => void;
}

export default function PlayerScreen({
  track, playing, position, duration, resolving, onToggle, onPrev, onNext, onSeek, onClose, onAdd,
}: Props) {
  // Neden: Seek çubuğu genişliği onLayout'ta ref'e yazılır — locationX / genişlik = oran.
  const barWidthRef = useRef(0);

  if (track == null) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="music-note" size={72} color={colors.textTertiary} />
        <Text style={styles.muted}>Henüz bir şey çalmıyor</Text>
        <Text style={styles.muted}>Arama ekranından bir şarkı seç</Text>
      </View>
    );
  }

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Küçült">
          <MaterialIcons name="keyboard-arrow-down" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.topLabel}>ŞİMDİ ÇALIYOR</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.artWrap}>
        {track.thumb ? (
          <Image source={{ uri: track.thumb }} style={styles.art} />
        ) : (
          <View style={styles.artFallback}>
            <MaterialIcons name="music-note" size={64} color={colors.textTertiary} />
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
          <Text style={styles.channel} numberOfLines={1}>{track.channel}</Text>
        </View>
        <Pressable
          onPress={() => onAdd(track)}
          hitSlop={8}
          style={styles.addCircle}
          accessibilityLabel="Çalma listesine ekle"
        >
          <MaterialIcons name="add" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {resolving ? (
        <View style={styles.resolving}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>Ses akışı hazırlanıyor…</Text>
        </View>
      ) : null}

      {/* Dokunmatik ilerleme çubuğu — ek bağımlılık olmadan seek */}
      <Pressable
        style={styles.progressHit}
        onPress={(e) => {
          // Neden: Dokunulan X'in bara oranı = hedef seek yüzdesi.
          const w = barWidthRef.current;
          if (w <= 0) return;
          onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
        }}
        onLayout={(e) => {
          barWidthRef.current = e.nativeEvent.layout.width;
        }}
        accessibilityLabel="İlerleme"
      >
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.knob, { left: `${ratio * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.times}>
        <Text style={styles.time}>{fmt(position)}</Text>
        <Text style={styles.time}>{fmt(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onPrev} hitSlop={12} accessibilityLabel="Önceki">
          <MaterialIcons name="skip-previous" size={36} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onToggle}
          style={styles.playBtn}
          hitSlop={12}
          accessibilityLabel={playing ? 'Duraklat' : 'Oynat'}
        >
          {resolving ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <MaterialIcons
              name={playing ? 'pause' : 'play-arrow'}
              size={36}
              color={colors.black}
            />
          )}
        </Pressable>
        <Pressable onPress={onNext} hitSlop={12} accessibilityLabel="Sonraki">
          <MaterialIcons name="skip-next" size={36} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  muted: { color: colors.textSecondary, textAlign: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topLabel: {
    color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },
  topSpacer: { width: 30 },
  artWrap: {
    width: '100%', maxWidth: 420, aspectRatio: 1, alignSelf: 'center',
    marginTop: spacing.lg, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  art: { width: '100%', height: '100%' },
  artFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl,
  },
  metaText: { flex: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  channel: { color: colors.textSecondary, fontSize: 16, marginTop: spacing.xs },
  addCircle: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.textTertiary,
  },
  resolving: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.lg,
  },
  progressHit: { width: '100%', paddingVertical: 10, marginTop: spacing.lg },
  progressBg: {
    height: 4, borderRadius: 2, backgroundColor: colors.scrubTrack,
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.white },
  knob: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.white, marginLeft: -6, top: -4,
  },
  times: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2,
  },
  time: { color: colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 48, marginTop: spacing.xl,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
});
