import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useMyToken } from './identity';
import type { NestlyUser } from './identity';

export interface CircleInfo {
  _id: Id<'circles'>;
  name: string;
  code: string;
  ownerId: Id<'users'>;
  createdAt: number;
}

/**
 * Live circle + members with live presence (includes me — filter by
 * `member._id === me._id` where screens need to render self differently).
 */
export function useCircle(): {
  circle: CircleInfo | null;
  members: NestlyUser[];
  loading: boolean;
  inCircle: boolean;
} {
  const token = useMyToken();
  const data = useQuery(
    api.circles.get,
    token ? { token } : 'skip',
  );

  if (!data) {
    return { circle: null, members: [], loading: true, inCircle: false };
  }

  const { circle, members } = data;
  return {
    circle,
    members,
    loading: false,
    inCircle: !!circle,
  };
}
