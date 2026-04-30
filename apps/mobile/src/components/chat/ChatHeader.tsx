import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface ChatHeaderProps {
  name?: string;
  subtitle?: string;
  isTyping?: boolean;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  onDrawerPress?: () => void;
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 150),
      animate(dot3, 300),
    ]);

    animation.start();
    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const getDotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
  });

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>Digitando</Text>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[styles.typingDot, getDotStyle(dot)]} />
      ))}
    </View>
  );
}

export function ChatHeader({
  name = 'Isabela',
  subtitle = 'Sua coach de relacionamentos',
  isTyping = false,
  onBackPress,
  onMenuPress,
  onDrawerPress,
}: ChatHeaderProps) {
  return (
    <View style={styles.container}>
      {onDrawerPress && (
        <TouchableOpacity
          onPress={onDrawerPress}
          style={styles.drawerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Abrir menu de conversas"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      {onBackPress && (
        <TouchableOpacity
          onPress={onBackPress}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>I</Text>
        </View>
        <View style={styles.onlineIndicator} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {isTyping ? (
          <TypingDots />
        ) : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      {onMenuPress && (
        <TouchableOpacity
          onPress={onMenuPress}
          style={styles.menuButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  drawerButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.sm + 4,
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('sm'),
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.white,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
    fontFamily: 'Inter_400Regular',
  },
  menuButton: {
    padding: spacing.sm,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  typingText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
    marginRight: 2,
  },
  typingDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
    marginLeft: 2,
  },
});
