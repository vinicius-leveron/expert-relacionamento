import { describe, expect, it, vi } from 'vitest'
import pino from 'pino'
import { User, type JwtService, type MagicLinkService, type UserRepository, type VerificationCodeService } from '@perpetuo/core'
import type {
  Conversation,
  Message,
  SupabaseAvatarProfileRepository,
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
    metadata: undefined,
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
  onCreate?: (params: {
    userId: string
    channel: string
    metadata?: Record<string, unknown>
  }) => Promise<void> | void
}): SupabaseConversationRepository {
  const conversation = params?.conversation ?? createConversation()
  const messages = params?.messages ?? []
  const conversations = params?.conversations ?? (conversation ? [conversation] : [])

  return {
    create: vi.fn(
      async (createParams: {
        userId: string
        channel: string
        metadata?: Record<string, unknown>
      }) => {
        await params?.onCreate?.(createParams)
        return createConversation({
          userId: createParams.userId,
          channel: createParams.channel,
          metadata: createParams.metadata,
        })
      },
    ),
    findByUserId: vi.fn(async (userId: string) =>
      conversations.filter((item) => item.userId === userId),
    ),
    findById: vi.fn(async (conversationId: string) =>
      conversations.find((item) => item.id === conversationId) ?? null,
    ),
    getMessages: vi.fn(async () => messages),
    countUserMessagesByTypeSince: vi.fn(
      async (countParams: {
        userId: string
        role: 'user' | 'assistant'
        contentType: 'text' | 'image' | 'audio'
        conversationAgentIds?: string[]
        excludeConversationAgentIds?: string[]
      }) => {
        const includeAgentIds =
          countParams.conversationAgentIds && countParams.conversationAgentIds.length > 0
            ? new Set(countParams.conversationAgentIds)
            : null
        const excludeAgentIds =
          countParams.excludeConversationAgentIds &&
          countParams.excludeConversationAgentIds.length > 0
            ? new Set(countParams.excludeConversationAgentIds)
            : null

        const conversationIds = conversations
          .filter((item) => {
            if (item.userId !== countParams.userId) {
              return false
            }

            const agentId =
              typeof item.metadata?.agentId === 'string' ? item.metadata.agentId : undefined

            if (includeAgentIds) {
              return agentId ? includeAgentIds.has(agentId) : false
            }

            if (excludeAgentIds) {
              return !agentId || !excludeAgentIds.has(agentId)
            }

            return true
          })
          .map((item) => item.id)

        return messages.filter(
          (message) =>
            conversationIds.includes(message.conversationId) &&
            message.role === countParams.role &&
            message.contentType === countParams.contentType,
        ).length
      },
    ),
    archive: vi.fn(async (conversationId: string) => {
      await params?.onArchive?.(conversationId)
    }),
  } as unknown as SupabaseConversationRepository
}

function createAvatarProfileRepo(params?: {
  avatarProfile?: {
    status: 'not_started' | 'in_progress' | 'completed'
    currentPhase: number | null
    completedPhases: number[]
    updatedAt?: Date
  } | null
}) {
  return {
    getByUserId: vi.fn(async () =>
      params?.avatarProfile
        ? {
            id: 'avatar-profile-1',
            userId: 'user-1',
            status: params.avatarProfile.status,
            currentPhase: params.avatarProfile.currentPhase,
            completedPhases: params.avatarProfile.completedPhases,
            phaseData: {},
            profileSummary: {
              identity: { selfImage: '', idealSelf: '', mainConflict: '' },
              socialRomanticPatterns: [],
              strengths: [],
              blockers: [],
              values: [],
              goals90d: [],
              executionRisks: [],
              recommendedNextFocus: '',
            },
            sourceConversationId: null,
            createdAt: new Date('2026-04-29T12:00:00.000Z'),
            updatedAt: params.avatarProfile.updatedAt ?? new Date('2026-04-29T12:00:00.000Z'),
          }
        : null,
    ),
  } as unknown as SupabaseAvatarProfileRepository
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

function createUserRepo(
  userId = 'user-1',
  overrides?: {
    email?: string | null
    phoneE164?: string | null
    displayName?: string | null
    avatarStoragePath?: string | null
  },
): UserRepository {
  let currentUser = User.reconstitute({
    id: userId,
    email: overrides?.email ?? 'user@example.com',
    phoneE164: overrides?.phoneE164 ?? null,
    displayName: overrides?.displayName ?? null,
    avatarStoragePath: overrides?.avatarStoragePath ?? null,
    createdAt: new Date('2026-04-29T12:00:00.000Z'),
    updatedAt: new Date('2026-04-29T12:00:00.000Z'),
  })

  return {
    findById: vi.fn(async (id: string) =>
      id === userId
        ? currentUser
        : null,
    ),
    findByPhone: vi.fn(async () => null),
    findByEmail: vi.fn(async () => null),
    save: vi.fn(async (user: User) => {
      currentUser = user
    }),
    findOrCreateByPhone: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
    findOrCreateByEmail: vi.fn(async () => {
      throw new Error('Not implemented in test')
    }),
    linkEmail: vi.fn(async () => {
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
  avatarProfileRepo?: SupabaseAvatarProfileRepository
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
    avatarProfileRepo: params?.avatarProfileRepo,
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
          metadata: { agentId: 'diagnostic' },
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
          metadata: { agentId: 'diagnostic' },
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
      getLatestByUserId: vi.fn(async () => null),
    } as unknown as SupabaseSubscriptionRepository
    const app = createRoutes({
      diagnosticRepo,
      subscriptionRepo,
      avatarProfileRepo: createAvatarProfileRepo({
        avatarProfile: {
          status: 'completed',
          currentPhase: null,
          completedPhases: [1, 2, 3, 4, 5, 6, 7],
        },
      }),
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
        displayName: null,
        avatarUrl: null,
        avatarProfile: {
          status: 'completed',
          currentPhase: null,
          completedPhases: [1, 2, 3, 4, 5, 6, 7],
        },
        subscription: null,
        access: {
          diagnosisCompleted: true,
          hasActiveSubscription: false,
          hasChatAccess: false,
          hasJourneyAccess: false,
          canAnalyzeImages: false,
          hasStructuredDiagnosis: true,
        },
        usage: {
          imageAnalyses: {
            conversation: {
              used: 0,
              limit: 30,
              remaining: 30,
            },
            profile: {
              used: 0,
              limit: 5,
              remaining: 5,
            },
          },
        },
        commerce: {
          checkoutUrl: 'https://perpetuo.com.br/assinar',
          nativeCheckoutMode: 'external_link',
          canUpgrade: true,
        },
      },
    })
  })

  it('atualiza displayName do perfil autenticado', async () => {
    const userRepo = createUserRepo('user-1', {
      displayName: null,
    })
    const app = createRoutes({ userRepo })

    const response = await app.request('http://localhost/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Vinicius Oliveira',
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        displayName: 'Vinicius Oliveira',
        avatarUrl: null,
      },
    })
  })

  it('cria conversa com metadata.agentId', async () => {
    const conversationRepo = createConversationRepo()
    const app = createRoutes({ conversationRepo })

    const response = await app.request('http://localhost/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: {
          agentId: 'diagnostic',
        },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        metadata: {
          agentId: 'diagnostic',
        },
      },
    })
  })

  it('bloqueia criação de conversa derivada sem diagnóstico estruturado completo', async () => {
    const conversationRepo = createConversationRepo()
    const app = createRoutes({
      conversationRepo,
      avatarProfileRepo: createAvatarProfileRepo({
        avatarProfile: {
          status: 'in_progress',
          currentPhase: 3,
          completedPhases: [1, 2],
        },
      }),
    })

    const response = await app.request('http://localhost/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: {
          agentId: 'vsm',
        },
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'DIAGNOSIS_REQUIRED',
      },
    })
  })

  it('mapeia diagnosis_required do pipeline para DIAGNOSIS_REQUIRED na API', async () => {
    const conversationRepo = createConversationRepo()
    const appPipeline = createAppPipeline({
      processAppMessage: vi.fn(async () => ({ success: false, error: 'diagnosis_required' })),
    })
    const app = createRoutes({
      conversationRepo,
      attachmentStorage: createAttachmentStorage(),
      appPipeline,
    })

    const response = await app.request('http://localhost/conversations/conversation-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'oi',
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: 'DIAGNOSIS_REQUIRED',
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
