# Nestly — Architecture

## System overview

```
┌─────────────────────────┐        realtime WebSocket subscriptions        ┌──────────────────┐
│  Nestly app (Expo SDK   │ ─────────────────────────────────────────────▶ │  Convex cloud    │
│  57, expo-router)       │ ◀───────────────────────────────────────────── │  (deployment     │
│                         │     mutations from UI (convex/react client)    │  adept-whale-546)│
└───────────┬─────────────┘                                                └────────┬─────────┘
            │                                                                        │
            │  Background location task (expo-task-manager)                          │ scheduler.runAfter(0)
            │  posts raw HTTP mutations to                                           ▼
            │  <deployment>.site/api/mutation:                              ┌──────────────────┐
            │  presence:heartbeat, places:recordPlaceEvent                  │ internal action  │
            └──────────────────────────────────────────────────────────────▶│ push:sendPush    │
                                                                            └────────┬─────────┘
                                                                                     │ HTTPS
                                                                                     ▼
                                                                            Expo push API → FCM
```

- Foreground screens read everything through Convex subscriptions — no manual refresh anywhere.
- The background task cannot hold a Convex client, so it calls the same mutations
  over plain HTTP (`src/services/tracking.ts`).
- Push is fire-and-forget: mutations insert an alert row and schedule the push
  action; delivery failures are logged, never surfaced in-app.

## Frontend

### Route map (expo-router, all under `src/app`)

| Route | Purpose |
| --- | --- |
| `_layout.tsx` | Root stack: ConvexProvider, Nunito fonts, splash gate while identity bootstraps. Also imports `services/tracking` so the background task is defined at startup. |
| `index.tsx` | Gate. Token + circle membership → `(app)`; anything else → `onboarding`. |
| `onboarding.tsx` | Welcome → identity (name + role, live bloub preview) → create nest (name) or join nest (6-char code). Registers, creates/joins, stores token, enables sharing, requests push. |
| `(app)/_layout.tsx` | Tab layout: Nest (map), Family, Places, Me. Hidden routes: `member/[id]`, `alerts`. Boots permissions, background tracking, push registration, and refreshes the background task's place cache. |
| `(app)/map.tsx` | Live MapLibre map with member markers, own-location camera, place pins, SOS long-press button with confirm sheet. |
| `(app)/family.tsx` | Member list with moods, invite code share/regenerate, remove member (owner), location-sharing toggle. |
| `(app)/places.tsx` | Place CRUD with a map picker (emoji, radius 100/150/300/500 m), arrive/leave notification toggles, recent place-event history. |
| `(app)/me.tsx` | Profile editor (name, role, bloub avatar picker: 8 shapes / 12 colors / 16 expressions), device + battery readout, sharing toggle. |
| `(app)/alerts.tsx` | Alert feed (SOS, memberJoined, arrive/leave, checkin, batteryLow) with mark-read. |
| `(app)/member/[id].tsx` | Member detail: breadcrumb trail on a map, speed/battery/last-seen stats. |

### Identity store (`src/lib/identity.ts`)

Zustand store with `status: 'loading' | 'signedOut' | 'ready'`, `token`, `me`.
The auth token lives in `expo-secure-store` under the key `nestly.token`;
`bootstrap()` reads it at launch, `signIn`/`signOut` write/delete it. The store
never talks to Convex itself — sync happens in `useMeSync`.

### Sync patterns

- `useMeSync()` (`src/lib/useMeSync.ts`) — subscribes to `auth:me` for the
  current token and mirrors the result into the identity store. Returns
  `undefined` while loading, `null` for an invalid token, else the live user doc.
  Screens prefer its value over the store copy.
- `useCircle()` (`src/lib/useCircle.ts`) — subscribes to `circles:get`, returns
  `{ circle, members, loading, inCircle }`. Members carry live presence fields
  because they are stored flat on the user docs.

### Bloub avatar engine (`src/components/Bloub`)

Ported from jeremy-prt/bloub (MIT). Two layers:

- `engine/` — pure TypeScript: state machines (`states.ts`, 14 states plus the
  `swirl` transition), shapes (`skins.ts`, 8), expressions (`expressions.ts`,
  16), math/easing helpers. No React, no imports from the app — it just samples
  `BotFrame` objects (body path, eye paths, particle dots, arcs).
- `Bloub.tsx` — renders a frame to `react-native-svg` (mask + ink rect + dots +
  gradient arcs). Two modes:
  - **Frozen** (default, `animate` off or `frozenAt` set): samples one frame —
    used for tab icons and list rows where a rAF loop per avatar would be waste.
  - **Animate** (`animate` prop): runs the rAF loop with `playSpeed`, morphs
    smoothly between state/shape/expression changes, supports `follow` (gaze
    target) and scripted `gaze`.

`ids.ts` resolves prop strings to engine ids and accepts English aliases
(`shape="round"`, `expression="happy"`).

### Design tokens (`src/theme/tokens.ts`)

Single source for `colors` (warm cream base `#FFF8EE`, coral accent `#FF6B4A`,
soft-tinted pairs like `skySoft`/`mintSoft`), `spacing` (4–48), `radius`
(12–pill), `shadow` (card/float), and `typography` (Nunito 400–800, loaded in
the root layout). Every screen styles from these tokens; no ad-hoc palette
values.

### Mood mapping (`src/lib/memberStatus.ts`)

`memberMood(user)` turns a member's live presence into a bloub mood — this is
how avatars react to data. Priority order:

| Condition | State | Expression | Tint | Label |
| --- | --- | --- | --- | --- |
| No presence or `lastSeen` older than 8 min | `sleep` | `somnolent` | off | "Last seen …" |
| Low-power mode, battery ≤ 15%, not charging | `alert` | `effraye` | warn | "Low battery · N%" |
| Speed 0.5-2.0 m/s | `wide` | `curieux` | ok | "Walking · N km/h" |
| Speed 2.0-8.0 m/s | `orbit` | `excite` | ok | "Running · N km/h" |
| Speed above 8.0 m/s | `comet` | `excite` | ok | "Driving · N km/h" |
| Battery ≤ 15% while charging | `notify` | `heureux` | ok | "Charging up" |
| Otherwise | `idle` | `heureux` | ok | "Resting" |

The states `wide`, `notify`, `orbit` and `comet` carry `faceFromExpression: true`,
so the mood expression replaces their face while their own animation stays.

`batteryLabel(user)` renders the battery pill as plain text, like "80% · charging"
or "12% · low".

## Backend (Convex)

### Tables and indexes (`convex/schema.ts`)

| Table | Indexes | Notes |
| --- | --- | --- |
| `users` | `by_token(token)`, `by_circle(circleId)` | Presence fields (`lat`…`lastSeen`) live flat on the doc; `token` and `pushToken` are secrets. |
| `circles` | `by_code(code)` | 6-char code from an unambiguous alphabet (no 0/O, 1/I/L, 8/B). |
| `places` | `by_circle(circleId)` | Geofence circle: `lat`, `lng`, `radiusM` (default 150), `notifyOnArrive`/`notifyOnLeave`. |
| `placeEvents` | `by_circle_ts`, `by_place` | Append-only arrive/leave log; deleted along with their place. |
| `breadcrumbs` | `by_user_ts` | Trimmed to the last 200 per user on every insert. |
| `checkinRequests` | `by_target_status`, `by_circle_status` | `status: "pending" \| "ok"`. |
| `alerts` | `by_circle_ts`, `by_target` | Types: `sos`, `memberJoined`, `arrive`, `leave`, `batteryLow`, `checkin`. `toUserId` absent = whole circle. |

### Function map

| File | Exports |
| --- | --- |
| `convex/auth.ts` | `register` (mutation, returns `{token, userId, user}`), `me` (query), `updateProfile` (mutation), `setPushToken` (mutation) |
| `convex/circles.ts` | `create`, `join` (inserts `memberJoined` alert + push), `leave`, `removeMember` (owner only), `regenerateCode` (owner only), `get` (query: circle + `publicUser` members + `placesCount`), `getByCode` (query, no auth — join preview) |
| `convex/presence.ts` | `heartbeat` (mutation, patches presence + `lastSeen`), `breadcrumb` (mutation, keeps last 200), `breadcrumbsForUser` (query, default limit 100, max 200, filtered to caller's circle) |
| `convex/places.ts` | `list`, `add`, `remove` (also deletes the place's events), `events` (query, joined with member names), `recordPlaceEvent` (mutation — see below) |
| `convex/checkins.ts` | `request` (alert + push to target), `respond` (answers the caller's latest pending request; alert + push to requester), `pendingForMe`, `pendingForCircle` |
| `convex/alerts.ts` | `list` (scans last 200 in circle, keeps those addressed to me or everyone, default limit 100), `markRead`, `sos` (alert + push to all other members) |
| `convex/push.ts` | `getPushTargets` (internal query), `sendPush` (internal action), `queuePush` (helper — see below) |
| `convex/lib/helpers.ts` | `requireUser`, `requireCircleUser`, `getCircleMembers`, `publicUser`, `insertAlert`, `genCode`, `genToken` |

Full signatures: `docs/CONTRACT.md`.

### Push pipeline

```
mutation handler
  → queuePush(ctx, userIds, title, body, data)     (convex/push.ts)
  → ctx.scheduler.runAfter(0, internal.push.sendPush, …)
  → sendPush (internal action)
      → runQuery(getPushTargets)   — actions can't touch ctx.db; drops users without pushToken
      → POST https://exp.host/--/api/v2/push/send  in chunks of 100 tokens
```

Users without a `pushToken` are filtered out, so the whole pipeline is a no-op
on builds without Firebase config.

### Heartbeat / breadcrumb / geofence flow

All client-side detection happens inside the background task
`nestly-location-task` (`src/services/tracking.ts`), started via
`Location.startLocationUpdatesAsync` (balanced accuracy, no distance floor,
15 s time interval, Android foreground service with a persistent notification).
The task runs while the app is alive in the background. It stops when the app is
force-stopped or swiped away.

1. **Context cache** — the `(app)` tab layout writes the auth token and the
   current `places` list into AsyncStorage (`cacheTaskContext`) whenever the
   places subscription changes. The task reads this cache; it never queries
   Convex directly.
2. **Speed** — `speedFromFix` rejects the two failure modes that produced
   nonsense: a bad fix (accuracy worse than 60 m) or an implausible value (above
   100 m/s) is dropped, and if the phone did not move further than its own
   accuracy radius it reports 0. The distance between fixes is the harder
   evidence, so it also supplies a speed when the OS value is missing.
3. **Heartbeat** — throttled to one per 12 s. Reads battery level/state and
   low-power mode (`expo-battery`), then POSTs `presence:heartbeat` to
   `<deployment>.site/api/mutation` over plain fetch. The server clamps speed to
   0–100 m/s and drops null fields. Failures are swallowed; the next tick retries.
4. **Breadcrumbs** — throttled to one per 60 s, POSTed from the same task to
   `presence:breadcrumb`, so the member trail map has real points.
5. **Geofence** — for each cached place, haversine distance vs `radiusM`. The
   inside/outside state per place is persisted in AsyncStorage, so transitions
   are edge-triggered (one event per crossing, not per tick). On enter/exit it
   POSTs `places:recordPlaceEvent`; the server inserts the `placeEvents` row
   and, when the place's `notifyOnArrive`/`notifyOnLeave` flag matches, fans out
   an alert + push to the rest of the circle.
6. **Alerts** — throttled to one poll per 20 s. The task queries
   `alerts:since` over plain HTTP with a cursor kept in AsyncStorage, then raises
   a local notification for anything new that is addressed to this member and was
   not sent by them (`notify.ts`). This is how the app tells the family about a
   place event without a push service. A foreground interval in `(app)/_layout`
   runs the same poll while a screen is open.

## Auth model

- `auth:register` mints a token (`genToken()`: timestamp + four `Math.random`
  draws, ~100+ bits — `node:crypto` is unavailable in the deterministic
  mutation runtime) and returns it once. The app stores it in SecureStore.
- Every function takes `{ token, … }` as its first argument. `requireUser`
  looks the token up via the `by_token` index and throws `Invalid auth token`;
  `requireCircleUser` additionally throws `Not in a circle`.
- `publicUser()` strips `token` and `pushToken` before user docs leave the
  server (used by `circles:get`). `auth:me` returns the caller's own doc
  unstripped — it is the only way a client sees its own token echo.
- `circles:getByCode` is the only unauthenticated function: it returns just
  `{ name }` so the join screen can preview a circle.
