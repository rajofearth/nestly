import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIdentity } from '../lib/identity';
import { logError } from '../services/logger';
import { colors, spacing, typography } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  crashed: boolean;
}

export class CrashBoundary extends React.Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const message = info.componentStack
      ? `${error.message}\n${info.componentStack}`
      : error.message;
    logError('react-boundary', message, error);
  }

  private handleReset = () => {
    void useIdentity.getState().signOut().finally(() => {
      this.setState({ crashed: false });
      router.replace('/onboarding');
    });
  };

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Nestly hit a snag</Text>
        <Text style={styles.body}>Restarting…</Text>
        <Pressable style={styles.button} onPress={this.handleReset}>
          <Text style={styles.buttonText}>Reset & start over</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
    padding: spacing.xl,
  },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.bodySoft, textAlign: 'center' },
  button: {
    marginTop: spacing.m,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
  },
  buttonText: { ...typography.button, color: colors.white },
});
