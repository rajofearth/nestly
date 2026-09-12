import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { MAP_STYLE_URL, timeAgo } from '../../lib/utils';
import { memberMood } from '../../lib/memberStatus';
import { MemberAvatar } from '../../components/ui/MemberAvatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { hapticError, hapticSuccess, useHaptics } from '../../hooks/useHaptics';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { NestlyUser } from '../../lib/identity';

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
    const list: { id: string; lngLat: [number, number]; member: NestlyUser; isMe: boolean }[] = [];
    for (const m of members) {
      const isMe = m._id === user?._id;
      const pos: [number, number] | null =
        isMe && myLoc ? myLoc : m.lat != null && m.lng != null ? [m.lng, m.lat] : null;
      if (!pos) continue;
      list.push({ id: m._id, lngLat: pos, member: m, isMe });
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

  const requestPermission = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setPerm(granted ? 'granted' : 'denied');
  };

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
        <View style={[styles.circlePill, shadow.float]}>
          <Text numberOfLines={1} style={styles.circleName}>
            {circle?.name ?? 'Nest'}
          </Text>
          <Pressable
            onPress={() => router.push('/alerts')}
            hitSlop={8}
            style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unread > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
      </View>

      {sentAt ? (
        <View style={[styles.sentCard, { bottom: 108 + spacing.xl }, shadow.float]}>
          <Text style={styles.sentText}>Sent — family notified</Text>
        </View>
      ) : null}

      {perm === 'denied' ? (
        <View style={[styles.permCard, { top: insets.top + spacing.xxl + 40 }, shadow.float]}>
          <Text style={styles.permTitle}>Nestly needs your location to work</Text>
          <Button label="Allow location" small onPress={requestPermission} />
        </View>
      ) : null}

      {others.length === 0 && !loading ? (
        <View style={[styles.emptyWrap, { bottom: 108 + spacing.xxl }]} pointerEvents="box-none">
          <View style={[styles.emptyCard, shadow.float]}>
            <EmptyState
              bloub={{ state: 'exclaim', expression: 'curieux', size: 96, color: colors.coral }}
              title="Your nest is just you (for now)"
              subtitle="Invite family from the Family tab"
            />
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
        style={({ pressed }) => [styles.sos, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Text style={styles.sosText}>SOS</Text>
      </Pressable>

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
                  <Text numberOfLines={1} style={styles.chipMood}>
                    {mood.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Sheet visible={sosOpen} onClose={() => setSosOpen(false)}>
        <Text style={styles.sosTitle}>Send SOS to everyone in {circle?.name}?</Text>
        <View style={styles.sosRow}>
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
  mood: ReturnType<typeof memberMood>;
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
          badge={member.isOwner ? '👑' : undefined}
        />
        <Text style={styles.markerSeen} numberOfLines={1}>
          {timeAgo(member.lastSeen)}
        </Text>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  top: { position: 'absolute', left: spacing.l, right: spacing.l, alignItems: 'flex-start' },
  circlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.l,
    paddingRight: spacing.s,
    paddingVertical: spacing.s,
  },
  circleName: {
    ...typography.heading,
    maxWidth: 200,
  },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.coral,
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
  },
  permTitle: { ...typography.body, textAlign: 'center' },
  sos: {
    position: 'absolute',
    right: spacing.l,
    bottom: 96,
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
  sentCard: {
    position: 'absolute',
    right: spacing.l,
    backgroundColor: colors.mint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  sentText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: colors.white },
  emptyWrap: { position: 'absolute', left: 0, right: 0 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.xl,
  },
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
  chipName: { fontSize: 13, fontWeight: '800', color: colors.ink, fontFamily: 'Nunito_800ExtraBold' },
  chipMood: { fontSize: 11, fontWeight: '600', color: colors.inkSoft },
  markerSeen: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  markerView: { alignItems: 'center' },
  sosTitle: { ...typography.body, marginBottom: spacing.l },
  sosRow: { flexDirection: 'row', gap: spacing.s },
});
