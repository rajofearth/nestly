import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import { Bloub } from '../../components/Bloub';
import { colors, radius, shadow, typography } from '../../theme/tokens';
import { useMyToken } from '../../lib/identity';
import { useCircle } from '../../lib/useCircle';
import { timeAgo } from '../../lib/utils';

type Alert = Doc<'alerts'>;

const ICONS: Record<Alert['type'], { emoji: string; bg: string }> = {
  sos: { emoji: '🆘', bg: colors.coralSoft },
  memberJoined: { emoji: '🎉', bg: colors.lilacSoft },
  arrive: { emoji: '📍', bg: colors.mintSoft },
  leave: { emoji: '👋', bg: colors.creamDeep },
  checkin: { emoji: '✅', bg: colors.skySoft },
  batteryLow: { emoji: '🪫', bg: colors.amberSoft },
};

function derive(alert: Alert, name: string): { title: string; body: string } {
  const p = (alert.payload ?? {}) as {
    name?: string;
    placeName?: string;
    emoji?: string;
    kind?: string;
  };
  switch (alert.type) {
    case 'sos':
      return { title: `SOS from ${name}`, body: `${name} needs help right now` };
    case 'memberJoined':
      return { title: `${p.name ?? name} joined the nest`, body: 'Say welcome 👋' };
    case 'arrive':
      return { title: `${name} arrived`, body: `${p.emoji ?? '📍'} ${p.placeName ?? 'a place'}` };
    case 'leave':
      return { title: `${name} left`, body: `${p.emoji ?? '📍'} ${p.placeName ?? 'a place'}` };
    case 'checkin':
      return p.kind === 'responded'
        ? { title: `${name} checked in`, body: 'They marked themselves as OK' }
        : { title: `${name} asked for a check-in`, body: "Let them know you're OK" };
    case 'batteryLow':
      return { title: `${name}'s battery is low`, body: 'Their phone might die soon' };
    default:
      return { title: 'Family update', body: '' };
  }
}

export default function Alerts() {
  const token = useMyToken();
  const { members } = useCircle();
  const alerts = useQuery(api.alerts.list, token ? { token, limit: 50 } : 'skip');
  const markRead = useMutation(api.alerts.markRead);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m._id, m.name);
    return map;
  }, [members]);

  useEffect(() => {
    if (!alerts || !token) return;
    const unread = alerts.filter((a) => !a.read);
    const timers = unread.map((a) =>
      setTimeout(() => markRead({ token, alertId: a._id }).catch(() => {}), 800),
    );
    return () => timers.forEach(clearTimeout);
  }, [alerts, token, markRead]);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable hitSlop={12} style={styles.back} onPress={() => router.back()}>
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Alerts</Text>
        <View style={styles.headerSpacer} />
      </View>
      {alerts !== undefined && alerts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Bloub
            size={120}
            shape="nuage"
            color={colors.lilac}
            expression="somnolent"
            state="sleep"
            paper={colors.cream}
            frozenAt={1.4}
          />
          <Text style={styles.emptyTitle}>All quiet in the nest</Text>
          <Text style={styles.emptySub}>
            Alerts about arrivals, check-ins and SOS land here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {(alerts ?? []).map((alert) => {
            const icon = ICONS[alert.type];
            const name = nameById.get(alert.fromUserId) ?? 'Someone';
            const copy = derive(alert, name);
            return (
              <View key={alert._id} style={styles.rowCard}>
                <View style={styles.dotCol}>
                  {!alert.read ? <View style={styles.dot} /> : null}
                </View>
                <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
                  <Text style={styles.iconEmoji}>{icon.emoji}</Text>
                </View>
                <View style={styles.mid}>
                  <Text style={styles.rowTitle}>{copy.title}</Text>
                  {copy.body ? <Text style={styles.rowBody}>{copy.body}</Text> : null}
                </View>
                <Text style={styles.rowTime}>{timeAgo(alert.ts)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  chevron: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: -2 },
  headerTitle: { ...typography.title, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 36 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadow.card,
  },
  dotCol: { width: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 19 },
  mid: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  rowBody: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  rowTime: { fontSize: 11, fontWeight: '700', color: colors.inkFaint },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { ...typography.heading, textAlign: 'center' },
  emptySub: {
    ...typography.bodySoft,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
