// Seed mock family members into a real circle. Plain Node 24, no deps.
// Usage: node tools/seed-mocks.mjs
// Read .env for EXPO_PUBLIC_CONVEX_URL, register 4 mocks, join circle UVDTK4,
// send heartbeats + breadcrumbs, print a summary table.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CIRCLE_CODE = 'UVDTK4';

function readConvexUrl() {
  for (const envFile of ['.env', '.env.local']) {
    try {
      const raw = readFileSync(join(__dirname, '..', envFile), 'utf8');
      const match = raw.match(/^EXPO_PUBLIC_CONVEX_URL=(.*)$/m);
      if (match) return match[1].trim();
    } catch {
      // try next file
    }
  }
  throw new Error('EXPO_PUBLIC_CONVEX_URL not found in .env or .env.local');
}

const CONVEX_URL = readConvexUrl();

async function callMutation(path, args) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const json = await res.json();
  if (json.status === 'error' || res.status !== 200) {
    const msg = json?.errorMessage ?? json?.error ?? `HTTP ${res.status} for ${path}`;
    throw new Error(msg);
  }
  return json.value;
}

async function callQuery(path, args) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const json = await res.json();
  if (json.status === 'error' || res.status !== 200) {
    const msg = json?.errorMessage ?? json?.error ?? `HTTP ${res.status} for ${path}`;
    throw new Error(msg);
  }
  return json.value;
}

// Haversine distance in km (same formula as src/lib/utils.ts).
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Home = Meera's coords.
const HOME = { lat: 24.585, lng: 73.7118 };

const MEMBERS = [
  {
    name: 'Meera',
    role: 'mom',
    avatar: { shape: 'nuage', color: '#e152b0', expression: 'heureux' },
    lat: 24.585,
    lng: 73.7118,
    speed: 0,
    battery: 84,
    isCharging: true,
    isLowPower: false,
    deviceModel: 'OPPO A57',
    heading: 0,
  },
  {
    name: 'Arjun',
    role: 'dad',
    avatar: { shape: 'squircle', color: '#3b93f0', expression: 'neutre' },
    lat: 24.5962,
    lng: 73.705,
    speed: 6.9,
    battery: 42,
    isCharging: false,
    isLowPower: false,
    deviceModel: 'Samsung M32',
    heading: 210,
  },
  {
    name: 'Ira',
    role: 'kid',
    avatar: { shape: 'galet', color: '#2fa37c', expression: 'curieux' },
    lat: 24.582,
    lng: 73.695,
    speed: 0.4,
    battery: 91,
    isCharging: false,
    isLowPower: false,
    deviceModel: 'Redmi 10',
    heading: 95,
  },
  {
    name: 'Dadi',
    role: 'grandma',
    avatar: { shape: 'nuage', color: '#f26b4e', expression: 'heureux' },
    lat: 24.5848,
    lng: 73.7131,
    speed: 0,
    battery: 18,
    isCharging: false,
    isLowPower: true,
    deviceModel: 'Vivo Y15',
    heading: 0,
  },
];

// 1 deg lat ≈ 111.32 km, 1 deg lng ≈ 100.9 km at this latitude (~24.58N).
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 100.9;

// Build a short path of n points ending at (lat, lng), walking backwards
// along a given bearing so trails look like an approach to the live point.
function makeTrail(lat, lng, speed, n) {
  const points = [];
  const bearingRad = ((90 + Math.random() * 120) * Math.PI) / 180; // wander E-SE
  const stepKm = (speed * 60) / 1000; // one breadcrumb per minute-ish
  let curLat = lat;
  let curLng = lng;
  for (let i = 0; i < n; i++) {
    points.unshift({ lat: curLat, lng: curLng, speed });
    curLat -= (Math.cos(bearingRad) * stepKm) / KM_PER_DEG_LAT;
    curLng -= (Math.sin(bearingRad) * stepKm) / KM_PER_DEG_LNG;
  }
  return points;
}

async function seedMember(m) {
  const reg = await callMutation('auth:register', {
    name: m.name,
    role: m.role,
    avatar: m.avatar,
  });
  const token = reg.token;
  console.log(`  registered ${m.name} — token: ${token}`);

  try {
    await callMutation('circles:join', { token, code: CIRCLE_CODE, role: m.role });
    console.log(`  ${m.name} joined circle ${CIRCLE_CODE}`);
  } catch (err) {
    console.log(`  ${m.name} join failed (continuing): ${err.message}`);
  }

  // Heartbeat regardless of join outcome.
  await callMutation('presence:heartbeat', {
    token,
    lat: m.lat,
    lng: m.lng,
    accuracy: 12,
    speed: m.speed,
    heading: m.heading,
    battery: m.battery,
    isCharging: m.isCharging,
    isLowPower: m.isLowPower,
    deviceModel: m.deviceModel,
  });
  console.log(`  ${m.name} heartbeat sent`);

  // Breadcrumbs: 5-8 points forming a short path near their coords.
  const n = 5 + Math.floor(Math.random() * 4);
  const trail = makeTrail(m.lat, m.lng, m.speed, n);
  for (const p of trail) {
    await callMutation('presence:breadcrumb', {
      token,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
    });
  }
  console.log(`  ${m.name}: ${trail.length} breadcrumbs inserted`);

  return { token, trailPoints: trail.length };
}

async function main() {
  console.log(`Convex URL: ${CONVEX_URL}`);
  console.log(`Seeding ${MEMBERS.length} mock members into circle ${CIRCLE_CODE}\n`);

  const results = new Map();
  for (const m of MEMBERS) {
    try {
      const { token, trailPoints } = await seedMember(m);
      results.set(m.name, { ...m, token, trailPoints });
    } catch (err) {
      console.error(`  FAILED for ${m.name}: ${err.message}`);
      results.set(m.name, { ...m, token: '(failed)', trailPoints: 0 });
    }
  }

  // Verify circle exists via getByCode.
  console.log('');
  try {
    const circle = await callQuery('circles:getByCode', { code: CIRCLE_CODE });
    if (circle) {
      console.log(`Verified circle ${CIRCLE_CODE}: "${circle.name}"`);
    } else {
      console.log(`WARNING: circles:getByCode returned null for ${CIRCLE_CODE}`);
    }
  } catch (err) {
    console.log(`circles:getByCode failed: ${err.message}`);
  }

  // Summary table.
  console.log('\nSummary:');
  console.log(
    ['Name', 'Role', 'Battery', 'Dist-from-home(km)', 'Trail', 'Token'].map((h) =>
      h.padEnd(20),
    ).join(''),
  );
  console.log('-'.repeat(120));
  for (const [name, r] of results) {
    const dist = haversineKm(HOME.lat, HOME.lng, r.lat, r.lng).toFixed(2);
    console.log(
      [
        name,
        r.role,
        `${r.battery}%${r.isCharging ? ' (charging)' : ''}`,
        dist,
        String(r.trailPoints),
        r.token,
      ]
        .map((c, i) => String(c).padEnd(i === 5 ? 60 : 20))
        .join(''),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
