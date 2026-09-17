import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../../../convex/_generated/api';
import {
  Bloub,
  COLOR_PALETTE,
  EXPRESSION_IDS,
  SHAPE_IDS,
} from '../../components/Bloub';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { colors, radius, shadow, typography } from '../../theme/tokens';
import { useIdentity, useMyToken } from '../../lib/identity';
import { useMeSync } from '../../lib/useMeSync';
import { useCircle } from '../../lib/useCircle';
import { memberMood, motionKey, motionLabel } from '../../lib/memberStatus';
import { ROLES, roleAvatar, roleLabel, type RoleId } from '../../lib/roles';
import {
  getSharingEnabled,
  setSharingEnabled,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../services/tracking';
import { hapticSuccess, useHaptics } from '../../hooks/useHaptics';
import { useNow } from '../../hooks/useNow';

export default function Me() {
  const token = useMyToken();
  const me = useMeSync();
  const { circle } = useCircle();
  const haptic = useHaptics();
  const now = useNow();
  const signOut = useIdentity((s) => s.signOut);

  const updateProfile = useMutation(api.auth.updateProfile);
  const regenerateCode = useMutation(api.circles.regenerateCode);

  const batteryLevel = Battery.useBatteryLevel();
  const batteryState = Battery.useBatteryState();

  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleId>('mom');
  const [roleLabelText, setRoleLabelText] = useState('');
  const [shape, setShape] = useState('cercle');
  const [color, setColor] = useState('#3b93f0');
  const [expression, setExpression] = useState('neutre');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);

  useEffect(() => {
    if (!me || hydrated) return;
    setHydrated(true);
    setName(me.name);
    const def = ROLES.find((r) => r.id === me.role);
    setRole(def ? def.id : 'custom');
    setRoleLabelText(me.roleLabel ?? '');
    setShape(me.avatar.shape);
    setColor(me.avatar.color);
    setExpression(me.avatar.expression);
  }, [me, hydrated]);

  useEffect(() => {
    void getSharingEnabled().then(setSharing);
  }, []);

  const batteryPct =
    batteryLevel !== null && batteryLevel >= 0
      ? Math.round(batteryLevel * 100)
      : null;
  const charging =
    batteryState === Battery.BatteryState.CHARGING ||
    batteryState === Battery.BatteryState.FULL;

  if (!me) return <View style={styles.flex} />;

  const mood = memberMood(me, now);
  const speed = me.speed ?? null;
  const deviceLine = [
    Device.modelName ?? 'Phone',
    motionKey(speed) !== 'still' ? motionLabel(speed) : null,
    batteryPct !== null ? `${batteryPct}%` : null,
    charging ? 'charging' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function pickRole(id: RoleId) {
    setRole(id);
    if (id !== 'custom') {
      const def = roleAvatar(id);
      setShape(def.shape);
      setColor(def.color);
      setExpression(def.expression);
    }
  }

  async function saveChanges() {
    const trimmed = name.trim();
    if (!token || saving || !trimmed) return;
    setSaving(true);
    try {
      await updateProfile({
        token,
        name: trimmed,
        role,
        roleLabel: role === 'custom' ? roleLabelText.trim() : '',
        avatar: { shape, color, expression },
      });
      hapticSuccess();
      setEditOpen(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  function toggleSharing(value: boolean) {
    setSharing(value);
    void setSharingEnabled(value);
    if (value) void startBackgroundTracking();
    else void stopBackgroundTracking();
  }

  function shareInvite() {
    if (!circle) return;
    void Share.share({
      message: `Join our family on Nestly! Open the app and enter code: ${circle.code}`,
    });
  }

  async function doRegenerate() {
    if (!token) return;
    setConfirmCode(false);
    try {
      await regenerateCode({ token });
      hapticSuccess();
    } catch {
    }
  }

  async function doSignOut() {
    setConfirmSignOut(false);
    await stopBackgroundTracking();
    await signOut();
    router.replace('/onboarding');
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Me</Text>

      <View style={styles.card}>
        <View style={styles.center}>
          <Bloub
            size={96}
            state={mood.state}
            shape={me.avatar.shape}
            color={me.avatar.color}
            expression={mood.expression}
            paper={colors.cream}
            animate
          />
        </View>
        <Text style={styles.profileName}>{me.name}</Text>
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>
            {roleLabel(me.role, me.roleLabel)}
          </Text>
        </View>
        <Text style={styles.deviceLine}>{deviceLine}</Text>
        <View style={styles.editRow}>
          <Button
            label="Edit profile"
            variant="secondary"
            small
            onPress={() => setEditOpen(true)}
          />
          {savedTick ? <Text style={styles.savedTick}>Saved</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This device</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device</Text>
          <Text style={styles.infoValue}>{Device.modelName ?? 'Phone'}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Battery</Text>
          <Text style={styles.infoValue}>
            {batteryPct !== null
              ? `${batteryPct}%${charging ? ' · charging' : ''}`
              : '—'}
          </Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location sharing</Text>
          <Switch
            value={sharing ?? false}
            disabled={sharing === null}
            onValueChange={toggleSharing}
            trackColor={{ true: colors.coral, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {circle ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nest</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Circle</Text>
            <Text style={styles.infoValue}>{circle.name}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invite code</Text>
            <Text style={styles.codeValue}>{circle.code}</Text>
          </View>
          <Button
            label="Share invite"
            variant="secondary"
            small
            onPress={shareInvite}
            style={styles.shareBtn}
          />
          {me.isOwner ? (
            <Pressable
              style={styles.ghostRow}
              onPress={() => {
                haptic();
                setConfirmCode(true);
              }}
            >
              <Text style={styles.ghostRowText}>New code</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Pressable
          style={styles.infoRow}
          onPress={() => setConfirmSignOut(true)}
        >
          <Text style={[styles.infoLabel, { color: colors.danger }]}>
            Sign out
          </Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        Nestly · v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>

      <Sheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            label="Name"
            maxLength={40}
          />
          <Text style={styles.sheetLabel}>Role</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  haptic();
                  pickRole(r.id);
                }}
                style={[styles.roleOption, role === r.id && styles.selectedRing]}
              >
                <Text style={styles.roleOptionLabel}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          {role === 'custom' ? (
            <Input
              value={roleLabelText}
              onChangeText={setRoleLabelText}
              placeholder="Auntie, uncle, cousin…"
              label="Role label"
              maxLength={24}
            />
          ) : null}
          <Text style={styles.sheetLabel}>Avatar</Text>
          <View style={styles.preview}>
            <Bloub
              size={110}
              state="idle"
              shape={shape}
              color={color}
              expression={expression}
              paper={colors.cream}
              animate
            />
          </View>
          <Text style={styles.rowLabel}>Shape</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            {SHAPE_IDS.map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  haptic();
                  setShape(id);
                }}
                style={[styles.shapeBtn, shape === id && styles.selectedRing]}
              >
                <Bloub
                  size={34}
                  shape={id}
                  color={color}
                  expression={expression}
                  paper={colors.cream}
                />
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.rowLabel}>Color</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            {COLOR_PALETTE.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  haptic();
                  setColor(c.hex);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: c.hex },
                  color.toLowerCase() === c.hex.toLowerCase() &&
                    styles.selectedRing,
                ]}
              />
            ))}
          </ScrollView>
          <Text style={styles.rowLabel}>Expression</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            {EXPRESSION_IDS.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => {
                  haptic();
                  setExpression(e.id);
                }}
                style={[
                  styles.exprChip,
                  expression === e.id && styles.selectedRing,
                ]}
              >
                <Bloub
                  size={30}
                  shape={shape}
                  color={color}
                  expression={e.id}
                  paper={colors.cream}
                />
                <Text style={styles.exprLabel}>{e.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={saveChanges}
            disabled={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </Sheet>

      <Sheet
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
      >
        <Text style={styles.sheetBody}>
          You'll need your invite code to come back to the nest.
        </Text>
        <Button
          label="Sign out"
          variant="danger"
          onPress={doSignOut}
          style={{ marginTop: 12 }}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setConfirmSignOut(false)}
          style={{ marginTop: 8 }}
        />
      </Sheet>

      <Sheet
        visible={confirmCode}
        onClose={() => setConfirmCode(false)}
        title="New invite code?"
      >
        <Text style={styles.sheetBody}>
          The old code stops working. Share the new one with family.
        </Text>
        <Button
          label="New code"
          onPress={doRegenerate}
          style={{ marginTop: 12 }}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setConfirmCode(false)}
          style={{ marginTop: 8 }}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  screenTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: colors.ink,
    paddingTop: 48,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
  center: { alignItems: 'center' },
  profileName: { ...typography.heading, textAlign: 'center' },
  roleChip: {
    alignSelf: 'center',
    backgroundColor: colors.creamDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  deviceLine: {
    ...typography.small,
    textAlign: 'center',
    color: colors.inkFaint,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  savedTick: { fontSize: 14, fontWeight: '800', color: colors.mint },
  cardTitle: { ...typography.heading },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  codeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 2,
  },
  separator: { height: 1, backgroundColor: colors.border },
  shareBtn: { alignSelf: 'stretch' },
  ghostRow: { alignItems: 'center', paddingVertical: 4 },
  ghostRowText: { fontSize: 14, fontWeight: '800', color: colors.coral },
  sheetScroll: { maxHeight: 480 },
  sheetContent: { gap: 14, paddingBottom: 8 },
  sheetLabel: { ...typography.tiny, color: colors.inkFaint },
  sheetBody: {
    ...typography.bodySoft,
    marginBottom: 4,
  },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.m,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { ...typography.tiny, color: colors.inkFaint, marginTop: -6 },
  hRow: { gap: 10, paddingVertical: 4 },
  shapeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.cream,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  exprChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exprLabel: { fontSize: 12, fontWeight: '700', color: colors.ink },
  selectedRing: { borderColor: colors.coral },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  roleOptionLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  saveBtn: { marginTop: 4 },
  footer: {
    ...typography.tiny,
    textAlign: 'center',
    marginTop: 8,
  },
});
