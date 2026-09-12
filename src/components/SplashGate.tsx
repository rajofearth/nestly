import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bloub } from './Bloub';
import { colors } from '../theme/tokens';

/** Warm splash while fonts/identity load: a single bloub floating. */
export function SplashGate() {
  return (
    <View style={styles.wrap}>
      <Bloub
        size={120}
        state="idle"
        expression="neutre"
        color={colors.ink}
        paper={colors.cream}
        animate
        playSpeed={0.7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
});
