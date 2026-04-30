import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface Stat {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  color?: string;
}

interface StatsRowProps {
  stats: Stat[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {stats.map((stat, index) => (
        <View key={index} style={styles.statCard}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${stat.color || colors.primary}15` },
            ]}
          >
            <Ionicons
              name={stat.icon}
              size={22}
              color={stat.color || colors.primary}
            />
          </View>
          <Text style={styles.value}>{stat.value}</Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: 90,
    ...getShadow('sm'),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginTop: spacing.xs,
  },
});
