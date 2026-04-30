import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { ProgressBar } from '@/components/ui';

interface JourneyProgressProps {
  progress: number; // 0-100
  subtitle?: string;
  onPress?: () => void;
}

export function JourneyProgress({
  progress,
  subtitle = 'Continue conversando para desbloquear novos insights',
  onPress,
}: JourneyProgressProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
      accessibilityLabel={`Sua jornada: ${progress}% completo`}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="compass" size={20} color={colors.primary} />
          <Text style={styles.title}>Sua Jornada</Text>
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </View>

      <ProgressBar progress={progress} height={10} />

      <Text style={styles.subtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
  },
});
