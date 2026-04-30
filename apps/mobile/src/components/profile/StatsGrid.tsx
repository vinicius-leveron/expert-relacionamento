import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface Stat {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  color?: string;
}

interface StatsGridProps {
  stats: Stat[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <View key={index} style={styles.statItem}>
          <View style={[styles.iconContainer, { backgroundColor: `${stat.color || colors.primary}15` }]}>
            <Ionicons
              name={stat.icon}
              size={20}
              color={stat.color || colors.primary}
            />
          </View>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...getShadow('sm'),
  },
  statItem: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.h2,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});
