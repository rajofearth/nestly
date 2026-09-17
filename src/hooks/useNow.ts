import { useEffect, useState } from 'react';

/**
 * A clock that ticks on an interval. Screens pass its value into `memberMood`
 * so time-based transitions (a member going offline) show up without waiting
 * for the next Convex query to arrive.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
