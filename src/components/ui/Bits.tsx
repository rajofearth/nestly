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
  text,
  tint = 'ok',
}: {
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
      <View
        style={[
          styles.dot,
          tint === 'warn' && { backgroundColor: colors.amber },
          tint === 'off' && { backgroundColor: colors.inkFaint },
        ]}
      />
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
    gap: 6,
    backgroundColor: colors.mintSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mint },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.ink },
});
