# 🎵 Sonata

**Reklamsız, YouTube kaynaklı kişisel müzik çalar.** Spotify benzeri bir akışla arama yapar, çalar ve geçmişini/çalma listelerini saklar — araya giren reklam yok.

<p>
  <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white">
  <img alt="React Native 0.88" src="https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white">
  <img alt="Lisans: MIT" src="https://img.shields.io/badge/license-MIT-green">
</p>

## ✨ Özellikler

- **Reklamsız arama ve çalma** — YouTube Music InnerTube üzerinden; Invidious/Piped yedek zinciri
- **"Orijinaller üstte"** — `slowed + reverb`, `nightcore`, `sped up` gibi yüklemeler orijinalin önüne geçmez
- **Sekmeli arama** — Şarkılar · Albümler · Listeler · Profiller
- **Çalan ekranı** — sıra, ileri/geri, tekrar/karıştır, mini oynatıcı çubuğu
- **Kaydedilen geçmiş** ve **çalma listeleri**
- **Start ekranı** — son çalınanlar, kişisel öneriler, popüler radyo istasyonları
- **Kalıcı arama önbelleği** — son 40 sorgu 6 saat boyunca diskte (uygulama açılışında tekrar beklemez)
- **Türkçe arayüz**, koyu tema

## 🧱 Teknoloji

| Bileşen | Sürüm |
|---|---|
| Expo SDK | `~58.0.11` |
| React Native | `0.88.0` |
| React | `19.3.0` |
| TypeScript | `~6.0.3` |
| Ses | `expo-audio ~58.0.9` |
| Kalıcılık | `@react-native-async-storage/async-storage 2.2.0` |

> Bilinçli olarak **ek bağımlılık yok**: harici kütüphane yerine Expo'nun sunduğu yerleşik çözümler ve küçük, okunabilir modüller kullanılıyor.

## 🚀 Çalıştırma

```bash
# 1) Depoyu al
git clone https://github.com/Zer0Crypt0/Sonata.git
cd Sonata

# 2) Bağımlılıkları kur
npm install

# 3) Geliştirme sunucusunu başlat
npx expo start
```

Telefonda **Expo Go** (SDK 58) ile QR kodu okut — uygulama açılır.

### Kontroller

```bash
npx tsc --noEmit     # tip kontrolü
npx expo lint        # lint
```

## 🗂️ Proje yapısı

```
App.tsx                     # El yazımı gezinme durumu + üst düzey akış
src/
  sources/                  # Sağlayıcı zinciri (ekranlar yalnız index.ts'i bilir)
    index.ts                #   InnerTube → Invidious → Piped, timeout/ölü-hafıza
    youtube.ts              #   YouTube Music InnerTube arama + ses çözümleme
    invidious.ts            #   Yedek arama uçları
    piped.ts                #   Yedek arama uçları
  components/               # Ekranlar ve kartlar (Home, Search, Player, Library…)
  player.ts                 # expo-audio sarmalayıcı: yükle/çal/duraklat/sıra
  ranking.ts                # "Orijinaller üstte" puanlama ve sıralama
  search-cache.ts           # 6 saatlik LRU arama önbelleği (AsyncStorage)
  history.ts / playlist.ts  # Kalıcı geçmiş ve çalma listeleri
  radio.ts                  # Sanatçı bazlı radyo istasyonları
  recommendations.ts        # Ana ekran önerileri
  home-data.ts              # Ana ekran verisini tek hook'ta toplayan katman
  theme.ts                  # Renk, boşluk, yarıçap sabitleri
  types.ts                  # Katmanlar arası tek veri sözleşmesi
```

### Arama nasıl çalışıyor?

1. **InnerTube (music.youtube.com)** — tek istek, en hızlı yol; başarılıysa diğer sağlayıcılar hiç denenmez.
2. Başarısızsa **Invidious** ve **Piped** paralel yarışır; ilk dolu sonuç kazanır.
3. Ölü işaretlenen sağlayıcı 10 dakika atlanır; süre sonunda kendiliğinden tekrar denenir.
4. Aynı sorgunun eşzamanlı istekleri **tek uçuşa** düşer; sonuçlar 5 dakika bellekte, 6 saat diskte tutulur.

## ⚠️ Notlar

- İçerik YouTube'dan **kişisel kullanım** için akıtılır; uygulama hiçbir içeriği barındırmaz veya yeniden dağıtmaz.
- Invidious/Piped örnekleri topluluk tarafından işletilir; zaman zaman yavaş veya erişilemez olabilirler — bu yüzden birincil yol InnerTube'dır.
- Expo Go'da gömülü olmayan native modüller development build gerektirir; bu proje **Expo Go ile** çalışacak şekilde tasarlandı.

## 📄 Lisans

[MIT](LICENSE)
