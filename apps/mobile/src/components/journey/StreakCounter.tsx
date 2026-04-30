import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface StreakCounterProps {
  streak: number;
  bestStreak?: number;
}

export function StreakCounter({ streak, bestStreak = 0 }: StreakCounterProps) {
  const isOnFire = streak >= 3;

  return (
    <View style={styles.container}>
      <View style={styles.mainStreak}>
        <View style={[styles.fireIcon, isOnFire && styles.fireIconActive]}>
          <Ionicons
            name="flame"
            size={24}
            color={isOnFire ? colors.warning : colors.textMuted}
          />
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>
            {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </Text>
        </View>
      </View>

      {bestStreak > 0 && (
        <View style={styles.bestStreak}>
          <Ionicons name="trophy" size={14} color={colors.warning} />
          <Text style={styles.bestStreakText}>Recorde: {bestStreak}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...getShadow('sm'),
  },
  mainStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fireIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fireIconActive: {
    backgroundColor: colors.warningLight,
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  streakNumber: {
    ...typography.h1,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  streakLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  bestStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  bestStreakText: {
    ...typography.caption,
    color: colors.warningDark,
    fontFamily: 'Inter_500Medium',
  },
});
