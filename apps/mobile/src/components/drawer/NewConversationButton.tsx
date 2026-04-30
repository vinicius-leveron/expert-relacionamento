import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface NewConversationButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function NewConversationButton({
  onPress,
  disabled,
}: NewConversationButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      accessibilityLabel="Criar nova conversa"
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Ionicons name="add" size={20} color={colors.white} />
      </View>
      <Text style={styles.text}>Nova Conversa</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...getShadow('sm'),
  },
  disabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  text: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
