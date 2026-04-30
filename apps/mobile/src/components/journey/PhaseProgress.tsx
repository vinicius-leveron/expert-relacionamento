import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/theme';

interface Phase {
  name: string;
  days: [number, number];
}

const PHASES: Phase[] = [
  { name: 'Consciência', days: [1, 10] },
  { name: 'Experimentação', days: [11, 20] },
  { name: 'Integração', days: [21, 30] },
];

interface PhaseProgressProps {
  currentDay: number;
}

export function PhaseProgress({ currentDay }: PhaseProgressProps) {
  const getCurrentPhaseIndex = () => {
    for (let i = 0; i < PHASES.length; i++) {
      if (currentDay >= PHASES[i].days[0] && currentDay <= PHASES[i].days[1]) {
        return i;
      }
    }
    return 0;
  };

  const currentPhaseIndex = getCurrentPhaseIndex();

  return (
    <View style={styles.container}>
      <View style={styles.phases}>
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;
          const isFuture = index > currentPhaseIndex;

          return (
            <View key={phase.name} style={styles.phaseItem}>
              {/* Connector line */}
              {index > 0 && (
                <View
                  style={[
                    styles.connector,
                    isCompleted || isCurrent
                      ? styles.connectorActive
                      : styles.connectorInactive,
                  ]}
                />
              )}

              {/* Phase circle */}
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isCurrent && styles.circleCurrent,
                  isFuture && styles.circleFuture,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      isCurrent && styles.circleTextCurrent,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Phase name */}
              <Text
                style={[
                  styles.phaseName,
                  isCurrent && styles.phaseNameCurrent,
                  isFuture && styles.phaseNameFuture,
                ]}
              >
                {phase.name}
              </Text>

              {/* Days range */}
              <Text style={styles.daysRange}>
                Dias {phase.days[0]}-{phase.days[1]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  phases: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  phaseItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 16,
    right: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
  },
  connectorActive: {
    backgroundColor: colors.primary,
  },
  connectorInactive: {
    backgroundColor: colors.gray200,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  circleCompleted: {
    backgroundColor: colors.primary,
  },
  circleCurrent: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  circleFuture: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  circleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  circleTextCurrent: {
    color: colors.primary,
  },
  phaseName: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  phaseNameCurrent: {
    color: colors.primary,
  },
  phaseNameFuture: {
    color: colors.textMuted,
  },
  daysRange: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
