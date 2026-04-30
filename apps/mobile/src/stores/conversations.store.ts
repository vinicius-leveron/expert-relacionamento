import { create } from 'zustand';
import { api } from '@/api/client';

export interface Conversation {
  id: string;
  title: string;
  channel: string;
  status: 'active' | 'archived';
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsState {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchConversations: () => Promise<void>;
  createConversation: () => Promise<Conversation>;
  selectConversation: (id: string) => void;
  archiveConversation: (id: string) => Promise<void>;
  setActiveId: (id: string | null) => void;
  getActiveConversation: () => Conversation | undefined;
}

interface ConversationsResponse {
  success: boolean;
  data: Array<{
    id: string;
    channel: string;
    status: 'active' | 'archived';
    summary?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface CreateConversationResponse {
  success: boolean;
  data: {
    id: string;
    channel: string;
    status: 'active' | 'archived';
    createdAt: string;
    updatedAt: string;
  };
}

function generateTitle(summary?: string): string {
  if (summary && summary.trim()) {
    const trimmed = summary.trim();
    return trimmed.length > 40 ? trimmed.slice(0, 40) + '...' : trimmed;
  }
  return 'Nova conversa';
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  activeId: null,
  isLoading: false,
  error: null,

  fetchConversations: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<ConversationsResponse>('/conversations');

      if (!response.data.success) {
        throw new Error('Falha ao carregar conversas');
      }

      const conversations: Conversation[] = response.data.data
        .filter((c) => c.status === 'active')
        .map((c) => ({
          id: c.id,
          title: generateTitle(c.summary),
          channel: c.channel,
          status: c.status,
          summary: c.summary,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

      const currentActiveId = get().activeId;
      const nextActiveId =
        currentActiveId && conversations.some((conversation) => conversation.id === currentActiveId)
          ? currentActiveId
          : conversations[0]?.id ?? null;

      set({ conversations, activeId: nextActiveId, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      set({ error: message, isLoading: false });
    }
  },

  createConversation: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<CreateConversationResponse>(
        '/conversations'
      );

      if (!response.data.success) {
        throw new Error('Falha ao criar conversa');
      }

      const newConversation: Conversation = {
        id: response.data.data.id,
        title: 'Nova conversa',
        channel: response.data.data.channel,
        status: response.data.data.status,
        createdAt: response.data.data.createdAt,
        updatedAt: response.data.data.updatedAt,
      };

      set((state) => ({
        conversations: [newConversation, ...state.conversations],
        activeId: newConversation.id,
        isLoading: false,
      }));

      return newConversation;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  selectConversation: (id: string) => {
    set({ activeId: id });
  },

  archiveConversation: async (id: string) => {
    const { activeId, conversations } = get();

    // Otimisticamente remove da lista
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    }));

    try {
      await api.delete(`/conversations/${id}`);

      // Se a conversa ativa foi arquivada, limpar activeId
      if (activeId === id) {
        const remaining = get().conversations;
        set({ activeId: remaining.length > 0 ? remaining[0].id : null });
      }
    } catch (error) {
      // Rollback em caso de erro
      set((state) => ({
        conversations: [...conversations],
      }));
      throw error;
    }
  },

  setActiveId: (id: string | null) => {
    set({ activeId: id });
  },

  getActiveConversation: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId);
  },
}));
