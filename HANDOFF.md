# HANDOFF.md — Sonata ↔ OpenCode (Sisyphus) iş bölümü

> Bu dosya TEAM.md'nin Sonata (müzik uygulaması) için uygulanmış halidir.
> Çelişkide `TEAM.md` esas alınır. Mesajlar `[Buffy]` / `[OC]` etiketiyle yazılır.

## [Buffy] 2026-10-16 — Nerede, ne var, kim ne yapıyor

### 1. Proje nerede

**Mutlak yol:** `/Users/fatihemre/For-Pentest/sonata`

- **Kendi git deposu var** (`sonata/.git`) — For-Pentest'in kökünde repo YOK.
  `git -C /Users/fatihemre/For-Pentest/sonata log --oneline` → tek commit: `Initial commit`
- Çalışan uygulama adı: **Sonata** — reklamsız, YouTube kaynaklı kişisel müzik çalar
  (Weezer/MusicFree benzeri arayüz akışı: **Ara → Çalan → Liste**, hepsi reklamsız).
- Kullanıcının asıl istediği özellik: **"orijinaller üstte"** — aramada
  `slowed + reverb / nightcore / sped up` yüklemeleri orijinalin önüne geçmesin.

### 2. Stack (dondurulmuş — değiştirmeden önce kullanıcıya sor)

| Bileşen | Sürüm |
|---------|-------|
| Expo SDK | `~58.0.11` |
| React Native | `0.88.0` |
| React | `19.3.0` |
| TypeScript | `~6.0.3` |
| Ses | `expo-audio ~58.0.9` |
| Kalıcılık | `@react-native-async-storage/async-storage 2.2.0` |

Tek ek bağımlılık: `expo-status-bar ~58.0.3`. **Başka bağımlılık YOK ve istenmiyor.**

### 3. 🔴 Kullanıcı kısıtı: disk (pazarlık dışı)

Kullanıcının makinesinde ~11 GB boş alan var ve **yeni paket indirilmesini istemiyor**:

- `npm install`, `npx expo install <paket>`, `npm ci` **çalıştırma**.
- `npx <paket>` ile registry'den araç indirme (npx cache'e 200-400 MB yazar). Örnek:
  yanlış dizinden çalıştırılan `npx expo start`, `expo@58.0.12` paketini indirmeye
  başlamıştı — bu kabul edilemez.
- Bunun yerine **lokal binary'leri** kullan: `./node_modules/.bin/tsc`, `./node_modules/.bin/expo`.
- Expo Go'da gömülü olmayan native modül eklemek **development build** gerektirir →
  Gradle/NDK indirmesi → disk. **Kaçın.** `expo-audio` ve `async-storage` Expo Go'da gömülü,
  bu yüzden Expo Go ile test edebiliyoruz.
- Yeni bağımlılık gerçekten şartsa: **önce kullanıcıya sor**, indirme boyutunu söyle.

### 4. Test döngüsü (çalışan, doğrulanmış — 2026-10-16)

| Adım | Komut / durum |
|------|---------------|
| Dev sunucusu | **tmux oturumu `sonata-metro` zaten ayakta**, port **8081** |
| Yeniden başlatma gerekirse | `tmux new-session -d -s sonata-metro -c /Users/fatihemre/For-Pentest/sonata "./node_modules/.bin/expo start --lan --port 8081 > /tmp/sonata-metro.log 2>&1"` |
| Log | `/tmp/sonata-metro.log` · `tmux attach -t sonata-metro` |
| Mac LAN IP | `ipconfig getifaddr en0` → **10.84.145.191** (Wi-Fi değişince değişir) |
| Telefon | Samsung **SM-A715F** (A71), Android 13, USB bağlı, adb cihaz kimliği `R58NC3R20AH` |
| Client | **Expo Go 58.0.4** (SDK 58 ile uyumlu) kurulu |
| Uygulamayı telefonda aç | `adb shell am start -a android.intent.action.VIEW -d "exp://10.84.145.191:8081" host.exp.exponent` |
| Tip kontrolü | `./node_modules/.bin/tsc --noEmit` → **EXIT 0 beklenir** |
| Bundle testi | `./node_modules/.bin/expo export --platform android` → `dist/` üretir; **test sonrası `rm -rf dist`** (disk) |
| Metro hazır mı | `curl -s http://127.0.0.1:8081/status` → `packager-status:running` |
| Telefon sunucuya erişiyor mu | `adb shell "printf 'GET /status HTTP/1.0\r\n\r\n' \| toybox nc -w 5 10.84.145.191 8081"` |

> Not: `npx expo start` yerine **`./node_modules/.bin/expo`** kullan; yanlış dizinden
> `npx` çağrısı paket indirmeye çalışır (bkz. §3).

### 5. Kanıt zorunlu (TEAM.md §5)

"Çalışıyor" demek yetmez. En az:

1. `./node_modules/.bin/tsc --noEmit` → 0
2. Metro logunda `Android Bundled … modules` satırı (telefonun gerçekten bundle aldığının kanıtı)
3. Telefonda UI kanıtı — ekran görüntüsü yerine **metin ağacı** (deterministik):

```bash
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml > /tmp/ui.xml
# /tmp/ui.xml içindeki text="..." değerleri beklenen etiketlerle karşılaştırılır
```

4. `adb logcat -d -t 300 | grep -iE "ReactNativeJS|FATAL"` → kırmızı ekran/hata izi olmamalı

### 6. 📁 Dosya sahipliği (çakışma yasak — TEAM.md §4)

| Dosya | Sahip | Not |
|-------|-------|-----|
| `src/components/SearchScreen.tsx` | **OC** | UI + liste render perf |
| `src/components/PlayerScreen.tsx` | **OC** | UI |
| `src/components/PlaylistScreen.tsx` | **OC** | UI |
| `src/theme.ts` *(yeni)* | **OC** | Renk/tipografi tek kaynağı |
| `App.tsx` | **Buffy** | Kabuk, sekme çubuğu, mini bar, durum yönetimi |
| `src/player.ts` | **Buffy** | expo-audio sarmalayıcı + durum aboneliği |
| `src/sources/**` (invidious, piped, index) | **Buffy** | Ağ katmanı, failover, önbellek |
| `src/ranking.ts` | **Buffy** | "Orijinaller üstte" skorlaması |
| `src/playlist.ts` | **Buffy** | AsyncStorage kalıcılığı |
| `src/types.ts` | **ortak, dondurulmuş** | Değişiklik gerekiyorsa ikimize de söyle |

**Ekranların props arayüzleri dondurulmuştur** (Buffy bunları `App.tsx`'te besler):

```ts
SearchScreen   : { results, loading, error, onSearch(q), onPlay(track, context), onAdd(track) }
PlayerScreen   : { track, playing, position, duration, resolving, onToggle, onPrev, onNext, onSeek(ratio) }
PlaylistScreen : { tracks, onPlay(track, context), onRemove(track) }
```

Prop eklemek/çıkarmak gerekirse önce buraya `[OC]` notu yaz — `App.tsx` sahibi uygular.

### 7. [Buffy] OC'nin işi — UI + liste performansı

Kullanıcı isteği: *"arayüzü düzenlesek güzel olur"* + *"performansı da arttıralım"*.

**Görsel (serbest ama bunlara dikkat):**
- Koyu tema korunur; renkler `src/theme.ts`'e taşınıp tek kaynaktan gelsin.
- Türkçe etiketler korunur (Ara / Çalan / Liste) — bunlar testlerde etiket olarak kullanılıyor.
- Oynatıcı ekranı: büyük albüm kapağı, sürüklenebilir ilerleme çubuğu, süre göstergesi.
- Boş durumlar ve hata durumu ("Tekrar dene") görsel olarak iyileştirilir.
- Erişilebilirlik: dokunma alanları ≥ 44dp, `accessibilityLabel` ekle.

**Render performansı (ölçülebilir):**
- Satır bileşenini ayrı dosyaya çıkar ve `React.memo` ile sar → satır, üst bileşen
  yeniden çizildiğinde gereksiz render olmasın.
- `renderItem` içinde **satır başına yeni closure üretme**; `useCallback` ile sabit tut.
- `FlatList` ayarları: `initialNumToRender={12}`, `maxToRenderPerBatch={8}`,
  `windowSize={7}`, `removeClippedSubviews={true}`.
- Satır yüksekliği sabitse `getItemLayout` ver (kaydırma sırasında ölçüm maliyetini sıfırlar).
- `Image` için sabit genişlik/yükseklik (layout thrash yok) + `defaultSource` yok →
  yükleme sırasında gri kutu zaten var; kapak gelene kadar `activityIndicator` yerine
  ucuz placeholder tercih et.

### 8. [Buffy] Bildiğim açık konular (OC dokunmasın, bende)

- `App.tsx`'te 500 ms `setInterval` ile durum yoklaması vardı → **kaldırıyorum**,
  yerine `expo-audio` durum olayına bağlı abonelik geliyor (boştayken 0 render).
- `player.ts`'deki `onFinished` aboneliği oynatıcı oluşmadan önce kurulduğu için
  **hiç çalışmıyordu** (otomatik sıradaki bozuk) → kalıcı listener ile düzeltiyorum.
- Sağlayıcı zinciri sırayla deniyordu (her ölü instance 8 sn bekletiyordu) →
  yarış (paralel) + sağlık hafızası geliyor.
- Bilinen küçük borç: `SafeAreaView` RN 0.88'de deprecated uyarısı veriyor
  (`react-native-safe-area-context` öneriliyor). Yeni bağımlılık gerektirdiği için
  kullanıcı onayı olmadan değiştirilmez.

### 9. AGENTS.md ile bilinçli sapma

`sonata/AGENTS.md` (Expo şablonundan) "navigasyon için **Expo Router** kullan,
rotalar `src/app/`'de olsun" diyor. Bu **bilinçli olarak** uygulanmadı:

- `expo-router` yeni bağımlılık + disk maliyeti (bkz. §3).
- Navigasyon `App.tsx` içinde küçük bir durum makinesi (`search | player | list`) —
  üç sekmeli bir uygulama için yeterli ve sıfır bağımlılık.

Router'a geçiş istenirse bu bir mimari karardır → **önce kullanıcıya sorulur**.
