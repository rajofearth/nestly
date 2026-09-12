import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

export function StatPill({
  emoji,
  text,
  tint = 'ok',
}: {
  emoji: string;
  text: string;
  tint?: 'ok' | 'warn' | 'off';
}) {
  return (
    <View
      style={[
        styles.pill,
        tint === 'warn' && { backgroundColor: colors.amberSoft },
        tint === 'off' && { backgroundColor: colors.border },
      ]}
    >
      <Text style={{ fontSize: 12 }}>{emoji}</Text>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  action: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mintSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.ink },
});
