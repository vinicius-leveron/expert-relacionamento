import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { useProfileStore } from '@/stores/profile.store';
import { SubscriptionRequiredState } from '@/components/paywall';
import {
  EXPLORE_CATEGORIES,
  type ExploreCategory,
} from '@/data/explore-categories';
import { ExploreGrid } from '@/components/explore';
import { colors, spacing, typography } from '@/theme';

export default function CategoriesScreen() {
  const chatStore = useChatStore();
  const { accessToken } = useAuthStore();
  const { createConversation } = useConversationsStore();
  const { profile, fetchProfile, isLoading, error } = useProfileStore();

  useEffect(() => {
    if (!profile && !isLoading) {
      void fetchProfile();
    }
  }, [fetchProfile, isLoading, profile]);

  const prepareConversationState = useCallback(
    (nextConversationId: string) => {
      chatStore.disconnectSSE();
      useChatStore.setState({
        messages: [],
        conversationId: nextConversationId,
        pendingAttachments: [],
        isLoading: false,
        responseStartedAt: null,
      });

      if (accessToken) {
        chatStore.connectSSE(accessToken);
      }
    },
    [accessToken, chatStore],
  );

  const handleSelectCategory = useCallback(
    async (category: ExploreCategory) => {
      try {
        const newConversation = await createConversation();
        prepareConversationState(newConversation.id);
        useConversationsStore.getState().updateConversationPreview({
          id: newConversation.id,
          summary: category.prompt,
        });
        router.replace('/(app)/(tabs)/chat');
        await chatStore.sendMessage(category.prompt);
      } catch (error) {
        console.error('Erro ao iniciar categoria:', error);
      }
    },
    [createConversation, prepareConversationState, chatStore],
  );

  const handleOpenImageStudio = useCallback(() => {
    router.push('/(app)/image-studio' as never);
  }, []);

  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (profile && !profile.access.hasChatAccess) {
    return (
      <SubscriptionRequiredState
        title="As categorias premium abrem conversas guiadas"
        description="Ative sua assinatura para usar prompts especializados como analisador de perfil, analisador de conversas e criador de jornada."
        onPrimaryPress={() => router.push('/(app)/subscription')}
        checkoutBlocked={
          Platform.OS !== 'web' && profile.commerce.nativeCheckoutMode === 'blocked'
        }
      />
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorTitle}>Não consegui carregar seu acesso</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void fetchProfile()}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Explorar</Text>
        <Text style={styles.subtitle}>
          Escolha um tema e comece uma conversa guiada
        </Text>
      </View>

      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.92}
        onPress={handleOpenImageStudio}
      >
        <LinearGradient
          colors={['#111827', '#4C1D95', '#FE3C72']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color={colors.white} />
            <Text style={styles.heroBadgeText}>Gemini no app</Text>
          </View>
          <Text style={styles.heroTitle}>Estúdio Visual</Text>
          <Text style={styles.heroText}>
            Gere imagens quadradas direto no Perpétuo e valide ideias de visual,
            posicionamento e criativo sem sair do fluxo premium.
          </Text>
          <View style={styles.heroFooter}>
            <Text style={styles.heroLimit}>Até 30 imagens por mês</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <ExploreGrid
        categories={EXPLORE_CATEGORIES}
        onSelectCategory={handleSelectCategory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontFamily: 'Inter_700Bold',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
  },
  retryButtonText: {
    ...typography.buttonSmall,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingBottom: spacing.lg,
  },
  heroCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  heroBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  heroTitle: {
    ...typography.h1,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  heroText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: 'Inter_400Regular',
  },
  heroFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLimit: {
    ...typography.bodySmall,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
});
