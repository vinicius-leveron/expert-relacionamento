import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';
import type { QuickRepliesData } from '@/utils/message-parser';

interface QuickReplyButtonsProps {
  data: QuickRepliesData;
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export function QuickReplyButtons({
  data,
  onSelect,
  disabled = false,
}: QuickReplyButtonsProps) {
  return (
    <View style={styles.container}>
      {data.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={() => onSelect(option)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  button: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
  },
  buttonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
});
