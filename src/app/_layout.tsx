import '../services/tracking';

import React, { useEffect } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useIdentity } from '../lib/identity';
import { colors } from '../theme/tokens';
import { SplashGate } from '../components/SplashGate';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? '';
const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

function RootGate() {
  const { status, bootstrap } = useIdentity();
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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
      <RootGate />
    </ConvexProvider>
  );
}
