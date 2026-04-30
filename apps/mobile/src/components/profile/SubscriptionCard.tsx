import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

interface SubscriptionCardProps {
  isActive?: boolean;
  planName?: string;
  onSubscribePress?: () => void;
  onManagePress?: () => void;
}

const BENEFITS = [
  { icon: 'image-outline' as const, text: 'Análise de prints e perfis' },
  { icon: 'map-outline' as const, text: 'Jornada de 30 dias' },
  { icon: 'sparkles-outline' as const, text: 'Feedback direto e honesto' },
];

export function SubscriptionCard({
  isActive = false,
  planName = 'Premium',
  onSubscribePress,
  onManagePress,
}: SubscriptionCardProps) {
  if (isActive) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="diamond" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.planLabel}>Plano atual</Text>
            <Text style={styles.planName}>{planName}</Text>
          </View>
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.successDark} />
            <Text style={styles.activeBadgeText}>Ativo</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.manageButton}
          onPress={onManagePress}
          activeOpacity={0.8}
          accessibilityLabel="Ver detalhes do plano"
          accessibilityRole="button"
        >
          <Text style={styles.manageButtonText}>Ver detalhes do plano</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.containerPremium}>
      {/* Gradient-like header */}
      <View style={styles.premiumHeader}>
        <Ionicons name="diamond" size={28} color={colors.primary} />
        <Text style={styles.premiumTitle}>ACESSO COMPLETO</Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        {BENEFITS.map((benefit, index) => (
          <View key={index} style={styles.benefitRow}>
            <Ionicons name={benefit.icon} size={18} color={colors.primary} />
            <Text style={styles.benefitText}>{benefit.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={onSubscribePress}
        activeOpacity={0.8}
        accessibilityLabel="Conhecer plano premium"
        accessibilityRole="button"
      >
        <Text style={styles.ctaButtonText}>Liberar Acesso</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  containerPremium: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    ...getShadow('md'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  planLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  planName: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  activeBadgeText: {
    ...typography.caption,
    color: colors.successDark,
    fontFamily: 'Inter_500Medium',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  manageButtonText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  premiumTitle: {
    ...typography.h3,
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  benefits: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...getShadow('sm'),
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
