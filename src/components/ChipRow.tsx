// Neden: ana ekranın üst filtresi (Spotify: All/Musik/Listen) — yatay pill satırı,
// aktif chip yeşil; seçim HomeScreen'de tutulur, burası saf çizer (DESIGN.md §6).
import React, { memo } from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface ChipOption {
  key: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

function ChipRowInner({ options, activeKey, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {options.map((opt) => {
        const active = opt.key === activeKey;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44, // dokunma hedefi (a11y)
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent },
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
  labelActive: { color: colors.black, fontWeight: '700' },
});

export default memo(ChipRowInner);
