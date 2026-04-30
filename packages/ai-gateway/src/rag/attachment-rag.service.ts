import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmbeddingPort } from '../embeddings/embedding.port.js'

export interface AttachmentKnowledgeChunk {
  id: string
  attachmentId: string
  fileName: string
  content: string
  similarity: number
  metadata: Record<string, unknown>
}

export interface AttachmentRAGSearchOptions {
  userId: string
  conversationId: string
  attachmentIds?: string[]
  matchThreshold?: number
  matchCount?: number
}

export interface AttachmentRAGServiceConfig {
  supabase: SupabaseClient
  embeddingProvider: EmbeddingPort
}

interface RawAttachmentSearchResult {
  id: string
  attachment_id: string
  file_name: string
  content: string
  similarity: number
  metadata: Record<string, unknown> | null
}

interface RawAttachmentOverviewRow {
  id: string
  attachment_id: string
  content: string
  metadata: Record<string, unknown> | null
  chat_attachments:
    | {
        id: string
        file_name: string
        user_id: string
        conversation_id: string
        status: string
      }
    | {
        id: string
        file_name: string
        user_id: string
        conversation_id: string
        status: string
      }[]
    | null
}

export class AttachmentRAGService {
  private readonly supabase: SupabaseClient
  private readonly embedding: EmbeddingPort

  constructor(config: AttachmentRAGServiceConfig) {
    this.supabase = config.supabase
    this.embedding = config.embeddingProvider
  }

  async search(
    query: string,
    options: AttachmentRAGSearchOptions,
  ): Promise<AttachmentKnowledgeChunk[]> {
    const { matchThreshold = 0.7, matchCount = 5 } = options
    const { embedding } = await this.embedding.embed(query)

    const { data, error } = await this.supabase.rpc('search_chat_attachment_chunks', {
      query_embedding: embedding,
      filter_user_id: options.userId,
      filter_conversation_id: options.conversationId,
      filter_attachment_ids:
        options.attachmentIds && options.attachmentIds.length > 0 ? options.attachmentIds : null,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      throw new Error(`Attachment RAG search failed: ${error.message}`)
    }

    return (data ?? []).map((row: RawAttachmentSearchResult) => ({
      id: row.id,
      attachmentId: row.attachment_id,
      fileName: row.file_name,
      content: row.content,
      similarity: row.similarity,
      metadata: row.metadata ?? {},
    }))
  }

  async getAttachmentOverview(params: {
    userId: string
    conversationId: string
    attachmentIds: string[]
    maxChunks?: number
  }): Promise<AttachmentKnowledgeChunk[]> {
    if (params.attachmentIds.length === 0) {
      return []
    }

    const { data, error } = await this.supabase
      .from('chat_attachment_chunks')
      .select(
        `
          id,
          attachment_id,
          content,
          metadata,
          chat_attachments!inner (
            id,
            file_name,
            user_id,
            conversation_id,
            status
          )
        `,
      )
      .eq('user_id', params.userId)
      .eq('conversation_id', params.conversationId)
      .in('attachment_id', params.attachmentIds)
      .order('attachment_id', { ascending: true })
      .order('chunk_index', { ascending: true })
      .limit(params.maxChunks ?? 6)

    if (error) {
      throw new Error(`Failed to load attachment overview: ${error.message}`)
    }

    return ((data ?? []) as RawAttachmentOverviewRow[])
      .filter((row) => {
        const attachment = row.chat_attachments
        return !!attachment && !Array.isArray(attachment) && attachment.status === 'ready'
      })
      .map((row) => {
        const attachment = row.chat_attachments
        if (!attachment || Array.isArray(attachment)) {
          throw new Error('Unexpected attachment join result while loading overview')
        }

        return {
          id: row.id,
          attachmentId: row.attachment_id,
          fileName: attachment.file_name,
          content: row.content,
          similarity: 1,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        }
      })
  }

  formatForContext(chunks: AttachmentKnowledgeChunk[]): string {
    if (chunks.length === 0) {
      return ''
    }

    const formatted = chunks
      .map((chunk, index) => `[${index + 1}] Arquivo: ${chunk.fileName}\n${chunk.content}`)
      .join('\n\n')

    return `---
ARQUIVOS ANEXADOS RELEVANTES:
${formatted}
---`
  }
}
