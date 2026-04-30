import { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';
import { getPromptsForArchetype, type Archetype } from '@/data/prompts-by-archetype';

interface QuickRepliesProps {
  onSelect: (message: string) => void | Promise<void>;
  visible?: boolean;
  archetype?: Archetype | null;
}

export function QuickReplies({ onSelect, visible = true, archetype }: QuickRepliesProps) {
  const { width } = useWindowDimensions();

  const prompts = useMemo(() => getPromptsForArchetype(archetype), [archetype]);

  if (!visible) return null;

  // Calcular largura do chip baseado na largura da tela
  // 2 chips por linha com padding e gap
  const chipWidth = (width - spacing.md * 2 - spacing.sm) / 2;

  return (
    <View style={styles.container}>
      {prompts.map((reply, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.chip, { width: chipWidth }]}
          onPress={() => onSelect(reply)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText} numberOfLines={2}>
            {reply}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    minHeight: 48,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
