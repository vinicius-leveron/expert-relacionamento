import type { SupabaseClient } from '../client.js'
import type { ConversationRow, Json, MessageRow } from '../types.js'

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  contentType: 'text' | 'image' | 'audio'
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface Conversation {
  id: string
  userId: string
  channel: string
  status: 'active' | 'archived'
  summary?: string
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

export interface ConversationRepository {
  /**
   * Busca ou cria conversa ativa para um usuário
   */
  getOrCreateActive(userId: string, channel: string): Promise<Conversation>

  /**
   * Adiciona mensagem a uma conversa
   */
  addMessage(params: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    contentType?: 'text' | 'image' | 'audio'
    metadata?: Record<string, unknown>
  }): Promise<Message>

  /**
   * Busca mensagens recentes de uma conversa
   */
  getRecentMessages(conversationId: string, limit?: number): Promise<Message[]>

  /**
   * Busca histórico completo do usuário (para contexto)
   */
  getUserHistory(userId: string, limit?: number): Promise<Message[]>

  /**
   * Atualiza resumo da conversa (para compressão de contexto)
   */
  updateSummary(conversationId: string, summary: string): Promise<void>

  /**
   * Arquiva conversa antiga
   */
  archive(conversationId: string): Promise<void>
}

/**
 * SupabaseConversationRepository - Implementação usando Supabase
 */
export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOrCreateActive(userId: string, channel: string): Promise<Conversation> {
    // Busca conversa ativa existente
    const { data: existing } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('channel', channel)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const messages = await this.getRecentMessages(existing.id)
      return this.mapConversation(existing, messages)
    }

    // Cria nova conversa
    const { data: created, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: userId,
        channel,
        status: 'active',
      })
      .select()
      .single()

    if (error || !created) {
      throw new Error(`Failed to create conversation: ${error?.message}`)
    }

    return this.mapConversation(created, [])
  }

  async addMessage(params: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    contentType?: 'text' | 'image' | 'audio'
    metadata?: Record<string, number | string>
  }): Promise<Message> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        role: params.role,
        content: params.content,
        content_type: params.contentType ?? 'text',
        metadata: (params.metadata ?? {}) as Json,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to add message: ${error?.message}`)
    }

    return this.mapMessage(data)
  }

  async getRecentMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`)
    }

    return (data ?? []).map(this.mapMessage)
  }

  async getUserHistory(userId: string, limit = 100): Promise<Message[]> {
    // Busca mensagens de todas as conversas do usuário
    const { data: conversations } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)

    if (!conversations || conversations.length === 0) {
      return []
    }

    const conversationIds = conversations.map((c) => c.id)

    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get user history: ${error.message}`)
    }

    // Retorna em ordem cronológica
    return (data ?? []).reverse().map(this.mapMessage)
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({ summary })
      .eq('id', conversationId)

    if (error) {
      throw new Error(`Failed to update summary: ${error.message}`)
    }
  }

  async archive(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', conversationId)

    if (error) {
      throw new Error(`Failed to archive conversation: ${error.message}`)
    }
  }

  private mapConversation(row: ConversationRow, messages: Message[]): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      status: row.status as 'active' | 'archived',
      summary: row.summary ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      messages,
    }
  }

  private mapMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      contentType: row.content_type as 'text' | 'image' | 'audio',
      metadata: row.metadata as Record<string, unknown>,
      createdAt: new Date(row.created_at),
    }
  }
}
