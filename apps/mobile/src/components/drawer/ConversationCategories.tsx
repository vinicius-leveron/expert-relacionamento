import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme';

export interface ConversationCategory {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  prompt: string;
}

interface ConversationCategoriesProps {
  categories: ConversationCategory[];
  onSelect: (category: ConversationCategory) => void | Promise<void>;
  disabled?: boolean;
}

export const ConversationCategories = memo(function ConversationCategories({
  categories,
  onSelect,
  disabled = false,
}: ConversationCategoriesProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Categorias</Text>

      <View style={styles.list}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.card, disabled && styles.cardDisabled]}
            onPress={() => onSelect(category)}
            activeOpacity={0.82}
            disabled={disabled}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={category.icon} size={18} color={colors.primary} />
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>{category.title}</Text>
              <Text style={styles.description} numberOfLines={2}>
                {category.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingBottom: spacing.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.gray50,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
});
