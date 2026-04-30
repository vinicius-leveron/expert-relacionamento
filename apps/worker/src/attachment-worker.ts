import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { EmbeddingPort } from '@perpetuo/ai-gateway'
import type { AttachmentRepository, ChatAttachment, SupabaseClient } from '@perpetuo/database'
import type { Logger } from 'pino'
import { prepareDocument } from './rag-ingestion.js'

const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'

export interface AttachmentWorkerConfig {
  maxJobsPerCycle?: number
  chunkSize?: number
  chunkOverlap?: number
}

export interface AttachmentWorkerStats {
  processed: number
  succeeded: number
  failed: number
  skipped: number
}

export class AttachmentWorker {
  private readonly maxJobsPerCycle: number
  private readonly chunkSize: number
  private readonly chunkOverlap: number

  constructor(
    private readonly deps: {
      supabase: SupabaseClient
      attachmentRepo: AttachmentRepository
      embeddingProvider: EmbeddingPort
      logger: Logger
    },
    config: AttachmentWorkerConfig = {},
  ) {
    this.maxJobsPerCycle = config.maxJobsPerCycle ?? 10
    this.chunkSize = config.chunkSize ?? 1200
    this.chunkOverlap = config.chunkOverlap ?? 200
  }

  async runCycle(): Promise<AttachmentWorkerStats> {
    const stats: AttachmentWorkerStats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    }

    for (let index = 0; index < this.maxJobsPerCycle; index += 1) {
      const job = await this.deps.attachmentRepo.getNextPendingJob('ingest')
      if (!job) {
        break
      }

      const claimedJob = await this.deps.attachmentRepo.markJobProcessing(job.id)
      if (!claimedJob) {
        stats.skipped += 1
        continue
      }

      stats.processed += 1

      try {
        await this.processAttachment(claimedJob.attachmentId)
        await this.deps.attachmentRepo.markJobCompleted(claimedJob.id)
        stats.succeeded += 1
      } catch (error) {
        const message = this.toErrorMessage(error)
        stats.failed += 1

        await this.deps.attachmentRepo.markJobFailed(claimedJob.id, message)

        const attachment = await this.deps.attachmentRepo.findById(claimedJob.attachmentId)
        if (attachment) {
          await this.deps.attachmentRepo.markFailed(claimedJob.attachmentId, message)
        }

        this.deps.logger.error(
          {
            error,
            attachmentId: claimedJob.attachmentId,
            jobId: claimedJob.id,
          },
          'Attachment ingestion job failed',
        )
      }
    }

    return stats
  }

  private async processAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.deps.attachmentRepo.findById(attachmentId)
    if (!attachment) {
      throw new Error('Attachment not found')
    }

    if (attachment.status === 'pending_upload') {
      throw new Error('Attachment upload is not complete yet')
    }

    await this.deps.attachmentRepo.markProcessing(attachment.id)

    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'chat-attachment-'))

    try {
      const buffer = await this.downloadAttachment(attachment.storagePath)
      const tempFilePath = path.join(tempDir, this.buildTempFileName(attachment.fileName))
      await fs.writeFile(tempFilePath, buffer)

      const prepared = await prepareDocument(tempFilePath, {
        cwd: tempDir,
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        sourceUrlPrefix: `attachment://${attachment.id}`,
      })

      if (prepared.chunks.length === 0) {
        throw new Error('Attachment does not contain indexable text')
      }

      const embeddings = await this.deps.embeddingProvider.embedBatch(
        prepared.chunks.map((chunk) => chunk.content),
      )

      await this.deps.attachmentRepo.replaceChunks({
        attachmentId: attachment.id,
        userId: attachment.userId,
        conversationId: attachment.conversationId,
        chunks: prepared.chunks.map((chunk, index) => ({
          content: chunk.content,
          tokenCount: embeddings[index]?.tokenCount,
          embedding: embeddings[index]?.embedding,
          metadata: {
            ...(chunk.metadata ?? {}),
            fileName: attachment.fileName,
            sourceType: prepared.sourceType,
          },
        })),
      })

      await this.deps.attachmentRepo.markReady({
        attachmentId: attachment.id,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        metadata: this.buildReadyMetadata(attachment, prepared),
      })
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }

  private async downloadAttachment(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.deps.supabase.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .download(storagePath)

    if (error || !data) {
      throw new Error(`Failed to download attachment: ${error?.message ?? 'missing file'}`)
    }

    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private buildReadyMetadata(
    attachment: ChatAttachment,
    prepared: Awaited<ReturnType<typeof prepareDocument>>,
  ): Record<string, unknown> {
    return {
      ...attachment.metadata,
      ingestedAt: new Date().toISOString(),
      sourceType: prepared.sourceType,
      contentHash: prepared.metadata.contentHash,
      contentLength: prepared.metadata.contentLength,
      chunkCount: prepared.chunks.length,
      chunking: prepared.metadata.chunking,
      sourcePath: prepared.metadata.sourcePath,
    }
  }

  private buildTempFileName(fileName: string): string {
    const trimmed = path.basename(fileName.trim())
    if (trimmed.length > 0) {
      return trimmed
    }

    return 'attachment.txt'
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 500)
    }

    return 'Unknown attachment ingestion error'
  }
}
