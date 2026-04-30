import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '@/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'custom';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<Exclude<BadgeVariant, 'custom'>, { bg: string; text: string }> = {
  default: { bg: colors.primaryLight, text: colors.primary },
  success: { bg: colors.successLight, text: colors.successDark },
  warning: { bg: colors.warningLight, text: colors.warningDark },
  error: { bg: colors.errorLight, text: colors.errorDark },
  info: { bg: colors.infoLight, text: colors.infoDark },
};

export function Badge({
  label,
  variant = 'default',
  size = 'sm',
  icon,
  color,
  style,
}: BadgeProps) {
  const isCustom = variant === 'custom' && color;
  const bgColor = isCustom ? `${color}20` : VARIANT_COLORS[variant as keyof typeof VARIANT_COLORS].bg;
  const textColor = isCustom ? color : VARIANT_COLORS[variant as keyof typeof VARIANT_COLORS].text;

  return (
    <View
      style={[
        styles.container,
        size === 'md' && styles.containerMd,
        { backgroundColor: bgColor },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={size === 'sm' ? 12 : 14}
          color={textColor}
        />
      )}
      <Text
        style={[
          styles.label,
          size === 'md' && styles.labelMd,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderRadius: radius.full,
  },
  containerMd: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  labelMd: {
    fontSize: 12,
  },
});
