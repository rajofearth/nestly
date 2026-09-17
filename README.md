# Nestly

Your family, always within reach. Live location, speed, device status, places,
check-ins and SOS — in one cozy place, with a family of bloub avatars.

## Stack

| | |
| --- | --- |
| App | Expo SDK 57 / RN 0.86 / expo-router, TypeScript strict |
| Backend | Convex (cloud, team `rajofearth-proton-me`, project `nestly`, deployment `adept-whale-546`) — realtime DB + push scheduling |
| Maps | MapLibre React Native v11 + free OpenFreeMap Liberty tiles (no API key) |
| Avatars | Bloub engine (ported from jeremy-prt/bloub, MIT), rendered with react-native-svg |

## APK

`.build-outputs/nestly-v1.0.0.apk` — universal release APK signed with the debug
keystore (test build). Install on physical devices; no emulator needed.

## Build

```
pnpm install
npx convex dev --once          # push backend (already deployed)
npx expo prebuild --platform android --clean
cd android && .\gradlew assembleRelease
```

Windows-specific notes (hoisted node-linker, arm64-only builds, CMake/ninja
cleanup): see `docs/BUILD_WINDOWS.md`.

## Docs

| Doc | Contents |
| --- | --- |
| `docs/ARCHITECTURE.md` | System overview, route map, bloub engine, backend tables/functions, push pipeline, background tracking, auth model |
| `docs/CONTRACT.md` | Shared API contract — schema, function signatures, conventions |
| `docs/BUILD_WINDOWS.md` | Windows build setup and troubleshooting |
| `docs/PUSH_SETUP.md` | Enabling Android push (Firebase config, FCM v1 credentials) |
| `docs/TESTING.md` | 2-device manual test script |

## Conventions

- All screens read live data through Convex subscriptions — no manual refresh.
- Member mood/expression logic lives in `src/lib/memberStatus.ts` — the bloub
  avatars react to battery, movement, staleness and SOS from there.
