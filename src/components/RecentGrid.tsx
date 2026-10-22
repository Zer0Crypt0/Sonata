// Neden: "Son çalınanlar" 2 sütun kart grid (DESIGN.md §6, plan §2.2) —
// kart = kare kapak + başlık; dış ScrollView kaydırdığı için iç liste sabittir.
import React, { memo } from 'react';
import { View, Text, Pressable, Image, FlatList, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Track } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  tracks: Track[];
  onPlay: (t: Track, ctx: Track[]) => void;
}

const MAX_CARDS = 8; // 2 sütun × 4 satır — Spotify yoğunluğu

function RecentGridInner({ tracks, onPlay }: Props) {
  const data = tracks.slice(0, MAX_CARDS);
  if (data.length === 0) return null;
  return (
    <FlatList
      data={data}
      numColumns={2}
      scrollEnabled={false} // dış ScrollView kaydırır; iç liste sabit
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => onPlay(item, data)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.channel}`}
        >
          {item.thumb ? (
            <Image source={{ uri: item.thumb }} style={styles.cover} />
          ) : (
            <View style={styles.coverFallback}>
              <MaterialIcons name="music-note" size={20} color={colors.textTertiary} />
            </View>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    overflow: 'hidden', // gölge yerine düz yüzey — koyu temada derinlik renkten gelir
    minHeight: 56,
    padding: spacing.xs,
  },
  cardPressed: { backgroundColor: colors.card },
  cover: { width: 48, height: 48, borderRadius: radius.thumb },
  coverFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.thumb,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', paddingRight: spacing.xs },
});

export default memo(RecentGridInner);
