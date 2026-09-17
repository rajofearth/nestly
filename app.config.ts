import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync } from 'fs';

export default ({ config }: ConfigContext): ExpoConfig => {
  const name = config.name ?? 'Nestly';
  const slug = config.slug ?? 'nestly';
  const version = config.version ?? '1.0.0';

  return {
    ...config,
    name,
    slug,
    version,
    scheme: 'nestly',
    owner: 'rajofearth',
    userInterfaceStyle: 'light',
    extra: {
      eas: {
        projectId: 'e421fdf3-f51e-4ee1-80b4-4359b7be476d',
      },
    },
    android: {
      ...(config.android ?? {}),
      package: 'com.rajofearth.nestly',
      softwareKeyboardLayoutMode: 'resize',
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        backgroundColor: '#FFF8EE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: Array.from(
        new Set([
          ...(((config.android?.permissions as string[] | undefined) ?? []) as string[]),
          'ACCESS_COARSE_LOCATION',
          'ACCESS_FINE_LOCATION',
          'ACCESS_BACKGROUND_LOCATION',
          'FOREGROUND_SERVICE',
          'FOREGROUND_SERVICE_LOCATION',
          'POST_NOTIFICATIONS',
          'VIBRATE',
          'RECEIVE_BOOT_COMPLETED',
        ]),
      ),
    },
    plugins: [
      ...(config.plugins ?? []),
      'expo-router',
      'expo-secure-store',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FFF8EE',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          color: '#FF8A5C',
          defaultChannel: 'nestly-alerts',
          ...(existsSync('./google-services.json')
            ? { googleServicesFile: './google-services.json' }
            : {}),
        },
      ],
      '@maplibre/maplibre-react-native',
      [
        'expo-build-properties',
        {
          android: {
            buildArchs: ['arm64-v8a'],
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  };
};
