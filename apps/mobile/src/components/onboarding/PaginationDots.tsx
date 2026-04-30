import { View, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '@/theme';

interface PaginationDotsProps {
  total: number;
  current: number;
}

export function PaginationDots({ total, current }: PaginationDotsProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotInactive: {
    backgroundColor: colors.gray200,
  },
});
