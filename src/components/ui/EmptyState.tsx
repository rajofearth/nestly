import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../../theme/tokens';
import { Bloub, type StateId } from '../Bloub';

interface EmptyStateProps {
  bloub?: {
    state?: StateId;
    expression?: string;
    color?: string;
    size?: number;
  };
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  bloub,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Bloub
        size={bloub?.size ?? 120}
        state={bloub?.state ?? 'sleep'}
        expression={bloub?.expression ?? 'neutre'}
        color={bloub?.color ?? colors.inkSoft}
        paper={colors.cream}
      />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...shadow.card,
  },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
