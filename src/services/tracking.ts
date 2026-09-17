import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import type { Id } from '../../convex/_generated/dataModel';
import { haversineMeters } from '../lib/utils';
import { presentAlertNotification } from './notify';

export const BACKGROUND_TASK = 'nestly-location-task';
const KEY_TOKEN = 'nestly.task.token';
const KEY_PLACES = 'nestly.task.places';
const KEY_GEOFENCE_STATE = 'nestly.task.geofence';
const KEY_SHARING = 'nestly.task.sharing';
const KEY_ALERT_CURSOR = 'nestly.task.alertCursor';

const HEARTBEAT_MS = 12_000;
const BREADCRUMB_MS = 60_000;
const ALERT_POLL_MS = 20_000;

// A fix whose accuracy radius is larger than this cannot be trusted for speed.
const ACCURACY_GATE_M = 60;
// 100 m/s is roughly 360 km/h: above this the sample is garbage.
const MAX_PLAUSIBLE_MPS = 100;

interface CachedPlace {
  _id: Id<'places'>;
  lat: number;
  lng: number;
  radiusM: number;
  notifyOnArrive: boolean;
  notifyOnLeave: boolean;
}

interface GeofenceState {
  [placeId: string]: boolean; // inside?
}

interface SinceAlert {
  _id: string;
  type: string;
  fromUserId: string;
  fromName: string;
  ts: number;
  payload?: { name?: string; placeName?: string; kind?: string } | null;
}

export async function setSharingEnabled(enabled: boolean) {
  await AsyncStorage.setItem(KEY_SHARING, enabled ? '1' : '0');
}

export async function getSharingEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_SHARING)) !== '0';
}

export async function cacheTaskContext(token: string | null, places: unknown) {
  if (token) await AsyncStorage.setItem(KEY_TOKEN, token);
  await AsyncStorage.setItem(KEY_PLACES, JSON.stringify(places ?? []));
}

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Drops null and undefined so the server never has to accept them. */
function compact(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== null && value !== undefined),
  );
}

let lastHeartbeat = 0;
let lastBreadcrumb = 0;
let lastAlertPoll = 0;
let lastFix: { lat: number; lng: number; ts: number } | null = null;

/**
 * Rejects the two failure modes that produced nonsense speeds: a bad fix that
 * reports a huge speed while the phone sits still, and a good fix whose OS
 * speed is missing or zero while the phone is actually moving.
 *
 * The displacement between two fixes is the harder evidence. If the phone did
 * not move further than its own accuracy radius, it is still. Otherwise the
 * accepted speed is bounded by the distance actually travelled, and the
 * displacement itself is used when the OS value is missing.
 */
function speedFromFix(loc: Location.LocationObject): number {
  const raw = loc.coords.speed;
  const accuracy = loc.coords.accuracy ?? 9999;
  const ts = loc.timestamp ?? Date.now();
  const lat = loc.coords.latitude;
  const lng = loc.coords.longitude;
  const prev = lastFix;
  lastFix = { lat, lng, ts };

  const reported =
    raw != null && Number.isFinite(raw) && raw >= 0 && raw <= MAX_PLAUSIBLE_MPS
      ? raw
      : 0;
  const gated = accuracy <= ACCURACY_GATE_M ? reported : 0;

  if (!prev) return gated;

  const dt = (ts - prev.ts) / 1000;
  if (dt <= 0) return gated;

  const moved = haversineMeters(prev.lat, prev.lng, lat, lng);
  const noise = Math.max(accuracy, 10);
  if (moved <= noise) return 0;

  const derived = moved / dt;
  const candidate = Math.max(gated, derived);
  return Math.min(candidate, derived * 3 + 1);
}

async function sendHeartbeat(token: string, loc: Location.LocationObject, speed: number) {
  const now = Date.now();
  if (now - lastHeartbeat < HEARTBEAT_MS) return;
  lastHeartbeat = now;

  let battery: number | null = null;
  let isCharging: boolean | null = null;
  let isLowPower: boolean | null = null;
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    battery = level * 100;
    isCharging =
      state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    isLowPower = await Battery.isLowPowerModeEnabledAsync();
  } catch {
    // battery unavailable — send nulls
  }

  await postMutation('presence:heartbeat', compact({
    token,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    speed,
    heading: loc.coords.heading,
    battery,
    isCharging,
    isLowPower,
    deviceModel: Device.modelName ?? null,
  }));
}

async function sendBreadcrumb(token: string, loc: Location.LocationObject, speed: number) {
  const now = Date.now();
  if (now - lastBreadcrumb < BREADCRUMB_MS) return;
  lastBreadcrumb = now;
  await postMutation('presence:breadcrumb', {
    token,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speed,
  });
}

let convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? '';
export function setConvexUrl(url: string) {
  if (url) convexUrl = url;
}

// Background-safe HTTP (no convex client in task context).
async function postMutation(path: string, args: Record<string, unknown>) {
  try {
    await fetch(`${convexUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    });
  } catch {
    // offline — next tick retries
  }
}

async function recordPlaceEvent(
  token: string,
  placeId: string,
  type: 'arrive' | 'leave',
) {
  await postMutation('places:recordPlaceEvent', { token, placeId, type });
}

function alertCopy(alert: SinceAlert): { title: string; body: string } {
  const payload = alert.payload ?? {};
  switch (alert.type) {
    case 'sos':
      return {
        title: `SOS from ${alert.fromName}`,
        body: `${alert.fromName} needs help right now`,
      };
    case 'memberJoined':
      return {
        title: `${payload.name ?? alert.fromName} joined the nest`,
        body: 'Say welcome',
      };
    case 'arrive':
      return { title: `${alert.fromName} arrived`, body: payload.placeName ?? 'A place' };
    case 'leave':
      return { title: `${alert.fromName} left`, body: payload.placeName ?? 'A place' };
    case 'checkin':
      return payload.kind === 'responded'
        ? { title: `${alert.fromName} checked in`, body: 'They marked themselves as OK' }
        : { title: `${alert.fromName} asked for a check-in`, body: "Let them know you're OK" };
    case 'batteryLow':
      return {
        title: `${alert.fromName}'s battery is low`,
        body: 'Their phone might die soon',
      };
    default:
      return { title: 'Family update', body: '' };
  }
}

/**
 * The app is the one doing the communicating: poll the alert feed this device
 * is allowed to see, and raise a local notification for anything new. The
 * cursor lives in AsyncStorage so the same alert never notifies twice.
 */
async function pollAlerts(token: string) {
  const now = Date.now();
  if (now - lastAlertPoll < ALERT_POLL_MS) return;
  lastAlertPoll = now;

  const raw = await AsyncStorage.getItem(KEY_ALERT_CURSOR);
  if (raw == null) {
    // First run on this device: start from now, do not replay old history.
    await AsyncStorage.setItem(KEY_ALERT_CURSOR, String(now));
    return;
  }
  const cursor = Number(raw) || 0;

  let rows: SinceAlert[] = [];
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'alerts:since',
        args: { token, since: cursor },
        format: 'json',
      }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { value?: unknown };
    if (Array.isArray(json.value)) rows = json.value as SinceAlert[];
  } catch {
    return;
  }

  let newest = cursor;
  for (const alert of rows) {
    try {
      await presentAlertNotification({
        ...alertCopy(alert),
        data: { kind: alert.type, alertId: alert._id },
      });
    } catch {
      // permission revoked or channel missing — skip, cursor still advances
    }
    newest = Math.max(newest, alert.ts);
  }
  if (newest > cursor) {
    await AsyncStorage.setItem(KEY_ALERT_CURSOR, String(newest));
  }
}

export async function handleLocationUpdate(loc: Location.LocationObject) {
  const token = await AsyncStorage.getItem(KEY_TOKEN);
  if (!token) return;

  // Alerts are for this device to read even while it is not sharing.
  await pollAlerts(token);

  const sharing = await getSharingEnabled();
  if (!sharing) return;

  // One speed decision per fix, shared by the heartbeat and the breadcrumb.
  const speed = speedFromFix(loc);
  await sendHeartbeat(token, loc, speed);
  await sendBreadcrumb(token, loc, speed);

  const places = readJson<CachedPlace[]>(await AsyncStorage.getItem(KEY_PLACES), []);
  if (places.length > 0) {
    const state = readJson<GeofenceState>(
      await AsyncStorage.getItem(KEY_GEOFENCE_STATE),
      {},
    );
    let changed = false;
    for (const place of places) {
      const dist = haversineMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        place.lat,
        place.lng,
      );
      const inside = dist <= place.radiusM;
      const was = state[place._id] ?? false;
      if (inside && !was) {
        state[place._id] = true;
        changed = true;
        await recordPlaceEvent(token, place._id, 'arrive');
      } else if (!inside && was) {
        state[place._id] = false;
        changed = true;
        await recordPlaceEvent(token, place._id, 'leave');
      }
    }
    if (changed) {
      await AsyncStorage.setItem(KEY_GEOFENCE_STATE, JSON.stringify(state));
    }
  }
}

/** Foreground entry point: poll the alert feed even when the device is still. */
export async function checkAlerts(token: string) {
  await pollAlerts(token);
}

if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error) return;
    const { locations } = data as { locations: Location.LocationObject[] };
    for (const loc of locations) {
      await handleLocationUpdate(loc);
    }
  });
}

export async function startBackgroundTracking() {
  const { granted } = await Location.getBackgroundPermissionsAsync();
  if (!granted) return false;
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
  if (started) return true;
  lastFix = null;
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Balanced,
    // Deliver on time even when standing still, so a parked phone reports
    // speed 0 instead of freezing at its last driving speed.
    distanceInterval: 0,
    timeInterval: 15_000,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Nestly is keeping watch',
      notificationBody: 'Sharing your location with your family circle.',
      killServiceOnDestroy: false,
    },
    showsBackgroundLocationIndicator: false,
  });
  return true;
}

export async function stopBackgroundTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
  if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
}

// Foreground telemetry: same pipeline as the background task (heartbeat with
// 12s throttle, geofence checks) but callable from screens while the app is
// open. Wire into a watchPositionAsync callback.
export async function recordLiveLocation(loc: Location.LocationObject) {
  await handleLocationUpdate(loc);
}
