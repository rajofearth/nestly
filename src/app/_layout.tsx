import '../services/tracking';

import React, { useEffect, useRef } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useIdentity } from '../lib/identity';
import { colors } from '../theme/tokens';
import { SplashGate } from '../components/SplashGate';
import { CrashBoundary } from '../components/CrashBoundary';
import { installGlobalErrorHandlers, logEvent } from '../services/logger';

installGlobalErrorHandlers();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl || !convexUrl.includes('://')) {
  throw new Error('EXPO_PUBLIC_CONVEX_URL missing — rebuild with .env present');
}
const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

function RootGate() {
  const { status, bootstrap } = useIdentity();
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const loggedOpen = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (loaded && !loggedOpen.current) {
      loggedOpen.current = true;
      logEvent('app-open', 'fonts loaded, app mounted');
    }
  }, [loaded]);

  if (!loaded || status === 'loading') return <SplashGate />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <CrashBoundary>
        <RootGate />
      </CrashBoundary>
    </ConvexProvider>
  );
}
