import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useMyToken } from '../lib/identity';
import { ensureAlertChannel, ensureNotificationPermission } from './notify';

/**
 * Gets the device ready to receive alerts: notification permission, the
 * Android channel, then the Expo push token. Each step is independent, so a
 * build without Firebase still gets permission and the channel for local
 * notifications (see `notify.ts`).
 */
export async function registerPushAndReport(): Promise<string | null> {
  let granted = false;
  try {
    granted = await ensureNotificationPermission();
    await ensureAlertChannel();
  } catch {
    return null;
  }
  if (!granted) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return expoToken.data;
  } catch {
    // No Firebase config on this build — local notifications still work.
    return null;
  }
}

/** Hook version: registers the push token with the backend once ready. */
export function usePushRegistration() {
  const token = useMyToken();
  const setPushToken = useMutation(api.auth.setPushToken);
  return async () => {
    if (!token) return;
    const pushToken = await registerPushAndReport();
    if (pushToken) {
      setPushToken({ token, pushToken }).catch(() => {});
    }
  };
}
