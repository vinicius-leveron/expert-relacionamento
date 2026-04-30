import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, spacing, radius, sizes } from '@/theme';

interface TypingIndicatorProps {
  visible: boolean;
}

export function TypingIndicator({ visible }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      createAnimation(dot1, 0),
      createAnimation(dot2, 150),
      createAnimation(dot3, 300),
    ]);

    animation.start();

    return () => {
      animation.stop();
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
    };
  }, [visible, dot1, dot2, dot3]);

  if (!visible) return null;

  const dotStyle = (animValue: Animated.Value) => ({
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>I</Text>
      </View>

      {/* Bubble with dots */}
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dotStyle(dot1)]} />
        <Animated.View style={[styles.dot, dotStyle(dot2)]} />
        <Animated.View style={[styles.dot, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
  },
  avatar: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: sizes.avatarSm / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: spacing.md + 2,
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
});
