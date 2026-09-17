import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bloub } from '../Bloub';
import { colors } from '../../theme/tokens';
import type { Avatar as AvatarSpec } from '../../lib/identity';

interface MemberAvatarProps {
  avatar: AvatarSpec;
  role?: string;
  size?: number;
  ring?: boolean;
  state?: string;
  expression?: string;
}

/**
 * A member's bloub avatar. Expression can be overridden (e.g. reacting to
 * battery level, movement, alerts) — falls back to the member's chosen one.
 */
export const MemberAvatar = memo(function MemberAvatar({
  avatar,
  size = 48,
  ring = true,
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
          animate
        />
      </View>
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
});
