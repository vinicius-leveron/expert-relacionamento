import type { SupabaseClient } from '../client.js'
import type { ChatAttachmentJobRow, ChatAttachmentRow, Json } from '../types.js'

export type ChatAttachmentScope = 'conversation' | 'user_library'
export type ChatAttachmentStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed'

export type ChatAttachmentJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ChatAttachment {
  id: string
  userId: string
  conversationId: string
  scope: ChatAttachmentScope
  fileName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  sha256?: string
  status: ChatAttachmentStatus
  errorMessage?: string
  pageCount?: number
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface ChatAttachmentJob {
  id: string
  attachmentId: string
  jobType: string
  status: ChatAttachmentJobStatus
  attemptCount: number
  scheduledAt: Date
  startedAt?: Date
  finishedAt?: Date
  lastError?: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface AttachmentRepository {
  createPending(params: {
    id?: string
    userId: string
    conversationId: string
    fileName: string
    mimeType: string
    sizeBytes: number
    storagePath: string
    scope?: ChatAttachmentScope
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachment>
  findById(attachmentId: string): Promise<ChatAttachment | null>
  listByConversation(conversationId: string): Promise<ChatAttachment[]>
  findByConversationAndIds(params: {
    conversationId: string
    userId: string
    attachmentIds: string[]
  }): Promise<ChatAttachment[]>
  markUploaded(attachmentId: string): Promise<ChatAttachment>
  markProcessing(attachmentId: string): Promise<ChatAttachment>
  markReady(params: {
    attachmentId: string
    sha256?: string
    pageCount?: number
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachment>
  markFailed(attachmentId: string, errorMessage: string): Promise<ChatAttachment>
  createJob(params: {
    attachmentId: string
    jobType?: string
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachmentJob>
  getNextPendingJob(jobType?: string): Promise<ChatAttachmentJob | null>
  markJobProcessing(jobId: string): Promise<ChatAttachmentJob | null>
  markJobCompleted(jobId: string): Promise<ChatAttachmentJob>
  markJobFailed(jobId: string, errorMessage: string): Promise<ChatAttachmentJob>
  replaceChunks(params: {
    attachmentId: string
    userId: string
    conversationId: string
    chunks: Array<{ content: string; tokenCount?: number; metadata?: Record<string, unknown>; embedding?: number[] }>
  }): Promise<void>
  deleteById(attachmentId: string): Promise<void>
}

export class SupabaseAttachmentRepository implements AttachmentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createPending(params: {
    id?: string
    userId: string
    conversationId: string
    fileName: string
    mimeType: string
    sizeBytes: number
    storagePath: string
    scope?: ChatAttachmentScope
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachment> {
    const { data, error } = await this.supabase
      .from('chat_attachments')
      .insert({
        id: params.id,
        user_id: params.userId,
        conversation_id: params.conversationId,
        scope: params.scope ?? 'conversation',
        file_name: params.fileName,
        mime_type: params.mimeType,
        size_bytes: params.sizeBytes,
        storage_path: params.storagePath,
        metadata: (params.metadata ?? {}) as Json,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create chat attachment: ${error?.message}`)
    }

    return this.mapAttachment(data)
  }

  async findById(attachmentId: string): Promise<ChatAttachment | null> {
    const { data, error } = await this.supabase
      .from('chat_attachments')
      .select('*')
      .eq('id', attachmentId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapAttachment(data)
  }

  async listByConversation(conversationId: string): Promise<ChatAttachment[]> {
    const { data, error } = await this.supabase
      .from('chat_attachments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to list chat attachments: ${error.message}`)
    }

    return (data ?? []).map((row) => this.mapAttachment(row))
  }

  async findByConversationAndIds(params: {
    conversationId: string
    userId: string
    attachmentIds: string[]
  }): Promise<ChatAttachment[]> {
    if (params.attachmentIds.length === 0) {
      return []
    }

    const { data, error } = await this.supabase
      .from('chat_attachments')
      .select('*')
      .eq('conversation_id', params.conversationId)
      .eq('user_id', params.userId)
      .in('id', params.attachmentIds)

    if (error) {
      throw new Error(`Failed to find chat attachments: ${error.message}`)
    }

    return (data ?? []).map((row) => this.mapAttachment(row))
  }

  async markUploaded(attachmentId: string): Promise<ChatAttachment> {
    return this.updateAttachment(attachmentId, {
      status: 'uploaded',
      error_message: null,
    })
  }

  async markProcessing(attachmentId: string): Promise<ChatAttachment> {
    return this.updateAttachment(attachmentId, {
      status: 'processing',
      error_message: null,
    })
  }

  async markReady(params: {
    attachmentId: string
    sha256?: string
    pageCount?: number
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachment> {
    return this.updateAttachment(params.attachmentId, {
      status: 'ready',
      sha256: params.sha256,
      page_count: params.pageCount,
      error_message: null,
      ...(params.metadata ? { metadata: params.metadata as Json } : {}),
    })
  }

  async markFailed(attachmentId: string, errorMessage: string): Promise<ChatAttachment> {
    return this.updateAttachment(attachmentId, {
      status: 'failed',
      error_message: errorMessage,
    })
  }

  async createJob(params: {
    attachmentId: string
    jobType?: string
    metadata?: Record<string, unknown>
  }): Promise<ChatAttachmentJob> {
    const { data, error } = await this.supabase
      .from('chat_attachment_jobs')
      .insert({
        attachment_id: params.attachmentId,
        job_type: params.jobType ?? 'ingest',
        metadata: (params.metadata ?? {}) as Json,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create chat attachment job: ${error?.message}`)
    }

    return this.mapJob(data)
  }

  async getNextPendingJob(jobType = 'ingest'): Promise<ChatAttachmentJob | null> {
    const { data, error } = await this.supabase
      .from('chat_attachment_jobs')
      .select('*')
      .eq('job_type', jobType)
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch next chat attachment job: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return this.mapJob(data)
  }

  async markJobProcessing(jobId: string): Promise<ChatAttachmentJob | null> {
    const { data, error } = await this.supabase
      .from('chat_attachment_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to mark chat attachment job processing: ${error.message}`)
    }

    return data ? this.mapJob(data) : null
  }

  async markJobCompleted(jobId: string): Promise<ChatAttachmentJob> {
    const { data, error } = await this.supabase
      .from('chat_attachment_jobs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', jobId)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to mark chat attachment job completed: ${error?.message}`)
    }

    return this.mapJob(data)
  }

  async markJobFailed(jobId: string, errorMessage: string): Promise<ChatAttachmentJob> {
    const { data, error } = await this.supabase
      .from('chat_attachment_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        last_error: errorMessage,
      })
      .eq('id', jobId)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to mark chat attachment job failed: ${error?.message}`)
    }

    return this.mapJob(data)
  }

  async replaceChunks(params: {
    attachmentId: string
    userId: string
    conversationId: string
    chunks: Array<{
      content: string
      tokenCount?: number
      metadata?: Record<string, unknown>
      embedding?: number[]
    }>
  }): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from('chat_attachment_chunks')
      .delete()
      .eq('attachment_id', params.attachmentId)

    if (deleteError) {
      throw new Error(`Failed to clear chat attachment chunks: ${deleteError.message}`)
    }

    if (params.chunks.length === 0) {
      return
    }

    const { error: insertError } = await this.supabase.from('chat_attachment_chunks').insert(
      params.chunks.map((chunk, index) => ({
        attachment_id: params.attachmentId,
        user_id: params.userId,
        conversation_id: params.conversationId,
        content: chunk.content,
        embedding: chunk.embedding ?? null,
        chunk_index: index,
        token_count: chunk.tokenCount ?? null,
        metadata: (chunk.metadata ?? {}) as Json,
      })),
    )

    if (insertError) {
      throw new Error(`Failed to insert chat attachment chunks: ${insertError.message}`)
    }
  }

  async deleteById(attachmentId: string): Promise<void> {
    const { error } = await this.supabase.from('chat_attachments').delete().eq('id', attachmentId)

    if (error) {
      throw new Error(`Failed to delete chat attachment: ${error.message}`)
    }
  }

  private async updateAttachment(
    attachmentId: string,
    patch: Partial<ChatAttachmentRow>,
  ): Promise<ChatAttachment> {
    const { data, error } = await this.supabase
      .from('chat_attachments')
      .update(patch)
      .eq('id', attachmentId)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(`Failed to update chat attachment: ${error?.message}`)
    }

    return this.mapAttachment(data)
  }

  private mapAttachment(row: ChatAttachmentRow): ChatAttachment {
    return {
      id: row.id,
      userId: row.user_id,
      conversationId: row.conversation_id,
      scope: row.scope as ChatAttachmentScope,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storagePath: row.storage_path,
      sha256: row.sha256 ?? undefined,
      status: row.status as ChatAttachmentStatus,
      errorMessage: row.error_message ?? undefined,
      pageCount: row.page_count ?? undefined,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapJob(row: ChatAttachmentJobRow): ChatAttachmentJob {
    return {
      id: row.id,
      attachmentId: row.attachment_id,
      jobType: row.job_type,
      status: row.status as ChatAttachmentJobStatus,
      attemptCount: row.attempt_count,
      scheduledAt: new Date(row.scheduled_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      lastError: row.last_error ?? undefined,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }
}
