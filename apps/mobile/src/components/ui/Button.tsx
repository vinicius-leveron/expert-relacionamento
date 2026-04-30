import { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'right',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (!loading && !disabled) {
      onPress();
    }
  };

  const isDisabled = disabled || loading;

  const getContainerStyle = () => {
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: styles.container_primary,
      secondary: styles.container_secondary,
      outline: styles.container_outline,
      ghost: styles.container_ghost,
      danger: styles.container_danger,
    };

    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      sm: styles.container_sm,
      md: styles.container_md,
      lg: styles.container_lg,
    };

    return [
      styles.container,
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && styles.fullWidth,
      isDisabled && styles.disabled,
      style,
    ];
  };

  const getTextStyle = () => {
    const variantTextStyles: Record<ButtonVariant, TextStyle> = {
      primary: styles.text_primary,
      secondary: styles.text_secondary,
      outline: styles.text_outline,
      ghost: styles.text_ghost,
      danger: styles.text_danger,
    };

    const sizeTextStyles: Record<ButtonSize, TextStyle> = {
      sm: styles.text_sm,
      md: styles.text_md,
      lg: styles.text_lg,
    };

    return [styles.text, variantTextStyles[variant], sizeTextStyles[size]];
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  const iconColor = variant === 'primary' || variant === 'danger'
    ? colors.white
    : variant === 'secondary'
    ? colors.textPrimary
    : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={getContainerStyle()}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        accessibilityLabel={accessibilityLabel || title}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary}
            size="small"
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} />
            )}
            <Text style={getTextStyle()}>{title}</Text>
            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} />
            )}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  container_primary: {
    backgroundColor: colors.primary,
    ...getShadow('sm'),
  },
  container_secondary: {
    backgroundColor: colors.gray100,
  },
  container_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  container_ghost: {
    backgroundColor: 'transparent',
  },
  container_danger: {
    backgroundColor: colors.error,
    ...getShadow('sm'),
  },

  // Sizes
  container_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: sizes.buttonHeightSm,
  },
  container_md: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    minHeight: sizes.buttonHeight,
  },
  container_lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: sizes.buttonHeight + 8,
  },

  // Text
  text: {
    fontFamily: 'Inter_600SemiBold',
  },
  text_primary: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.textPrimary,
  },
  text_outline: {
    color: colors.primary,
  },
  text_ghost: {
    color: colors.primary,
  },
  text_danger: {
    color: colors.white,
  },
  text_sm: {
    ...typography.buttonSmall,
  },
  text_md: {
    ...typography.button,
  },
  text_lg: {
    ...typography.button,
    fontSize: 18,
  },
});
