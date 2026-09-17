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

const TAGS: Record<Alert['type'], { label: string; bg: string }> = {
  sos: { label: 'SOS', bg: colors.coralSoft },
  memberJoined: { label: 'New', bg: colors.lilacSoft },
  arrive: { label: 'In', bg: colors.mintSoft },
  leave: { label: 'Out', bg: colors.creamDeep },
  checkin: { label: 'Safe', bg: colors.skySoft },
  batteryLow: { label: 'Batt', bg: colors.amberSoft },
};

function derive(alert: Alert, name: string): { title: string; body: string } {
  const p = (alert.payload ?? {}) as {
    name?: string;
    placeName?: string;
    kind?: string;
  };
  switch (alert.type) {
    case 'sos':
      return { title: `SOS from ${name}`, body: `${name} needs help right now` };
    case 'memberJoined':
      return { title: `${p.name ?? name} joined the nest`, body: 'Say welcome' };
    case 'arrive':
      return { title: `${name} arrived`, body: p.placeName ?? 'a place' };
    case 'leave':
      return { title: `${name} left`, body: p.placeName ?? 'a place' };
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
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <Text style={styles.headerSub}>What happened while you were away</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      {alerts !== undefined && alerts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Bloub
            size={100}
            shape="nuage"
            color={colors.lilac}
            expression="somnolent"
            state="sleep"
            paper={colors.cream}
          />
          <Text style={styles.emptyTitle}>All quiet in the nest</Text>
          <Text style={styles.emptySub}>
            Alerts land here — arrivals, check-ins, SOS.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {(alerts ?? []).map((alert) => {
            const tag = TAGS[alert.type];
            const name = nameById.get(alert.fromUserId) ?? 'Someone';
            const copy = derive(alert, name);
            return (
              <View key={alert._id} style={styles.rowCard}>
                <View style={styles.dotCol}>
                  {!alert.read ? <View style={styles.dot} /> : null}
                </View>
                <View style={[styles.tagBox, { backgroundColor: tag.bg }]}>
                  <Text style={styles.tagText}>{tag.label}</Text>
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
  headerMid: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: { ...typography.title, fontSize: 20, lineHeight: 24 },
  headerSub: { ...typography.small, fontSize: 12, lineHeight: 15 },
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
  tagBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    color: colors.ink,
  },
  mid: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  rowBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
    fontFamily: 'Nunito_600SemiBold',
  },
  rowTime: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    fontFamily: 'Nunito_700Bold',
  },
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
