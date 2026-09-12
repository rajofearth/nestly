import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
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
import { batteryLabel } from '../../lib/memberStatus';
import { ROLES, roleAvatar, roleLabel, type RoleId } from '../../lib/roles';
import {
  getSharingEnabled,
  setSharingEnabled,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../services/tracking';
import { hapticSuccess, useHaptics } from '../../hooks/useHaptics';

export default function Me() {
  const token = useMyToken();
  const me = useMeSync();
  const { circle } = useCircle();
  const haptic = useHaptics();
  const signOut = useIdentity((s) => s.signOut);

  const updateProfile = useMutation(api.auth.updateProfile);
  const regenerateCode = useMutation(api.circles.regenerateCode);

  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleId>('mom');
  const [roleLabelText, setRoleLabelText] = useState('');
  const [shape, setShape] = useState('cercle');
  const [color, setColor] = useState('#3b93f0');
  const [expression, setExpression] = useState('neutre');
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

  if (!me) return <View style={styles.flex} />;

  function saveName() {
    const trimmed = name.trim();
    if (!token || !trimmed || trimmed === me?.name) return;
    updateProfile({ token, name: trimmed }).catch(() => {});
  }

  function pickRole(id: RoleId) {
    setRole(id);
    if (id !== 'custom') {
      const def = roleAvatar(id);
      setShape(def.shape);
      setColor(def.color);
      setExpression(def.expression);
    }
  }

  async function saveAvatar() {
    if (!token || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        token,
        avatar: { shape, color, expression },
        role,
        roleLabel: role === 'custom' ? roleLabelText.trim() : '',
      });
      hapticSuccess();
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
    } catch {
      // keep the draft — user can retry
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

  async function doSignOut() {
    setConfirmSignOut(false);
    await stopBackgroundTracking();
    await signOut();
    router.replace('/onboarding');
  }

  async function doRegenerate() {
    if (!token) return;
    setConfirmCode(false);
    try {
      await regenerateCode({ token });
      hapticSuccess();
    } catch {
      // ignore — code stays as is
    }
  }

  const battery = batteryLabel(me);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Me</Text>

      <View style={styles.card}>
        <View style={styles.center}>
          <Bloub
            size={120}
            state="idle"
            shape={me.avatar.shape}
            color={me.avatar.color}
            expression={me.avatar.expression}
            paper={colors.cream}
            animate
          />
        </View>
        <Text style={styles.profileName}>{name.trim() || me.name}</Text>
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>
            {roleLabel(role, role === 'custom' ? roleLabelText : undefined)}
          </Text>
        </View>
        <View style={styles.nameRow}>
          <View style={styles.nameInput}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              maxLength={40}
            />
          </View>
          <Button label="Save" small onPress={saveName} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your avatar</Text>
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
                frozenAt={1.2}
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
                color.toLowerCase() === c.hex.toLowerCase() && styles.selectedRing,
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
                frozenAt={1.2}
              />
              <Text style={styles.exprLabel}>{e.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.saveRow}>
          <Button
            label={saving ? 'Saving…' : 'Save avatar'}
            onPress={saveAvatar}
            disabled={saving}
            style={styles.saveBtn}
          />
          {savedTick ? <Text style={styles.savedTick}>Saved ✓</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Role</Text>
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
              <Text style={styles.roleEmoji}>{r.emoji}</Text>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This device</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>📱</Text>
          <Text style={styles.infoLabel}>Device</Text>
          <Text style={styles.infoValue}>{Device.modelName ?? 'Phone'}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>🔋</Text>
          <Text style={styles.infoLabel}>Battery</Text>
          <Text style={styles.infoValue}>{battery ? battery.text : '—'}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>🚀</Text>
          <Text style={styles.infoLabel}>Speed</Text>
          <Text style={styles.infoValue}>—</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>📍</Text>
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {me.isOwner && circle ? (
          <>
            <Pressable
              style={styles.infoRow}
              onPress={() => setConfirmCode(true)}
            >
              <Text style={styles.infoEmoji}>🔑</Text>
              <Text style={styles.infoLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{circle.code}</Text>
              <Text style={styles.linkText}>Regenerate</Text>
            </Pressable>
            <View style={styles.separator} />
          </>
        ) : null}
        <Pressable style={styles.infoRow} onPress={() => setConfirmSignOut(true)}>
          <Text style={styles.infoEmoji}>🚪</Text>
          <Text style={[styles.infoLabel, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>Nestly keeps your family close. Made with care.</Text>
      <Text style={styles.version}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>

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
        title="Regenerate invite code?"
      >
        <Text style={styles.sheetBody}>
          The old code stops working. Share the new one with family.
        </Text>
        <Button
          label="Regenerate"
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
  title: { ...typography.title, paddingTop: 48 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { flex: 1 },
  cardTitle: { ...typography.heading },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.m,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { ...typography.tiny, color: colors.inkFaint, marginTop: 4 },
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
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  saveBtn: { flex: 1, alignSelf: 'stretch' },
  savedTick: { fontSize: 14, fontWeight: '800', color: colors.mint },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleEmoji: { fontSize: 15 },
  roleOptionLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  infoEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  codeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 2,
  },
  linkText: { fontSize: 13, fontWeight: '800', color: colors.coral },
  separator: { height: 1, backgroundColor: colors.border },
  footer: {
    ...typography.tiny,
    textAlign: 'center',
    marginTop: 8,
  },
  version: {
    ...typography.tiny,
    textAlign: 'center',
    color: colors.inkFaint,
  },
  sheetBody: {
    ...typography.bodySoft,
    marginBottom: 4,
  },
});
