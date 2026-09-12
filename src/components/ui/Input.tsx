import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoFocus?: boolean;
  centered?: boolean;
  error?: string | null;
  big?: boolean;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  multiline,
  maxLength,
  autoCapitalize = 'sentences',
  autoFocus,
  centered,
  error,
  big,
}: InputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        style={[
          styles.input,
          multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 },
          centered && { textAlign: 'center' },
          big && { fontSize: 22, fontWeight: '800', minHeight: 64 },
          error ? { borderColor: colors.danger } : null,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginLeft: 4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  error: { fontSize: 12, fontWeight: '700', color: colors.danger, marginLeft: 4 },
});
