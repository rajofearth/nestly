# Nestly — Android push setup

The app builds and runs fine without Firebase. Until this is done, alerts are
in-app only (the alerts tab, unread badges, in-app sheets); `registerPushAndReport`
(`src/services/push.ts`) catches the missing-config error and returns `null`.

## 1. Create `google-services.json`

1. In the Firebase console, create (or reuse) a project and add an **Android
   app** with package id `com.rajofearth.nestly`.
2. Add the SHA-1 fingerprint of the keystore that signs the APK:
   - Debug/test builds: `cd android && .\gradlew signingReport` and copy the
     `SHA1` of the debug variant.
   - Release builds with a real keystore: `keytool -list -v -keystore <keystore>`
     and add that SHA-1 too. Without the matching SHA-1, FCM v1 rejects tokens
     from builds signed with that key.
3. Download `google-services.json` and place it at the **project root** (next to
   `app.config.ts`).

`app.config.ts` auto-detects the file: when `./google-services.json` exists it
sets `googleServicesFile` on the `expo-notifications` plugin, which pulls it
into the Android build on the next prebuild. Nothing else to wire up.

## 2. Add the FCM v1 service account key to expo.dev credentials

1. In the Firebase console: Project settings → Service accounts →
   **Generate new private key** for the Firebase Admin SDK.
2. On expo.dev, open the project (account `rajofearth-proton-me`, project
   `nestly`) → credentials → upload the JSON key as the **FCM v1 auth key**
   (per https://docs.expo.dev/push-notifications/fcm-credentials).
3. Rebuild the APK so the new `google-services.json` is embedded, reinstall,
   and confirm a new Expo push token reaches `auth:setPushToken`.

## 3. API-key restriction gotchas

If the Firebase project's API key is restricted (Google Cloud console →
Credentials), allow these APIs or pushes silently fail:

- **Firebase Cloud Messaging API** (FCM v1 — what Expo's push service calls)
- **Firebase Installations API** (token registration on the device)

Also verify the Android app restriction includes the package name
`com.rajofearth.nestly` and both the debug and release SHA-1 fingerprints.

## Verify

- `npx expo push:android --recipient <expo-push-token>` — or trigger a real
  event (SOS from the other device) and check the notification appears.
- Convex dashboard → deployment logs: `push:sendPush` errors from the Expo push
  API show up there if credentials are wrong.
