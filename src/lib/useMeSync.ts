import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useIdentity, useMyToken, type NestlyUser } from './identity';

/**
 * Subscribes to `auth.me` for the current token and mirrors it into the
 * identity store. Returns the remote value: undefined = loading,
 * null = token invalid/deleted, else the live user doc.
 */
export function useMeSync(): NestlyUser | null | undefined {
  const token = useMyToken();
  const me = useIdentity((s) => s.me);
  const setMe = useIdentity((s) => s.setMe);
  const remote = useQuery(api.auth.me, token ? { token } : 'skip');
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (remote === undefined) return;
    // The query may emit a fresh object identity on every poll even when the
    // doc is unchanged; only mirror it into the store when it actually differs.
    const key = remote === null ? 'null' : JSON.stringify(remote);
    if (lastSynced.current === key) return;
    lastSynced.current = key;
    setMe(remote as NestlyUser | null);
  }, [remote, setMe]);

  if (remote === undefined) return token ? undefined : null;
  return (remote as NestlyUser | null) ?? me ?? null;
}
