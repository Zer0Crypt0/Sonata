# 🎵 Sonata

**An ad-free, YouTube-powered personal music player.** Search, stream and keep your history/playlists with a Spotify-like flow — no ads in between.

<p>
  <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white">
  <img alt="React Native 0.88" src="https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green">
</p>

## Why Sonata?

YouTube has the deepest music catalog on the internet, but watching it through the regular app means ads, autoplay rabbit holes and a video-first experience. Sonata distills YouTube into a clean, audio-first player:

- **No third-party music backend** — everything comes straight from YouTube Music's InnerTube API, with community fallbacks when it misbehaves.
- **Original-first results** — `slowed + reverb`, `nightcore` and `sped up` uploads no longer outrank the original track.
- **No new dependencies by design** — the project deliberately stays on Expo's built-in modules (audio, storage, icons) instead of pulling in large third-party libraries.
- **Runs in Expo Go** — no native build, no Android/iOS toolchain required to try it.

## ✨ Features

- **Ad-free search & playback** — YouTube Music InnerTube as the primary path, Invidious/Piped as fallback
- **"Originals first" ranking** — reuploads (`slowed + reverb`, `nightcore`, `sped up`, karaoke, lyrics-only) are demoted below the original
- **Tabbed search** — Songs · Albums · Playlists · Profiles
- **Full player screen** — queue, next/previous, repeat/shuffle, translucent mini-player bar over the tab bar
- **Persistent history** and **playlists**
- **Home screen** — recently played, personalized recommendations, popular radio stations
- **Persistent search cache** — the last 40 queries are kept on disk for 6 hours, so reopening the app doesn't re-wait for the same results
- **Turkish UI**, dark theme

## 🧱 Tech stack

| Component | Version |
|---|---|
| Expo SDK | `~58.0.11` |
| React Native | `0.88.0` |
| React | `19.3.0` |
| TypeScript | `~6.0.3` |
| Audio | `expo-audio ~58.0.9` |
| Persistence | `@react-native-async-storage/async-storage 2.2.0` |

## 🚀 Getting started

### Prerequisites

- Node.js 20+ and npm
- [Expo Go](https://expo.dev/go) (SDK 58) on your phone, on the same network as your computer

### Run it

```bash
# 1) Clone
git clone https://github.com/Zer0Crypt0/Sonata.git
cd Sonata

# 2) Install dependencies
npm install

# 3) Start the dev server
npx expo start
```

Scan the QR code with Expo Go — the app opens on your phone.

### Checks

```bash
npx tsc --noEmit     # type check
npx expo lint        # lint
```

## 🗂️ Project structure

```
App.tsx                     # Hand-rolled navigation state + top-level flow
src/
  sources/                  # Provider chain (screens only know index.ts)
    index.ts                #   InnerTube → Invidious → Piped, timeouts & dead-provider memory
    youtube.ts              #   YouTube Music InnerTube search + audio resolution
    invidious.ts            #   Fallback search endpoints
    piped.ts                #   Fallback search endpoints
  components/               # Screens & cards (Home, Search, Player, Library…)
  player.ts                 # expo-audio wrapper: load / play / pause / queue
  ranking.ts                # "Originals first" scoring & ordering
  search-cache.ts           # 6-hour LRU search cache (AsyncStorage)
  history.ts / playlist.ts  # Persistent history and playlists
  radio.ts                  # Artist-based radio stations
  recommendations.ts        # Home screen recommendations
  home-data.ts              # Single hook that aggregates home screen data
  theme.ts                  # Color, spacing, radius tokens
  types.ts                  # Single cross-layer data contract
```

### How search works

1. **InnerTube (music.youtube.com)** — one request, the fastest path; if it succeeds, no other provider is touched.
2. On failure, **Invidious** and **Piped** race in parallel; the first non-empty result wins.
3. A provider that fails is marked dead for 10 minutes and skipped; it is retried automatically after that.
4. Concurrent requests for the same query are collapsed into a single in-flight request; results are cached in memory for 5 minutes and on disk for 6 hours.
5. Audio resolution follows the same chain, and the player keeps queue state locally so playback survives screen changes.

## ⚠️ Notes

- Content is streamed from YouTube for **personal use**; Sonata hosts and redistributes nothing.
- Invidious/Piped instances are community-run and can be slow or unavailable at times — that's why InnerTube is the primary path.
- Native modules not bundled in Expo Go require a development build; this project is intentionally designed to run in **Expo Go**.

## 📄 License

[MIT](LICENSE)
