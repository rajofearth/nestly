import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useIdentity, useMyToken } from '../lib/identity';
import { useMeSync } from '../lib/useMeSync';
import { SplashGate } from '../components/SplashGate';

/**
 * Route gate: while loading → splash. Token + member in a circle → app.
 * Anything else → onboarding.
 */
export default function Gate() {
  const status = useIdentity((s) => s.status);
  const token = useMyToken();
  const remote = useMeSync();

  useEffect(() => {
    if (status === 'loading') return;
    if (!token) {
      router.replace('/onboarding');
      return;
    }
    if (remote === undefined) return; // still fetching me
    if (remote && remote.circleId) {
      router.replace('/map');
    } else {
      router.replace('/onboarding');
    }
  }, [status, token, remote]);

  if (status === 'loading' || (token && remote === undefined)) {
    return <SplashGate />;
  }
  return <View />;
}
