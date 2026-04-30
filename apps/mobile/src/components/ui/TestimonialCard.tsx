import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import type { Testimonial } from '@/data/testimonials';

interface TestimonialCardProps {
  testimonial: Testimonial;
  compact?: boolean;
}

export function TestimonialCard({ testimonial, compact = false }: TestimonialCardProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Ionicons
        name="chatbubble-ellipses"
        size={compact ? 16 : 20}
        color={colors.primaryLight}
        style={styles.quoteIcon}
      />
      <Text style={[styles.text, compact && styles.textCompact]}>
        "{testimonial.text}"
      </Text>
      <View style={styles.footer}>
        <Text style={styles.name}>— {testimonial.name}</Text>
        {testimonial.result && (
          <View style={styles.resultBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.successDark} />
            <Text style={styles.resultText}>{testimonial.result}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...getShadow('sm'),
  },
  containerCompact: {
    padding: spacing.md,
  },
  quoteIcon: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    opacity: 0.3,
  },
  text: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  textCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  resultText: {
    ...typography.caption,
    color: colors.successDark,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
});
