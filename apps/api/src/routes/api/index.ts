import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { Hono } from 'hono'
import type {
  JwtService,
  MagicLinkService,
  UserRepository,
  VerificationCodeService,
} from '@perpetuo/core'
import type {
  AttachmentRepository,
  SupabaseConversationRepository,
  SupabaseDiagnosticRepository,
  SupabaseSessionRepository,
  SupabaseSubscriptionRepository,
} from '@perpetuo/database'
import type { Logger } from 'pino'
import { createAuthRoutes } from './auth.routes.js'
import { createStreamRoutes } from './stream.routes.js'
import { createAuthMiddleware } from '../../middleware/auth.middleware.js'
import type { MessageEmitter } from '../../events/message-emitter.js'
import type { MessagePipeline } from '../../pipeline/message-pipeline.js'
import {
  ChatAttachmentStorageService,
  sanitizeAttachmentFileName,
} from '../../services/chat-attachment-storage.service.js'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
const MAX_ATTACHMENTS_PER_MESSAGE = 5
const MAX_INLINE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_INLINE_AUDIO_SIZE_BYTES = 10 * 1024 * 1024
const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
])
const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
  '.json',
])
const SUPPORTED_INLINE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const SUPPORTED_INLINE_AUDIO_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
])

function isSupportedAttachment(fileName: string, mimeType: string): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase()
  const extension = extname(fileName.trim()).toLowerCase()

  return (
    SUPPORTED_ATTACHMENT_MIME_TYPES.has(normalizedMimeType) ||
    SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension)
  )
}

function estimateBase64SizeInBytes(base64: string): number {
  const sanitized = base64.replace(/\s+/g, '')
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0
  return Math.floor((sanitized.length * 3) / 4) - padding
}

function parseInlineMediaData(mediaData: string): {
  base64: string
  mediaTypeFromDataUrl?: string
} {
  const trimmed = mediaData.trim()
  const dataUrlMatch = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/i)

  if (!dataUrlMatch) {
    return { base64: trimmed }
  }

  return {
    mediaTypeFromDataUrl: dataUrlMatch[1]?.trim().toLowerCase(),
    base64: dataUrlMatch[2]?.trim() ?? '',
  }
}

function isValidBase64String(base64: string): boolean {
  const sanitized = base64.replace(/\s+/g, '')

  if (sanitized.length === 0 || sanitized.length % 4 !== 0) {
    return false
  }

  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(sanitized)
}

function getImageExtension(mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): string {
  switch (mediaType) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
  }
}

function getAudioExtension(
  mediaType:
    | 'audio/mp4'
    | 'audio/mpeg'
    | 'audio/wav'
    | 'audio/x-wav'
    | 'audio/webm'
    | 'audio/ogg'
    | 'audio/aac',
): string {
  switch (mediaType) {
    case 'audio/mpeg':
      return '.mp3'
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav'
    case 'audio/webm':
      return '.webm'
    case 'audio/ogg':
      return '.ogg'
    case 'audio/aac':
      return '.aac'
    case 'audio/mp4':
    default:
      return '.m4a'
  }
}

export interface ApiRoutesConfig {
  jwtService: JwtService
  magicLinkService: MagicLinkService
  verificationCodeService: VerificationCodeService
  sessionRepo: SupabaseSessionRepository
  userRepo: UserRepository
  conversationRepo?: SupabaseConversationRepository
  attachmentRepo?: AttachmentRepository
  attachmentStorage?: ChatAttachmentStorageService
  diagnosticRepo?: SupabaseDiagnosticRepository
  subscriptionRepo?: SupabaseSubscriptionRepository
  messageEmitter?: MessageEmitter
  appPipeline?: MessagePipeline
  paymentUrl?: string
  logger: Logger
}

export function createApiRoutes(config: ApiRoutesConfig) {
  const {
    jwtService,
    magicLinkService,
    verificationCodeService,
    sessionRepo,
    userRepo,
    conversationRepo,
    attachmentRepo,
    attachmentStorage,
    diagnosticRepo,
    subscriptionRepo,
    messageEmitter,
    appPipeline,
    paymentUrl,
    logger,
  } = config

  const app = new Hono()

  // Auth routes (public)
  app.route(
    '/auth',
    createAuthRoutes({
      jwtService,
      magicLinkService,
      verificationCodeService,
      sessionRepo,
      userRepo,
      logger,
    })
  )

  // Stream routes (SSE)
  if (messageEmitter) {
    app.route(
      '/stream',
      createStreamRoutes({
        jwtService,
        messageEmitter,
        logger,
      })
    )
  }

  // Protected routes - require authentication
  const authMiddleware = createAuthMiddleware({ jwtService })

  // Profile routes
  app.get('/profile', authMiddleware, async (c) => {
    const userId = c.get('userId')

    try {
      const user = await userRepo.findById(userId)
      if (!user) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          404
        )
      }

      // Get additional data
      const diagnostic = diagnosticRepo ? await diagnosticRepo.getByUserId(userId) : null
      const subscription = subscriptionRepo ? await subscriptionRepo.getActiveByUserId(userId) : null
      const diagnosisCompleted = diagnostic !== null
      const hasActiveSubscription = subscription?.status === 'active'
      const subscriptionCheckEnabled = subscriptionRepo !== undefined
      const hasJourneyAccess =
        diagnosisCompleted && (!subscriptionCheckEnabled || hasActiveSubscription)
      const canAnalyzeImages =
        !diagnosisCompleted || !subscriptionCheckEnabled || hasActiveSubscription

      return c.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          phone: user.phoneE164,
          createdAt: user.createdAt.toISOString(),
          diagnostic: diagnostic
            ? {
                archetype: diagnostic.archetype,
                completedAt: diagnostic.completedAt,
              }
            : null,
          subscription: subscription
            ? {
                status: subscription.status,
                planId: subscription.planId,
                endDate: subscription.endDate,
              }
            : null,
          access: {
            diagnosisCompleted,
            hasActiveSubscription,
            hasJourneyAccess,
            canAnalyzeImages,
          },
          commerce: {
            checkoutUrl: paymentUrl ?? null,
            canUpgrade: Boolean(paymentUrl) && (!subscriptionCheckEnabled || !hasActiveSubscription),
          },
        },
      })
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get profile')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get profile' } },
        500
      )
    }
  })

  // Conversations routes
  app.get('/conversations', authMiddleware, async (c) => {
    const userId = c.get('userId')

    if (!conversationRepo) {
      return c.json({ success: true, data: [] })
    }

    try {
      const conversations = await conversationRepo.findByUserId(userId)

      return c.json({
        success: true,
        data: conversations.map((conv) => ({
          id: conv.id,
          channel: conv.channel,
          status: conv.status,
          summary: conv.summary ?? null,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
        })),
      })
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get conversations')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversations' } },
        500
      )
    }
  })

  app.get('/conversations/:id/messages', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')

    if (!conversationRepo) {
      return c.json({ success: true, data: [] })
    }

    try {
      // Verify conversation belongs to user
      const conversation = await conversationRepo.findById(conversationId)
      if (!conversation || conversation.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          404
        )
      }

      const messages = await conversationRepo.getMessages(conversationId)

      return c.json({
        success: true,
        data: await Promise.all(
          messages.map(async (msg) => {
            const imageStoragePath =
              typeof msg.metadata?.imageStoragePath === 'string'
                ? msg.metadata.imageStoragePath
                : undefined
            const imageMimeType =
              typeof msg.metadata?.imageMimeType === 'string'
                ? msg.metadata.imageMimeType
                : undefined
            const audioStoragePath =
              typeof msg.metadata?.audioStoragePath === 'string'
                ? msg.metadata.audioStoragePath
                : undefined
            const audioMimeType =
              typeof msg.metadata?.audioMimeType === 'string'
                ? msg.metadata.audioMimeType
                : undefined
            const audioDurationMs =
              typeof msg.metadata?.audioDurationMs === 'number'
                ? msg.metadata.audioDurationMs
                : undefined

            let image: { url: string; mimeType: string } | null = null
            let audio: { url: string; mimeType: string; durationMs?: number } | null = null

            if (msg.contentType === 'image' && imageStoragePath && attachmentStorage) {
              try {
                image = {
                  url: await attachmentStorage.createSignedReadUrl(imageStoragePath),
                  mimeType: imageMimeType ?? 'image/jpeg',
                }
              } catch (error) {
                logger.warn(
                  { error, conversationId, messageId: msg.id, imageStoragePath },
                  'Failed to create signed image URL for message preview',
                )
              }
            }

            if (msg.contentType === 'audio' && audioStoragePath && attachmentStorage) {
              try {
                audio = {
                  url: await attachmentStorage.createSignedReadUrl(audioStoragePath),
                  mimeType: audioMimeType ?? 'audio/mp4',
                  durationMs: audioDurationMs,
                }
              } catch (error) {
                logger.warn(
                  { error, conversationId, messageId: msg.id, audioStoragePath },
                  'Failed to create signed audio URL for message preview',
                )
              }
            }

            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              contentType: msg.contentType,
              image,
              audio,
              attachments: (msg.attachments ?? []).map((attachment) => ({
                id: attachment.id,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                status: attachment.status,
              })),
              createdAt: msg.createdAt.toISOString(),
            }
          }),
        ),
      })
    } catch (error) {
      logger.error({ error, userId, conversationId }, 'Failed to get messages')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get messages' } },
        500
      )
    }
  })

  // Diagnostic routes
  app.get('/diagnostic', authMiddleware, async (c) => {
    const userId = c.get('userId')

    if (!diagnosticRepo) {
      return c.json({ success: true, data: null })
    }

    try {
      const diagnostic = await diagnosticRepo.getByUserId(userId)

      if (!diagnostic) {
        return c.json({ success: true, data: null })
      }

      return c.json({
        success: true,
        data: {
          archetype: diagnostic.archetype,
          scores: diagnostic.scores,
          completedAt: diagnostic.completedAt,
        },
      })
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get diagnostic')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get diagnostic' } },
        500
      )
    }
  })

  // Send message via chat (processes through AI pipeline)
  app.post('/conversations/:id/messages', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')
    let uploadedInlineImagePath: string | undefined
    let uploadedInlineAudioPath: string | undefined
    let pipelineDelegated = false

    if (!appPipeline || !conversationRepo) {
      return c.json(
        { success: false, error: { code: 'NOT_CONFIGURED', message: 'Chat not configured' } },
        503
      )
    }

    try {
      const body = await c.req.json<{
        content?: string
        attachmentIds?: string[]
        image?: {
          data?: string
          mediaType?: string
        }
        audio?: {
          data?: string
          mediaType?: string
          durationMs?: number
        }
      }>()
      const content = body.content?.trim()
      const attachmentIds = [...new Set(body.attachmentIds ?? [])]
      const image = body.image
      const audio = body.audio
      const normalizedImageData = image?.data ? parseInlineMediaData(image.data) : undefined
      const normalizedAudioData = audio?.data ? parseInlineMediaData(audio.data) : undefined

      if (!content && attachmentIds.length === 0 && !image && !audio) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Content, image, audio or attachmentIds are required',
            },
          },
          400
        )
      }

      if (body.content !== undefined && typeof body.content !== 'string') {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Content must be a string' } },
          400
        )
      }

      if (body.attachmentIds !== undefined && !Array.isArray(body.attachmentIds)) {
        return c.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'attachmentIds must be an array' },
          },
          400
        )
      }

      if (body.image !== undefined && body.audio !== undefined) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Send either image or audio in the same message, not both',
            },
          },
          400
        )
      }

      if (body.image !== undefined) {
        if (!attachmentStorage) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_CONFIGURED', message: 'Image upload is not configured' },
            },
            503
          )
        }

        if (!image || typeof image !== 'object') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'image must be an object' },
            },
            400
          )
        }

        if (!image.data || typeof image.data !== 'string') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'image.data is required' },
            },
            400
          )
        }

        if (!image.mediaType || typeof image.mediaType !== 'string') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'image.mediaType is required' },
            },
            400
          )
        }

        const normalizedImageMediaType = image.mediaType.trim().toLowerCase()

        if (
          normalizedImageData?.mediaTypeFromDataUrl &&
          normalizedImageData.mediaTypeFromDataUrl !== normalizedImageMediaType
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'image.mediaType does not match the data URI media type',
              },
            },
            400
          )
        }

        if (!SUPPORTED_INLINE_IMAGE_MIME_TYPES.has(normalizedImageMediaType)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Unsupported image type. Allowed: image/jpeg, image/png, image/webp',
              },
            },
            400
          )
        }

        if (
          !normalizedImageData?.base64 ||
          estimateBase64SizeInBytes(normalizedImageData.base64) > MAX_INLINE_IMAGE_SIZE_BYTES
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Image exceeds the ${MAX_INLINE_IMAGE_SIZE_BYTES} bytes limit`,
              },
            },
            400
          )
        }

        if (!isValidBase64String(normalizedImageData.base64)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'image.data must be valid base64 content',
              },
            },
            400
          )
        }
      }

      if (body.audio !== undefined) {
        if (!attachmentStorage) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_CONFIGURED', message: 'Audio upload is not configured' },
            },
            503
          )
        }

        if (!audio || typeof audio !== 'object') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'audio must be an object' },
            },
            400
          )
        }

        if (!audio.data || typeof audio.data !== 'string') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'audio.data is required' },
            },
            400
          )
        }

        if (!audio.mediaType || typeof audio.mediaType !== 'string') {
          return c.json(
            {
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'audio.mediaType is required' },
            },
            400
          )
        }

        const normalizedAudioMediaType = audio.mediaType.trim().toLowerCase()

        if (
          normalizedAudioData?.mediaTypeFromDataUrl &&
          normalizedAudioData.mediaTypeFromDataUrl !== normalizedAudioMediaType
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'audio.mediaType does not match the data URI media type',
              },
            },
            400
          )
        }

        if (!SUPPORTED_INLINE_AUDIO_MIME_TYPES.has(normalizedAudioMediaType)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Unsupported audio type. Allowed: audio/mp4, audio/mpeg, audio/wav, audio/x-wav, audio/webm, audio/ogg, audio/aac',
              },
            },
            400
          )
        }

        if (
          !normalizedAudioData?.base64 ||
          estimateBase64SizeInBytes(normalizedAudioData.base64) > MAX_INLINE_AUDIO_SIZE_BYTES
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Audio exceeds the ${MAX_INLINE_AUDIO_SIZE_BYTES} bytes limit`,
              },
            },
            400
          )
        }

        if (!isValidBase64String(normalizedAudioData.base64)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'audio.data must be valid base64 content',
              },
            },
            400
          )
        }

        if (
          audio.durationMs !== undefined &&
          (typeof audio.durationMs !== 'number' || Number.isNaN(audio.durationMs) || audio.durationMs < 0)
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'audio.durationMs must be a positive number',
              },
            },
            400
          )
        }
      }

      if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `You can send up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`,
            },
          },
          400
        )
      }

      // Verify conversation belongs to user
      const conversation = await conversationRepo.findById(conversationId)
      if (!conversation || conversation.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          404
        )
      }

      if (attachmentIds.length > 0) {
        if (!attachmentRepo) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_CONFIGURED', message: 'Attachments not configured' },
            },
            503
          )
        }

        const attachments = await attachmentRepo.findByConversationAndIds({
          conversationId,
          userId,
          attachmentIds,
        })

        if (attachments.length !== attachmentIds.length) {
          return c.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'One or more attachments are invalid for this conversation',
              },
            },
            400
          )
        }
      }

      let persistedImage:
        | {
            data: string
            mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
            caption?: string
            storagePath: string
            sizeBytes: number
          }
        | undefined
      let persistedAudio:
        | {
            url: string
            mediaType:
              | 'audio/mp4'
              | 'audio/mpeg'
              | 'audio/wav'
              | 'audio/x-wav'
              | 'audio/webm'
              | 'audio/ogg'
              | 'audio/aac'
            caption?: string
            storagePath: string
            sizeBytes: number
            durationMs?: number
          }
        | undefined

      if (normalizedImageData?.base64 && image?.mediaType && attachmentStorage) {
        const imageData = normalizedImageData.base64
        const normalizedMediaType = image.mediaType.trim().toLowerCase() as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
        const extension = getImageExtension(normalizedMediaType)
        const storagePath = `users/${userId}/conversations/${conversationId}/inline-images/${randomUUID()}${extension}`
        const buffer = Buffer.from(imageData, 'base64')

        await attachmentStorage.uploadBuffer({
          path: storagePath,
          data: buffer,
          contentType: normalizedMediaType,
        })
        uploadedInlineImagePath = storagePath

        persistedImage = {
          data: imageData,
          mediaType: normalizedMediaType,
          caption: content,
          storagePath,
          sizeBytes: buffer.byteLength,
        }
      }

      if (normalizedAudioData?.base64 && audio?.mediaType && attachmentStorage) {
        const audioData = normalizedAudioData.base64
        const normalizedMediaType = audio.mediaType.trim().toLowerCase() as
          | 'audio/mp4'
          | 'audio/mpeg'
          | 'audio/wav'
          | 'audio/x-wav'
          | 'audio/webm'
          | 'audio/ogg'
          | 'audio/aac'
        const extension = getAudioExtension(normalizedMediaType)
        const storagePath = `users/${userId}/conversations/${conversationId}/inline-audios/${randomUUID()}${extension}`
        const buffer = Buffer.from(audioData, 'base64')

        await attachmentStorage.uploadBuffer({
          path: storagePath,
          data: buffer,
          contentType: normalizedMediaType,
        })
        uploadedInlineAudioPath = storagePath

        persistedAudio = {
          url: await attachmentStorage.createSignedReadUrl(storagePath),
          mediaType: normalizedMediaType,
          caption: content,
          storagePath,
          sizeBytes: buffer.byteLength,
          durationMs: typeof audio.durationMs === 'number' ? audio.durationMs : undefined,
        }
      }

      const pipelineResult = await appPipeline.processAppMessage({
        userId,
        conversationId,
        content,
        image: persistedImage,
        audio: persistedAudio,
        attachmentIds,
      })
      pipelineDelegated = true

      if (!pipelineResult.success) {
        logger.error(
          {
            userId,
            conversationId,
            error: pipelineResult.error,
          },
          'Pipeline processing failed for app message',
        )
        return c.json(
          {
            success: false,
            error: {
              code: 'PROCESSING_FAILED',
              message: 'Não consegui processar sua mensagem agora. Tente novamente.',
            },
          },
          500,
        )
      }

      return c.json({
        success: true,
        data: {
          message: 'Message processed successfully',
          responseMessageId: pipelineResult.responseMessageId ?? null,
        },
      })
    } catch (error) {
      const uploadedInlineMediaPath = uploadedInlineImagePath ?? uploadedInlineAudioPath

      if (uploadedInlineMediaPath && attachmentStorage && !pipelineDelegated) {
        await attachmentStorage.removeObject(uploadedInlineMediaPath).catch((cleanupError) => {
          logger.warn(
            { cleanupError, userId, conversationId, uploadedInlineMediaPath },
            'Failed to cleanup inline media after route failure',
          )
        })
      }

      logger.error({ error, userId, conversationId }, 'Failed to send message')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
        500
      )
    }
  })

  app.get('/conversations/:id/attachments', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')

    if (!conversationRepo || !attachmentRepo) {
      return c.json({ success: true, data: [] })
    }

    try {
      const conversation = await conversationRepo.findById(conversationId)
      if (!conversation || conversation.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          404
        )
      }

      const attachments = await attachmentRepo.listByConversation(conversationId)

      return c.json({
        success: true,
        data: attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          scope: attachment.scope,
          status: attachment.status,
          errorMessage: attachment.errorMessage ?? null,
          pageCount: attachment.pageCount ?? null,
          metadata: attachment.metadata,
          createdAt: attachment.createdAt.toISOString(),
          updatedAt: attachment.updatedAt.toISOString(),
        })),
      })
    } catch (error) {
      logger.error({ error, userId, conversationId }, 'Failed to list attachments')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to list attachments' },
        },
        500
      )
    }
  })

  app.post('/conversations/:id/attachments', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')

    if (!conversationRepo || !attachmentRepo || !attachmentStorage) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Attachments not configured' },
        },
        503
      )
    }

    try {
      const conversation = await conversationRepo.findById(conversationId)
      if (!conversation || conversation.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          404
        )
      }

      const body = await c.req.json<{
        fileName?: string
        mimeType?: string
        sizeBytes?: number
        metadata?: Record<string, unknown>
      }>()

      if (!body.fileName || typeof body.fileName !== 'string') {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'fileName is required' } },
          400
        )
      }

      if (!body.mimeType || typeof body.mimeType !== 'string') {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'mimeType is required' } },
          400
        )
      }

      if (typeof body.sizeBytes !== 'number' || Number.isNaN(body.sizeBytes) || body.sizeBytes < 0) {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'sizeBytes is required' } },
          400
        )
      }

      if (body.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Attachment exceeds the ${MAX_ATTACHMENT_SIZE_BYTES} bytes limit`,
            },
          },
          400
        )
      }

      if (!isSupportedAttachment(body.fileName, body.mimeType)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Unsupported attachment type. Allowed: pdf, txt, md, json',
            },
          },
          400
        )
      }

      const attachmentId = randomUUID()
      const safeFileName = sanitizeAttachmentFileName(body.fileName)
      const storagePath = `users/${userId}/conversations/${conversationId}/${attachmentId}/${safeFileName}`

      const attachment = await attachmentRepo.createPending({
        id: attachmentId,
        userId,
        conversationId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        storagePath,
        metadata: body.metadata,
      })

      try {
        const upload = await attachmentStorage.createSignedUpload(storagePath)

        return c.json({
          success: true,
          data: {
            attachment: {
              id: attachment.id,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              scope: attachment.scope,
              status: attachment.status,
              createdAt: attachment.createdAt.toISOString(),
            },
            upload,
          },
        })
      } catch (error) {
        await attachmentRepo.deleteById(attachment.id).catch(() => {})
        throw error
      }
    } catch (error) {
      logger.error({ error, userId, conversationId }, 'Failed to create attachment upload')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create attachment upload' },
        },
        500
      )
    }
  })

  app.post('/attachments/:id/complete', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const attachmentId = c.req.param('id')

    if (!attachmentRepo) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Attachments not configured' },
        },
        503
      )
    }

    try {
      const attachment = await attachmentRepo.findById(attachmentId)
      if (!attachment || attachment.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
          404
        )
      }

      const updated =
        attachment.status === 'uploaded' || attachment.status === 'processing' || attachment.status === 'ready'
          ? attachment
          : await attachmentRepo.markUploaded(attachmentId)

      const job =
        attachment.status === 'uploaded' || attachment.status === 'processing' || attachment.status === 'ready'
          ? null
          : await attachmentRepo.createJob({ attachmentId })

      return c.json({
        success: true,
        data: {
          attachment: {
            id: updated.id,
            status: updated.status,
            fileName: updated.fileName,
            mimeType: updated.mimeType,
            sizeBytes: updated.sizeBytes,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
          job: job
            ? {
                id: job.id,
                status: job.status,
                jobType: job.jobType,
                scheduledAt: job.scheduledAt.toISOString(),
              }
            : null,
        },
      })
    } catch (error) {
      logger.error({ error, userId, attachmentId }, 'Failed to complete attachment upload')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to complete attachment upload' },
        },
        500
      )
    }
  })

  app.delete('/attachments/:id', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const attachmentId = c.req.param('id')

    if (!attachmentRepo || !attachmentStorage) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Attachments not configured' },
        },
        503
      )
    }

    try {
      const attachment = await attachmentRepo.findById(attachmentId)
      if (!attachment || attachment.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
          404
        )
      }

      await attachmentStorage.removeObject(attachment.storagePath)
      await attachmentRepo.deleteById(attachmentId)

      return c.json({ success: true, data: { id: attachmentId } })
    } catch (error) {
      logger.error({ error, userId, attachmentId }, 'Failed to delete attachment')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete attachment' },
        },
        500
      )
    }
  })

  // Create new conversation
  app.post('/conversations', authMiddleware, async (c) => {
    const userId = c.get('userId')

    if (!conversationRepo) {
      return c.json(
        { success: false, error: { code: 'NOT_CONFIGURED', message: 'Conversations not configured' } },
        503
      )
    }

    try {
      const conversation = await conversationRepo.create({
        userId,
        channel: 'app',
      })

      return c.json({
        success: true,
        data: {
          id: conversation.id,
          channel: conversation.channel,
          status: conversation.status,
          summary: conversation.summary ?? null,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        },
      })
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create conversation')
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' } },
        500
      )
    }
  })

  app.delete('/conversations/:id', authMiddleware, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')

    if (!conversationRepo) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Conversations not configured' },
        },
        503
      )
    }

    try {
      const conversation = await conversationRepo.findById(conversationId)
      if (!conversation || conversation.userId !== userId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          404
        )
      }

      await conversationRepo.archive(conversationId)

      return c.json({
        success: true,
        data: {
          id: conversationId,
          status: 'archived',
        },
      })
    } catch (error) {
      logger.error({ error, userId, conversationId }, 'Failed to archive conversation')
      return c.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to archive conversation' },
        },
        500
      )
    }
  })

  return app
}
