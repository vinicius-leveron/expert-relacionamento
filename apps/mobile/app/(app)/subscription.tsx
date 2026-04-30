import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '@/stores/profile.store';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { openCheckoutUrl } from '@/utils/checkout';
import { captureAnalyticsEvent } from '@/analytics/posthog';

const PREMIUM_BENEFITS = [
  {
    icon: 'calendar-outline' as const,
    title: 'Jornada guiada de 30 dias',
    description: 'Desbloqueie o plano diário completo com progressão e continuidade.',
  },
  {
    icon: 'images-outline' as const,
    title: 'Análise de imagens com IA',
    description: 'Envie prints, fotos e contextos visuais para receber leitura assistida.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Arquivos como contexto',
    description: 'Anexe PDFs e documentos para a IA responder com base no seu material.',
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
  const checkoutUrl = profile?.commerce.checkoutUrl ?? null;
  const canUpgrade = profile?.commerce.canUpgrade === true;

  useEffect(() => {
    if (hasTrackedView.current) {
      return;
    }

    hasTrackedView.current = true;
    captureAnalyticsEvent('subscription_screen_viewed');
  }, []);

  const heading = useMemo(() => {
    if (hasActiveSubscription) {
      return {
        title: 'Seu acesso premium está ativo',
        subtitle: 'A jornada completa e os recursos avançados já estão liberados para você.',
      };
    }

    return {
      title: 'Desbloqueie a experiência completa',
      subtitle:
        'Ative sua assinatura para continuar a jornada, analisar imagens e usar arquivos como contexto no chat.',
    };
  }, [hasActiveSubscription]);

  const handleOpenCheckout = async () => {
    if (isOpeningCheckout) {
      return;
    }

    try {
      setIsOpeningCheckout(true);
      captureAnalyticsEvent('subscription_checkout_clicked', {
        has_active_subscription: hasActiveSubscription,
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
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="diamond-outline" size={32} color={colors.primaryDark} />
          </View>
          <Text style={styles.heroTitle}>{heading.title}</Text>
          <Text style={styles.heroSubtitle}>{heading.subtitle}</Text>

          {profile?.subscription ? (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.successDark} />
              <Text style={styles.statusText}>Plano {profile.subscription.planId}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que está incluído</Text>
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
            Depois de concluir a compra, volte para este app e toque em atualizar status.
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
            <TouchableOpacity
              style={[styles.primaryButton, !canUpgrade && styles.primaryButtonDisabled]}
              onPress={handleOpenCheckout}
              activeOpacity={0.85}
              disabled={!canUpgrade || isOpeningCheckout}
            >
              {isOpeningCheckout ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Assinar agora</Text>
                  <Ionicons name="open-outline" size={18} color={colors.white} />
                </>
              )}
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
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('sm'),
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
});
