import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getShadow, radius, spacing, typography } from '@/theme';

interface SubscriptionRequiredStateProps {
  title: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  isLoading?: boolean;
  checkoutBlocked?: boolean;
}

export function SubscriptionRequiredState({
  title,
  description,
  primaryLabel = 'Ver assinatura',
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  isLoading = false,
  checkoutBlocked = false,
}: SubscriptionRequiredStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="diamond-outline" size={36} color={colors.primaryDark} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {checkoutBlocked ? (
        <View style={styles.blockedNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.infoDark} />
          <Text style={styles.blockedText}>
            A contratação está disponível no site oficial. No app, você pode acompanhar seu acesso depois da assinatura.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onPrimaryPress}
        activeOpacity={0.85}
        disabled={!onPrimaryPress || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </>
        )}
      </TouchableOpacity>

      {secondaryLabel && onSecondaryPress ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryPress}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gray50,
  },
  iconContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontFamily: 'Inter_700Bold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 360,
    fontFamily: 'Inter_400Regular',
  },
  blockedNote: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.infoLight,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    maxWidth: 380,
  },
  blockedText: {
    ...typography.caption,
    color: colors.infoDark,
    flex: 1,
    fontFamily: 'Inter_500Medium',
  },
  primaryButton: {
    marginTop: spacing.xl,
    minWidth: 220,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    marginTop: spacing.sm,
    minWidth: 220,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
});
