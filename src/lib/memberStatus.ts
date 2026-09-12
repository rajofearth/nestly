import { timeAgo } from './utils';
import type { NestlyUser } from './identity';

export type MemberMood = {
  state: string;
  expression: string;
  label: string;
  tint: 'ok' | 'warn' | 'off';
};

/**
 * Turns a member's live data into a bloub mood: what the avatar shows and
 * what one short line says about them. This is how avatars "react" to data.
 */
export function memberMood(user: NestlyUser): MemberMood {
  const stale = !user.lastSeen || Date.now() - user.lastSeen > 8 * 60 * 1000;

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

  const speed = user.speed ?? 0;
  if (speed > 2.2) {
    const kmh = Math.round(speed * 3.6);
    return {
      state: 'comet',
      expression: speed > 8.3 ? 'excite' : 'fier',
      label: `On the move · ${kmh} km/h`,
      tint: 'ok',
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
