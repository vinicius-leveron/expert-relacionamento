import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface DayCardProps {
  day: number;
  title: string;
  description: string;
  isCompleted?: boolean;
  onPress?: () => void;
}

export function DayCard({
  day,
  title,
  description,
  isCompleted = false,
  onPress,
}: DayCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayLabel}>Dia</Text>
          <Text style={styles.dayNumber}>{day}</Text>
        </View>

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.completedText}>Completo</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {description}
      </Text>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.buttonText}>
            {isCompleted ? 'Revisar' : 'Começar'}
          </Text>
          <Ionicons
            name={isCompleted ? 'refresh' : 'arrow-forward'}
            size={16}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  dayBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dayLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  dayNumber: {
    ...typography.h1,
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completedText: {
    ...typography.caption,
    color: colors.success,
    fontFamily: 'Inter_500Medium',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    alignItems: 'flex-start',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.buttonSmall,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
