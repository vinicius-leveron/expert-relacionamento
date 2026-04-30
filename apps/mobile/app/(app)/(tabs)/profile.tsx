import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '@/stores/profile.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  ProfileHeader,
  JourneyProgress,
  StatsRow,
  ArchetypeCard,
  SubscriptionCard,
} from '@/components/profile';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { captureAnalyticsEvent } from '@/analytics/posthog';

export default function ProfileScreen() {
  const { profile, fetchProfile } = useProfileStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleOpenSettings = () => {
    captureAnalyticsEvent('profile_settings_clicked');
    router.push('/(app)/settings');
  };

  const handleEditProfile = () => {
    captureAnalyticsEvent('profile_edit_clicked');
    router.push('/(app)/edit-profile');
  };

  const handleStartDiagnostic = () => {
    if (profile?.access.hasChatAccess) {
      router.push('/(app)/(tabs)/chat');
      return;
    }

    router.push('/(app)/subscription');
  };

  const handleOpenSubscription = () => {
    captureAnalyticsEvent('profile_subscription_cta_clicked', {
      has_active_subscription: profile?.access.hasActiveSubscription === true,
    });
    router.push('/(app)/subscription');
  };

  const handleOpenArchetype = () => {
    if (profile?.diagnostic) {
      router.push({
        pathname: '/(app)/archetype',
        params: { archetype: profile.diagnostic.archetype },
      });
    }
  };

  const stats = [
    {
      icon: 'diamond' as const,
      value: profile?.access.hasActiveSubscription
        ? 'Ativa'
        : profile?.subscription?.status === 'payment_failed'
          ? 'Falhou'
          : profile?.subscription
            ? 'Pendente'
            : 'Inativa',
      label: 'Assinatura',
      color: profile?.access.hasActiveSubscription ? colors.success : colors.warning,
    },
    {
      icon: 'sparkles' as const,
      value: profile?.diagnostic ? 'Pronto' : 'Pendente',
      label: 'Diagnóstico',
      color: profile?.diagnostic ? colors.primary : colors.textMuted,
    },
    {
      icon: 'chatbubbles' as const,
      value: profile?.access.hasChatAccess ? 'Liberado' : 'Bloq.',
      label: 'Chat',
      color: profile?.access.hasChatAccess ? colors.info : colors.textMuted,
    },
    {
      icon: 'images' as const,
      value: profile?.access.canAnalyzeImages ? 'Liberado' : 'Bloq.',
      label: 'Imagens',
      color: profile?.access.canAnalyzeImages ? colors.success : colors.textMuted,
    },
  ];

  // Calculate journey progress (mock for now)
  const journeyProgress = profile?.diagnostic ? 72 : 25;

  const { width } = useWindowDimensions();
  const isWideScreen = width > 600;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={isWideScreen ? styles.wideContentContainer : undefined}
      showsVerticalScrollIndicator={false}
    >
      <View style={isWideScreen ? styles.wideWrapper : undefined}>
      {/* Profile Header */}
      <ProfileHeader
        name={profile?.displayName ?? user?.email?.split('@')[0]}
        email={user?.email ?? undefined}
        archetype={profile?.diagnostic?.archetype}
        avatarUrl={profile?.avatarUrl}
        onEditPress={handleEditProfile}
        onSettingsPress={handleOpenSettings}
      />

      {/* Journey Progress */}
      <View style={styles.section}>
        <JourneyProgress
          progress={journeyProgress}
          subtitle={
            profile?.diagnostic
              ? 'Continua mandando prints e seguindo a jornada'
              : profile?.access.hasChatAccess
                ? 'Faz o diagnóstico pra descobrir onde você trava'
                : 'Ativa o acesso pra começar'
          }
        />
      </View>

      {/* Stats Row - Horizontal Scroll */}
      <View style={styles.statsSection}>
        <StatsRow stats={stats} />
      </View>

      {/* Archetype Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seu Arquétipo</Text>
        {profile?.diagnostic ? (
          <ArchetypeCard
            archetype={profile.diagnostic.archetype}
            completedAt={profile.diagnostic.completedAt}
          />
        ) : (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={handleStartDiagnostic}
            activeOpacity={0.8}
            accessibilityLabel="Conversar com Isabela"
            accessibilityRole="button"
          >
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubble-ellipses" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Descobre onde você erra</Text>
            <Text style={styles.emptyText}>
              {profile?.access.hasChatAccess
                ? 'Responde umas perguntas e a Isabela mostra o padrão que te sabota.'
                : 'Ativa o acesso pra fazer o diagnóstico.'}
            </Text>
            <View style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>
                {profile?.access.hasChatAccess ? 'Conversar com Isabela' : 'Ver assinatura'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assinatura</Text>
        <SubscriptionCard
          isActive={profile?.access.hasActiveSubscription}
          planName={profile?.subscription?.planId ?? 'Premium'}
          onSubscribePress={handleOpenSubscription}
          onManagePress={handleOpenSubscription}
        />
      </View>

      {/* Version */}
      <Text style={styles.version}>Perpétuo v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  wideContentContainer: {
    alignItems: 'center',
  },
  wideWrapper: {
    width: '100%',
    maxWidth: 480,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  statsSection: {
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...getShadow('sm'),
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'Inter_400Regular',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  emptyButtonText: {
    ...typography.buttonSmall,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontFamily: 'Inter_400Regular',
  },
});
