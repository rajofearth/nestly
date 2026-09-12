# Nestly — 2-device test script

Practical pass for a family of two physical Android devices (arm64). No
emulator needed. Data lives on the deployed Convex dev deployment
(`adept-whale-546`) — expect leftovers from earlier runs.

## Setup

1. Install `.build-outputs/nestly-v1.0.0.apk` on both devices (debug-keystore
   signed test build).
2. Device A: open app → "Create a family nest" → pick a role → name the nest.
   Note the invite code from the Family tab.
3. Device B: open app → "Join with an invite code" → enter the 6-char code.

Verify during onboarding:

- [ ] Bloub preview changes shape/color/expression with the selected role.
- [ ] Wrong code shows "That code does not exist — check with the sender".
- [ ] After join, Device A gets a "joined the nest" alert and both land on the map tab.

## Map (Nest tab)

- [ ] Both markers visible; tapping a member marker opens their detail sheet.
- [ ] Own marker follows movement (foreground GPS).
- [ ] Long-press the SOS button → confirm sheet → confirm. Device B shows the
      SOS alert and the map's alert badge increments.

## Presence reactions (member moods)

- [ ] Carry one device while walking/driving: its bloub switches to `comet`
      with an "On the move · N km/h" label; expression escalates past ~30 km/h.
- [ ] Plug a low (< 15%) device in: mood flips to "Charging up".
- [ ] Airplane-mode a device for 8+ minutes: its bloub goes to sleep with
      "Last seen …".
- [ ] Battery percentage pill matches the OS readout on the Me tab.

## Places and geofence nudges

- [ ] Device A creates a place (emoji + pin + radius 100 m) with "notify on
      arrive" on.
- [ ] Walk/drive into the radius on Device B: A gets an "arrived at" alert.
      Leave the radius: a "left" alert. Each crossing fires once (edge-triggered),
      not repeatedly while inside.
- [ ] Places tab history shows both events with member names.
- [ ] Deleting a place removes its event history.

## Check-ins

- [ ] Device A: member detail → request check-in from B. B sees the pending
      request and a push (if configured — see Limitations).
- [ ] B confirms "I'm OK": A gets the "checked in" alert.
- [ ] Only one pending request resolves per respond (latest wins).

## Chat

- [ ] Messages appear on both devices in realtime, grouped by sender and day.
- [ ] Empty message is rejected; > 2000 chars is rejected.

## Family / Me

- [ ] Share invite code via the Android share sheet; regenerate code (owner
      only) invalidates the old one.
- [ ] Owner can remove the member; removed member is bounced to onboarding on
      next sync.
- [ ] Me tab: avatar edits (shape/color/expression) propagate to the other
      device's member list live.
- [ ] Location-sharing toggle off on Device B stops its marker updates.

## Known limitations

- **Push is in-app only** until Firebase is configured (`docs/PUSH_SETUP.md`):
  alerts appear in the app but no system notifications.
- **Debug-keystore signing**: the APK is signed with the debug keystore — fine
  for sideloading, not for Play Store.
- **Dev deployment data**: the backend is a Convex dev deployment; test data
  from previous runs may appear. Circles are joined by code, so old codes from
  prior installs can surface.
- Background delivery depends on OEM battery optimization; force-pinned/killed
  apps stop heartbeats (the member just goes stale after 8 minutes).
