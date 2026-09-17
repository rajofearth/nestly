export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const PLACE_EMOJIS = [
  '🏠', '🎒', '🏫', '⚽', '🛒', '🎹', '🩺', '🕌', '🛕', '⛪', '🚉', '🏢', '🥅', '🌳', '🍔', '💊',
];

export const CIRCLE_NAME_PLACEHOLDERS = [
  'The Morning Nest',
  'Team Homebase',
  'The Cozy Ones',
  'Nest HQ',
  'The Fam Squad',
];

export function timeAgo(ts?: number | null): string {
  if (!ts) return 'a while';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return 'long ago';
}

export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
