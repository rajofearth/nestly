import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
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
import type { CameraRef, MapRef } from '@maplibre/maplibre-react-native';
import type { NestlyUser } from '../../lib/identity';

type Mood = ReturnType<typeof memberMood>;

type MarkerEntry = { id: string; lngLat: [number, number]; member: NestlyUser };
type EdgeEntry = {
  id: string;
  member: NestlyUser;
  lngLat: [number, number];
  x: number;
  y: number;
};

const SOS_SIZE = 64;
const CHIP_ROW_HEIGHT = 52;
const CHIP_GAP = 10;
const CHIP_INTERVAL = 170;
const INDICATOR_SIZE = 32;
const MAX_INDICATORS = 6;
const EDGE_PAD_X = 12;
const EDGE_PAD_BOTTOM = CHIP_ROW_HEIGHT + spacing.m + 12;
const RECOMPUTE_MS = 250;
const FOCUS_ZOOM = 15;

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

// The Bloub engine's 'sleep' pose collapses the whole body to a tiny dot
// (circle r=0.1585), so offline members rendered as dots on the map. Keep
// their mood-driven sleepy expression but show it on a visible idle body.
function visibleState(mood: Mood): string {
  return mood.state === 'sleep' ? 'idle' : mood.state;
}

function memberPos(member: NestlyUser, meId: string | undefined, myLoc: [number, number] | null): [number, number] | null {
  if (member._id === meId && myLoc) return myLoc;
  if (member.lat != null && member.lng != null) return [member.lng, member.lat];
  return null;
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

  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [myLoc, setMyLoc] = useState<[number, number] | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [offscreen, setOffscreen] = useState<EdgeEntry[]>([]);
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
    const list: MarkerEntry[] = [];
    for (const m of members) {
      const pos = memberPos(m, user?._id, myLoc);
      if (!pos) continue;
      list.push({ id: m._id, lngLat: pos, member: m });
    }
    return list;
  }, [members, user, myLoc]);

  const focusMember = useCallback((lngLat: [number, number]) => {
    cameraRef.current?.easeTo({ center: lngLat, zoom: FOCUS_ZOOM, duration: 600 });
  }, []);

  const markersRef = useRef(markers);
  markersRef.current = markers;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const recomputeSeq = useRef(0);
  const throttleRef = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null }>({
    last: 0,
    timer: null,
  });
  const offscreenSig = useRef('');

  const computeOffscreen = useCallback(async () => {
    const map = mapRef.current;
    const vp = viewportRef.current;
    if (!map || !vp) return;
    const seq = ++recomputeSeq.current;
    const top = insetsRef.current.top + 68;
    const bottom = EDGE_PAD_BOTTOM;
    const cx = vp.w / 2;
    const cy = vp.h / 2;
    const found: EdgeEntry[] = [];
    const dists: number[] = [];
    for (const mk of markersRef.current) {
      try {
        const pt = await map.project(mk.lngLat);
        if (seq !== recomputeSeq.current) return;
        const px = pt[0];
        const py = pt[1];
        if (
          px >= EDGE_PAD_X &&
          px <= vp.w - EDGE_PAD_X &&
          py >= top &&
          py <= vp.h - bottom
        ) {
          continue;
        }
        const dx = px - cx;
        const dy = py - cy;
        let t = Infinity;
        if (dx < 0) t = Math.min(t, (EDGE_PAD_X - cx) / dx);
        if (dx > 0) t = Math.min(t, (vp.w - EDGE_PAD_X - cx) / dx);
        if (dy < 0) t = Math.min(t, (top - cy) / dy);
        if (dy > 0) t = Math.min(t, (vp.h - bottom - cy) / dy);
        if (!Number.isFinite(t)) continue;
        found.push({
          id: mk.id,
          member: mk.member,
          lngLat: mk.lngLat,
          x: cx + dx * t - INDICATOR_SIZE / 2,
          y: cy + dy * t - INDICATOR_SIZE / 2,
        });
        dists.push(dx * dx + dy * dy);
      } catch {
        // map not ready to project — skip this member
      }
    }
    if (seq !== recomputeSeq.current) return;
    const next = found
      .map((entry, i) => ({ entry, d: dists[i] ?? 0 }))
      .sort((a, b) => b.d - a.d)
      .slice(0, MAX_INDICATORS)
      .map((r) => r.entry);
    const sig = next
      .map((e) => `${e.id}:${Math.round(e.x)},${Math.round(e.y)}`)
      .join('|');
    if (sig === offscreenSig.current) return;
    offscreenSig.current = sig;
    setOffscreen(next);
  }, []);

  const scheduleRecompute = useCallback(() => {
    const st = throttleRef.current;
    const now = Date.now();
    const run = () => {
      st.last = Date.now();
      void computeOffscreen();
    };
    if (now - st.last >= RECOMPUTE_MS) {
      run();
    } else if (st.timer == null) {
      st.timer = setTimeout(() => {
        st.timer = null;
        run();
      }, RECOMPUTE_MS - (now - st.last));
    }
  }, [computeOffscreen]);

  useEffect(() => {
    scheduleRecompute();
  }, [scheduleRecompute, markers, viewport]);

  useEffect(
    () => () => {
      if (throttleRef.current.timer != null) clearTimeout(throttleRef.current.timer);
    },
    [],
  );

  const onMapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport((prev) =>
      prev && prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  }, []);

  const onSos = async () => {
    if (!token) return;
    setSosOpen(false);
    try {
      await sendSos({ token, payload: { msg: 'Need help' } });
      hapticSuccess();
      setSentAt(Date.now());
    } catch {
      hapticError();
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
    <View style={styles.page} onLayout={onMapLayout}>
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE_URL}
        style={{ flex: 1 }}
        compassPosition={{ top: 8, right: 8 }}
        onRegionIsChanging={scheduleRecompute}
        onRegionDidChange={scheduleRecompute}
      >
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

      {offscreen.map((edge) => {
        const mood = memberMood(edge.member);
        return (
          <Pressable
            key={edge.id}
            hitSlop={8}
            onPress={() => focusMember(edge.lngLat)}
            style={({ pressed }) => [
              styles.edgeIndicator,
              { left: edge.x, top: edge.y },
              pressed && { opacity: 0.8 },
              shadow.float,
            ]}
          >
            <MemberAvatar
              avatar={edge.member.avatar}
              size={INDICATOR_SIZE}
              state={visibleState(mood)}
              expression={mood.expression}
            />
          </Pressable>
        );
      })}

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
          decelerationRate="fast"
          snapToInterval={CHIP_INTERVAL}
          style={[styles.chipRow, { bottom: spacing.m }]}
          contentContainerStyle={styles.chips}
        >
          {members.map((m) => {
            const mood = memberMood(m);
            return (
              <Pressable
                key={m._id}
                onPress={() => {
                  const pos = memberPos(m, user?._id, myLoc);
                  if (pos) {
                    haptic();
                    focusMember(pos);
                  }
                }}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }, shadow.card]}
              >
                <MemberAvatar
                  avatar={m.avatar}
                  size={36}
                  state={visibleState(mood)}
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
          style={[
            styles.guidanceWrap,
            { bottom: spacing.m + CHIP_ROW_HEIGHT + spacing.s },
          ]}
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
        onPress={() => {
          haptic();
          setSosOpen(true);
        }}
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
          <Button label="Send SOS" variant="danger" onPress={onSos} />
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
          size={44}
          state={visibleState(mood)}
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
  edgeIndicator: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  sos: {
    position: 'absolute',
    right: spacing.l,
    bottom: spacing.m + CHIP_ROW_HEIGHT + spacing.s,
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
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
    marginRight: spacing.l + SOS_SIZE + spacing.s,
    padding: spacing.m,
  },
  guidanceText: { flex: 1, gap: 2 },
  guidanceTitle: {
    ...typography.heading,
    fontSize: 16,
    lineHeight: 20,
  },
  guidanceSub: { ...typography.small, fontSize: 12, lineHeight: 16 },
  chipRow: { position: 'absolute', left: 0, right: 0, height: CHIP_ROW_HEIGHT },
  chips: {
    gap: CHIP_GAP,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    height: CHIP_ROW_HEIGHT,
  },
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
