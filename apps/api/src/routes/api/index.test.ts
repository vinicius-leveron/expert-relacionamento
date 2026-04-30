import { describe, expect, it, vi } from 'vitest'
import pino from 'pino'
import type { JwtService, MagicLinkService, UserRepository, VerificationCodeService } from '@perpetuo/core'
import type {
  Conversation,
  Message,
  SupabaseConversationRepository,
  SupabaseDiagnosticRepository,
  SupabaseSessionRepository,
  SupabaseSubscriptionRepository,
} from '@perpetuo/database'
import type { ChatAttachmentStorageService } from '../../services/chat-attachment-storage.service.js'
import type { MessagePipeline } from '../../pipeline/message-pipeline.js'
import { createApiRoutes } from './index.js'

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    userId: 'user-1',
    channel: 'app',
    status: 'active',
    createdAt: new Date('2026-04-29T12:00:00.000Z'),
    updatedAt: new Date('2026-04-29T12:00:00.000Z'),
    messages: [],
    ...overrides,
  }
}

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    role: 'user',
    content: '[Imagem enviada para análise]',
    contentType: 'image',
    createdAt: new Date('2026-04-29T12:00:00.000Z'),
    ...overrides,
  }
}

function createJwtService(userId = 'user-1'): JwtService {
  return {
    verifyAccessToken: vi.fn(async () => ({
      sub: userId,
      email: 'user@example.com',
      phone: null,
      iat: 1,
      exp: 9999999999,
    })),
  } as unknown as JwtService
}

function createConversationRepo(params?: {
  conversation?: Conversation | null
  messages?: Message[]
  conversations?: Conversation[]
  onArchive?: (conversationId: string) => Promise<void> | void
}): SupabaseConversationRepository {
  const conversation = params?.conversation ?? createConversation()
  const messages = params?.messages ?? []
  const conversations = params?.conversations ?? (conversation ? [conversation] : [])

  return {
    findByUserId: vi.fn(async (userId: string) =>
      conversations.filter((item) => item.userId === userId),
    ),
    findById: vi.fn(async (conversationId: string) =>
      conversations.find((item) => item.id === conversationId) ?? null,
    ),
    getMessages: vi.fn(async () => messages),
    archive: vi.fn(async (conversationId: string) => {
      await params?.onArchive?.(conversationId)
    }),
  } as unknown as SupabaseConversationRepository
}

function createAttachmentStorage(overrides?: Partial<ChatAttachmentStorageService>) {
  return {
    uploadBuffer: vi.fn(async () => ({ path: 'uploaded/path.png', fullPath: 'uploaded/path.png' })),
    createSignedReadUrl: vi.fn(async (path: string) => `https://cdn.test/${encodeURIComponent(path)}`),
    ...overrides,
  } as unknown as ChatAttachmentStorageService
}

function createAppPipeline(overrides?: Partial<MessagePipeline>) {
  return {
    processAppMessage: vi.fn(async () => ({ success: true })),
    ...overrides,
  } as unknown as MessagePipeline
}

function createUserRepo(userId = 'user-1'): UserRepository {
  return {
    findById: vi.fn(async (id: string) =>
      id === userId
        ? {
            id: userId,
            email: 'user@example.com',
            phoneE164: null,
            createdAt: new Date('2026-04-29T12:00:00.000Z'),
          }
        : null,
    ),
    findByPhone: vi.fn(async () => null),
    findByEmail: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    findOrCreateByPhone: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
    findOrCreateByEmail: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
    linkPhone: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
  } as unknown as UserRepository
}

function createRoutes(params?: {
  conversationRepo?: SupabaseConversationRepository
  diagnosticRepo?: SupabaseDiagnosticRepository
  subscriptionRepo?: SupabaseSubscriptionRepository
  attachmentStorage?: ChatAttachmentStorageService
  appPipeline?: MessagePipeline
  paymentUrl?: string
  userRepo?: UserRepository
  userId?: string
}) {
  return createApiRoutes({
    jwtService: createJwtService(params?.userId),
    magicLinkService: {} as MagicLinkService,
    verificationCodeService: {} as VerificationCodeService,
    sessionRepo: {} as SupabaseSessionRepository,
    userRepo: params?.userRepo ?? createUserRepo(params?.userId),
    conversationRepo: params?.conversationRepo,
    diagnosticRepo: params?.diagnosticRepo,
    subscriptionRepo: params?.subscriptionRepo,
    attachmentStorage: params?.attachmentStorage,
    appPipeline: params?.appPipeline,
    paymentUrl: params?.paymentUrl,
    logger: pino({ enabled: false }),
  })
}

describe('createApiRoutes image chat flow', () => {
  it('lista conversas com summary para o drawer do app', async () => {
    const conversationRepo = createConversationRepo({
      conversations: [
        createConversation({
          id: 'conversation-1',
          summary: 'Conversa sobre limites e comunicação afetiva',
        }),
      ],
    })
    const app = createRoutes({ conversationRepo })

    const response = await app.request('http://localhost/conversations', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: [
        {
          id: 'conversation-1',
          summary: 'Conversa sobre limites e comunicação afetiva',
        },
      ],
    })
  })

  it('retorna o estado comercial do perfil com checkout para usuário sem assinatura ativa', async () => {
    const diagnosticRepo = {
      getByUserId: vi.fn(async () => ({
        archetype: 'provedor',
        completedAt: '2026-04-29T12:00:00.000Z',
      })),
    } as unknown as SupabaseDiagnosticRepository
    const subscriptionRepo = {
      getActiveByUserId: vi.fn(async () => null),
    } as unknown as SupabaseSubscriptionRepository
    const app = createRoutes({
      diagnosticRepo,
      subscriptionRepo,
      paymentUrl: 'https://perpetuo.com.br/assinar',
    })

    const response = await app.request('http://localhost/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        email: 'user@example.com',
        subscription: null,
        access: {
          diagnosisCompleted: true,
          hasActiveSubscription: false,
          hasJourneyAccess: false,
          canAnalyzeImages: false,
        },
        commerce: {
          checkoutUrl: 'https://perpetuo.com.br/assinar',
          canUpgrade: true,
        },
      },
    })
  })

  it('arquiva a conversa do usuário autenticado', async () => {
    const onArchive = vi.fn(async () => {})
    const conversationRepo = createConversationRepo({
      conversation: createConversation({ id: 'conversation-1' }),
      onArchive,
    })
    const app = createRoutes({ conversationRepo })

    const response = await app.request('http://localhost/conversations/conversation-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer test-token',
      },
    })

    expect(response.status).toBe(200)
    expect(onArchive).toHaveBeenCalledWith('conversation-1')
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        id: 'conversation-1',
        status: 'archived',
      },
    })
  })

  it('aceita imagem inline em data URI, persiste no storage e encaminha base64 limpo para o pipeline', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage()
    const appPipeline = createAppPipeline()
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'o que você vê aqui?',
        image: {
          data: 'data:image/png;base64,YWJjZA==',
          mediaType: 'image/png',
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(attachmentStorage.uploadBuffer).toHaveBeenCalledTimes(1)

    const uploadArgs = vi.mocked(attachmentStorage.uploadBuffer).mock.calls[0]?.[0]
    expect(uploadArgs?.contentType).toBe('image/png')
    expect(uploadArgs?.data.toString('utf8')).toBe('abcd')
    expect(uploadArgs?.path).toContain('/inline-images/')

    expect(appPipeline.processAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        conversationId: 'conversation-1',
        content: 'o que você vê aqui?',
        image: expect.objectContaining({
          data: 'YWJjZA==',
          mediaType: 'image/png',
          caption: 'o que você vê aqui?',
          sizeBytes: 4,
        }),
      }),
    )
  })

  it('aceita áudio inline em data URI, persiste no storage e encaminha preview assinado para o pipeline', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage({
      createSignedReadUrl: vi.fn(async (path: string) => `https://cdn.test/${encodeURIComponent(path)}`),
    })
    const appPipeline = createAppPipeline()
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'escuta isso',
        audio: {
          data: 'data:audio/mp4;base64,YWJjZA==',
          mediaType: 'audio/mp4',
          durationMs: 4200,
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(attachmentStorage.uploadBuffer).toHaveBeenCalledTimes(1)

    const uploadArgs = vi.mocked(attachmentStorage.uploadBuffer).mock.calls[0]?.[0]
    expect(uploadArgs?.contentType).toBe('audio/mp4')
    expect(uploadArgs?.data.toString('utf8')).toBe('abcd')
    expect(uploadArgs?.path).toContain('/inline-audios/')

    expect(appPipeline.processAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        conversationId: 'conversation-1',
        content: 'escuta isso',
        audio: expect.objectContaining({
          url: expect.stringContaining('https://cdn.test/'),
          mediaType: 'audio/mp4',
          caption: 'escuta isso',
          sizeBytes: 4,
          durationMs: 4200,
        }),
      }),
    )
  })

  it('rejeita áudio quando o mediaType informado diverge do data URI', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage()
    const appPipeline = createAppPipeline()
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: {
          data: 'data:audio/webm;base64,YWJjZA==',
          mediaType: 'audio/mp4',
        },
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'audio.mediaType does not match the data URI media type',
      },
    })
    expect(attachmentStorage.uploadBuffer).not.toHaveBeenCalled()
    expect(appPipeline.processAppMessage).not.toHaveBeenCalled()
  })

  it('degrada o histórico quando não consegue gerar signed URL do áudio', async () => {
    const conversationRepo = createConversationRepo({
      messages: [
        createMessage({
          content: 'Transcrição do áudio:\nquero conversar melhor sem brigar',
          contentType: 'audio',
          metadata: {
            audioStoragePath: 'users/user-1/conversations/conversation-1/inline-audios/audio-1.m4a',
            audioMimeType: 'audio/mp4',
            audioDurationMs: 4200,
          },
        }),
      ],
    })
    const attachmentStorage = createAttachmentStorage({
      createSignedReadUrl: vi.fn(async () => {
        throw new Error('storage unavailable')
      }),
    })
    const app = createRoutes({ conversationRepo, attachmentStorage })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: [
        {
          id: 'message-1',
          contentType: 'audio',
          audio: null,
        },
      ],
    })
  })

  it('rejeita imagem quando o mediaType informado diverge do data URI', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage()
    const appPipeline = createAppPipeline()
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          data: 'data:image/webp;base64,YWJjZA==',
          mediaType: 'image/png',
        },
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'image.mediaType does not match the data URI media type',
      },
    })
    expect(attachmentStorage.uploadBuffer).not.toHaveBeenCalled()
    expect(appPipeline.processAppMessage).not.toHaveBeenCalled()
  })

  it('rejeita imagem com base64 inválido', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage()
    const appPipeline = createAppPipeline()
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          data: 'data:image/png;base64,%%%%',
          mediaType: 'image/png',
        },
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'image.data must be valid base64 content',
      },
    })
    expect(attachmentStorage.uploadBuffer).not.toHaveBeenCalled()
    expect(appPipeline.processAppMessage).not.toHaveBeenCalled()
  })

  it('remove a imagem inline do storage se a rota falhar antes de delegar para a pipeline', async () => {
    const conversationRepo = createConversationRepo()
    const attachmentStorage = createAttachmentStorage({
      removeObject: vi.fn(async () => {}),
    })
    const appPipeline = createAppPipeline({
      processAppMessage: vi.fn(() => {
        throw new Error('pipeline sync failure')
      }),
    })
    const app = createRoutes({ conversationRepo, attachmentStorage, appPipeline })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: {
          data: 'data:image/png;base64,YWJjZA==',
          mediaType: 'image/png',
        },
      }),
    })

    expect(response.status).toBe(500)

    const uploadedPath = vi.mocked(attachmentStorage.uploadBuffer).mock.calls[0]?.[0]?.path
    expect(uploadedPath).toContain('/inline-images/')
    expect(attachmentStorage.removeObject).toHaveBeenCalledWith(uploadedPath)
  })

  it('degrada o histórico quando não consegue gerar signed URL da imagem', async () => {
    const conversationRepo = createConversationRepo({
      messages: [
        createMessage({
          metadata: {
            imageStoragePath: 'users/user-1/conversations/conversation-1/inline-images/image-1.png',
            imageMimeType: 'image/png',
          },
        }),
      ],
    })
    const attachmentStorage = createAttachmentStorage({
      createSignedReadUrl: vi.fn(async () => {
        throw new Error('storage unavailable')
      }),
    })
    const app = createRoutes({ conversationRepo, attachmentStorage })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: [
        {
          id: 'message-1',
          contentType: 'image',
          image: null,
        },
      ],
    })
  })
})
