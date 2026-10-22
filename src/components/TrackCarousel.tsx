// Neden: "Şimdi Müzik Dinle" yatay parça listesi (plan §2.3) — bölüm başlığı +
// snap'li yatay kaydırma; satırlar paylaşılan TrackRow (trailing ⋮).
import React, { memo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { Track } from '../types';
import TrackRow from './TrackRow';
import { colors, spacing } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  tracks: Track[];
  onPlay: (t: Track, ctx: Track[]) => void;
  onAdd?: (t: Track) => void;
}

const ITEM_WIDTH = 300;
const SNAP = ITEM_WIDTH + spacing.md; // 312 — liste gap'iyle aynı ritim

function TrackCarouselInner({ title, subtitle, tracks, onPlay, onAdd }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
      {tracks.length === 0 ? (
        <Text style={styles.empty}>Burada henüz parça yok.</Text>
      ) : (
        <FlatList
          horizontal
          data={tracks}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <TrackRow
                track={item}
                onPress={(t) => onPlay(t, tracks)}
                onAdd={onAdd}
                trailing="more"
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.sm },
  item: { width: ITEM_WIDTH },
});

export default memo(TrackCarouselInner);
