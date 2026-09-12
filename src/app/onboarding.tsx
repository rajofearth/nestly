import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { api } from '../../convex/_generated/api';
import { Bloub } from '../components/Bloub';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { colors, radius, shadow, spacing } from '../theme/tokens';
import { ROLES, type RoleId } from '../lib/roles';
import { CIRCLE_NAME_PLACEHOLDERS } from '../lib/utils';
import { useIdentity } from '../lib/identity';
import { registerPushAndReport } from '../services/push';
import { setSharingEnabled } from '../services/tracking';

type Mode = 'welcome' | 'create' | 'join';

export default function Onboarding() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [step, setStep] = useState<'identity' | 'circle'>('identity');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleId | null>(null);
  const [circleName, setCircleName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = useIdentity((s) => s.signIn);

  const previewAvatar = useMemo(() => {
    const def = ROLES.find((r) => r.id === role);
    return def?.avatar ?? { shape: 'cercle', color: colors.ink, expression: 'neutre' };
  }, [role]);

  const registerFn = useMutation(api.auth.register);
  const createCircleFn = useMutation(api.circles.create);
  const joinCircleFn = useMutation(api.circles.join);

  async function finish() {
    setError(null);
    if (!name.trim()) return setError('What should the family call you?');
    if (!role) return setError('Pick who you are in the nest');
    if (mode === 'create' && !circleName.trim())
      return setError('Give your nest a name');
    if (mode === 'join' && code.trim().length !== 6)
      return setError('The invite code is 6 characters');

    setBusy(true);
    try {
      const res = await registerFn({
        name: name.trim(),
        role,
        avatar: previewAvatar,
      });
      if (mode === 'create') {
        await createCircleFn({ token: res.token, name: circleName.trim(), role });
      } else {
        await joinCircleFn({ token: res.token, code: code.trim().toUpperCase(), role });
      }
      await signIn(res.token);
      await setSharingEnabled(true);
      void registerPushAndReport();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/map');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg.includes('Invalid') ? 'That code does not exist — check with the sender' : msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const placeholder =
    CIRCLE_NAME_PLACEHOLDERS[Math.floor(Date.now() / 86400000) % CIRCLE_NAME_PLACEHOLDERS.length];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {mode === 'welcome' ? (
        <Welcome
          onCreate={() => {
            setMode('create');
            setStep('identity');
          }}
          onJoin={() => {
            setMode('join');
            setStep('identity');
          }}
        />
      ) : (
        <>
          <Text style={styles.kicker}>
            {mode === 'create' ? 'Create your nest' : 'Join a nest'}
          </Text>

          {step === 'identity' ? (
            <>
              <Text style={styles.heading}>Who are you in the nest?</Text>
              <View style={styles.previewRow}>
                <Bloub
                  size={132}
                  shape={previewAvatar.shape}
                  color={previewAvatar.color}
                  expression={previewAvatar.expression}
                  state="idle"
                  paper={colors.cream}
                  animate
                  playSpeed={0.8}
                />
                <View style={styles.previewText}>
                  <Input
                    value={name}
                    onChangeText={(t) => setName(t.slice(0, 24))}
                    placeholder="Your name"
                    autoFocus
                  />
                </View>
              </View>

              <View style={styles.roleGrid}>
                {ROLES.map((r) => {
                  const selected = role === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        setRole(r.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      }}
                      style={[styles.roleCard, selected && styles.roleCardSelected]}
                    >
                      <Bloub
                        size={46}
                        shape={r.avatar.shape}
                        color={r.avatar.color}
                        expression={r.avatar.expression}
                        state="idle"
                        paper={selected ? colors.coralSoft : colors.surface}
                        animate={selected}
                        playSpeed={0.9}
                        frozenAt={0.6}
                      />
                      <Text style={[styles.roleLabel, selected && { color: colors.ink }]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                label="Continue"
                onPress={() => setStep('circle')}
                disabled={!role || !name.trim()}
              />
            </>
          ) : (
            <>
              {mode === 'create' ? (
                <>
                  <Text style={styles.heading}>Name your nest</Text>
                  <Input
                    value={circleName}
                    onChangeText={(t) => setCircleName(t.slice(0, 32))}
                    placeholder={`e.g. ${placeholder}`}
                    autoFocus
                  />
                  <Text style={styles.hint}>
                    After this, invite your family with a code from the Family tab.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.heading}>Enter the family code</Text>
                  <Input
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="6 characters"
                    autoCapitalize="none"
                    centered
                    big
                    maxLength={6}
                    autoFocus
                  />
                  <Text style={styles.hint}>
                    Ask whoever created your family circle to share the code from
                    their Family tab.
                  </Text>
                </>
              )}
              <Button label={mode === 'create' ? 'Create nest' : 'Join nest'} onPress={finish} loading={busy} />
            </>
          )}

          <View style={styles.backRow}>
            <Button
              label={step === 'circle' ? 'Back' : 'Back to start'}
              variant="ghost"
              onPress={() => {
                if (step === 'circle') setStep('identity');
                else setMode('welcome');
              }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Welcome({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.welcome}>
      <View style={styles.familyRow}>
        <View style={styles.familyBlob1}>
          <Bloub size={104} shape="nuage" color={colors.rose} expression="heureux" state="idle" paper={colors.cream} animate playSpeed={0.9} />
        </View>
        <View style={styles.familyBlob2}>
          <Bloub size={84} shape="goutte" color={colors.amber} expression="curieux" state="idle" paper={colors.cream} animate playSpeed={1.1} />
        </View>
        <View style={styles.familyBlob3}>
          <Bloub size={64} shape="cercle" color={colors.mint} expression="excite" state="idle" paper={colors.cream} animate playSpeed={1.2} />
        </View>
      </View>

      <Text style={styles.logo}>Nestly</Text>
      <Text style={styles.tagline}>Your family, always within reach.</Text>
      <Text style={styles.sub}>
        See where everyone is, how they're travelling, and that their phones are
        safe — quietly, in one cozy place.
      </Text>

      <View style={styles.ctaStack}>
        <Button label="Create a family nest" icon="🏡" onPress={onCreate} />
        <Button label="Join with an invite code" variant="secondary" icon="🔗" onPress={onJoin} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.cream },
  content: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.l,
  },
  welcome: { alignItems: 'center', gap: spacing.m, paddingTop: spacing.xxxl * 2 },
  familyRow: { flexDirection: 'row', height: 130, marginTop: 20 },
  familyBlob1: { top: 10 },
  familyBlob2: { top: 26, marginLeft: -18 },
  familyBlob3: { top: 34, marginLeft: -14 },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 8,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'Nunito_700Bold',
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.s,
    fontFamily: 'Nunito_600SemiBold',
  },
  ctaStack: { marginTop: spacing.xl, gap: spacing.m, alignSelf: 'stretch' },
  kicker: { fontSize: 13, fontWeight: '800', color: colors.inkFaint, letterSpacing: 1.2 },
  heading: { fontSize: 24, fontWeight: '800', color: colors.ink, fontFamily: 'Nunito_800ExtraBold' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.l },
  previewText: { flex: 1 },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    justifyContent: 'space-between',
  },
  roleCard: {
    width: '31%',
    aspectRatio: 0.95,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  roleCardSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.coralSoft,
    ...shadow.card,
  },
  roleLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
    lineHeight: 19,
    fontFamily: 'Nunito_600SemiBold',
  },
  backRow: { marginTop: spacing.s },
});
