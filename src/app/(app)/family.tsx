import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Bloub } from '../../components/Bloub';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { MemberRow } from '../../components/ui/MemberRow';
import { MemberAvatar } from '../../components/ui/MemberAvatar';
import { SectionHeader } from '../../components/ui/Bits';
import { Sheet } from '../../components/ui/Sheet';
import { colors, radius, shadow, spacing } from '../../theme/tokens';
import { useMe, useMyToken, type NestlyUser } from '../../lib/identity';
import { useCircle } from '../../lib/useCircle';
import { memberMood } from '../../lib/memberStatus';
import { timeAgo } from '../../lib/utils';
import {
  getSharingEnabled,
  setSharingEnabled,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../services/tracking';
import { hapticSuccess, useHaptics } from '../../hooks/useHaptics';

function shareInvite(code: string) {
  Share.share({
    message: `Join our family on Nestly! 🏡 Open the app and enter code: ${code}`,
  }).catch(() => {
    Alert.alert('Invite code', code);
  });
}

export default function FamilyScreen() {
  const token = useMyToken();
  const me = useMe();
  const { circle, members, loading } = useCircle();
  const haptic = useHaptics();

  const pendingForMe = useQuery(api.checkins.pendingForMe, token ? { token } : 'skip');
  const pendingForCircle = useQuery(
    api.checkins.pendingForCircle,
    token ? { token } : 'skip',
  );

  const respondFn = useMutation(api.checkins.respond);
  const regenerateFn = useMutation(api.circles.regenerateCode);
  const removeMemberFn = useMutation(api.circles.removeMember);
  const leaveFn = useMutation(api.circles.leave);

  const [codeSheet, setCodeSheet] = useState(false);
  const [quickMember, setQuickMember] = useState<NestlyUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<NestlyUser | null>(null);
  const [leaveSheet, setLeaveSheet] = useState(false);
  const [sharing, setSharing] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSharingEnabled().then(setSharing);
  }, []);

  const isOwner = !!me?.isOwner;

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (me && a._id === me._id) return -1;
      if (me && b._id === me._id) return 1;
      if (circle && a._id === circle.ownerId) return -1;
      if (circle && b._id === circle.ownerId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, me, circle]);

  const checkinName = useMemo(() => {
    const first = pendingForMe?.[0];
    if (!first) return null;
    return members.find((m) => m._id === first.requestedBy)?.name ?? 'Someone';
  }, [pendingForMe, members]);

  const waitingOn = useMemo(() => {
    if (!pendingForCircle || !me) return [];
    return pendingForCircle
      .filter((r) => r.requestedBy === me._id)
      .map((r) => members.find((m) => m._id === r.targetId)?.name ?? 'someone');
  }, [pendingForCircle, me, members]);

  async function confirmSafe() {
    if (!token) return;
    setBusy(true);
    try {
      await respondFn({ token, status: 'ok' });
      hapticSuccess();
    } catch {
      haptic('medium');
    } finally {
      setBusy(false);
    }
  }

  async function doRegenerate() {
    if (!token) return;
    setBusy(true);
    try {
      await regenerateFn({ token });
      hapticSuccess();
      setCodeSheet(false);
    } catch {
      haptic('medium');
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!token || !removeTarget) return;
    setBusy(true);
    try {
      await removeMemberFn({ token, memberId: removeTarget._id });
      hapticSuccess();
      setRemoveTarget(null);
    } catch {
      haptic('medium');
    } finally {
      setBusy(false);
    }
  }

  async function doLeave() {
    if (!token) return;
    setBusy(true);
    try {
      await leaveFn({ token });
      router.replace('/onboarding');
    } catch {
      haptic('medium');
      setBusy(false);
    }
  }

  async function toggleSharing(on: boolean) {
    setSharing(on);
    if (on) {
      await setSharingEnabled(true);
      await startBackgroundTracking();
    } else {
      await setSharingEnabled(false);
      await stopBackgroundTracking();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Bloub size={96} shape="nuage" color={colors.rose} expression="curieux" state="egg" paper={colors.cream} frozenAt={1.4} />
      </View>
    );
  }

  const code = circle?.code ?? '';
  const alone = members.length <= 1;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Bloub
            size={52}
            shape="nuage"
            color={colors.rose}
            expression="heureux"
            state="idle"
            paper={colors.surface}
            frozenAt={1.2}
          />
          <View style={styles.headerMid}>
            <Text style={styles.circleName}>{circle?.name ?? 'Our nest'}</Text>
            <Text style={styles.code}>Invite code: {code || '······'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button
            label="Share invite"
            icon="🔗"
            variant="secondary"
            small
            onPress={() => code && shareInvite(code)}
          />
          {isOwner ? (
            <Button label="New code" variant="ghost" small onPress={() => setCodeSheet(true)} />
          ) : null}
        </View>
      </View>

      <SectionHeader title="Members" />

      {alone ? (
        <EmptyState
          bloub={{ state: 'exclaim', color: colors.coral }}
          title="Your nest is just you (for now)"
          subtitle="Share your invite code so family can hop in."
          actionLabel="Share invite code"
          onAction={() => code && shareInvite(code)}
        />
      ) : (
        <View style={styles.memberList}>
          {sorted.map((m) => {
            if (me && m._id === me._id) {
              return <MeCard key={m._id} member={m} />;
            }
            return (
              <View key={m._id} style={styles.rowWrap}>
                <MemberRow member={m} />
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => router.push(`/member/${m._id}`)}
                  onLongPress={() => {
                    haptic('medium');
                    setQuickMember(m);
                  }}
                />
              </View>
            );
          })}
        </View>
      )}

      {checkinName ? (
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>🫶</Text>
          <View style={styles.bannerMid}>
            <Text style={styles.bannerTitle}>{checkinName} asked if you're okay</Text>
            <Text style={styles.bannerSub}>Let them know you're safe</Text>
          </View>
          <Button label="Confirm safe" variant="success" small onPress={confirmSafe} loading={busy} />
        </View>
      ) : null}

      {waitingOn.length > 0 ? (
        <View style={styles.waitingCard}>
          {waitingOn.map((name, i) => (
            <Text key={`${name}-${i}`} style={styles.waitingText}>
              ⏳ Waiting for {name}…
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.footerCard}>
        <View style={styles.footerMid}>
          <Text style={[styles.footerTitle, !sharing && { color: colors.inkSoft }]}>
            {sharing ? 'Location sharing is ON' : 'Location sharing is off'}
          </Text>
          <Text style={styles.footerSub}>
            {sharing
              ? `Last seen ${timeAgo(me?.lastSeen)}`
              : 'Family cannot see where you are'}
          </Text>
        </View>
        <Switch
          value={sharing}
          onValueChange={toggleSharing}
          trackColor={{ true: colors.mint, false: colors.borderStrong }}
          thumbColor={colors.white}
        />
      </View>

      <Pressable
        onPress={() => setLeaveSheet(true)}
        style={styles.leaveButton}
      >
        <Text style={styles.leaveText}>Leave this nest</Text>
      </Pressable>

      <Sheet visible={codeSheet} onClose={() => setCodeSheet(false)} title="New invite code?">
        <Text style={styles.sheetText}>
          The old code stops working. Anyone mid-join will need the new one.
        </Text>
        <Button label="Regenerate code" onPress={doRegenerate} loading={busy} />
      </Sheet>

      <Sheet
        visible={!!quickMember}
        onClose={() => setQuickMember(null)}
        title={quickMember?.name}
      >
        <View style={styles.sheetStack}>
          <Button
            label={`View ${quickMember?.name ?? ''}`}
            variant="secondary"
            onPress={() => {
              const id = quickMember?._id;
              setQuickMember(null);
              if (id) router.push(`/member/${id}`);
            }}
          />
          {isOwner ? (
            <Button
              label="Remove from nest"
              variant="danger"
              onPress={() => {
                setRemoveTarget(quickMember);
                setQuickMember(null);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? ''}?`}
      >
        <Text style={styles.sheetText}>
          They can always rejoin with the invite code.
        </Text>
        <Button label="Remove" variant="danger" onPress={doRemove} loading={busy} />
      </Sheet>

      <Sheet visible={leaveSheet} onClose={() => setLeaveSheet(false)} title="Leave the nest?">
        <Text style={styles.sheetText}>
          You'll stop appearing on the map. You can rejoin with an invite code.
        </Text>
        <Button label="Leave nest" variant="danger" onPress={doLeave} loading={busy} />
      </Sheet>
    </ScrollView>
  );
}

function MeCard({ member }: { member: NestlyUser }) {
  const mood = memberMood(member);
  return (
    <View style={styles.meCard}>
      <MemberAvatar
        avatar={member.avatar}
        role={member.role}
        size={54}
        state={mood.state}
        expression={mood.expression}
      />
      <View style={styles.meMid}>
        <View style={styles.meNameRow}>
          <Text style={styles.meName}>{member.name}</Text>
          <View style={styles.youChip}>
            <Text style={styles.youText}>You</Text>
          </View>
        </View>
        <Text style={styles.meStatus}>{mood.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.cream },
  content: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.l,
  },
  center: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    gap: spacing.m,
    ...shadow.card,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.l },
  headerMid: { flex: 1, gap: 2 },
  circleName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  code: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 1.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  memberList: { gap: spacing.m },
  rowWrap: { borderRadius: radius.l },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    ...shadow.card,
  },
  meMid: { flex: 1, gap: 2 },
  meNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  youChip: {
    backgroundColor: colors.coralSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youText: { fontSize: 11, fontWeight: '800', color: colors.coral },
  meStatus: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.amber,
    padding: spacing.l,
  },
  bannerEmoji: { fontSize: 26 },
  bannerMid: { flex: 1, gap: 2 },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  bannerSub: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    gap: spacing.xs,
  },
  waitingText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    ...shadow.card,
  },
  footerMid: { flex: 1, gap: 2 },
  footerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.mint,
    fontFamily: 'Nunito_800ExtraBold',
  },
  footerSub: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  leaveButton: { alignSelf: 'center', padding: spacing.s },
  leaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    fontFamily: 'Nunito_700Bold',
  },
  sheetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    lineHeight: 21,
    marginBottom: spacing.l,
    fontFamily: 'Nunito_600SemiBold',
  },
  sheetStack: { gap: spacing.m },
});
