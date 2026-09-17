import * as Notifications from 'expo-notifications';

export const ALERT_CHANNEL = 'nestly-alerts';

// Foreground presentation rules. Registered at import time so both the app
// and the background task bundle pick it up.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

export async function ensureAlertChannel(): Promise<void> {
  if (channelReady) return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: 'Family alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B4A',
  });
  channelReady = true;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function presentAlertNotification(content: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await ensureAlertChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: content.data ?? {},
    },
    trigger: { channelId: ALERT_CHANNEL },
  });
}
