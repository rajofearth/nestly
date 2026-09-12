import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const KEY_PENDING = 'nestly.pendingLogs';
const PENDING_CAP = 50;
const MAX_POSTS_PER_MIN = 10;

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? '';

const device = `${Device.modelName ?? '?'} · Android ${Device.osVersion ?? '?'}`;
const appVersion = Constants.expoConfig?.version ?? '?';

interface LogEntry {
  level: 'crash' | 'error' | 'warn' | 'info';
  tag: string;
  message: string;
  stack?: string;
}

const postTimestamps: number[] = [];
let lastSignature = '';
let lastSignatureTs = 0;

function signature(entry: LogEntry): string {
  return `${entry.level}|${entry.tag}|${entry.message}`;
}

function throttled(entry: LogEntry): boolean {
  const now = Date.now();
  while (postTimestamps.length > 0 && now - postTimestamps[0] >= 60_000) {
    postTimestamps.shift();
  }
  if (postTimestamps.length >= MAX_POSTS_PER_MIN) return true;
  if (signature(entry) === lastSignature && now - lastSignatureTs < 60_000) {
    return true;
  }
  postTimestamps.push(now);
  lastSignature = signature(entry);
  lastSignatureTs = now;
  return false;
}

function post(entry: LogEntry) {
  if (throttled(entry)) return;
  void fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'logs:post',
      args: { ...entry, device, appVersion },
      format: 'json',
    }),
  }).catch(() => {
    // offline — entry already persisted as pending
  });
}

async function persistPending(entry: LogEntry) {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING);
    const arr = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    arr.push(entry);
    await AsyncStorage.setItem(KEY_PENDING, JSON.stringify(arr.slice(-PENDING_CAP)));
  } catch {
    // storage unavailable — nothing more we can do
  }
}

async function flushPending() {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING);
    if (!raw) return;
    const arr = JSON.parse(raw) as LogEntry[];
    await AsyncStorage.removeItem(KEY_PENDING);
    for (const entry of arr) {
      if (throttled(entry)) {
        await persistPending(entry);
      } else {
        void fetch(`${convexUrl}/api/mutation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'logs:post',
            args: { ...entry, device, appVersion },
            format: 'json',
          }),
        }).catch(() => {});
      }
    }
  } catch {
    // ignore flush failures
  }
}

export function logError(tag: string, message: string, error?: unknown) {
  const stack =
    error instanceof Error
      ? (error.stack ?? `${error.name}: ${error.message}`)
      : error != null
        ? String(error)
        : undefined;
  const entry: LogEntry = { level: 'error', tag, message, stack };
  void persistPending(entry);
  post(entry);
}

export function logEvent(tag: string, message?: string) {
  post({ level: 'info', tag, message: message ?? tag });
}

export function installGlobalErrorHandlers() {
  void flushPending();

  try {
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('unhandledrejection', (event) => {
        const reason = (event as { reason?: unknown })?.reason ?? 'unknown rejection';
        logError(
          'unhandled-rejection',
          reason instanceof Error ? reason.message : String(reason),
          reason instanceof Error ? reason : undefined,
        );
      });
    }
  } catch {
    // addEventListener unavailable — skip
  }

  try {
    const eu = (
      global as typeof globalThis & {
        ErrorUtils?: {
          getGlobalHandler?: () =>
            | ((error: unknown, isFatal?: boolean) => void)
            | undefined;
          setGlobalHandler?: (
            handler: (error: unknown, isFatal?: boolean) => void,
          ) => void;
        };
      }
    ).ErrorUtils;
    const prev = eu?.getGlobalHandler?.();
    eu?.setGlobalHandler?.((error, isFatal) => {
      const entry: LogEntry = {
        level: 'crash',
        tag: 'global',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      void persistPending(entry);
      post(entry);
      prev?.(error, isFatal);
    });
  } catch {
    // ErrorUtils unavailable — skip
  }
}
