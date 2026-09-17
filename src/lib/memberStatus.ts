import { timeAgo } from './utils';
import type { NestlyUser } from './identity';

export type MemberMood = {
  state: string;
  expression: string;
  label: string;
  tint: 'ok' | 'warn' | 'off';
};

/** How a member is moving, in metres per second. */
export type MotionKey = 'still' | 'walk' | 'run' | 'drive';

/** Boundaries in m/s. Walking is ~1.4, running ~3, city driving ~12. */
const STILL_MAX = 0.5;
const WALK_MAX = 2.0;
const RUN_MAX = 8.0;
const STALE_MS = 8 * 60 * 1000;

/**
 * The single classifier for movement. Every screen reads motion through this
 * so the map chip and the family row can never disagree again.
 */
export function motionKey(speed?: number | null): MotionKey {
  const s = speed ?? 0;
  if (!Number.isFinite(s) || s < STILL_MAX) return 'still';
  if (s < WALK_MAX) return 'walk';
  if (s < RUN_MAX) return 'run';
  return 'drive';
}

export function motionLabel(speed?: number | null): string {
  const kmh =
    speed != null && Number.isFinite(speed) && speed >= 0
      ? Math.round(speed * 3.6)
      : null;
  const key = motionKey(speed);
  const suffix = kmh != null ? ` · ${kmh} km/h` : '';
  switch (key) {
    case 'walk':
      return `Walking${suffix}`;
    case 'run':
      return `Running${suffix}`;
    case 'drive':
      return `Driving${suffix}`;
    default:
      return 'Resting';
  }
}

/** State + expression the avatar uses for each motion band. */
const MOTION_VISUAL: Record<
  MotionKey,
  { state: string; expression: string; tint: MemberMood['tint'] }
> = {
  still: { state: 'idle', expression: 'heureux', tint: 'ok' },
  walk: { state: 'wide', expression: 'curieux', tint: 'ok' },
  run: { state: 'orbit', expression: 'excite', tint: 'ok' },
  drive: { state: 'comet', expression: 'excite', tint: 'ok' },
};

/**
 * Turns a member's live data into a bloub mood: what the avatar shows and
 * what one short line says about them. This is how avatars "react" to data.
 *
 * Pass `now` from a ticking hook so the staleness rule re-evaluates without
 * waiting for an unrelated query to re-render the screen.
 */
export function memberMood(user: NestlyUser, now: number = Date.now()): MemberMood {
  const stale = !user.lastSeen || now - user.lastSeen > STALE_MS;

  if (stale) {
    return {
      state: 'sleep',
      expression: 'somnolent',
      label: `Last seen ${timeAgo(user.lastSeen)}`,
      tint: 'off',
    };
  }

  if (user.isLowPower && user.battery != null && user.battery <= 15 && !user.isCharging) {
    return {
      state: 'alert',
      expression: 'effraye',
      label: `Low battery · ${Math.round(user.battery)}%`,
      tint: 'warn',
    };
  }

  const key = motionKey(user.speed);
  if (key !== 'still') {
    const visual = MOTION_VISUAL[key];
    return {
      state: visual.state,
      expression: visual.expression,
      label: motionLabel(user.speed),
      tint: visual.tint,
    };
  }

  if (user.battery != null && user.battery <= 15 && user.isCharging) {
    return {
      state: 'notify',
      expression: 'heureux',
      label: 'Charging up',
      tint: 'ok',
    };
  }

  return {
    state: 'idle',
    expression: 'heureux',
    label: 'Resting',
    tint: 'ok',
  };
}

export function batteryLabel(user: NestlyUser): {
  text: string;
  tint: MemberMood['tint'];
} | null {
  if (user.battery == null) return null;
  const pct = Math.round(user.battery);
  if (user.isCharging) return { text: `${pct}% · charging`, tint: 'ok' };
  if (pct <= 15) return { text: `${pct}% · low`, tint: 'warn' };
  return { text: `${pct}%`, tint: 'ok' };
}
