import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, radius, typography } from '@/theme';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = (current / total) * 100;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Pergunta {current} de {total}</Text>
        <Text style={styles.percentage}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  percentage: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  track: {
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.xs,
  },
});
