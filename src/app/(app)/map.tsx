import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../convex/_generated/api';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';
import { useMe, useMyToken } from '../../lib/identity';
import { useMeSync } from '../../lib/useMeSync';
import { useCircle } from '../../lib/useCircle';
import { MAP_STYLE_URL, speedKmh } from '../../lib/utils';
import { memberMood } from '../../lib/memberStatus';
import { MemberAvatar } from '../../components/ui/MemberAvatar';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { hapticError, hapticSuccess, useHaptics } from '../../hooks/useHaptics';
import { recordLiveLocation } from '../../services/tracking';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { NestlyUser } from '../../lib/identity';

type Mood = ReturnType<typeof memberMood>;

function statusWord(mood: Mood, member: NestlyUser): string {
  switch (mood.state) {
    case 'comet': {
      const kmh = speedKmh(member.speed);
      return kmh != null ? `Moving · ${kmh} km/h` : 'Moving';
    }
    case 'sleep':
      return 'Offline';
    case 'alert':
      return 'Low battery';
    case 'notify':
      return 'Charging';
    default:
      return 'Resting';
  }
}

export default function NestScreen() {
  const router = useRouter();
  const token = useMyToken();
  const remoteMe = useMeSync();
  const me = useMe();
  const user = remoteMe ?? me;
  const { circle, members, loading } = useCircle();
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();

  const cameraRef = useRef<CameraRef>(null);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [myLoc, setMyLoc] = useState<[number, number] | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const sendSos = useMutation(api.alerts.sos);

  const alerts = useQuery(api.alerts.list, token ? { token } : 'skip');
  const unread = alerts?.filter((a) => !a.read).length ?? 0;

  const others = useMemo(
    () => members.filter((m) => m._id !== user?._id),
    [members, user],
  );

  useEffect(() => {
    if (remoteMe === undefined) return;
    if (!remoteMe || !remoteMe.circleId) {
      router.replace('/onboarding');
    }
  }, [remoteMe, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (active) setPerm(granted ? 'granted' : 'denied');
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (perm !== 'granted') return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High },
        (pos) => {
          void recordLiveLocation(pos);
          if (pos.coords.latitude != null && pos.coords.longitude != null) {
            setMyLoc([pos.coords.longitude, pos.coords.latitude]);
          }
        },
      );
      if (cancelled) sub?.remove();
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [perm]);

  useEffect(() => {
    if (sentAt === null) return;
    const t = setTimeout(() => setSentAt(null), 3000);
    return () => clearTimeout(t);
  }, [sentAt]);

  useEffect(() => {
    if (myLoc) cameraRef.current?.easeTo({ center: myLoc, zoom: 15, duration: 500 });
  }, [myLoc]);

  const markers = useMemo(() => {
    const list: { id: string; lngLat: [number, number]; member: NestlyUser }[] = [];
    for (const m of members) {
      const isMe = m._id === user?._id;
      const pos: [number, number] | null =
        isMe && myLoc ? myLoc : m.lat != null && m.lng != null ? [m.lng, m.lat] : null;
      if (!pos) continue;
      list.push({ id: m._id, lngLat: pos, member: m });
    }
    return list;
  }, [members, user, myLoc]);

  const onSos = async () => {
    if (!token) return;
    setSosOpen(false);
    try {
      await sendSos({ token, payload: { msg: 'Need help' } });
      hapticSuccess();
      setSentAt(Date.now());
    } catch {
      setSosOpen(true);
    }
  };

  const onShareInvite = () => {
    if (!circle?.code) return;
    haptic();
    Share.share({
      message: `Join our family on Nestly! Open the app and enter code: ${circle.code}`,
    }).catch(() => {});
  };

  const requestPermission = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setPerm(granted ? 'granted' : 'denied');
  };

  const showGuidance = others.length === 0 && !loading;

  return (
    <View style={styles.page}>
      <Map mapStyle={MAP_STYLE_URL} style={{ flex: 1 }} compassPosition={{ top: 8, right: 8 }}>
        <Camera ref={cameraRef} initialViewState={{ zoom: 13 }} maxZoom={18} />
        {markers.map((mk) => {
          const mood = memberMood(mk.member);
          return (
            <MarkerItem
              key={mk.id}
              id={mk.id}
              lngLat={mk.lngLat}
              member={mk.member}
              mood={mood}
              onPress={() => router.push(`/member/${mk.id}`)}
            />
          );
        })}
      </Map>

      <View
        pointerEvents="box-none"
        style={[styles.top, { top: insets.top + spacing.s }]}
      >
        <View style={[styles.topCard, shadow.float]}>
          <Text numberOfLines={1} style={styles.circleName}>
            {circle?.name ?? 'Nest'}
          </Text>
          <Pressable
            onPress={() => router.push('/alerts')}
            hitSlop={8}
            style={({ pressed }) => [styles.alertChip, pressed && { opacity: 0.7 }]}
          >
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
            <Text style={styles.alertChipText}>Alerts</Text>
          </Pressable>
        </View>
      </View>

      {perm === 'denied' ? (
        <View
          style={[styles.permCard, { top: insets.top + spacing.xxl + 48 }, shadow.float]}
        >
          <Text style={styles.permTitle}>Nestly needs your location to work</Text>
          <Button label="Allow location" small onPress={requestPermission} />
        </View>
      ) : null}

      {members.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          pointerEvents="box-none"
          contentContainerStyle={styles.chips}
          style={[styles.chipRow, { bottom: spacing.m }]}
        >
          {members.map((m) => {
            const mood = memberMood(m);
            return (
              <Pressable
                key={m._id}
                onPress={() => router.push(`/member/${m._id}`)}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }, shadow.card]}
              >
                <MemberAvatar
                  avatar={m.avatar}
                  role={m.role}
                  size={36}
                  state={mood.state}
                  expression={mood.expression}
                />
                <View style={styles.chipText}>
                  <Text numberOfLines={1} style={styles.chipName}>
                    {m.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.chipStatus}>
                    {statusWord(mood, m)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {showGuidance ? (
        <View
          pointerEvents="box-none"
          style={[styles.guidanceWrap, { bottom: spacing.m + 64 + spacing.s }]}
        >
          <View style={[styles.guidanceCard, shadow.float]}>
            <MemberAvatar
              avatar={{
                shape: 'nuage',
                color: colors.coral,
                expression: 'curieux',
              }}
              size={56}
              ring={false}
              state="idle"
              expression="curieux"
            />
            <View style={styles.guidanceText}>
              <Text style={styles.guidanceTitle}>Your nest is just you</Text>
              <Text style={styles.guidanceSub}>Share your invite code so family can join</Text>
            </View>
            <Button label="Share invite" small onPress={onShareInvite} />
          </View>
        </View>
      ) : null}

      <Pressable
        delayLongPress={1500}
        onLongPress={() => {
          hapticError();
          setSosOpen(true);
        }}
        onPressIn={() => haptic()}
        style={({ pressed }) => [
          styles.sos,
          sentAt != null && { backgroundColor: colors.mint },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <Text style={styles.sosText}>{sentAt != null ? 'Sent' : 'SOS'}</Text>
      </Pressable>

      <Sheet visible={sosOpen} onClose={() => setSosOpen(false)}>
        <Text style={styles.sheetTitle}>Send SOS to everyone in {circle?.name}?</Text>
        <View style={styles.sheetRow}>
          <Button label="Cancel" variant="secondary" onPress={() => setSosOpen(false)} />
          <Button label="Send" variant="danger" onPress={onSos} />
        </View>
      </Sheet>
    </View>
  );
}

const MarkerItem = React.memo(function MarkerItem({
  id,
  lngLat,
  member,
  mood,
  onPress,
}: {
  id: string;
  lngLat: [number, number];
  member: NestlyUser;
  mood: Mood;
  onPress: () => void;
}) {
  return (
    <Marker id={id} lngLat={lngLat} anchor="center" onPress={onPress}>
      <View style={styles.markerView}>
        <MemberAvatar
          avatar={member.avatar}
          role={member.role}
          size={40}
          state={mood.state}
          expression={mood.expression}
        />
        <View style={styles.markerLabel}>
          <Text numberOfLines={1} style={styles.markerName}>
            {member.name}
          </Text>
        </View>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  top: { position: 'absolute', left: spacing.l, right: spacing.l },
  topCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.l,
    paddingRight: spacing.s,
    paddingVertical: spacing.s,
  },
  circleName: {
    ...typography.heading,
    flexShrink: 1,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.creamDeep,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.m,
    paddingRight: spacing.s,
    paddingVertical: 6,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    color: colors.white,
  },
  alertChipText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13,
    color: colors.ink,
  },
  permCard: {
    position: 'absolute',
    left: spacing.l,
    right: spacing.l,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    gap: spacing.s,
    alignItems: 'center',
  },
  permTitle: { ...typography.body, textAlign: 'center' },
  sos: {
    position: 'absolute',
    right: spacing.l,
    bottom: spacing.m + 64 + spacing.s,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  sosText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.white,
    letterSpacing: 1,
  },
  guidanceWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.l,
    marginRight: spacing.l + 64 + spacing.s,
    padding: spacing.m,
  },
  guidanceText: { flex: 1, gap: 2 },
  guidanceTitle: {
    ...typography.heading,
    fontSize: 16,
    lineHeight: 20,
  },
  guidanceSub: { ...typography.small, fontSize: 12, lineHeight: 16 },
  chipRow: { position: 'absolute', left: 0, right: 0 },
  chips: { gap: spacing.s, paddingHorizontal: spacing.l },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 6,
    paddingRight: spacing.m,
    paddingVertical: 6,
  },
  chipText: { width: 96, gap: 1 },
  chipName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  chipStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSoft,
    fontFamily: 'Nunito_600SemiBold',
  },
  markerView: { alignItems: 'center' },
  markerLabel: {
    marginTop: 2,
    maxWidth: 110,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  markerName: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  sheetTitle: { ...typography.body, marginBottom: spacing.l },
  sheetRow: { flexDirection: 'row', gap: spacing.s },
});
