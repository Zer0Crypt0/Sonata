// Neden: Kitaplık ekranı — Spotify library düzeni: "Kitaplığın" başlığı, satıra dokunma
// listeyi context'al oynatır, ⋮ kaldırır (onay diyaloğu ile).
import React from 'react';
import { View, Text, FlatList, Pressable, Image, StyleSheet, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Track } from '../types';
import { colors, radius, spacing } from '../theme';

function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  tracks: Track[];
  onPlay: (track: Track, context: Track[]) => void;
  onRemove: (track: Track) => void;
}

export default function PlaylistScreen({ tracks, onPlay, onRemove }: Props) {
  const confirmRemove = (t: Track) => {
    Alert.alert('Listeden kaldırılsın mı?', t.title, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Kaldır', style: 'destructive', onPress: () => onRemove(t) },
    ]);
  };

  if (tracks.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="library-music" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>Şu anda boş</Text>
        <Text style={styles.muted}>Arama sonuçlarındaki + ile şarkı ekle</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      ListHeaderComponent={<Text style={styles.header}>Kitaplığın</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => onPlay(item, tracks)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.channel}`}
        >
          {item.thumb ? (
            <Image source={{ uri: item.thumb }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={styles.rowText}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.channel} numberOfLines={1}>{item.channel}</Text>
          </View>
          <Text style={styles.duration}>{fmtDuration(item.durationSec)}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => confirmRemove(item)}
            accessibilityLabel={`Listeden kaldır: ${item.title}`}
          >
            <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.textSecondary, textAlign: 'center' },
  header: {
    color: colors.text, fontSize: 26, fontWeight: '700',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.rowPressed },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface },
  rowText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  channel: { color: colors.textSecondary, fontSize: 14, marginTop: 3 },
  duration: {
    color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'],
  },
});
