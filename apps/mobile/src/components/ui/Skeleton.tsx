import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%' as const,
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as number | `${number}%`,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Predefined skeleton patterns
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '60%' as const : '100%' as const}
          height={14}
          style={index > 0 ? styles.textLine : undefined}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonAvatar size={40} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={12} style={styles.mt4} />
        </View>
      </View>
      <SkeletonText lines={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.gray200,
  },
  textContainer: {
    gap: 8,
  },
  textLine: {
    marginTop: 4,
  },
  mt4: {
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
});
