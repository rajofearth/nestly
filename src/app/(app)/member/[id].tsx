import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { Bloub } from '../../../components/Bloub';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useMe, useMyToken } from '../../../lib/identity';
import { useCircle } from '../../../lib/useCircle';
import { MAP_STYLE_URL, speedKmh, timeAgo } from '../../../lib/utils';
import { batteryLabel, memberMood } from '../../../lib/memberStatus';
import { roleLabel } from '../../../lib/roles';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Sheet } from '../../../components/ui/Sheet';
import { StatPill } from '../../../components/ui/Bits';
import type { MemberMood } from '../../../lib/memberStatus';

export default function MemberDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const router = useRouter();
  const token = useMyToken();
  const me = useMe();
  const { circle, members, loading } = useCircle();

  const member = members.find((m) => m._id === id);
  const crumbs = useQuery(
    api.presence.breadcrumbsForUser,
    token && id ? { token, userId: id as Id<'users'>, limit: 100 } : 'skip',
  );
  const pending = useQuery(api.checkins.pendingForCircle, token ? { token } : 'skip');

  const [asked, setAsked] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const requestCheckin = useMutation(api.checkins.request);
  const removeMember = useMutation(api.circles.removeMember);

  if (loading && !member) {
    return <View style={styles.page} />;
  }

  if (!member || !id) {
    return (
      <View style={[styles.page, styles.center]}>
        <EmptyState
          bloub={{ state: 'wide', expression: 'curieux', size: 110 }}
          title="Member not found"
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const mood = memberMood(member);
  const points = (crumbs ?? []).slice().sort((a, b) => a.ts - b.ts);
  const waiting = !!pending?.some((r) => r.targetId === id);
  const battery = batteryLabel(member);
  const kmh = speedKmh(member.speed);
  const isOwner = !!circle && !!me && circle.ownerId === me._id;

  const onAsk = async () => {
    if (!token || waiting || asked) return;
    try {
      await requestCheckin({ token, targetId: id as Id<'users'> });
      setAsked(true);
    } catch {
      setAsked(false);
    }
  };

  const onRemove = async () => {
    if (!token) return;
    setRemoveOpen(false);
    try {
      await removeMember({ token, memberId: id as Id<'users'> });
      router.back();
    } catch {
      setRemoveOpen(true);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.chevron}>
          <Text style={styles.chevronText}>‹</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.name}>
          {member.name}
        </Text>
        <View style={styles.roleChip}>
          <Text numberOfLines={1} style={styles.roleText}>
            {roleLabel(member.role, member.roleLabel)}
          </Text>
        </View>
      </View>

      <View style={styles.moodBlock}>
        <Bloub
          size={140}
          animate
          shape={member.avatar.shape}
          color={member.avatar.color}
          state={mood.state}
          expression={mood.expression}
          paper={colors.cream}
        />
        <Text style={styles.moodLabel}>{mood.label}</Text>
      </View>

      <View style={styles.pills}>
        {battery ? (
          <StatPill emoji={battery.emoji} text={battery.text} tint={battery.tint} />
        ) : (
          <StatPill emoji="🔋" text="No battery data" tint="off" />
        )}
        <StatPill
          emoji={kmh != null ? '💨' : '🧘'}
          text={kmh != null ? `${kmh} km/h` : 'Still'}
          tint={kmh != null ? 'ok' : 'off'}
        />
        <StatPill emoji="🕐" text={timeAgo(member.lastSeen)} tint={mood.tint === 'off' ? 'off' : 'ok'} />
      </View>

      <View style={styles.miniMap}>
        {points.length >= 2 ? (
          <TrailMap points={points} mood={mood} />
        ) : (
          <View style={styles.noMovement}>
            <Bloub
              size={64}
              state="sleep"
              expression="somnolent"
              color={colors.inkFaint}
              paper={colors.cream}
            />
            <Text style={styles.noMovementText}>No recent movement</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={asked ? 'Asked ✓' : waiting ? 'Waiting for reply…' : 'Ask to check in'}
            variant={asked || waiting ? 'secondary' : 'primary'}
            disabled={asked || waiting}
            onPress={onAsk}
          />
        </View>
        <View style={styles.action}>
          <Button
            label="Message"
            variant="secondary"
            onPress={() => router.push({ pathname: '/chat', params: { to: id } })}
          />
        </View>
      </View>

      {isOwner && me && id !== me._id ? (
        <Pressable onPress={() => setRemoveOpen(true)} hitSlop={8} style={styles.removeBtn}>
          <Text style={styles.removeText}>Remove from nest</Text>
        </Pressable>
      ) : null}

      <Sheet visible={removeOpen} onClose={() => setRemoveOpen(false)}>
        <Text style={styles.sheetTitle}>Remove {member.name} from {circle?.name}?</Text>
        <View style={styles.sheetRow}>
          <Button label="Cancel" variant="secondary" onPress={() => setRemoveOpen(false)} />
          <Button label="Remove" variant="danger" onPress={onRemove} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const TrailMap = React.memo(function TrailMap({
  points,
  mood,
}: {
  points: { lat: number; lng: number }[];
  mood: MemberMood;
}) {
  const line: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
      },
    ],
  };
  const last = points[points.length - 1];
  const dot: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [last.lng, last.lat] },
      },
    ],
  };
  return (
    <Map
      mapStyle={MAP_STYLE_URL}
      style={{ flex: 1 }}
      logo={false}
      compass={false}
      attribution={false}
    >
      <Camera initialViewState={{ center: [last.lng, last.lat], zoom: 14 }} />
      <GeoJSONSource id="trail-line-src" data={line} />
      <Layer
        id="trail-line"
        type="line"
        source="trail-line-src"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': colors.coral, 'line-width': 3 }}
      />
      <GeoJSONSource id="trail-dot-src" data={dot} />
      <Layer
        id="trail-dot"
        type="circle"
        source="trail-dot-src"
        paint={{
          'circle-radius': 6,
          'circle-color': colors.coral,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': colors.surface,
        }}
      />
    </Map>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: spacing.xxl, paddingTop: spacing.s },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
  },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: { fontSize: 22, color: colors.ink, marginTop: -3, fontWeight: '800' },
  name: {
    ...typography.title,
    flex: 1,
  },
  roleChip: {
    backgroundColor: colors.creamDeep,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
    maxWidth: 110,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  moodBlock: { alignItems: 'center', gap: spacing.s, paddingVertical: spacing.l },
  moodLabel: { ...typography.bodySoft, textAlign: 'center' },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
  },
  miniMap: {
    height: 200,
    borderRadius: radius.l,
    overflow: 'hidden',
    marginHorizontal: spacing.l,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
  },
  noMovement: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  noMovementText: { ...typography.small, color: colors.inkFaint },
  actions: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  action: { flex: 1 },
  removeBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    fontFamily: 'Nunito_700Bold',
  },
  sheetTitle: { ...typography.body, marginBottom: spacing.l },
  sheetRow: { flexDirection: 'row', gap: spacing.s },
});
