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
import { MemberRow } from '../../components/ui/MemberRow';
import { SectionHeader } from '../../components/ui/Bits';
import { Sheet } from '../../components/ui/Sheet';
import { colors, radius, shadow, spacing } from '../../theme/tokens';
import { useMe, useMyToken, type NestlyUser } from '../../lib/identity';
import { useCircle } from '../../lib/useCircle';
import {
  getSharingEnabled,
  setSharingEnabled,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../services/tracking';
import { hapticSuccess, useHaptics } from '../../hooks/useHaptics';

function shareInvite(code: string) {
  Share.share({
    message: `Join our family on Nestly! Open the app and enter code: ${code}`,
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
      return a.name.localeCompare(b.name);
    });
  }, [members, me]);

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

  const showLookAfter = !!checkinName || waitingOn.length > 0;

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
        <Bloub
          size={96}
          shape="nuage"
          color={colors.rose}
          expression="curieux"
          state="egg"
          paper={colors.cream}
          frozenAt={1.4}
        />
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
      <Text style={styles.title}>Family</Text>
      <Text style={styles.purpose}>Who's here and how they're doing</Text>

      <View style={styles.inviteCard}>
        <Text style={styles.circleName}>{circle?.name ?? 'Our nest'}</Text>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{code || '······'}</Text>
          {isOwner ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                haptic('light');
                setCodeSheet(true);
              }}
            >
              <Text style={styles.newCodeText}>New code</Text>
            </Pressable>
          ) : null}
        </View>
        <Button
          label="Share invite"
          onPress={() => code && shareInvite(code)}
          disabled={!code}
        />
      </View>

      <SectionHeader title="Members" />

      <View style={styles.memberList}>
        {sorted.map((m) => {
          const isMe = !!me && m._id === me._id;
          return (
            <View key={m._id} style={styles.rowWrap}>
              <MemberRow
                member={m}
                onPress={() => router.push(`/member/${m._id}`)}
              />
              {isMe ? (
                <View style={styles.youChip}>
                  <Text style={styles.youText}>You</Text>
                </View>
              ) : (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onLongPress={() => {
                    haptic('medium');
                    setQuickMember(m);
                  }}
                />
              )}
            </View>
          );
        })}
      </View>

      {alone ? (
        <View style={styles.aloneRow}>
          <Bloub
            size={60}
            shape="nuage"
            color={colors.lilac}
            expression="somnolent"
            state="sleep"
            paper={colors.cream}
            frozenAt={1.4}
          />
          <Text style={styles.aloneText}>Waiting for your family to join</Text>
        </View>
      ) : null}

      {showLookAfter ? <SectionHeader title="Look after" /> : null}

      {checkinName ? (
        <View style={styles.banner}>
          <View style={styles.bannerMid}>
            <Text style={styles.bannerTitle}>{checkinName} asked if you're okay</Text>
            <Text style={styles.bannerSub}>Let them know you're safe</Text>
          </View>
          <Button label="I'm safe" variant="primary" small onPress={confirmSafe} loading={busy} />
        </View>
      ) : null}

      {waitingOn.length > 0 ? (
        <View style={styles.waitingCard}>
          {waitingOn.map((name, i) => (
            <Text key={`${name}-${i}`} style={styles.waitingText}>
              Waiting for {name} to confirm
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.sharingRow}>
        <View style={styles.sharingMid}>
          <Text style={styles.sharingTitle}>Location sharing</Text>
          <Text style={styles.sharingValue}>{sharing ? 'On' : 'Off'}</Text>
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
        hitSlop={8}
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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  purpose: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    marginTop: -spacing.s,
    fontFamily: 'Nunito_600SemiBold',
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    gap: spacing.m,
    ...shadow.card,
  },
  circleName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 6,
    fontFamily: 'Nunito_800ExtraBold',
  },
  newCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.coral,
    fontFamily: 'Nunito_700Bold',
  },
  memberList: { gap: spacing.m },
  rowWrap: { borderRadius: radius.l },
  youChip: {
    position: 'absolute',
    top: -6,
    right: spacing.m,
    backgroundColor: colors.coralSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  youText: { fontSize: 11, fontWeight: '800', color: colors.coral },
  aloneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
  },
  aloneText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkFaint,
    fontFamily: 'Nunito_600SemiBold',
  },
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
  sharingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
  },
  sharingMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  sharingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'Nunito_700Bold',
  },
  sharingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkFaint,
    fontFamily: 'Nunito_700Bold',
  },
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
