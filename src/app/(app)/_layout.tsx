import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { colors, shadow } from '../../theme/tokens';
import { useMyToken } from '../../lib/identity';
import { useMeSync } from '../../lib/useMeSync';
import { Bloub, type StateId } from '../../components/Bloub';
import * as Location from 'expo-location';
import { usePushRegistration } from '../../services/push';
import {
  cacheTaskContext,
  checkAlerts,
  setConvexUrl,
  setSharingEnabled,
  startBackgroundTracking,
} from '../../services/tracking';

function TabIcon({
  shape,
  color,
  expression,
  state,
  focused,
  size,
}: {
  shape: string;
  color: string;
  expression: string;
  state: StateId;
  focused: boolean;
  size: number;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Bloub
        size={size - (focused ? 2 : 6)}
        shape={shape}
        color={focused ? color : colors.inkFaint}
        expression={expression}
        state={state}
        paper={colors.cream}
        animate={focused}
        playSpeed={0.8}
      />
    </View>
  );
}

export default function AppLayout() {
  const token = useMyToken();
  const registerPush = usePushRegistration();
  const registerPushRef = useRef(registerPush);
  registerPushRef.current = registerPush;
  useMeSync();

  const myData = useQuery(api.circles.get, token ? { token } : 'skip');
  const places = useQuery(api.places.list, token ? { token } : 'skip');

  // Bootstrap: permissions, background tracking, push, place cache.
  // Runs once — the closure is kept fresh via a ref instead of a dep, which
  // would re-fire permission prompts on every render.
  useEffect(() => {
    setConvexUrl(process.env.EXPO_PUBLIC_CONVEX_URL ?? '');
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      // Background location needs its own grant on Android 11+; without it the
      // foreground service never starts and there are no background updates.
      await Location.requestBackgroundPermissionsAsync();
      await setSharingEnabled(true);
      await startBackgroundTracking();
      void registerPushRef.current();
    })();
  }, []);

  // Foreground alert watch: raise local notifications while the app is open,
  // even when the device is not moving and the location task is idle.
  useEffect(() => {
    if (!token) return;
    void checkAlerts(token);
    const id = setInterval(() => void checkAlerts(token), 30_000);
    return () => clearInterval(id);
  }, [token]);

  // Keep the background task's cached context fresh.
  useEffect(() => {
    if (places && token) {
      void cacheTaskContext(token, places);
    }
  }, [places, token]);

  const circleName = myData?.circle?.name ?? 'Nestly';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.cream,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 6,
          ...shadow.float,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Nest',
          tabBarIcon: ({ focused }) => (
            <TabIcon shape="cercle" color={colors.coral} expression="curieux" state="idle" focused={focused} size={34} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: circleName.length > 12 ? 'Family' : circleName,
          tabBarIcon: ({ focused }) => (
            <TabIcon shape="nuage" color={colors.rose} expression="heureux" state="idle" focused={focused} size={34} />
          ),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: 'Places',
          tabBarIcon: ({ focused }) => (
            <TabIcon shape="goutte" color={colors.mint} expression="attentif" state="idle" focused={focused} size={34} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => (
            <TabIcon shape="squircle" color={colors.lilac} expression="neutre" state="idle" focused={focused} size={34} />
          ),
        }}
      />
      <Tabs.Screen name="member/[id]" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null }} />
    </Tabs>
  );
}
