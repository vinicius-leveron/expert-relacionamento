import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface StreakBadgeProps {
  days: number;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StreakBadge({
  days,
  onPress,
  size = 'md',
  showLabel = true,
}: StreakBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for the badge
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    // Flame flicker animation
    const flicker = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(flameAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ])
    );

    if (days > 0) {
      pulse.start();
      flicker.start();
    }

    return () => {
      pulse.stop();
      flicker.stop();
    };
  }, [days, pulseAnim, flameAnim]);

  const sizeConfig = {
    sm: { icon: 16, text: 12, padding: spacing.xs, gap: 2 },
    md: { icon: 20, text: 14, padding: spacing.sm, gap: spacing.xs },
    lg: { icon: 24, text: 16, padding: spacing.sm + 2, gap: spacing.xs },
  };

  const config = sizeConfig[size];
  const isActive = days > 0;

  const flameOpacity = flameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.7],
  });

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${days} dias de streak`}
    >
      <Animated.View
        style={[
          styles.container,
          {
            paddingHorizontal: config.padding,
            paddingVertical: config.padding - 2,
            gap: config.gap,
            transform: [{ scale: isActive ? pulseAnim : 1 }],
            backgroundColor: isActive ? colors.warningLight : colors.gray100,
          },
        ]}
      >
        <Animated.View style={{ opacity: isActive ? flameOpacity : 1 }}>
          <Ionicons
            name="flame"
            size={config.icon}
            color={isActive ? colors.warningDark : colors.textMuted}
          />
        </Animated.View>
        <Text
          style={[
            styles.count,
            {
              fontSize: config.text,
              color: isActive ? colors.warningDark : colors.textMuted,
            },
          ]}
        >
          {days}
        </Text>
        {showLabel && size !== 'sm' && (
          <Text
            style={[
              styles.label,
              { color: isActive ? colors.warningDark : colors.textMuted },
            ]}
          >
            {days === 1 ? 'dia' : 'dias'}
          </Text>
        )}
      </Animated.View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    ...getShadow('sm'),
  },
  count: {
    fontFamily: 'Inter_700Bold',
  },
  label: {
    ...typography.caption,
    fontFamily: 'Inter_500Medium',
  },
});
