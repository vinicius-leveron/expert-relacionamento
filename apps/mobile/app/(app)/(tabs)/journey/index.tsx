import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '@/stores/profile.store';
import { SubscriptionRequiredState } from '@/components/paywall';
import { PhaseProgress, DayCard, StreakCounter } from '@/components/journey';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';
import { openCheckoutUrl } from '@/utils/checkout';
import { captureAnalyticsEvent } from '@/analytics/posthog';

// Mock data for daily content
const DAILY_CONTENT = [
  { title: 'Autoconhecimento', description: 'Reflita sobre seus padrões de apego e como eles afetam seus relacionamentos.' },
  { title: 'Comunicação', description: 'Aprenda a expressar suas necessidades de forma clara e assertiva.' },
  { title: 'Vulnerabilidade', description: 'Pratique abrir-se emocionalmente de forma segura.' },
  { title: 'Limites Saudáveis', description: 'Estabeleça e mantenha limites que protejam seu bem-estar.' },
  { title: 'Conexão', description: 'Desenvolva formas genuínas de se conectar com seu parceiro.' },
];

export default function JourneyScreen() {
  const { profile, fetchProfile, isLoading } = useProfileStore();
  const hasTrackedPaywallView = useRef(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const diagnostic = profile?.diagnostic;
  const hasActiveSubscription = profile?.access.hasActiveSubscription === true;
  const hasJourneyAccess = profile?.access.hasJourneyAccess === true;
  const nativeCheckoutMode = profile?.commerce.nativeCheckoutMode ?? 'external_link';
  const canOpenCheckoutInCurrentClient =
    Platform.OS === 'web' || nativeCheckoutMode === 'external_link';
  const currentDay = 1; // TODO: Get from profile
  const streak = 1; // TODO: Get from profile
  const dailyContent = DAILY_CONTENT[(currentDay - 1) % DAILY_CONTENT.length];

  useEffect(() => {
    if (diagnostic && !hasJourneyAccess && !hasTrackedPaywallView.current) {
      hasTrackedPaywallView.current = true;
      captureAnalyticsEvent('journey_paywall_viewed');
    }
  }, [diagnostic, hasJourneyAccess]);

  if (isLoading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!hasActiveSubscription) {
    return (
      <SubscriptionRequiredState
        title="A jornada faz parte do acesso premium"
        description="Ative sua assinatura para acompanhar sua evolução, liberar os 30 dias e continuar com suporte guiado."
        onPrimaryPress={() => {
          captureAnalyticsEvent('journey_paywall_subscription_clicked');
          router.push('/(app)/subscription');
        }}
        secondaryLabel={
          profile?.commerce.canUpgrade && canOpenCheckoutInCurrentClient
            ? 'Ir para checkout'
            : undefined
        }
        onSecondaryPress={
          profile?.commerce.canUpgrade && canOpenCheckoutInCurrentClient
            ? () => {
                captureAnalyticsEvent('journey_paywall_checkout_clicked');
                void openCheckoutUrl(profile.commerce.checkoutUrl);
              }
            : undefined
        }
        checkoutBlocked={!canOpenCheckoutInCurrentClient}
      />
    );
  }

  if (!diagnostic) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sua jornada começa aqui</Text>
          <Text style={styles.emptyText}>
            Complete o diagnóstico com a Isabela para descobrir seu arquétipo
            e iniciar sua jornada de 30 dias.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.archetypeLabel}>Arquétipo:</Text>
        <Text style={styles.archetypeTitle}>
          {diagnostic.archetype.charAt(0).toUpperCase() + diagnostic.archetype.slice(1)}
        </Text>
        <Text style={styles.dayIndicator}>Dia {currentDay} de 30</Text>
      </View>

      {/* Streak */}
      <View style={styles.streakSection}>
        <StreakCounter streak={streak} bestStreak={7} />
      </View>

      {/* Phase Progress */}
      <PhaseProgress currentDay={currentDay} />

      {/* Today's Card */}
      <DayCard
        day={currentDay}
        title={dailyContent.title}
        description={dailyContent.description}
        isCompleted={false}
      />

      {/* Days Grid */}
      <View style={styles.daysSection}>
        <Text style={styles.sectionTitle}>Todos os Dias</Text>
        <View style={styles.daysGrid}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayItem,
                day < currentDay && styles.dayCompleted,
                day === currentDay && styles.dayCurrent,
              ]}
              activeOpacity={0.7}
            >
              {day < currentDay ? (
                <Ionicons name="checkmark" size={16} color={colors.white} />
              ) : (
                <Text
                  style={[
                    styles.dayText,
                    day === currentDay && styles.dayTextCurrent,
                    day < currentDay && styles.dayTextCompleted,
                  ]}
                >
                  {day}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: sizes.avatarXl,
    height: sizes.avatarXl,
    borderRadius: sizes.avatarXl / 2,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  lockIcon: {
    width: sizes.avatarXl,
    height: sizes.avatarXl,
    borderRadius: sizes.avatarXl / 2,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  emptyTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  primaryButton: {
    marginTop: spacing.lg,
    height: 52,
    minWidth: 220,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    marginTop: spacing.sm,
    height: 48,
    minWidth: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  archetypeLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Inter_400Regular',
  },
  archetypeTitle: {
    ...typography.h1,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
    marginBottom: spacing.xs,
  },
  dayIndicator: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Inter_500Medium',
  },
  streakSection: {
    marginTop: -spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    fontFamily: 'Inter_600SemiBold',
  },
  daysSection: {
    paddingVertical: spacing.lg,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dayItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  dayText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  dayTextCurrent: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  dayTextCompleted: {
    color: colors.white,
  },
});
