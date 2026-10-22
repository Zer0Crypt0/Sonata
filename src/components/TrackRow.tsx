// Neden: 3 ekranda tekrarlanan satırın tek primitive'i (plan §3.2, DESIGN.md §6) —
// kapak + metin + trailing; liste ekranları bunu dizer, stil burada yaşar.
import React, { memo } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Track } from '../types';
import { colors, radius, spacing } from '../theme';

function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface TrackRowProps {
  track: Track;
  onPress: (t: Track) => void;
  onAdd?: (t: Track) => void;
  trailing?: 'duration' | 'more';
}

function TrackRowInner({ track, onPress, onAdd, trailing = 'duration' }: TrackRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(track)}
      accessibilityRole="button"
      accessibilityLabel={`${track.title}, ${track.channel}`}
    >
      {track.thumb ? (
        <Image source={{ uri: track.thumb }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbFallback}>
          <MaterialIcons name="music-note" size={24} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.channel}
        </Text>
      </View>
      {trailing === 'duration' ? (
        <Text style={styles.duration}>{fmtDuration(track.durationSec)}</Text>
      ) : (
        <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
      )}
      {onAdd != null && (
        <Pressable
          hitSlop={12}
          onPress={() => onAdd(track)}
          accessibilityLabel={`${track.title} listeye ekle`}
        >
          <MaterialIcons name="add" size={24} color={colors.textSecondary} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.card }, // satır hover (DESIGN.md §1)
  thumb: { width: 56, height: 56, borderRadius: radius.thumb },
  thumbFallback: {
    width: 56, height: 56, borderRadius: radius.thumb,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  artist: { color: colors.textSecondary, fontSize: 13, fontWeight: '400', marginTop: 2 },
  duration: { color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
});

// Neden: uzun listelerde her satırın gereksiz render'ı kaydırma takılması yapar (HANDOFF §7).
export default memo(TrackRowInner);
