// Neden: Arama ekranı saf UI'dır — veri/ısrar (retry) App.tsx'ten gelir,
// sıralama motoru results zaten App tarafından rankTracks ile uygulanmış olur.
// UI: Spotify arama — sorgu boşken "Son" listesi; sorgu varken filtre chip'leri
// (Songs/Artists/Albums/Playlists/Profiles) + sanatçı kartı + "Mit" bölümü + şarkılar.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Image, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Track, PlaylistCard, ProfileCard } from '../types';
import { colors, radius, spacing } from '../theme';
import { isOriginalTrack } from '../ranking';
import { searchPlaylists, searchChannels, getChannelPlaylists } from '../sources';
import { loadRecentSearches, saveRecentSearch, removeRecentSearch, type RecentSearchItem } from '../recent';
import FilterChips from './FilterChips';

function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtViews(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// Neden: "sanatçının şarkıları" kapsamı için kaba kanal eşleşmesi —
// Türkçe küçük harf + trim; ranking.ts norm'unun hafif sürümü (kopya değil, eşik).
function channelMatches(t: Track, artist: string): boolean {
  const a = artist.toLocaleLowerCase('tr').trim();
  if (!a) return false;
  return (
    t.channel.toLocaleLowerCase('tr').includes(a) ||
    t.title.toLocaleLowerCase('tr').includes(a)
  );
}

// Neden: "Mit [sanatçı]" ve Songs kapsamı — sonuçlarda en sık geçen kanal,
// orijinal sorgunun sanatçısı sayılır (rankTracks zaten onu üste taşır).
function dominantChannel(tracks: Track[]): string | null {
  if (tracks.length === 0) return null;
  const counts = new Map<string, { n: number; name: string }>();
  for (const t of tracks) {
    const key = t.channel.toLocaleLowerCase('tr').trim();
    const cur = counts.get(key);
    counts.set(key, { n: (cur?.n ?? 0) + 1, name: t.channel });
  }
  let best: { n: number; name: string } | null = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) best = v;
  }
  return best?.name ?? null;
}

const ALL_CHIPS = ['Songs', 'Artists', 'Albums', 'Playlists', 'Profiles'];

interface Props {
  results: Track[];
  loading: boolean;
  error: string | null;
  onSearch: (q: string) => void;
  onPlay: (track: Track, context: Track[]) => void;
  onAdd: (track: Track) => void;
}

export default function SearchScreen({ results, loading, error, onSearch, onPlay, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSearchItem[]>([]);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Neden: saveRecentSearch BAŞARILI aramada ilk sonuçla yazılır — App'ten
  // dönüt gelmez, o yüzden gönderilen sorgu ref'te tutulur; results değişince eşleşir.
  const pendingSaveRef = useRef<string | null>(null);

  // Neden: pendingSave önce tanımlanır — debounce effect'i onu kapatır.
  const runSearch = useCallback((q: string) => {
    pendingSaveRef.current = q;
    onSearch(q);
  }, [onSearch]);

  // Neden: Spotify gibi yazarken de ara — 200ms debounce (önbellek var, erken ateşle); submit bekleyen zamanlayıcıyı
  // iptal ederek aynı sorgunun iki kez gitmesini engeller.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => runSearch(q), 200); // cache + 3sn yarışla birleşince his belirgin hızlanır
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query, runSearch]);

  // Son aramaları ilk açılışta yükle
  useEffect(() => {
    loadRecentSearches().then(setRecent).catch(() => {});
  }, []);

  // Başarılı arama (sonuç geldi) → geçmişe yaz + listeyi tazele
  useEffect(() => {
    const q = pendingSaveRef.current;
    if (q != null && results.length > 0) {
      pendingSaveRef.current = null;
      saveRecentSearch(q, results[0])
        .then(loadRecentSearches)
        .then(setRecent)
        .catch(() => {});
    }
  }, [results]);

  const submit = () => {
    const q = query.trim();
    if (q.length === 0) return; // boş arama ağ trafiği boşa harcamasın
    if (debRef.current) clearTimeout(debRef.current);
    runSearch(q);
  };

  const clearQuery = () => {
    setQuery('');
    setActiveChip(null); // sorgu temizlenince chip'ler sıfırlanır
  };

  // Son satırına dokun: geçmişi üste taşı + aramayı yeniden çalıştır + sonucu çal
  const replayRecent = (item: RecentSearchItem) => {
    setQuery(item.query);
    runSearch(item.query);
    if (item.firstResult) onPlay(item.firstResult, [item.firstResult]);
  };

  const dropRecent = (q: string) => {
    removeRecentSearch(q)
      .then(loadRecentSearches)
      .then(setRecent)
      .catch(() => {});
  };

  const hasQuery = query.trim().length > 0;
  // Neden: Songs sadece listeyi orijinal filtresine sokar — chip satırı hep tamdır.

  const artist = dominantChannel(results);
  // Songs kapsamı: sanatçı tespit edildiyse onun parçaları, yoksa tüm sonuçlar —
  // ardından editler TAMamen çıkarılır (isOriginalTrack).
  const artistScoped = artist ? results.filter((t) => channelMatches(t, artist)) : results;
  const songsOnly = (artistScoped.length > 0 ? artistScoped : results).filter(isOriginalTrack);
  // Artists görünümü: benzersiz kanallar, ilk görünen kapakla
  const artists = React.useMemo(() => {
    const seen = new Map<string, Track>();
    for (const t of results) {
      const key = t.channel.toLocaleLowerCase('tr').trim();
      if (!seen.has(key)) seen.set(key, t);
    }
    return [...seen.values()];
  }, [results]);
  const mixTracks = artist ? results.filter((t) => channelMatches(t, artist)).slice(0, 10) : [];
  // Neden: Albums sekmesi kanal playlist'lerini çeker — dominant sanatçının
  // ilk eşleşen parçasındaki channelId kullanılır (Invidious authorId).
  const artistChannelId = artist
    ? results.find((t) => channelMatches(t, artist))?.channelId ?? null
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <MaterialIcons name="search" size={22} color={colors.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Ne dinlemek istiyorsun?"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Arama"
        />
        {query.length > 0 && (
          <Pressable
            onPress={clearQuery}
            hitSlop={8}
            accessibilityLabel="Aramayı temizle"
          >
            <MaterialIcons name="close" size={18} color={colors.text} />
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} size="large" />
          <Text style={styles.muted}>Kaynaklar taranıyor…</Text>
        </View>
      )}

      {error != null && !loading && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={submit}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </Pressable>
        </View>
      )}

      {!loading && error == null && !hasQuery && (
        <FlatList
          data={recent}
          keyExtractor={(item) => item.query}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Son</Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>
                {'"Lorn" gibi bir sanatçı yaz —\norijinal yüklemeler üstte sıralanır.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => replayRecent(item)}
              accessibilityRole="button"
              accessibilityLabel={`Tekrar ara: ${item.query}`}
            >
              {item.firstResult?.thumb ? (
                <Image source={{ uri: item.firstResult.thumb }} style={styles.thumb} />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.firstResult?.title ?? item.query}
                </Text>
                <Text style={styles.channel} numberOfLines={1}>
                  {item.firstResult?.channel ?? 'Arama'}
                </Text>
              </View>
              {item.firstResult ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => onAdd(item.firstResult!)}
                  accessibilityLabel={`${item.firstResult.title} listeye ekle`}
                >
                  <MaterialIcons name="add" size={24} color={colors.textSecondary} />
                </Pressable>
              ) : null}
              <Pressable
                hitSlop={8}
                onPress={() => dropRecent(item.query)}
                accessibilityLabel={`${item.query} geçmişten kaldır`}
              >
                <MaterialIcons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {!loading && error == null && hasQuery && (
        <View style={styles.resultsWrap}>
          <FilterChips chips={ALL_CHIPS} activeChip={activeChip} onChange={setActiveChip} />

          {activeChip === 'Songs' && (
            <FlatList
              data={songsOnly}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.muted}>Orijinal şarkı bulunamadı — editler gizlendi.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TrackRow item={item} context={songsOnly} onPlay={onPlay} onAdd={onAdd} />
              )}
            />
          )}

          {activeChip === 'Artists' && (
            <FlatList
              data={artists}
              keyExtractor={(item) => `artist-${item.channel}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.muted}>Sanatçı bulunamadı.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => onPlay(item, results)}
                  accessibilityRole="button"
                  accessibilityLabel={`Sanatçı: ${item.channel}`}
                >
                  {item.thumb ? (
                    <Image source={{ uri: item.thumb }} style={styles.artistArt} />
                  ) : (
                    <View style={styles.artistArt} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.title} numberOfLines={1}>{item.channel}</Text>
                    <Text style={styles.badge}>Sanatçı</Text>
                  </View>
                </Pressable>
              )}
            />
          )}

          {activeChip === 'Albums' && (
            <AlbumsSection artist={artist} channelId={artistChannelId} />
          )}

          {activeChip === 'Playlists' && (
            <PlaylistsSection query={query.trim()} artist={artist} />
          )}

          {activeChip === 'Profiles' && (
            <ProfilesSection query={query.trim()} />
          )}

          {activeChip == null && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              ListHeaderComponent={
                <View>
                  {artist != null && results.length > 0 && (
                    <Pressable
                      style={styles.artistCard}
                      onPress={() => onPlay(results[0], results)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sanatçı: ${artist}`}
                    >
                      {results[0].thumb ? (
                        <Image source={{ uri: results[0].thumb }} style={styles.artistArt} />
                      ) : (
                        <View style={styles.artistArt} />
                      )}
                      <View style={styles.rowText}>
                        <Text style={styles.title} numberOfLines={1}>{artist}</Text>
                        <Text style={styles.badge}>Sanatçı</Text>
                      </View>
                    </Pressable>
                  )}
                  {artist != null && mixTracks.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>Mit {artist}</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.mixRow}
                      >
                        {mixTracks.map((t) => (
                          <Pressable
                            key={`mix-${t.id}`}
                            style={styles.mixCard}
                            onPress={() => onPlay(t, mixTracks)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t.title}, ${t.channel}`}
                          >
                            {t.thumb ? (
                              <Image source={{ uri: t.thumb }} style={styles.mixArt} />
                            ) : (
                              <View style={styles.mixArt} />
                            )}
                            <Text style={styles.mixTitle} numberOfLines={2}>{t.title}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              }
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.muted}>Sonuç bulunamadı — başka bir şey dene.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TrackRow item={item} context={results} onPlay={onPlay} onAdd={onAdd} />
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

// Neden: üç yeni sekme de aynı iskelet — yükleniyor / yatay kartlar / boş.
// Her biri kendi verisini çeker (chip'e ilk girişte bir kez, sorgu değişince yeniden).
// Neden: load çağrı yerinde useCallback ile sabitlenir — effect [key, load]
// ikilisine abone olur; ne sonsuz döngü ne kural ihlali.
function useAsyncList<T>(key: string, load: () => Promise<T[]>): { items: T[]; loading: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; // chip değişince eski yanıt çöpe
    load()
      .then((r) => { if (alive) { setItems(r); setDoneKey(key); } })
      .catch(() => { if (alive) { setItems([]); setDoneKey(key); } });
    return () => { alive = false; };
  }, [key, load]);
  // Neden: loading türetilmiş state'tir (biten key ≠ istenen key) — effect
  // içinde senkron setState yok, cascading render olmaz.
  return { items, loading: doneKey !== key };
}

// Albums: sanatçının kanalındaki playlist'ler (8 kart yatay).
function AlbumsSection({ artist, channelId }: { artist: string | null; channelId: string | null }) {
  const load = useCallback(async (): Promise<PlaylistCard[]> => {
    if (!channelId) return [];
    return (await getChannelPlaylists(channelId)).slice(0, 8);
  }, [channelId]);
  const { items, loading } = useAsyncList<PlaylistCard>(`albums:${channelId}`, load);
  if (loading) return <SectionSpinner />;
  if (items.length === 0) {
    return <SectionEmpty text={channelId ? 'Albüm bulunamadı.' : 'Sanatçı kanalı bilinmiyor.'} />;
  }
  return (
    <View>
      {artist != null && <Text style={styles.sectionTitle}>{artist} — Albümler</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mixRow}>
        {items.map((p) => (
          <View key={p.id} style={styles.mixCard}>
            {p.thumb ? (
              <Image source={{ uri: p.thumb }} style={styles.mixArt} />
            ) : (
              <View style={styles.mixArt} />
            )}
            <Text style={styles.mixTitle} numberOfLines={2}>{p.title}</Text>
            <Text style={styles.channel} numberOfLines={1}>
              {p.itemCount ? `${p.itemCount} parça` : 'Liste'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Playlists: sorguyla eşleşen listelerden sanatçıninkiler (8 kart yatay).
function PlaylistsSection({ query, artist }: { query: string; artist: string | null }) {
  const load = useCallback(async (): Promise<PlaylistCard[]> => {
    const all = await searchPlaylists(query);
    const scoped = artist ? all.filter((p) => channelMatches({ channel: p.author, title: '' } as Track, artist)) : all;
    return (scoped.length > 0 ? scoped : all).slice(0, 8);
  }, [query, artist]);
  const { items, loading } = useAsyncList<PlaylistCard>(`playlists:${query}:${artist}`, load);
  if (loading) return <SectionSpinner />;
  if (items.length === 0) return <SectionEmpty text="Liste bulunamadı." />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mixRow}>
      {items.map((p) => (
        <View key={p.id} style={styles.mixCard}>
          {p.thumb ? (
            <Image source={{ uri: p.thumb }} style={styles.mixArt} />
          ) : (
            <View style={styles.mixArt} />
          )}
          <Text style={styles.mixTitle} numberOfLines={2}>{p.title}</Text>
          <Text style={styles.channel} numberOfLines={1}>
            {p.author}{p.itemCount ? ` · ${p.itemCount} parça` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

// Profiles: sorguyla eşleşen kanallar (8 kart yatay, rozetli).
function ProfilesSection({ query }: { query: string }) {
  const load = useCallback(async (): Promise<ProfileCard[]> => {
    return (await searchChannels(query)).slice(0, 8);
  }, [query]);
  const { items, loading } = useAsyncList<ProfileCard>(`profiles:${query}`, load);
  if (loading) return <SectionSpinner />;
  if (items.length === 0) return <SectionEmpty text="Profil bulunamadı." />;
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.artistArt} />
          ) : (
            <View style={styles.artistArt} />
          )}
          <View style={styles.rowText}>
            <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.badge}>
              {item.isArtist ? 'Sanatçı' : 'Profil'}
              {item.subscriberCount ? ` · ${fmtViews(item.subscriberCount)} abone` : ''}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

function SectionSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.textSecondary} size="large" />
    </View>
  );
}

function SectionEmpty({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

// Neden: şarkı satırı iki listede (varsayılan + Songs) aynı — tek primitive.
function TrackRow({ item, context, onPlay, onAdd }: {
  item: Track; context: Track[];
  onPlay: (t: Track, ctx: Track[]) => void; onAdd: (t: Track) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPlay(item, context)}
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
        <Text style={styles.channel} numberOfLines={1}>
          {item.channel}
          {item.views ? ` · ${fmtViews(item.views)} görüntülenme` : ''}
        </Text>
      </View>
      <Text style={styles.duration}>{fmtDuration(item.durationSec)}</Text>
      <Pressable
        hitSlop={8}
        onPress={() => onAdd(item)}
        accessibilityLabel={`${item.title} listeye ekle`}
      >
        <MaterialIcons name="add" size={24} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: spacing.sm },
  resultsWrap: { flex: 1 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.searchPill, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 48,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 0 },
  center: { alignItems: 'center', padding: spacing.xl + 6, gap: spacing.md },
  muted: { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  error: { color: colors.danger, textAlign: 'center' },
  retry: {
    backgroundColor: colors.green, borderRadius: radius.pill,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2,
  },
  retryText: { color: colors.black, fontWeight: '700' },
  sectionTitle: {
    color: colors.text, fontSize: 18, fontWeight: '700',
    marginHorizontal: spacing.lg, marginVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.rowPressed },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  rowText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  channel: { color: colors.textSecondary, fontSize: 14, marginTop: 3 },
  badge: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  duration: {
    color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'],
  },
  artistCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  artistArt: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface },
  mixRow: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  mixCard: { width: 140 },
  mixArt: { width: 140, height: 140, borderRadius: radius.card, backgroundColor: colors.surface },
  mixTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
});
