// Neden: "Popüler Radyo" yatay kartları (plan §2.4, DESIGN.md §6) — RADIO rozetli
// kapak + başlık; karta dokununca istasyonun ilk parçası tüm listeyle çalar.
import React, { memo } from 'react';
import { View, Text, Pressable, Image, FlatList, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { RadioStation, Track } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  stations: RadioStation[];
  onPlay: (t: Track, ctx: Track[]) => void;
}

const CARD_W = 160;

function RadioCarouselInner({ title, stations, onPlay }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {stations.length === 0 ? (
        <Text style={styles.empty}>Burada henüz istasyon yok.</Text>
      ) : (
        <FlatList
          horizontal
          data={stations}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item: st }) => {
            const seed = st.tracks[0];
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => {
                  if (seed) onPlay(seed, st.tracks);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${st.title} radyosu`}
              >
                <View style={styles.cover}>
                  {st.thumb ? (
                    <Image source={{ uri: st.thumb }} style={styles.coverImg} />
                  ) : (
                    <View style={styles.coverFallback}>
                      <MaterialIcons name="radio" size={40} color={colors.textTertiary} />
                    </View>
                  )}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>RADIO</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {st.title}
                </Text>
              </Pressable>
            );
          }}
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
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.sm },
  card: { width: CARD_W },
  cardPressed: { opacity: 0.7 }, // kapakta yüzey yok — baskı opaklıkla belli olur
  cover: {
    width: CARD_W,
    aspectRatio: 1,
    borderRadius: radius.card,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: { position: 'absolute', width: '100%', height: '100%' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
});

export default memo(RadioCarouselInner);
