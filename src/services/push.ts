import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useMyToken } from '../lib/identity';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushAndReport(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    await Notifications.setNotificationChannelAsync('nestly-alerts', {
      name: 'Family alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B4A',
    });

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return expoToken.data;
  } catch {
    // No Firebase config on this build — in-app alerts still work.
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
