import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '@/stores/profile.store';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { useChatStore } from '@/stores/chat.store';
import {
  ProfileHeader,
  JourneyProgress,
  StatsRow,
  SubscriptionCard,
} from '@/components/profile';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { captureAnalyticsEvent } from '@/analytics/posthog';
import { SPECIALIZED_AGENTS } from '@/data/specialized-agents';

const DIAGNOSTIC_AGENT = SPECIALIZED_AGENTS.find((agent) => agent.id === 'diagnostic');

export default function ProfileScreen() {
  const { profile, fetchProfile } = useProfileStore();
  const { user, accessToken } = useAuthStore();
  const { createConversation, updateConversationPreview } = useConversationsStore();
  const chatStore = useChatStore();

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

  const handleOpenDiagnosticAgent = async () => {
    if (!profile?.access.hasChatAccess) {
      router.push('/(app)/subscription');
      return;
    }

    if (profile.avatarProfile?.status === 'completed') {
      router.push('/(app)/(tabs)/chat');
      return;
    }

    if (!DIAGNOSTIC_AGENT) {
      Alert.alert('Erro', 'O agente de diagnóstico não está disponível neste build.');
      return;
    }

    try {
      const newConversation = await createConversation({
        metadata: { agentId: DIAGNOSTIC_AGENT.id },
      });

      chatStore.disconnectSSE();
      useChatStore.setState({
        messages: [],
        conversationId: newConversation.id,
        pendingAttachments: [],
        isLoading: false,
        responseStartedAt: null,
      });

      if (accessToken) {
        chatStore.connectSSE(accessToken);
      }

      updateConversationPreview({
        id: newConversation.id,
        summary: DIAGNOSTIC_AGENT.name,
      });

      captureAnalyticsEvent('profile_avatar_agent_opened');
      router.push('/(app)/(tabs)/chat');
      await chatStore.sendMessage(DIAGNOSTIC_AGENT.prompt);
      await fetchProfile();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o Diagnóstico Pessoal agora.');
    }
  };

  const handleOpenSubscription = () => {
    captureAnalyticsEvent('profile_subscription_cta_clicked', {
      has_active_subscription: profile?.access.hasActiveSubscription === true,
    });
    router.push('/(app)/subscription');
  };

  const avatarProfile = profile?.avatarProfile ?? null;
  const hasLegacyDiagnosticOnly = Boolean(profile?.diagnostic && !avatarProfile);
  const completedAvatarPhases = avatarProfile?.completedPhases.length ?? 0;
  const avatarProgress =
    avatarProfile?.status === 'completed'
      ? 100
      : avatarProfile?.status === 'in_progress'
        ? Math.max(14, Math.round((completedAvatarPhases / 7) * 100))
        : 0;
  const avatarStatusValue =
    avatarProfile?.status === 'completed'
      ? 'Pronto'
      : avatarProfile?.status === 'in_progress'
        ? 'Em curso'
        : 'Pendente';
  const avatarStatusColor =
    avatarProfile?.status === 'completed'
      ? colors.success
      : avatarProfile?.status === 'in_progress'
        ? colors.primary
        : colors.textMuted;
  const journeySubtitle =
    avatarProfile?.status === 'completed'
      ? 'Seu avatar já alimenta os mentores e as conversas guiadas.'
      : avatarProfile?.status === 'in_progress'
        ? `${completedAvatarPhases}/7 etapas concluídas na construção do avatar.`
        : hasLegacyDiagnosticOnly
          ? 'Seu diagnóstico antigo não alimenta os novos agentes. Abra o Diagnóstico Pessoal para montar o avatar do app.'
          : profile?.access.hasChatAccess
            ? 'Abra o agente Diagnóstico Pessoal no chat para construir o avatar do app.'
            : 'Ative o acesso para liberar o Diagnóstico Pessoal e os mentores.';
  const avatarCardTitle =
    avatarProfile?.status === 'completed'
      ? 'Avatar estruturado'
      : avatarProfile?.status === 'in_progress'
        ? 'Construção em andamento'
        : hasLegacyDiagnosticOnly
          ? 'Novo avatar não iniciado'
          : 'Avatar ainda não iniciado';
  const avatarCardText =
    avatarProfile?.status === 'completed'
      ? 'Os agentes já conseguem usar sua memória central para responder com mais contexto e direção.'
      : avatarProfile?.status === 'in_progress'
        ? 'Continue no Diagnóstico Pessoal para fechar as 7 fases e liberar todos os mentores dependentes do avatar.'
        : hasLegacyDiagnosticOnly
          ? 'Seu diagnóstico legado continua salvo, mas os agentes novos dependem do avatar estruturado criado no Diagnóstico Pessoal.'
          : profile?.access.hasChatAccess
            ? 'O Diagnóstico Pessoal agora organiza o contexto que os mentores usam para te orientar nas próximas fases.'
            : 'Ative sua assinatura para liberar o chat, o Diagnóstico Pessoal e os demais agentes especializados.';
  const avatarButtonLabel = profile?.access.hasChatAccess
    ? avatarProfile?.status === 'completed'
      ? 'Abrir chat'
      : 'Abrir Diagnóstico Pessoal'
    : 'Ver assinatura';
  const conversationImageUsage = profile?.usage.imageAnalyses.conversation;
  const profileImageUsage = profile?.usage.imageAnalyses.profile;
  const chatImageGenerationUsage = profile?.usage.imageGenerations.chat;

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
      value: avatarStatusValue,
      label: 'Avatar',
      color: avatarStatusColor,
    },
    {
      icon: 'chatbubbles' as const,
      value: profile?.access.hasChatAccess ? 'Liberado' : 'Bloq.',
      label: 'Chat',
      color: profile?.access.hasChatAccess ? colors.info : colors.textMuted,
    },
    {
      icon: 'images' as const,
      value: profile?.access.hasChatAccess
        ? `${conversationImageUsage?.remaining ?? 0}/${conversationImageUsage?.limit ?? 30}`
        : 'Bloq.',
      label: 'Prints',
      color: profile?.access.hasChatAccess
        ? (conversationImageUsage?.remaining ?? 0) > 0
          ? colors.success
          : colors.warning
        : colors.textMuted,
    },
    {
      icon: 'logo-instagram' as const,
      value: profile?.access.hasChatAccess
        ? `${profileImageUsage?.remaining ?? 0}/${profileImageUsage?.limit ?? 5}`
        : 'Bloq.',
      label: 'Perfil',
      color: profile?.access.hasChatAccess
        ? (profileImageUsage?.remaining ?? 0) > 0
          ? colors.success
          : colors.warning
        : colors.textMuted,
    },
    {
      icon: 'image' as const,
      value: profile?.access.hasChatAccess
        ? `${chatImageGenerationUsage?.remaining ?? 0}/${chatImageGenerationUsage?.limit ?? 10}`
        : 'Bloq.',
      label: 'Imagem IA',
      color: profile?.access.hasChatAccess
        ? (chatImageGenerationUsage?.remaining ?? 0) > 0
          ? colors.success
          : colors.warning
        : colors.textMuted,
    },
  ];

  const { width } = useWindowDimensions();
  const isWideScreen = width > 600;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={isWideScreen ? styles.wideContentContainer : undefined}
      showsVerticalScrollIndicator={false}
    >
      <View style={isWideScreen ? styles.wideWrapper : undefined}>
        <ProfileHeader
          name={profile?.displayName ?? user?.email?.split('@')[0]}
          email={user?.email ?? undefined}
          archetype={undefined}
          avatarUrl={profile?.avatarUrl}
          onEditPress={handleEditProfile}
          onSettingsPress={handleOpenSettings}
        />

        <View style={styles.section}>
          <JourneyProgress
            progress={avatarProgress}
            subtitle={journeySubtitle}
            onPress={handleOpenDiagnosticAgent}
          />
        </View>

        <View style={styles.statsSection}>
          <StatsRow stats={stats} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avatar do App</Text>
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={handleOpenDiagnosticAgent}
            activeOpacity={0.8}
            accessibilityLabel={avatarButtonLabel}
            accessibilityRole="button"
          >
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name={avatarProfile?.status === 'completed' ? 'sparkles' : 'chatbubble-ellipses'}
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>{avatarCardTitle}</Text>
            <Text style={styles.emptyText}>{avatarCardText}</Text>
            <View style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>{avatarButtonLabel}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assinatura</Text>
          <SubscriptionCard
            isActive={profile?.access.hasActiveSubscription}
            planName={profile?.subscription?.planId ?? 'Premium'}
            onSubscribePress={handleOpenSubscription}
            onManagePress={handleOpenSubscription}
          />
        </View>

        <Text style={styles.version}>Perpétuo v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...getShadow('sm'),
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}15`,
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
