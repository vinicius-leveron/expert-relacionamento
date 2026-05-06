import type { SupabaseClient } from '../client.js'
import type {
  ChatAttachmentRow,
  ConversationRow,
  Json,
  MessageAttachmentRow,
  MessageRow,
} from '../types.js'

export interface MessageAttachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: string
  storagePath: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  contentType: 'text' | 'image' | 'audio'
  metadata?: Record<string, unknown>
  attachments?: MessageAttachment[]
  createdAt: Date
}

export interface Conversation {
  id: string
  userId: string
  channel: string
  status: 'active' | 'archived'
  summary?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

export interface ConversationRepository {
  /**
   * Cria nova conversa
   */
  create(params: {
    userId: string
    channel: string
    metadata?: Record<string, unknown>
  }): Promise<Conversation>

  /**
   * Busca conversa por ID
   */
  findById(conversationId: string): Promise<Conversation | null>

  /**
   * Busca todas as conversas de um usuário
   */
  findByUserId(userId: string): Promise<Conversation[]>

  /**
   * Busca ou cria conversa ativa para um usuário
   */
  getOrCreateActive(userId: string, channel: string): Promise<Conversation>

  /**
   * Busca mensagens de uma conversa
   */
  getMessages(conversationId: string, limit?: number): Promise<Message[]>

  /**
   * Adiciona mensagem a uma conversa
   */
  addMessage(params: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    contentType?: 'text' | 'image' | 'audio'
    metadata?: Record<string, unknown>
    attachmentIds?: string[]
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
   * Conta mensagens do usuário por tipo a partir de uma data
   */
  countUserMessagesByTypeSince(params: {
    userId: string
    role: 'user' | 'assistant'
    contentType: 'text' | 'image' | 'audio'
    since: Date
    conversationAgentIds?: string[]
    excludeConversationAgentIds?: string[]
  }): Promise<number>

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

  private isMissingRelationError(message?: string): boolean {
    if (!message) {
      return false
    }

    return (
      message.includes("Could not find the table 'public.message_attachments' in the schema cache") ||
      message.includes("Could not find the table 'public.chat_attachments' in the schema cache") ||
      message.includes('relation "message_attachments" does not exist') ||
      message.includes('relation "chat_attachments" does not exist')
    )
  }

  async create(params: {
    userId: string
    channel: string
    metadata?: Record<string, unknown>
  }): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        user_id: params.userId,
        channel: params.channel,
        status: 'active',
        metadata: (params.metadata ?? {}) as Json,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create conversation: ${error?.message}`)
    }

    return this.mapConversation(data, [])
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapConversation(data, [])
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to find conversations: ${error.message}`)
    }

    return (data ?? []).map((row) => this.mapConversation(row, []))
  }

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    return this.getRecentMessages(conversationId, limit)
  }

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
    metadata?: Record<string, unknown>
    attachmentIds?: string[]
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

    if (params.attachmentIds && params.attachmentIds.length > 0) {
      const { error: linkError } = await this.supabase.from('message_attachments').insert(
        params.attachmentIds.map((attachmentId) => ({
          message_id: data.id,
          attachment_id: attachmentId,
        })),
      )

      if (linkError) {
        if (this.isMissingRelationError(linkError.message)) {
          return this.mapMessage(data, [])
        }
        throw new Error(`Failed to link message attachments: ${linkError.message}`)
      }
    }

    const attachments = await this.getAttachmentsForMessages([data.id])
    return this.mapMessage(data, attachments.get(data.id) ?? [])
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

    const messages = data ?? []
    const attachments = await this.getAttachmentsForMessages(messages.map((row) => row.id))

    return messages.map((row) => this.mapMessage(row, attachments.get(row.id) ?? []))
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
    const messages = (data ?? []).reverse()
    const attachments = await this.getAttachmentsForMessages(messages.map((row) => row.id))

    return messages.map((row) => this.mapMessage(row, attachments.get(row.id) ?? []))
  }

  async countUserMessagesByTypeSince(params: {
    userId: string
    role: 'user' | 'assistant'
    contentType: 'text' | 'image' | 'audio'
    since: Date
    conversationAgentIds?: string[]
    excludeConversationAgentIds?: string[]
  }): Promise<number> {
    const { data: conversations } = await this.supabase
      .from('conversations')
      .select('id, metadata')
      .eq('user_id', params.userId)

    if (!conversations || conversations.length === 0) {
      return 0
    }

    const includeAgentIds =
      params.conversationAgentIds && params.conversationAgentIds.length > 0
        ? new Set(params.conversationAgentIds)
        : null
    const excludeAgentIds =
      params.excludeConversationAgentIds && params.excludeConversationAgentIds.length > 0
        ? new Set(params.excludeConversationAgentIds)
        : null

    const conversationIds = conversations
      .filter((conversation) => {
        const metadata =
          conversation.metadata &&
          typeof conversation.metadata === 'object' &&
          !Array.isArray(conversation.metadata)
            ? (conversation.metadata as Record<string, unknown>)
            : undefined
        const agentId =
          typeof metadata?.agentId === 'string' ? metadata.agentId : undefined

        if (includeAgentIds) {
          return agentId ? includeAgentIds.has(agentId) : false
        }

        if (excludeAgentIds) {
          return !agentId || !excludeAgentIds.has(agentId)
        }

        return true
      })
      .map((conversation) => conversation.id)

    if (conversationIds.length === 0) {
      return 0
    }

    const { count, error } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('role', params.role)
      .eq('content_type', params.contentType)
      .gte('created_at', params.since.toISOString())

    if (error) {
      throw new Error(`Failed to count user messages: ${error.message}`)
    }

    return count ?? 0
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
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined

    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      status: row.status as 'active' | 'archived',
      summary: row.summary ?? undefined,
      metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      messages,
    }
  }

  private async getAttachmentsForMessages(
    messageIds: string[],
  ): Promise<Map<string, MessageAttachment[]>> {
    const result = new Map<string, MessageAttachment[]>()

    if (messageIds.length === 0) {
      return result
    }

    const { data: links, error: linksError } = await this.supabase
      .from('message_attachments')
      .select('*')
      .in('message_id', messageIds)

    if (linksError) {
      if (this.isMissingRelationError(linksError.message)) {
        return result
      }
      throw new Error(`Failed to load message attachments: ${linksError.message}`)
    }

    const attachmentIds = [...new Set((links ?? []).map((link) => link.attachment_id))]
    if (attachmentIds.length === 0) {
      return result
    }

    const { data: attachments, error: attachmentsError } = await this.supabase
      .from('chat_attachments')
      .select('*')
      .in('id', attachmentIds)

    if (attachmentsError) {
      if (this.isMissingRelationError(attachmentsError.message)) {
        return result
      }
      throw new Error(`Failed to load attachments: ${attachmentsError.message}`)
    }

    const attachmentById = new Map(
      (attachments ?? []).map((attachment) => [attachment.id, this.mapAttachment(attachment)]),
    )

    for (const link of (links ?? []) as MessageAttachmentRow[]) {
      const attachment = attachmentById.get(link.attachment_id)
      if (!attachment) {
        continue
      }

      const current = result.get(link.message_id) ?? []
      current.push(attachment)
      result.set(link.message_id, current)
    }

    return result
  }

  private mapMessage(row: MessageRow, attachments: MessageAttachment[] = []): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      contentType: row.content_type as 'text' | 'image' | 'audio',
      metadata: row.metadata as Record<string, unknown>,
      attachments,
      createdAt: new Date(row.created_at),
    }
  }

  private mapAttachment(row: ChatAttachmentRow): MessageAttachment {
    return {
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.status,
      storagePath: row.storage_path,
    }
  }
}
