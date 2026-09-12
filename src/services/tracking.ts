import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import type { Id } from '../../convex/_generated/dataModel';
import { haversineMeters } from '../lib/utils';

export const BACKGROUND_TASK = 'nestly-location-task';
const KEY_TOKEN = 'nestly.task.token';
const KEY_PLACES = 'nestly.task.places';
const KEY_GEOFENCE_STATE = 'nestly.task.geofence';
const KEY_SHARING = 'nestly.task.sharing';

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

let lastHeartbeat = 0;

async function sendHeartbeat(token: string, loc: Location.LocationObject) {
  const now = Date.now();
  if (now - lastHeartbeat < 12_000) return;
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

  await fetchHeartbeat(token, {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    speed: loc.coords.speed,
    heading: loc.coords.heading,
    battery,
    isCharging,
    isLowPower,
    deviceModel: Device.modelName ?? null,
  });
}

let convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? '';
export function setConvexUrl(url: string) {
  if (url) convexUrl = url;
}

// Background-safe fetch (no convex client in task context — plain HTTP).
async function fetchHeartbeat(
  token: string,
  body: Record<string, unknown>,
) {
  try {
    await fetch(`${convexUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'presence:heartbeat',
        args: { token, ...body },
        format: 'json',
      }),
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
  try {
    await fetch(`${convexUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'places:recordPlaceEvent',
        args: { token, placeId, type },
        format: 'json',
      }),
    });
  } catch {
    // offline
  }
}

export async function handleLocationUpdate(loc: Location.LocationObject) {
  const token = await AsyncStorage.getItem(KEY_TOKEN);
  if (!token) return;
  const sharing = await getSharingEnabled();
  if (!sharing) return;


  await sendHeartbeat(token, loc);

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
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 15,
    timeInterval: 20_000,
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


