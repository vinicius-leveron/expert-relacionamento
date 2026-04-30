import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '@/stores/profile.store';
import { useAuthStore } from '@/stores/auth.store';
import { ArchetypeCard, StatsGrid } from '@/components/profile';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';
import { openCheckoutUrl } from '@/utils/checkout';
import { captureAnalyticsEvent } from '@/analytics/posthog';

export default function ProfileScreen() {
  const { profile, fetchProfile, isLoading } = useProfileStore();
  const { logout, user } = useAuthStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleStartDiagnostic = () => {
    // Diagnóstico agora é via chat - redireciona para o chat onde a Isabela conduz
    router.push('/(app)/(tabs)/chat');
  };

  const handleOpenSubscription = () => {
    captureAnalyticsEvent('profile_subscription_cta_clicked', {
      has_active_subscription: profile?.access.hasActiveSubscription === true,
    });
    router.push('/(app)/subscription');
  };

  const handleOpenCheckout = () => {
    captureAnalyticsEvent('profile_checkout_clicked', {
      has_active_subscription: profile?.access.hasActiveSubscription === true,
    });
    void openCheckoutUrl(profile?.commerce.checkoutUrl);
  };

  const handleOpenHelp = () => {
    captureAnalyticsEvent('profile_help_clicked');
    router.push('/(app)/help');
  };

  // Mock stats - TODO: Get from profile
  const stats = [
    { icon: 'calendar' as const, value: 1, label: 'Dias ativos', color: colors.primary },
    { icon: 'chatbubbles' as const, value: 12, label: 'Mensagens', color: colors.info },
    { icon: 'flame' as const, value: 1, label: 'Streak atual', color: colors.warning },
    { icon: 'trophy' as const, value: 0, label: 'Conquistas', color: colors.success },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityLabel="Foto de perfil">
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.email}>{user?.email || 'Carregando...'}</Text>
        {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estatísticas</Text>
        <StatsGrid stats={stats} />
      </View>

      {/* Archetype */}
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
            <Text style={styles.emptyTitle}>Descubra seu arquétipo</Text>
            <Text style={styles.emptyText}>
              Converse com a Isabela para descobrir seus padrões de relacionamento.
            </Text>
            <View style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Conversar com Isabela</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assinatura</Text>
        <View style={styles.card}>
          {profile?.access.hasActiveSubscription ? (
            <>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.successDark} />
                  <Text style={styles.statusText}>Ativa</Text>
                </View>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Plano</Text>
                <Text style={styles.cardValue}>{profile?.subscription?.planId ?? 'Premium'}</Text>
              </View>
              <TouchableOpacity
                style={styles.manageButton}
                onPress={handleOpenSubscription}
                activeOpacity={0.8}
                accessibilityLabel="Ver detalhes da assinatura"
                accessibilityRole="button"
              >
                <Text style={styles.manageButtonText}>Ver detalhes do plano</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.subscriptionEmpty}>
                <Ionicons name="diamond-outline" size={24} color={colors.textMuted} />
                <Text style={styles.cardEmpty}>Você não possui uma assinatura ativa.</Text>
              </View>
              <Text style={styles.subscriptionHint}>
                Desbloqueie a jornada completa, análise de imagens e arquivos no chat.
              </Text>
              <View style={styles.subscriptionActions}>
                <TouchableOpacity
                  style={styles.subscribeButton}
                  onPress={handleOpenSubscription}
                  activeOpacity={0.8}
                  accessibilityLabel="Abrir assinatura"
                  accessibilityRole="button"
                >
                  <Text style={styles.subscribeButtonText}>Conhecer plano</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.white} />
                </TouchableOpacity>
                {profile?.commerce.canUpgrade ? (
                  <TouchableOpacity
                    style={styles.checkoutButton}
                    onPress={handleOpenCheckout}
                    activeOpacity={0.8}
                    accessibilityLabel="Ir para checkout"
                    accessibilityRole="button"
                  >
                    <Text style={styles.checkoutButtonText}>Ir para checkout</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingsItem}
            accessibilityLabel="Configurações de notificações"
            accessibilityRole="button"
          >
            <View style={styles.settingsItemLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.settingsItemText}>Notificações</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={handleOpenHelp}
            accessibilityLabel="Ajuda e suporte"
            accessibilityRole="button"
          >
            <View style={styles.settingsItemLeft}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.settingsItemText}>Ajuda</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          <TouchableOpacity
            style={styles.settingsItem}
            onPress={handleLogout}
            accessibilityLabel="Sair da conta"
            accessibilityRole="button"
          >
            <View style={styles.settingsItemLeft}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.settingsItemText, { color: colors.error }]}>Sair</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Version */}
      <Text style={styles.version}>Perpétuo v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.white,
  },
  avatar: {
    width: sizes.avatarXl,
    height: sizes.avatarXl,
    borderRadius: sizes.avatarXl / 2,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...getShadow('sm'),
  },
  email: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  phone: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    padding: spacing.md,
    paddingBottom: 0,
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cardLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  cardValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
  cardEmpty: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  subscriptionHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  subscriptionActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  subscribeButton: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  subscribeButtonText: {
    ...typography.body,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  checkoutButton: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkoutButtonText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  subscriptionEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.successDark,
    fontFamily: 'Inter_500Medium',
  },
  manageButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manageButtonText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
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
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    ...getShadow('sm'),
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsItemText: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontFamily: 'Inter_400Regular',
  },
});
