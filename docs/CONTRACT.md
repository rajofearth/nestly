# Nestly — Shared API Contract (single source of truth)

Mirrors `convex/*.ts` exactly. If you change the backend, change this file.

## Domain model (Convex schema)

- **users**: `_id`, `token` (secret string, indexed `by_token`), `name`, `role` (mom|dad|firstborn|kid|youngest|grandma|grandpa|custom, with `roleLabel` freeform override), `circleId` (id|undefined), `avatar` ({shape, color, expression} string ids), `pushToken` (string|undefined), `isOwner` (boolean), `createdAt` (number)
  - Presence fields, patched by `presence:heartbeat`: `lat`, `lng`, `accuracy`, `speed`, `heading`, `battery`, `isCharging`, `isLowPower`, `deviceModel`, `lastSeen` (number ms). Stored flat on the user doc — one live doc per member.
  - Indexes: `by_token`, `by_circle`.
- **circles**: `_id`, `name`, `code` (6-char uppercase from an unambiguous alphabet, indexed `by_code`), `ownerId`, `createdAt`
- **places**: `_id`, `circleId`, `name`, `emoji`, `lat`, `lng`, `radiusM` (default 150), `notifyOnArrive` (default false), `notifyOnLeave` (default false), `createdBy`, `createdAt`. Index: `by_circle`.
- **placeEvents**: `_id`, `circleId`, `userId`, `placeId`, `type` ("arrive"|"leave"), `ts`. Indexes: `by_circle_ts`, `by_place`. Deleted along with their place.
- **breadcrumbs**: `_id`, `circleId`, `userId`, `lat`, `lng`, `speed`, `ts`. Index: `by_user_ts`. Keep last 200 per user (trimmed on insert).
- **checkinRequests**: `_id`, `circleId`, `requestedBy`, `targetId`, `status` ("pending"|"ok"), `ts`, `respondedTs` (optional). Indexes: `by_target_status`, `by_circle_status`.
- **alerts**: `_id`, `circleId`, `type` ("sos"|"memberJoined"|"arrive"|"leave"|"batteryLow"|"checkin"), `fromUserId`, `toUserId` (optional; absent = whole circle), `payload` (optional any), `ts`, `read`. Indexes: `by_circle_ts`, `by_target`.

## Auth

Custom lightweight auth. `auth:register` mints a token (timestamp + Math.random draws, ~100+ bits — `node:crypto` is unavailable in the mutation runtime) and returns `{ token, userId, user }`. The app stores it in `expo-secure-store`. Every subsequent call passes `token` as the first arg field. `requireUser(ctx, token)` throws `Invalid auth token`; `requireCircleUser` additionally throws `Not in a circle`. `publicUser(user)` strips `token` and `pushToken` before docs go to other members.

## Convex functions (file → exports)

- `convex/auth.ts`
  - `register(name, role, roleLabel?, avatar)` → `{token, userId, user}` (mutation)
  - `me(token)` → full own user doc or `null` (query)
  - `updateProfile(token, {name?, role?, roleLabel?, avatar?})` (mutation)
  - `setPushToken(token, pushToken)` (mutation)
- `convex/circles.ts`
  - `create(token, name, role)` → `{circleId}`; sets `isOwner: true`; throws if already in a circle
  - `join(token, code, role)` → `{circleId, circle}`; inserts a `memberJoined` alert and queues push to other members
  - `leave(token)`; `removeMember(token, memberId)` (owner only, not self); `regenerateCode(token)` (owner only)
  - `get(token)` → `null` or `{circle, members: publicUser[], placesCount}` (query — members carry live presence)
  - `getByCode(code)` → `{name}` or `null` (query, **no auth** — join preview only)
- `convex/presence.ts`
  - `heartbeat(token, {lat, lng, accuracy?, speed?, heading?, battery?, isCharging?, isLowPower?, deviceModel?})` — patches presence + `lastSeen`. `accuracy`, `speed` and `heading` also accept `null`. The server sets `speed` to a finite `0..100` m/s (null, NaN or negative means still) and omits any other field that arrives null, so a bad fix can never store a garbage speed or drop the heartbeat.
  - `breadcrumb(token, {lat, lng, speed})` — inserts and trims to last 200 per user
  - `breadcrumbsForUser(token, userId, limit?)` → recent crumbs (desc, default limit 100, max 200), filtered to the caller's circle
- `convex/places.ts`
  - `list(token)` (query)
  - `add(token, {name, emoji, lat, lng, radiusM?, notifyOnArrive?, notifyOnLeave?})` → `{placeId}`
  - `remove(token, placeId)` — also deletes the place's `placeEvents`
  - `events(token, limit?)` → recent events (desc, default 50) joined with `memberName`
  - `recordPlaceEvent(token, placeId, type)` — inserts the `placeEvents` row; if the place's `notifyOnArrive`/`notifyOnLeave` flag matches the type, inserts an `arrive`/`leave` alert and queues push to other members ("📍 Mom arrived at Home"). Geofence detection itself is client-side (background task).
- `convex/checkins.ts`
  - `request(token, targetId)` → `{requestId}`; inserts a `checkin` alert (`payload.kind: "request"`) targeted at the user + push to target
  - `respond(token, status: "ok")` — answers the caller's **latest pending** request (throws if none); patches `status`/`respondedTs`, inserts a `checkin` alert (`payload.kind: "responded"`) targeted at the requester + push to requester
  - `pendingForMe(token)`, `pendingForCircle(token)` (queries)
- `convex/alerts.ts`
  - `list(token, limit?)` — scans the last 200 alerts in the circle, keeps those with no `toUserId` or `toUserId === me`, default limit 100
  - `markRead(token, alertId)` — only own or circle-wide alerts
  - `sos(token, payload?)` — inserts an `sos` alert (whole circle) + push to all other members
  - `since(token, since?)` — notification cursor for the background task: up to 50 newest alerts in the circle with `ts > since`, excluding the caller's own actions and alerts addressed to someone else. Returns `{_id, type, fromUserId, fromName, ts, payload?}`, newest first.
- `convex/push.ts`
  - `getPushTargets` (internal query) — resolves userIds to `{userId, pushToken}`, dropping users without a token
  - `sendPush` (internal action) — POSTs to the Expo push API in chunks of 100 tokens
  - `queuePush(ctx, userIds, title, body, data?)` — helper called from mutations; `scheduler.runAfter(0, …)`, fire-and-forget

## Push

Expo push API via the scheduled internal action. Registration is optional — if the device can't get an Expo push token (no Firebase config), the app still works and alerts are in-app only. See `docs/PUSH_SETUP.md` to enable delivery.

The app also raises its own local notifications (`src/services/notify.ts`). The background task polls `alerts:since` with a cursor and calls `scheduleNotificationAsync` for each new alert, so the family hears about a place event even with no push service, for as long as the background task is running. This stops when the app is force-stopped.

## Conventions

- All timestamps: `Date.now()` ms.
- Roles ("mom", "dad", "firstborn", "kid", "youngest", "grandma", "grandpa", "custom") map to friendly labels in `src/lib/roles.ts` — e.g. "firstborn" → "First born"; `roleLabel` overrides when set.
- Avatar: shape ids from bloub (8 shapes), 12 colors, 16 expressions — ids defined by the ported bloub engine exports in `src/components/Bloub`.
- Free tile source: OpenFreeMap `https://tiles.openfreemap.org/styles/liberty` (MapLibre v11 API).
