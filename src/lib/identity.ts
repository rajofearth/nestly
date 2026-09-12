import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Id } from '../../convex/_generated/dataModel';

const KEY_TOKEN = 'nestly.token';

export interface Avatar {
  shape: string;
  color: string;
  expression: string;
}

export interface NestlyUser {
  _id: Id<'users'>;
  _creationTime: number;
  name: string;
  role: string;
  roleLabel?: string | null;
  avatar: Avatar;
  circleId?: Id<'circles'> | null;
  isOwner: boolean;
  pushToken?: string | null;
  // Live presence fields (flat on the user doc, updated by heartbeat).
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  battery?: number | null;
  isCharging?: boolean | null;
  isLowPower?: boolean | null;
  deviceModel?: string | null;
  lastSeen?: number | null;
}

interface IdentityState {
  status: 'loading' | 'signedOut' | 'ready';
  token: string | null;
  me: NestlyUser | null;
  bootstrap: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setMe: (user: NestlyUser | null) => void;
}

export const useIdentity = create<IdentityState>((set) => ({
  status: 'loading',
  token: null,
  me: null,

  bootstrap: async () => {
    const stored = await SecureStore.getItemAsync(KEY_TOKEN);
    if (!stored) {
      set({ status: 'signedOut', token: null, me: null });
      return;
    }
    set({ status: 'ready', token: stored });
  },

  signIn: async (token) => {
    await SecureStore.setItemAsync(KEY_TOKEN, token);
    set({ status: 'ready', token });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(KEY_TOKEN);
    set({ status: 'signedOut', token: null, me: null });
  },

  setMe: (user) => set({ me: user }),
}));

export function useMyToken(): string | null {
  return useIdentity((s) => s.token);
}

export function useMe(): NestlyUser | null {
  return useIdentity((s) => s.me);
}
