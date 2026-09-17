// Drive mock family members so you can watch the app react: avatars change
// state (resting / walking / running / driving), place alerts fire, and SOS
// lands. Plain Node 24, no deps.
//
// Usage:
//   node tools/simulate.mjs --code=K9KXM4
//   node tools/simulate.mjs --code=K9KXM4 --interval=3000
//   node tools/simulate.mjs --code=K9KXM4 --reset
//
// Options:
//   --code=XXXXXX     invite code of the circle to join (required on first run)
//   --interval=4000   ms between ticks
//   --users=3         how many mock members to drive (1..5)
//   --lat / --lng     where the mocks live (default: Hyderabad)
//   --event-every=12  ticks between a place arrive/leave event
//   --sos-every=40    ticks between SOS events (0 disables)
//   --once            run one tick and exit
//   --reset           forget saved mock users and start fresh
//
// State is kept in .build-outputs/sim-state.json so re-runs reuse the same
// mock members and their tokens.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATE_DIR = join(ROOT, '.build-outputs');
const STATE_FILE = join(STATE_DIR, 'sim-state.json');

function readConvexUrl() {
  for (const envFile of ['.env', '.env.local']) {
    try {
      const raw = readFileSync(join(ROOT, envFile), 'utf8');
      const match = raw.match(/^EXPO_PUBLIC_CONVEX_URL=(.*)$/m);
      if (match) return match[1].trim();
    } catch {
      // try next file
    }
  }
  throw new Error('EXPO_PUBLIC_CONVEX_URL not found in .env or .env.local');
}

const CONVEX_URL = readConvexUrl();

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const m = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const INTERVAL_MS = Number(args.interval ?? 4000);
const USER_COUNT = Math.max(1, Math.min(5, Number(args.users ?? 3)));
const EVENT_EVERY = Number(args['event-every'] ?? 12);
const SOS_EVERY = Number(args['sos-every'] ?? 40);
const HOME_LAT = Number(args.lat ?? 17.385);
const HOME_LNG = Number(args.lng ?? 78.4867);

async function call(path, argsBody) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args: argsBody, format: 'json' }),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'network error' };
  const json = await res.json().catch(() => null);
  if (!json || json.status === 'error' || res.status !== 200) {
    return { ok: false, error: json?.errorMessage ?? json?.error ?? `HTTP ${res.status}` };
  }
  return { ok: true, value: json.value };
}

const ROSTER = [
  { name: 'Meera', role: 'mom', avatar: { shape: 'nuage', color: '#e152b0', expression: 'heureux' }, device: 'OPPO A57' },
  { name: 'Arjun', role: 'dad', avatar: { shape: 'squircle', color: '#3b93f0', expression: 'neutre' }, device: 'Samsung M32' },
  { name: 'Ira', role: 'kid', avatar: { shape: 'galet', color: '#2fa37c', expression: 'curieux' }, device: 'Redmi 10' },
  { name: 'Dadi', role: 'grandma', avatar: { shape: 'nuage', color: '#f26b4e', expression: 'heureux' }, device: 'Vivo Y15' },
  { name: 'Ravi', role: 'grandpa', avatar: { shape: 'goutte', color: '#8b6cf0', expression: 'attentif' }, device: 'Realme C3' },
];

// One full lap of these takes rest -> walk -> run -> drive -> rest.
const PHASES = [
  { key: 'rest', speed: 0, ticks: 6 },
  { key: 'walk', speed: 1.4, ticks: 8 },
  { key: 'run', speed: 3.4, ticks: 8 },
  { key: 'drive', speed: 13, ticks: 10 },
];

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LNG = 106.5;

function loadState() {
  if (args.reset || !existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function spawnUser(spec, index) {
  return {
    name: spec.name,
    role: spec.role,
    avatar: spec.avatar,
    device: spec.device,
    token: null,
    lat: HOME_LAT + (index - 1) * 0.004,
    lng: HOME_LNG + (index - 1) * 0.004,
    heading: (index * 97) % 360,
    speed: 0,
    battery: 70 + index * 5,
    isCharging: false,
    isLowPower: false,
    phaseIndex: index % PHASES.length,
    phaseTick: 0,
  };
}

async function registerAndJoin(user, code) {
  const reg = await call('auth:register', {
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  });
  if (!reg.ok) throw new Error(`register failed: ${reg.error}`);
  user.token = reg.value.token;
  if (code) {
    const join = await call('circles:join', { token: user.token, code, role: user.role });
    if (!join.ok) console.log(`  ${user.name} join: ${join.error}`);
  }
}

async function heartbeat(user) {
  const res = await call('presence:heartbeat', {
    token: user.token,
    lat: user.lat,
    lng: user.lng,
    accuracy: 10,
    speed: user.speed,
    heading: user.heading,
    battery: user.battery,
    isCharging: user.isCharging,
    isLowPower: user.isLowPower,
    deviceModel: user.device,
  });
  return res;
}

function advance(user, dtSec) {
  const phase = PHASES[user.phaseIndex];
  user.speed = phase.speed;
  user.phaseTick += 1;
  if (user.phaseTick >= phase.ticks) {
    user.phaseTick = 0;
    user.phaseIndex = (user.phaseIndex + 1) % PHASES.length;
    // New bearing each phase so trails wander instead of stacking.
    user.heading = (user.heading + 40 + Math.random() * 90) % 360;
  }
  if (user.speed > 0) {
    const rad = (user.heading * Math.PI) / 180;
    const km = (user.speed * dtSec) / 1000;
    user.lat += (Math.cos(rad) * km) / KM_PER_DEG_LAT;
    user.lng += (Math.sin(rad) * km) / KM_PER_DEG_LNG;
  }
  user.battery = Math.max(5, user.battery - (user.speed > 8 ? 0.3 : 0.05));
}

function phaseLabel(user) {
  // Classify from the actual speed, not the phase, because place events
  // override the commuter's speed mid-phase.
  const kmh = Math.round(user.speed * 3.6);
  if (!(user.speed >= 0.5)) return 'Resting';
  if (user.speed < 2) return `Walking ${kmh} km/h`;
  if (user.speed < 8) return `Running ${kmh} km/h`;
  return `Driving ${kmh} km/h`;
}

async function ensurePlace(state) {
  if (state.placeId) return;
  const owner = state.users[0];
  const res = await call('places:add', {
    token: owner.token,
    name: 'Mock Home',
    emoji: '',
    lat: HOME_LAT,
    lng: HOME_LNG,
    radiusM: 150,
    notifyOnArrive: true,
    notifyOnLeave: true,
  });
  if (res.ok) {
    state.placeId = res.value.placeId;
    console.log(`Created place "Mock Home" (${state.placeId})`);
  } else {
    console.log(`place create failed: ${res.error}`);
  }
}

async function placeEvent(state, type) {
  const commuter = state.users[0];
  const res = await call('places:recordPlaceEvent', {
    token: commuter.token,
    placeId: state.placeId,
    type,
  });
  if (res.ok) {
    console.log(`  -> ${commuter.name} ${type === 'arrive' ? 'arrived at' : 'left'} Mock Home`);
  } else {
    console.log(`  -> place event failed: ${res.error}`);
    if (String(res.error).includes('Place not found')) state.placeId = null;
  }
}

async function main() {
  console.log(`Convex: ${CONVEX_URL}`);
  let state = loadState();

  if (!state || !args.code || state.code !== args.code) {
    const code = args.code;
    if (!code) throw new Error('First run needs --code=XXXXXX (your family invite code)');
    state = {
      code,
      home: { lat: HOME_LAT, lng: HOME_LNG },
      placeId: null,
      placeInside: false,
      users: ROSTER.slice(0, USER_COUNT).map(spawnUser),
    };
    console.log(`Registering ${state.users.length} mock members into ${code}...`);
    for (const user of state.users) {
      await registerAndJoin(user, code);
      console.log(`  ${user.name} ready`);
    }
    await ensurePlace(state);
    saveState(state);
  } else {
    console.log(`Reusing ${state.users.length} mock members in ${state.code}`);
    const owner = state.users[0];
    const probe = await heartbeat(owner);
    if (!probe.ok && String(probe.error).includes('token')) {
      console.log('  saved token expired, re-registering');
      for (const user of state.users) {
        await registerAndJoin(user, state.code);
      }
    }
    await ensurePlace(state);
  }

  console.log(`\nDriving members every ${INTERVAL_MS}ms. Ctrl+C to stop.\n`);

  let tick = 0;
  const run = async () => {
    tick += 1;
    for (const user of state.users) {
      advance(user, INTERVAL_MS / 1000);
      const res = await heartbeat(user);
      if (!res.ok) console.log(`  ${user.name} heartbeat: ${res.error}`);
    }

    if (EVENT_EVERY > 0 && tick % EVENT_EVERY === 0 && state.placeId) {
      const commuter = state.users[0];
      if (!state.placeInside) {
        commuter.lat = HOME_LAT + 0.0004; // ~45 m: inside the 150 m radius
        commuter.lng = HOME_LNG;
        commuter.speed = 1.2;
        await heartbeat(commuter);
        await placeEvent(state, 'arrive');
        state.placeInside = true;
      } else {
        commuter.lat = HOME_LAT + 0.004; // ~440 m: outside
        commuter.lng = HOME_LNG;
        commuter.speed = 11;
        await heartbeat(commuter);
        await placeEvent(state, 'leave');
        state.placeInside = false;
      }
      saveState(state);
    }

    if (SOS_EVERY > 0 && tick % SOS_EVERY === 0) {
      const user = state.users[tick % state.users.length];
      const res = await call('alerts:sos', {
        token: user.token,
        payload: { msg: 'Simulated SOS' },
      });
      console.log(`  -> SOS from ${user.name}${res.ok ? '' : ` (${res.error})`}`);
    }

    const line = state.users
      .map((u) => `${u.name} ${phaseLabel(u)}`)
      .join('  |  ');
    console.log(`[t${String(tick).padStart(3, '0')}] ${line}`);
  };

  await run();
  if (args.once) return;

  const timer = setInterval(() => {
    run().catch((err) => console.error('tick failed:', err.message));
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(timer);
    saveState(state);
    console.log('\nStopped. Mock state saved.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
