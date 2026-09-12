import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloub } from '../Bloub';
import { colors, radius, shadow } from '../../theme/tokens';
import { roleAvatar, roleEmoji } from '../../lib/roles';
import type { Avatar as AvatarSpec } from '../../lib/identity';

interface MemberAvatarProps {
  avatar: AvatarSpec;
  role?: string;
  size?: number;
  ring?: boolean;
  badge?: string;
  state?: string;
  expression?: string;
}

/**
 * A member's bloub avatar. Expression can be overridden (e.g. reacting to
 * battery level, movement, alerts) — falls back to the member's chosen one.
 */
export const MemberAvatar = memo(function MemberAvatar({
  avatar,
  role,
  size = 48,
  ring = true,
  badge,
  state,
  expression,
}: MemberAvatarProps) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          ring ? { borderWidth: 2.5, borderColor: colors.surface } : null,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Bloub
          size={size - 4}
          shape={avatar.shape}
          color={avatar.color}
          expression={expression ?? avatar.expression}
          state={state ?? 'idle'}
          paper={colors.cream}
          frozenAt={1.2}
        />
      </View>
      {badge ? (
        <View style={[styles.badge, { left: size * 0.62, bottom: -2 }]}>
          <Text style={{ fontSize: size * 0.2 }}>{badge ?? roleEmoji(role)}</Text>
        </View>
      ) : role ? (
        <View style={[styles.badge, { left: size * 0.62, bottom: -2 }]}>
          <Text style={{ fontSize: size * 0.2 }}>{roleEmoji(role)}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});
