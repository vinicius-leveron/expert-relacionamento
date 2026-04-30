import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '@/stores/profile.store';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { openCheckoutUrl } from '@/utils/checkout';
import { captureAnalyticsEvent } from '@/analytics/posthog';
import { TestimonialCard } from '@/components/ui';
import { getPaywallContent, type Archetype } from '@/data/prompts-by-archetype';
import { getTestimonialForArchetype } from '@/data/testimonials';

const PREMIUM_BENEFITS = [
  {
    icon: 'images-outline' as const,
    title: 'Análise de conversas e perfis',
    description: 'Manda o print e descobre onde você tá errando e o que fazer diferente.',
  },
  {
    icon: 'calendar-outline' as const,
    title: '30 dias pra evoluir de verdade',
    description: 'Um plano diário que te força a sair do mesmo lugar e parar de repetir erros.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Análise das suas redes',
    description: 'Mostra seu perfil pra Isabela e recebe um feedback honesto do que mudar.',
  },
];

export default function SubscriptionScreen() {
  const { profile, fetchProfile, isLoading } = useProfileStore();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const hasActiveSubscription = profile?.access.hasActiveSubscription === true;
  const subscriptionStatus = profile?.subscription?.status ?? null;
  const checkoutUrl = profile?.commerce.checkoutUrl ?? null;
  const canUpgrade = profile?.commerce.canUpgrade === true;
  const nativeCheckoutMode = profile?.commerce.nativeCheckoutMode ?? 'external_link';
  const canOpenCheckoutInCurrentClient =
    Platform.OS === 'web' || nativeCheckoutMode === 'external_link';

  const archetype = profile?.diagnostic?.archetype as Archetype | undefined;

  useEffect(() => {
    if (hasTrackedView.current) {
      return;
    }

    hasTrackedView.current = true;
    captureAnalyticsEvent('subscription_screen_viewed', {
      archetype: archetype ?? 'none',
    });
  }, [archetype]);

  const paywallContent = useMemo(() => getPaywallContent(archetype), [archetype]);
  const testimonial = useMemo(
    () => getTestimonialForArchetype('paywall', archetype),
    [archetype]
  );

  const heading = useMemo(() => {
    if (hasActiveSubscription) {
      return {
        title: 'Acesso liberado',
        subtitle: 'Agora é usar. Manda os prints, analisa teu perfil e segue a jornada.',
        cta: 'Ir para o chat',
      };
    }

    if (subscriptionStatus === 'pending') {
      return {
        title: 'Processando pagamento',
        subtitle: 'Assim que confirmar, seu acesso é liberado na hora.',
        cta: 'Atualizar status',
      };
    }

    if (subscriptionStatus === 'payment_failed') {
      return {
        title: 'Pagamento falhou',
        subtitle: 'Revisa a cobrança pra continuar usando tudo.',
        cta: 'Tentar novamente',
      };
    }

    if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired') {
      return {
        title: 'Acesso expirou',
        subtitle: 'Reativa pra voltar a analisar conversas e seguir a jornada.',
        cta: 'Reativar acesso',
      };
    }

    return {
      title: paywallContent.headline,
      subtitle: paywallContent.subheadline,
      cta: paywallContent.cta,
    };
  }, [hasActiveSubscription, subscriptionStatus, paywallContent]);

  const handleOpenCheckout = async () => {
    if (isOpeningCheckout) {
      return;
    }

    try {
      setIsOpeningCheckout(true);
      captureAnalyticsEvent('subscription_checkout_clicked', {
        has_active_subscription: hasActiveSubscription,
        archetype: archetype ?? 'none',
      });
      await openCheckoutUrl(checkoutUrl);
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (isRefreshingStatus) {
      return;
    }

    try {
      setIsRefreshingStatus(true);
      captureAnalyticsEvent('subscription_status_refresh_clicked', {
        has_active_subscription: hasActiveSubscription,
      });
      await fetchProfile();
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/profile');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          {!hasActiveSubscription && (
            <View style={styles.heroIcon}>
              <Ionicons name="diamond-outline" size={32} color={colors.primaryDark} />
            </View>
          )}
          <Text style={styles.heroTitle}>{heading.title}</Text>
          <Text style={styles.heroSubtitle}>{heading.subtitle}</Text>

          {profile?.subscription ? (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.successDark} />
              <Text style={styles.statusText}>Plano {profile.subscription.planId}</Text>
            </View>
          ) : null}
        </View>

        {!hasActiveSubscription && (
          <View style={styles.testimonialSection}>
            <TestimonialCard testimonial={testimonial} compact />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que você ganha</Text>
          {PREMIUM_BENEFITS.map((benefit) => (
            <View key={benefit.title} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <Ionicons name={benefit.icon} size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.infoDark} />
          <Text style={styles.infoText}>
            {canOpenCheckoutInCurrentClient
              ? 'Depois de concluir a compra, volte para este app e toque em atualizar status.'
              : 'A contratação está disponível no site oficial. Depois da compra, volte ao app e toque em atualizar status.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : hasActiveSubscription ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(app)/(tabs)/chat')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Ir para o chat</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRefreshStatus}
              activeOpacity={0.85}
              disabled={isRefreshingStatus}
            >
              {isRefreshingStatus ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={styles.secondaryButtonText}>Atualizar status</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {canOpenCheckoutInCurrentClient ? (
              <TouchableOpacity
                style={[styles.primaryButton, !canUpgrade && styles.primaryButtonDisabled]}
                onPress={handleOpenCheckout}
                activeOpacity={0.85}
                disabled={!canUpgrade || isOpeningCheckout}
              >
                {isOpeningCheckout ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>{heading.cta}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRefreshStatus}
              activeOpacity={0.85}
              disabled={isRefreshingStatus}
            >
              {isRefreshingStatus ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={styles.secondaryButtonText}>Já assinei, atualizar status</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('sm'),
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...getShadow('md'),
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontFamily: 'Inter_700Bold',
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  statusBadge: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.successDark,
    fontFamily: 'Inter_600SemiBold',
  },
  testimonialSection: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontFamily: 'Inter_600SemiBold',
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...getShadow('sm'),
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  benefitDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.infoDark,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
});
