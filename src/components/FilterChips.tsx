// Neden: Arama filtre chip'leri saf UI'dır — seçim durumu SearchScreen'de tutulur.
// Spotify: yatay kaydırmalı pill satırı; aktif chip yeşil zemin + siyah metin.
import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  chips: string[];
  activeChip: string | null;
  onChange: (chip: string | null) => void;
}

export default function FilterChips({ chips, activeChip, onChange }: Props) {
  // Neden: yatay ScrollView esnek ebeveynde dikey büyüyüp chip'leri sütun
  // gibi gösterebiliyor — dış View sabit yükseklikle çerçveler, ScrollView
  // büyüyemez (flexGrow: 0), chip'ler içerikte dikey ortalanır.
  return (
    <View style={{ height: 52 }}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const active = activeChip === chip;
        return (
          <Pressable
            key={chip}
            // Neden: aktif chip'e tekrar dokununca filtre kalkar (toggle) —
            // "Songs"tan çıkışın tek yolu bu (diğer chip'ler gizli).
            onPress={() => onChange(active ? null : chip)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filtre: ${chip}`}
          >
            <Text style={[styles.text, active && styles.textActive]}>{chip}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 8, alignItems: 'center', paddingVertical: 4 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44, // erişilebilir dokunma hedefi (DESIGN.md §10)
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent },
  text: { color: colors.text, fontSize: 14, fontWeight: '600' },
  textActive: { color: '#000000', fontWeight: '700' },
});
