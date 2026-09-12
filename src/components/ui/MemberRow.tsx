import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../../theme/tokens';
import { MemberAvatar } from './MemberAvatar';
import { memberMood } from '../../lib/memberStatus';
import { roleLabel } from '../../lib/roles';
import { timeAgo } from '../../lib/utils';
import type { NestlyUser } from '../../lib/identity';

interface MemberRowProps {
  member: NestlyUser;
  onPress?: () => void;
  /** distance in meters from me, if known */
  distanceM?: number | null;
}

export function MemberRow({ member, onPress, distanceM }: MemberRowProps) {
  const mood = memberMood(member);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <MemberAvatar
        avatar={member.avatar}
        size={54}
        state={mood.state}
        expression={mood.expression}
      />
      <View style={styles.mid}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{member.name}</Text>
          {member.isOwner ? <Text style={styles.ownerTag}>Nest keeper</Text> : null}
        </View>
        <Text style={[styles.status, mood.tint === 'warn' && { color: colors.amber }, mood.tint === 'off' && { color: colors.inkFaint }]}>
          {mood.label}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.role}>{roleLabel(member.role, member.roleLabel)}</Text>
        {distanceM != null ? (
          <Text style={styles.distance}>
            {distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`}
          </Text>
        ) : (
          <Text style={styles.distance}>{timeAgo(member.lastSeen)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  mid: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink, fontFamily: 'Nunito_800ExtraBold' },
  ownerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.coral,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  status: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  right: { alignItems: 'flex-end', gap: 4 },
  role: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  distance: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
});
