import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, typography } from '../../theme/tokens';
import { useHaptics } from '../../hooks/useHaptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantStyle: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink, fg: colors.white },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.ink },
  danger: { bg: colors.danger, fg: colors.white },
  success: { bg: colors.mint, fg: colors.white },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: ButtonProps) {
  const haptic = useHaptics();
  const v = variantStyle[variant];
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        haptic();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : null,
        { backgroundColor: v.bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        v.border ? { borderWidth: 1.5, borderColor: v.border } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Text style={{ fontSize: small ? 15 : 17 }}>{icon}</Text> : null}
          <Text
            style={{
              ...typography.button,
              color: v.fg,
              fontSize: small ? 14 : 16,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  small: {
    height: 42,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
