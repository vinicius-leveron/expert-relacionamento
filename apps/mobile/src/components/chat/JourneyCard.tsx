import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, getShadow } from '@/theme';
import type { DayCardData } from '@/utils/message-parser';

interface JourneyCardProps {
  data: DayCardData;
  onPress?: () => void;
}

function getPhaseInfo(day: number) {
  if (day <= 10) {
    return { phase: 'Consciência', color: colors.info, icon: 'eye' as const };
  } else if (day <= 20) {
    return { phase: 'Experimentação', color: colors.warning, icon: 'flask' as const };
  } else {
    return { phase: 'Integração', color: colors.success, icon: 'leaf' as const };
  }
}

export function JourneyCard({ data, onPress }: JourneyCardProps) {
  const phaseInfo = getPhaseInfo(data.day);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      {/* Header com dia e fase */}
      <View style={styles.header}>
        <View style={[styles.dayBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.dayNumber}>{data.day}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.dayLabel}>Dia {data.day} de 30</Text>
          <View style={styles.phaseRow}>
            <Ionicons name={phaseInfo.icon} size={14} color={phaseInfo.color} />
            <Text style={[styles.phaseName, { color: phaseInfo.color }]}>
              {phaseInfo.phase}
            </Text>
          </View>
        </View>
      </View>

      {/* Título do dia */}
      <Text style={styles.title}>{data.title}</Text>

      {/* Descrição/exercício */}
      <Text style={styles.description}>{data.description}</Text>

      {/* Call to action */}
      {onPress && (
        <View style={styles.ctaContainer}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Começar reflexão</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...getShadow('sm'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  dayNumber: {
    ...typography.h3,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  headerText: {
    flex: 1,
  },
  dayLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  phaseName: {
    ...typography.caption,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  ctaContainer: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  ctaText: {
    ...typography.buttonSmall,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
