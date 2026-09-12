# Nestly — Building on Windows

## Quick build

```
pnpm install
npx convex dev --once          # push backend (already deployed)
npx expo prebuild --platform android --clean
cd android && .\gradlew assembleRelease
```

Output: `.build-outputs/nestly-v1.0.0.apk` (universal release APK signed with
the debug keystore for testing; install on physical devices, no emulator
needed).

## pnpm `node-linker=hoisted` (`.npmrc`) — required

pnpm's default symlinked layout stores packages under `node_modules\.pnpm\<pkg>@<hash>\...`.
Combined with React Native codegen paths, those chains blow past Windows'
260-char MAX_PATH and ninja fails with cryptic missing-file errors.
`node-linker=hoisted` flattens the layout like npm. Do not remove this line.

## arm64-only builds (`buildArchs`)

`app.config.ts` sets `expo-build-properties` → `android.buildArchs:
['arm64-v8a']`, so prebuild skips armeabi/x86 — roughly half the native build
time. Every physical Android phone in the last several years is arm64. Revert
to the default arch set for Play Store artifacts.

## Cleaning a misbehaving CMake/ninja build

If CMake or ninja misbehave (stale caches, long-path errors, "ninja: error"
after moving the project):

1. Delete `android\app\.cxx` and `android\.cxx`.
2. Delete `node_modules\<lib>\android\.cxx` and `node_modules\<lib>\android\build`
   for the offending native lib (commonly `react-native-svg`,
   `@maplibre/maplibre-react-native`, `react-native-safe-area-context`).
3. Rebuild — Gradle re-runs configure from scratch.

## Defender exclusions (speed only, not a fix)

Windows Defender real-time scanning of thousands of small build files is a
large slowdown. Exclude these directories for faster builds:

- the project directory (`P:\Projects\famloc`)
- `%USERPROFILE%\.gradle`
- the Android SDK directory

These are performance knobs only — builds succeed without them.

## CMake version fallback for stubborn long-path ninja issues

If ninja still chokes on long paths after the `.cxx` cleanup, pin a newer CMake
for the Gradle plugin: in `android/build.gradle` (or the RN gradle plugin
config), force `cmakeVersion "3.31.6"` (or set `cmake.dir` to a standalone
3.31.6 install). Newer CMake's ninja integration handles deep hoisted
`node_modules` paths more gracefully than the bundled older version. Only
reach for this when the cleanup recipe above doesn't resolve it.
