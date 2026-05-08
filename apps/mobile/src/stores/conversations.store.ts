import { create } from 'zustand';
import { api } from '@/api/client';
import type { AgentId } from '@/data/specialized-agents';

export interface ConversationMetadata {
  agentId?: AgentId;
}

export interface Conversation {
  id: string;
  title: string;
  channel: string;
  status: 'active' | 'archived';
  summary?: string;
  metadata?: ConversationMetadata;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsState {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchConversations: () => Promise<void>;
  createConversation: (params?: {
    metadata?: ConversationMetadata;
  }) => Promise<Conversation>;
  selectConversation: (id: string) => void;
  archiveConversation: (id: string) => Promise<void>;
  setActiveId: (id: string | null) => void;
  updateConversationPreview: (params: {
    id: string;
    summary?: string;
    updatedAt?: string;
  }) => void;
  getActiveConversation: () => Conversation | undefined;
}

interface ConversationsResponse {
  success: boolean;
  data: Array<{
    id: string;
    channel: string;
    status: 'active' | 'archived';
    summary?: string;
    metadata?: ConversationMetadata | null;
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
    metadata?: ConversationMetadata | null;
    createdAt: string;
    updatedAt: string;
  };
}

function normalizeConversationSummary(summary?: string): string | undefined {
  if (!summary) {
    return undefined;
  }

  const trimmed = summary.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return undefined;
  }

  const firstSentence = trimmed.split(/[.!?]/)[0]?.trim() ?? trimmed;
  const normalized = firstSentence || trimmed;

  return normalized.length > 80 ? `${normalized.slice(0, 80).trim()}...` : normalized;
}

function generateTitle(summary?: string): string {
  const normalized = normalizeConversationSummary(summary);

  if (!normalized) {
    return 'Nova conversa';
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48).trim()}...` : normalized;
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
          metadata: c.metadata ?? undefined,
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

  createConversation: async (params) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<CreateConversationResponse>(
        '/conversations',
        params?.metadata ? { metadata: params.metadata } : undefined,
      );

      if (!response.data.success) {
        throw new Error('Falha ao criar conversa');
      }

      const newConversation: Conversation = {
        id: response.data.data.id,
        title: 'Nova conversa',
        channel: response.data.data.channel,
        status: response.data.data.status,
        metadata: response.data.data.metadata ?? undefined,
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
      const response = await api.delete<{ success: boolean }>(`/conversations/${id}`);

      // Verifica se a resposta foi bem sucedida
      if (!response.data.success) {
        throw new Error('Falha ao arquivar conversa');
      }

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

  updateConversationPreview: ({ id, summary, updatedAt }) => {
    const normalizedSummary = normalizeConversationSummary(summary);

    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              summary: normalizedSummary ?? conversation.summary,
              title: generateTitle(normalizedSummary ?? conversation.summary),
              updatedAt: updatedAt ?? new Date().toISOString(),
            }
          : conversation,
      ),
    }));
  },

  getActiveConversation: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId);
  },
}));
