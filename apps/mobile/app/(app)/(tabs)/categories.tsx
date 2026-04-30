import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { CHAT_CATEGORIES, type ChatCategory } from '@/data/chat-categories';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

function buildCategorySubtitle(category: ChatCategory): string {
  if (category.description.length <= 82) {
    return category.description;
  }

  return `${category.description.slice(0, 82).trim()}...`;
}

export default function CategoriesScreen() {
  const chatStore = useChatStore();
  const { accessToken } = useAuthStore();
  const { createConversation } = useConversationsStore();

  const categories = useMemo(
    () =>
      CHAT_CATEGORIES.map((category) => ({
        ...category,
        subtitle: buildCategorySubtitle(category),
      })),
    [],
  );

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
    async (category: ChatCategory) => {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Categorias</Text>
          <Text style={styles.title}>Entradas prontas para começar melhor</Text>
          <Text style={styles.subtitle}>
            Escolha um modo de conversa e a Isabela já abre o chat com o contexto
            certo, sem você precisar começar do zero.
          </Text>
        </View>

        <View style={styles.list}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => handleSelectCategory(category)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconBadge}>
                  <Ionicons
                    name={category.icon}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardEyebrow}>{category.eyebrow}</Text>
                  <Text style={styles.cardTitle}>{category.title}</Text>
                </View>
                <Ionicons
                  name="arrow-forward-circle"
                  size={24}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.cardDescription}>{category.subtitle}</Text>

              <View style={styles.promptPreview}>
                <Text style={styles.promptPreviewLabel}>Prompt inicial</Text>
                <Text style={styles.promptPreviewText} numberOfLines={3}>
                  {category.prompt}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? spacing.xl : spacing.md,
    paddingBottom: spacing.xxl,
  },
  hero: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: 'Inter_700Bold',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    marginBottom: spacing.sm,
    maxWidth: 560,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    maxWidth: 680,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...getShadow('sm'),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardCopy: {
    flex: 1,
  },
  cardEyebrow: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  cardDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    marginBottom: spacing.md,
  },
  promptPreview: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptPreviewLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  promptPreviewText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
});
