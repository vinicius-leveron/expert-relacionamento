import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import {
  useConversationsStore,
  type Conversation,
} from '@/stores/conversations.store';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { NewConversationButton } from './NewConversationButton';
import { ConversationListItem } from './ConversationListItem';
import { colors, spacing, typography, getShadow } from '@/theme';

export function ConversationDrawer({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const {
    conversations,
    activeId,
    isLoading,
    fetchConversations,
    createConversation,
    selectConversation,
    archiveConversation,
  } = useConversationsStore();

  const chatStore = useChatStore();
  const { accessToken } = useAuthStore();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewConversation = useCallback(async () => {
    try {
      const newConversation = await createConversation();

      // Limpar mensagens do chat e definir novo conversationId
      chatStore.disconnectSSE();
      useChatStore.setState({
        messages: [],
        conversationId: newConversation.id,
        pendingAttachments: [],
        isLoading: false,
      });

      // Reconectar SSE para nova conversa
      if (accessToken) {
        chatStore.connectSSE(accessToken);
      }

      navigation.closeDrawer();
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  }, [createConversation, chatStore, navigation, accessToken]);

  const handleSelectConversation = useCallback(
    async (conversation: Conversation) => {
      selectConversation(conversation.id);

      // Atualizar chat store com nova conversa
      chatStore.disconnectSSE();
      useChatStore.setState({
        messages: [],
        conversationId: conversation.id,
        pendingAttachments: [],
        isLoading: false,
      });

      // Carregar mensagens da conversa selecionada
      await chatStore.loadMessages();

      // Reconectar SSE para nova conversa
      if (accessToken) {
        chatStore.connectSSE(accessToken);
      }

      navigation.closeDrawer();
    },
    [selectConversation, chatStore, navigation, accessToken]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await archiveConversation(id);

        // Se a conversa deletada era a ativa, criar nova
        if (activeId === id) {
          const remaining = useConversationsStore.getState().conversations;
          if (remaining.length > 0) {
            await handleSelectConversation(remaining[0]);
          } else {
            await handleNewConversation();
          }
        }
      } catch (error) {
        console.error('Erro ao arquivar conversa:', error);
      }
    },
    [archiveConversation, activeId, handleSelectConversation, handleNewConversation]
  );

  const renderItem = ({ item }: { item: Conversation }) => (
    <ConversationListItem
      conversation={item}
      isActive={item.id === activeId}
      onPress={() => handleSelectConversation(item)}
      onDelete={() => handleDeleteConversation(item.id)}
    />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Carregando conversas...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
        <Text style={styles.emptyText}>
          Clique em "Nova Conversa" para começar
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="heart" size={24} color={colors.primary} />
        </View>
        <Text style={styles.title}>Perpétuo</Text>
      </View>

      {/* New Conversation Button */}
      <NewConversationButton
        onPress={handleNewConversation}
        disabled={isLoading}
      />

      {/* Section Title */}
      <Text style={styles.sectionTitle}>Conversas Recentes</Text>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyList : undefined
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.footerText}>
          {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    ...getShadow('sm'),
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.md,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
});
