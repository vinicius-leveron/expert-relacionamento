import { describe, expect, it, vi } from 'vitest'
import pino from 'pino'
import type {
  AIProviderPort,
  ChannelPort,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  IncomingMessage,
  OutgoingMessage,
} from '@perpetuo/core'
import type {
  AttachmentRepository,
  Archetype,
  AvatarProfile,
  AvatarProfileRepository,
  ConversationRepository,
  Diagnostic,
  DiagnosticRepository,
  JourneyProgress,
  Message,
  Subscription,
  SubscriptionRepository,
} from '@perpetuo/database'
import { createMockUserRepository } from '../repositories/mock-user.repository.js'
import { MessagePipeline } from './message-pipeline.js'

class TestChannelAdapter implements ChannelPort {
  readonly channelType = 'whatsapp' as const

  readonly sentMessages: OutgoingMessage[] = []

  constructor(private readonly message: IncomingMessage | null) {}

  async sendMessage(message: OutgoingMessage): Promise<{ messageId: string }> {
    this.sentMessages.push(message)
    return { messageId: `sent-${this.sentMessages.length}` }
  }

  validateWebhook(): boolean {
    return true
  }

  parseWebhook(): IncomingMessage | null {
    return this.message
  }
}

class RecordingAIProvider implements AIProviderPort {
  readonly providerName = 'recording'

  readonly calls: Array<{ messages: ChatMessage[]; options?: CompletionOptions }> = []

  constructor(private readonly responses: string[]) {}

  async complete(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    this.calls.push({ messages, options })

    return {
      content: this.responses[this.calls.length - 1] ?? 'ok',
      usage: { inputTokens: 10, outputTokens: 10 },
      finishReason: 'end_turn',
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

class InMemoryConversationRepo implements ConversationRepository {
  private readonly conversations = new Map<
    string,
    {
      id: string
      userId: string
      channel: string
      summary?: string
      metadata?: Record<string, unknown>
    }
  >()
  private readonly messages: Message[] = []
  private conversationCounter = 0
  private messageCounter = 0

  async create(params: { userId: string; channel: string; metadata?: Record<string, unknown> }) {
    const conversation = {
      id: `conversation-${++this.conversationCounter}`,
      userId: params.userId,
      channel: params.channel,
      summary: undefined,
      metadata: params.metadata,
    }
    this.conversations.set(conversation.id, conversation)

    return {
      ...conversation,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    }
  }

  async findById(conversationId: string) {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return null

    return {
      ...conversation,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: this.messages.filter((m) => m.conversationId === conversationId),
    }
  }

  async findByUserId(userId: string) {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .map((conversation) => ({
        ...conversation,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: this.messages.filter((m) => m.conversationId === conversation.id),
      }))
  }

  async getMessages(conversationId: string, limit = 100) {
    return this.messages.filter((m) => m.conversationId === conversationId).slice(-limit)
  }

  async getOrCreateActive(userId: string, channel: string) {
    const existing = [...this.conversations.values()].find(
      (conversation) => conversation.userId === userId && conversation.channel === channel,
    )

    if (existing) {
    return {
      ...existing,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
        messages: this.messages.filter((message) => message.conversationId === existing.id),
      }
    }

    const conversation = {
      id: `conversation-${++this.conversationCounter}`,
      userId,
      channel,
      summary: undefined,
      metadata: undefined,
    }
    this.conversations.set(conversation.id, conversation)

    return {
      ...conversation,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    }
  }

  async addMessage(params: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    contentType?: 'text' | 'image' | 'audio'
    metadata?: Record<string, unknown>
  }): Promise<Message> {
    const message: Message = {
      id: `message-${++this.messageCounter}`,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      contentType: params.contentType ?? 'text',
      metadata: params.metadata,
      createdAt: new Date(),
    }

    this.messages.push(message)
    return message
  }

  async getRecentMessages(conversationId: string, limit = 50): Promise<Message[]> {
    return this.messages.filter((message) => message.conversationId === conversationId).slice(-limit)
  }

  async getUserHistory(userId: string, limit = 100): Promise<Message[]> {
    const conversationIds = [...this.conversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .map((conversation) => conversation.id)

    return this.messages
      .filter((message) => conversationIds.includes(message.conversationId))
      .slice(-limit)
  }

  async countUserMessagesByTypeSince(params: {
    userId: string
    role: 'user' | 'assistant'
    contentType: 'text' | 'image' | 'audio'
    since: Date
    conversationAgentIds?: string[]
    excludeConversationAgentIds?: string[]
  }): Promise<number> {
    const includeAgentIds =
      params.conversationAgentIds && params.conversationAgentIds.length > 0
        ? new Set(params.conversationAgentIds)
        : null
    const excludeAgentIds =
      params.excludeConversationAgentIds && params.excludeConversationAgentIds.length > 0
        ? new Set(params.excludeConversationAgentIds)
        : null

    const conversationIds = [...this.conversations.values()]
      .filter((conversation) => {
        if (conversation.userId !== params.userId) {
          return false
        }

        const agentId =
          typeof conversation.metadata?.agentId === 'string'
            ? conversation.metadata.agentId
            : undefined

        if (includeAgentIds) {
          return agentId ? includeAgentIds.has(agentId) : false
        }

        if (excludeAgentIds) {
          return !agentId || !excludeAgentIds.has(agentId)
        }

        return true
      })
      .map((conversation) => conversation.id)

    return this.messages.filter(
      (message) =>
        conversationIds.includes(message.conversationId) &&
        message.role === params.role &&
        message.contentType === params.contentType &&
        message.createdAt >= params.since,
    ).length
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return

    this.conversations.set(conversationId, { ...conversation, summary })
  }

  async archive(): Promise<void> {}

  async seedUserImageMessages(
    userId: string,
    count: number,
    params?: {
      channel?: string
      metadata?: Record<string, unknown>
    },
  ): Promise<void> {
    const conversation =
      params?.metadata || params?.channel
        ? await this.create({
            userId,
            channel: params.channel ?? 'app',
            metadata: params.metadata,
          })
        : await this.getOrCreateActive(userId, 'whatsapp')

    for (let index = 0; index < count; index += 1) {
      await this.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: `Imagem ${index + 1}`,
        contentType: 'image',
      })
    }
  }

  async seedUserTextMessages(userId: string, count: number): Promise<void> {
    const conversation = await this.getOrCreateActive(userId, 'whatsapp')

    for (let index = 0; index < count; index += 1) {
      await this.addMessage({
        conversationId: conversation.id,
        role: index % 2 === 0 ? 'assistant' : 'user',
        content: `Mensagem ${index + 1}`,
        contentType: 'text',
      })
    }
  }

  getConversationSummary(userId: string): string | undefined {
    return [...this.conversations.values()].find((conversation) => conversation.userId === userId)
      ?.summary
  }
}

class StubDiagnosticRepo implements DiagnosticRepository {
  diagnostic: Diagnostic | null = null
  journey: JourneyProgress | null = null
  saveCalls = 0
  startJourneyCalls = 0

  async getByUserId(): Promise<Diagnostic | null> {
    return this.diagnostic
  }

  async save(params: {
    userId: string
    archetype: Archetype
    scores: Record<Archetype, number>
    answers: Array<{ questionIndex: number; answer: string }>
  }): Promise<Diagnostic> {
    this.saveCalls += 1
    this.diagnostic = {
      id: 'diagnostic-1',
      userId: params.userId,
      archetype: params.archetype,
      scores: params.scores,
      answers: params.answers,
      completedAt: new Date(),
    }
    return this.diagnostic
  }

  async getJourneyProgress(): Promise<JourneyProgress | null> {
    return this.journey
  }

  async startJourney(userId: string): Promise<JourneyProgress> {
    this.startJourneyCalls += 1
    this.journey = {
      id: 'journey-1',
      userId,
      currentDay: 1,
      startedAt: new Date(),
      lastInteractionAt: new Date(),
      lastNurturingSentAt: null,
      lastReengagementSentAt: null,
      status: 'active',
    }
    return this.journey
  }

  async updateJourneyProgress(
    _userId: string,
    updates: Partial<Pick<JourneyProgress, 'currentDay' | 'status'>>,
  ): Promise<void> {
    if (this.journey) {
      this.journey = { ...this.journey, ...updates }
    }
  }

  async recordInteraction(userId: string): Promise<void> {
    if (this.journey?.userId === userId) {
      this.journey.lastInteractionAt = new Date()
    }
  }

  async listJourneyProgress(): Promise<JourneyProgress[]> {
    return this.journey ? [this.journey] : []
  }

  async markNurturingSent(userId: string, sentAt = new Date()): Promise<void> {
    if (this.journey?.userId === userId) {
      this.journey.lastNurturingSentAt = sentAt
    }
  }

  async markReengagementSent(userId: string, sentAt = new Date()): Promise<void> {
    if (this.journey?.userId === userId) {
      this.journey.lastReengagementSentAt = sentAt
    }
  }
}

class StubSubscriptionRepo implements SubscriptionRepository {
  constructor(private readonly active: boolean) {}

  async getActiveByUserId(): Promise<Subscription | null> {
    return null
  }

  async getLatestByUserId(): Promise<Subscription | null> {
    return null
  }

  async getByExternalId(): Promise<Subscription | null> {
    return null
  }

  async isActive(): Promise<boolean> {
    return this.active
  }

  async create(): Promise<Subscription> {
    throw new Error('Not implemented in test')
  }

  async updateStatus(): Promise<void> {}

  async updateByExternalId(): Promise<void> {}
}

class StubAvatarProfileRepo implements AvatarProfileRepository {
  avatarProfile: AvatarProfile | null = null
  upsertCalls = 0

  async getByUserId(): Promise<AvatarProfile | null> {
    return this.avatarProfile
  }

  async upsert(params: {
    userId: string
    status: 'not_started' | 'in_progress' | 'completed'
    currentPhase: number | null
    completedPhases: number[]
    phaseData: Record<string, unknown>
    profileSummary: AvatarProfile['profileSummary']
    sourceConversationId?: string | null
  }): Promise<AvatarProfile> {
    this.upsertCalls += 1
    this.avatarProfile = {
      id: 'avatar-profile-1',
      userId: params.userId,
      status: params.status,
      currentPhase: params.currentPhase,
      completedPhases: params.completedPhases,
      phaseData: params.phaseData as AvatarProfile['phaseData'],
      profileSummary: params.profileSummary,
      sourceConversationId: params.sourceConversationId ?? null,
      createdAt: this.avatarProfile?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    return this.avatarProfile
  }
}

function createTextMessage(text: string): IncomingMessage {
  return {
    externalId: 'incoming-1',
    channelType: 'whatsapp',
    senderId: '5511999999999',
    timestamp: new Date(),
    content: { type: 'text', text },
  }
}

function createImageMessage(caption: string): IncomingMessage {
  return {
    externalId: 'incoming-image-1',
    channelType: 'whatsapp',
    senderId: '5511999999999',
    timestamp: new Date(),
    content: {
      type: 'image',
      data: 'base64-image',
      mediaType: 'image/png',
      caption,
    },
  }
}

function createPipeline(params: {
  message: IncomingMessage
  aiResponses: string[]
  diagnosticRepo?: StubDiagnosticRepo
  subscriptionRepo?: StubSubscriptionRepo
  conversationRepo?: InMemoryConversationRepo
  avatarProfileRepo?: StubAvatarProfileRepo
  inlineImageStorage?: {
    removeObject(path: string): Promise<void>
  }
  transcriber?: {
    transcribe(audioUrl: string): Promise<string>
  }
  rag?: {
    searchCalls: string[]
    search(query: string): Promise<Array<{ id: string; documentId: string; content: string; similarity: number; metadata: Record<string, unknown> }>>
    formatForContext(chunks: Array<{ content: string }>): string
  }
  attachmentRepo?: {
    findByConversationAndIds(params: {
      conversationId: string
      userId: string
      attachmentIds: string[]
    }): Promise<
      Array<{
        id: string
        userId: string
        conversationId: string
        status: 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'failed'
        fileName: string
        mimeType: string
        sizeBytes: number
        storagePath: string
        scope: 'conversation' | 'user_library'
        metadata: Record<string, unknown>
        createdAt: Date
        updatedAt: Date
      }>
    >
  }
  attachmentRag?: {
    searchCalls: string[]
    overviewCalls: string[][]
    search(query: string, options: { attachmentIds?: string[] }): Promise<
      Array<{
        id: string
        attachmentId: string
        fileName: string
        content: string
        similarity: number
        metadata: Record<string, unknown>
      }>
    >
    getAttachmentOverview(params: { attachmentIds: string[] }): Promise<
      Array<{
        id: string
        attachmentId: string
        fileName: string
        content: string
        similarity: number
        metadata: Record<string, unknown>
      }>
    >
    formatForContext(
      chunks: Array<{ fileName: string; content: string }>,
    ): string
  }
}) {
  const channel = new TestChannelAdapter(params.message)
  const aiProvider = new RecordingAIProvider(params.aiResponses)
  const userRepo = createMockUserRepository()

  const pipeline = new MessagePipeline({
    channel,
    userRepo,
    aiProvider,
    logger: pino({ enabled: false }),
    diagnosticRepo: params.diagnosticRepo,
    subscriptionRepo: params.subscriptionRepo,
    conversationRepo: params.conversationRepo,
    avatarProfileRepo: params.avatarProfileRepo,
    rag: params.rag as never,
    attachmentRepo: params.attachmentRepo as unknown as AttachmentRepository,
    attachmentRag: params.attachmentRag as never,
    transcriber: params.transcriber,
    inlineImageStorage: params.inlineImageStorage,
    paymentUrl: 'https://perpetuo.com.br/assinar',
  })

  return { pipeline, channel, aiProvider, userRepo }
}

describe('MessagePipeline', () => {
  it('salva o diagnóstico e anexa plano direcional à resposta final', async () => {
    const diagnosticRepo = new StubDiagnosticRepo()
    const conversationRepo = new InMemoryConversationRepo()
    const { pipeline, channel } = createPipeline({
      message: createTextMessage('acho que idealizo muito no começo'),
      aiResponses: ['[PERFIL:romantico] Você sente tudo com intensidade e isso pode virar maturidade.'],
      diagnosticRepo,
      conversationRepo,
    })

    const result = await pipeline.process({ any: 'payload' }, 'signature')

    expect(result.success).toBe(true)
    expect(diagnosticRepo.saveCalls).toBe(1)
    expect(diagnosticRepo.startJourneyCalls).toBe(1)
    expect(channel.sentMessages[0]?.content.type).toBe('text')
    expect((channel.sentMessages[0]?.content as { text: string }).text).toContain(
      '## Seu Plano Direcional de 30 Dias',
    )
    expect((channel.sentMessages[0]?.content as { text: string }).text).toContain(
      'Primeira ação prática',
    )
  })

  it('sem assinatura após diagnóstico bloqueia RAG e remove imagem do payload multimodal', async () => {
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'romantico',
      scores: { provedor: 1, aventureiro: 1, romantico: 9, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }

    const conversationRepo = new InMemoryConversationRepo()
    const rag = {
      searchCalls: [] as string[],
      async search(query: string) {
        this.searchCalls.push(query)
        return []
      },
      formatForContext() {
        return ''
      },
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createImageMessage('analisa esse perfil'),
      aiResponses: ['Resposta sem multimodal'],
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(false),
      conversationRepo,
      rag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id

    await pipeline.process({ any: 'payload' }, 'signature')

    expect(rag.searchCalls).toHaveLength(0)
    expect(typeof aiProvider.calls[0]?.messages.at(-1)?.content).toBe('string')
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain('Assinatura: INATIVA')
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain(
      'Análise de imagem: BLOQUEADA até assinatura ativa',
    )
  })

  it('com assinatura ativa usa RAG e mantém imagem no payload multimodal', async () => {
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'provedor',
      scores: { provedor: 9, aventureiro: 1, romantico: 1, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }

    const conversationRepo = new InMemoryConversationRepo()
    const rag = {
      searchCalls: [] as string[],
      async search(query: string) {
        this.searchCalls.push(query)
        return [
          {
            id: 'chunk-1',
            documentId: 'doc-1',
            content: 'Contexto relevante',
            similarity: 0.9,
            metadata: {},
          },
        ]
      },
      formatForContext(chunks: Array<{ content: string }>) {
        return `---\nCONHECIMENTO RELEVANTE:\n${chunks.map((chunk) => chunk.content).join('\n')}\n---`
      },
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createImageMessage('analisa essa conversa'),
      aiResponses: ['Resposta com multimodal'],
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
      conversationRepo,
      rag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id

    await pipeline.process({ any: 'payload' }, 'signature')

    expect(rag.searchCalls).toEqual(['analisa essa conversa'])
    expect(Array.isArray(aiProvider.calls[0]?.messages.at(-1)?.content)).toBe(true)
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain('Assinatura: ATIVA')
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain('RAG: LIBERADO')
  })

  it('atingindo 30 análises de prints no mês remove a imagem do payload e informa o limite no contexto', async () => {
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'racional',
      scores: { provedor: 1, aventureiro: 1, romantico: 1, racional: 9 },
      answers: [],
      completedAt: new Date(),
    }

    const conversationRepo = new InMemoryConversationRepo()
    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createImageMessage('mais uma imagem'),
      aiResponses: ['Resposta sem imagem por limite'],
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
      conversationRepo,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    await conversationRepo.seedUserImageMessages(user.id, 30)

    await pipeline.process({ any: 'payload' }, 'signature')

    expect(typeof aiProvider.calls[0]?.messages.at(-1)?.content).toBe('string')
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain(
      'Análises de imagem (prints/conversas): LIMITE ATINGIDO (30/30 este mês)',
    )
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain(
      'Análise de imagem: BLOQUEADA',
    )
  })

  it('atingindo 5 análises de perfil no mês bloqueia imagem no agente de instagram', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const avatarProfileRepo = new StubAvatarProfileRepo()
    avatarProfileRepo.avatarProfile = {
      id: 'test-avatar-profile-id',
      userId: 'placeholder',
      status: 'completed',
      currentPhase: null,
      completedPhases: [1, 2, 3, 4, 5, 6, 7],
      phaseData: {},
      profileSummary: {
        identity: {
          selfImage: '',
          idealSelf: '',
          mainConflict: '',
        },
        socialRomanticPatterns: [],
        strengths: [],
        blockers: [],
        values: [],
        goals90d: [],
        executionRisks: [],
        recommendedNextFocus: '',
      },
      sourceConversationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['Resposta sem imagem por limite de perfil'],
      conversationRepo,
      avatarProfileRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    avatarProfileRepo.avatarProfile!.userId = user.id
    await conversationRepo.seedUserImageMessages(user.id, 5, {
      channel: 'app',
      metadata: { agentId: 'instagram-analyzer' },
    })
    const conversation = await conversationRepo.create({
      userId: user.id,
      channel: 'app',
      metadata: { agentId: 'instagram-analyzer' },
    })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      image: {
        data: 'base64-image',
        mediaType: 'image/png',
        caption: 'analisa meu instagram',
      },
    })

    expect(result.success).toBe(true)
    expect(typeof aiProvider.calls[0]?.messages.at(-1)?.content).toBe('string')
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain(
      'Análises de imagem (perfil/Instagram): LIMITE ATINGIDO (5/5 este mês)',
    )
    expect(aiProvider.calls[0]?.messages[0]?.content).toContain(
      'Análise de imagem: BLOQUEADA',
    )
  })

  it('resume histórico antigo quando a conversa passa do limite de contexto recente', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('mensagem nova'),
      aiResponses: ['Resposta principal', '- ponto 1\n- ponto 2'],
      conversationRepo,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    await conversationRepo.seedUserTextMessages(user.id, 26)

    await pipeline.process({ any: 'payload' }, 'signature')

    expect(aiProvider.calls).toHaveLength(2)
    expect(aiProvider.calls[1]?.messages[0]?.content).toContain(
      'Resuma a conversa abaixo em português para uso interno de contexto de IA.',
    )
    expect(conversationRepo.getConversationSummary(user.id)).toContain('ponto 1')
  })

  it('avança o dia da jornada quando a última interação foi em dias anteriores', async () => {
    const diagnosticRepo = new StubDiagnosticRepo()
    const lastInteractionAt = new Date()
    lastInteractionAt.setDate(lastInteractionAt.getDate() - 3)
    lastInteractionAt.setHours(10, 0, 0, 0)

    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'provedor',
      scores: { provedor: 9, aventureiro: 1, romantico: 1, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }
    diagnosticRepo.journey = {
      id: 'journey-1',
      userId: 'placeholder',
      currentDay: 4,
      startedAt: new Date(),
      lastInteractionAt,
      lastNurturingSentAt: null,
      lastReengagementSentAt: null,
      status: 'active',
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('voltei'),
      aiResponses: ['Resposta da jornada'],
      diagnosticRepo,
      conversationRepo: new InMemoryConversationRepo(),
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    diagnosticRepo.journey.userId = user.id

    await pipeline.process({ any: 'payload' }, 'signature')

    expect(aiProvider.calls[0]?.messages[0]?.content).toContain('Dia na jornada: 7/30')
    expect(diagnosticRepo.journey?.currentDay).toBe(7)
  })

  it('processAppMessage injeta contexto de anexos prontos e exige citação do arquivo', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'provedor',
      scores: { provedor: 9, aventureiro: 1, romantico: 1, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }
    const attachmentRepo = {
      async findByConversationAndIds() {
        return [
          {
            id: 'attachment-1',
            userId: 'placeholder',
            conversationId: 'placeholder',
            status: 'ready' as const,
            fileName: 'contrato.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            storagePath: 'users/u1/conversations/c1/attachment-1/contrato.pdf',
            scope: 'conversation' as const,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
    }
    const attachmentRag = {
      searchCalls: [] as string[],
      overviewCalls: [] as string[][],
      async search(query: string) {
        this.searchCalls.push(query)
        return [
          {
            id: 'chunk-1',
            attachmentId: 'attachment-1',
            fileName: 'contrato.pdf',
            content: 'O prazo previsto para cancelamento é de 30 dias.',
            similarity: 0.92,
            metadata: {},
          },
        ]
      },
      async getAttachmentOverview(params: { attachmentIds: string[] }) {
        this.overviewCalls.push(params.attachmentIds)
        return []
      },
      formatForContext(chunks: Array<{ fileName: string; content: string }>) {
        return `---\nARQUIVOS ANEXADOS RELEVANTES:\n[1] Arquivo: ${chunks[0]?.fileName}\n${chunks[0]?.content}\n---`
      },
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['O prazo é de 30 dias. [Arquivo: contrato.pdf]'],
      conversationRepo,
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
      attachmentRepo,
      attachmentRag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'qual é o prazo?',
      attachmentIds: ['attachment-1'],
    })

    expect(attachmentRag.searchCalls).toEqual(['qual é o prazo?'])
    expect(attachmentRag.overviewCalls).toHaveLength(0)

    const systemPrompt = aiProvider.calls[0]?.messages[0]?.content as string
    expect(systemPrompt).toContain(
      'cite a fonte no fim da frase usando o formato [Arquivo: nome-do-arquivo]',
    )
    expect(systemPrompt).toContain('ARQUIVOS ANEXADOS RELEVANTES')
    expect(systemPrompt).toContain('Arquivo: contrato.pdf')
  })

  it('processAppMessage sem texto usa overview dos anexos e avisa quando ainda há processamento pendente', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'romantico',
      scores: { provedor: 1, aventureiro: 1, romantico: 9, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }
    const rag = {
      searchCalls: [] as string[],
      async search(query: string) {
        this.searchCalls.push(query)
        return []
      },
      formatForContext() {
        return ''
      },
    }
    const attachmentRepo = {
      async findByConversationAndIds() {
        return [
          {
            id: 'attachment-ready',
            userId: 'placeholder',
            conversationId: 'placeholder',
            status: 'ready' as const,
            fileName: 'resumo.txt',
            mimeType: 'text/plain',
            sizeBytes: 200,
            storagePath: 'users/u1/conversations/c1/attachment-ready/resumo.txt',
            scope: 'conversation' as const,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'attachment-processing',
            userId: 'placeholder',
            conversationId: 'placeholder',
            status: 'processing' as const,
            fileName: 'anexo-pendente.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 300,
            storagePath: 'users/u1/conversations/c1/attachment-processing/anexo-pendente.pdf',
            scope: 'conversation' as const,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
    }
    const attachmentRag = {
      searchCalls: [] as string[],
      overviewCalls: [] as string[][],
      async search(query: string) {
        this.searchCalls.push(query)
        return []
      },
      async getAttachmentOverview(params: { attachmentIds: string[] }) {
        this.overviewCalls.push(params.attachmentIds)
        return [
          {
            id: 'chunk-1',
            attachmentId: 'attachment-ready',
            fileName: 'resumo.txt',
            content: 'Ponto principal do arquivo já processado.',
            similarity: 1,
            metadata: {},
          },
        ]
      },
      formatForContext(chunks: Array<{ fileName: string; content: string }>) {
        return `---\nARQUIVOS ANEXADOS RELEVANTES:\n[1] Arquivo: ${chunks[0]?.fileName}\n${chunks[0]?.content}\n---`
      },
    }

    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['Recebi os arquivos e vou me basear no que já está pronto.'],
      conversationRepo,
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
      rag,
      attachmentRepo,
      attachmentRag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      attachmentIds: ['attachment-ready', 'attachment-processing'],
    })

    expect(rag.searchCalls).toHaveLength(0)
    expect(attachmentRag.searchCalls).toHaveLength(0)
    expect(attachmentRag.overviewCalls).toEqual([['attachment-ready']])

    const systemPrompt = aiProvider.calls[0]?.messages[0]?.content as string
    expect(systemPrompt).toContain('STATUS DOS ARQUIVOS ANEXADOS')
    expect(systemPrompt).toContain('a indexação ainda não terminou')

    const currentMessage = aiProvider.calls[0]?.messages.at(-1)?.content
    expect(currentMessage).toBe(
      'Analise os arquivos anexados e use-os como contexto para responder.',
    )
  })

  it('processAppMessage responde sem chamar IA quando só existem anexos ainda em processamento', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'racional',
      scores: { provedor: 1, aventureiro: 1, romantico: 1, racional: 9 },
      answers: [],
      completedAt: new Date(),
    }
    const attachmentRepo = {
      async findByConversationAndIds() {
        return [
          {
            id: 'attachment-processing',
            userId: 'placeholder',
            conversationId: 'placeholder',
            status: 'processing' as const,
            fileName: 'anexo-pendente.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 300,
            storagePath: 'users/u1/conversations/c1/attachment-processing/anexo-pendente.pdf',
            scope: 'conversation' as const,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
    }
    const attachmentRag = {
      searchCalls: [] as string[],
      overviewCalls: [] as string[][],
      async search(query: string) {
        this.searchCalls.push(query)
        return []
      },
      async getAttachmentOverview(params: { attachmentIds: string[] }) {
        this.overviewCalls.push(params.attachmentIds)
        return []
      },
      formatForContext() {
        return ''
      },
    }

    const { pipeline, aiProvider, channel, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não deveria ser usada'],
      conversationRepo,
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(true),
      attachmentRepo,
      attachmentRag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      attachmentIds: ['attachment-processing'],
    })

    expect(result.success).toBe(true)
    expect(aiProvider.calls).toHaveLength(0)
    expect(attachmentRag.overviewCalls).toHaveLength(0)
    expect(channel.sentMessages).toHaveLength(1)
    expect((channel.sentMessages[0]?.content as { text: string }).text).toContain(
      'ainda estão sendo indexados',
    )
  })

  it('processAppMessage responde com upgrade quando o usuário envia só anexos sem assinatura ativa', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new StubDiagnosticRepo()
    diagnosticRepo.diagnostic = {
      id: 'diagnostic-1',
      userId: 'placeholder',
      archetype: 'aventureiro',
      scores: { provedor: 1, aventureiro: 9, romantico: 1, racional: 1 },
      answers: [],
      completedAt: new Date(),
    }
    const attachmentRepo = {
      async findByConversationAndIds() {
        return [
          {
            id: 'attachment-ready',
            userId: 'placeholder',
            conversationId: 'placeholder',
            status: 'ready' as const,
            fileName: 'provas.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 900,
            storagePath: 'users/u1/conversations/c1/attachment-ready/provas.pdf',
            scope: 'conversation' as const,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
    }
    const attachmentRag = {
      searchCalls: [] as string[],
      overviewCalls: [] as string[][],
      async search(query: string) {
        this.searchCalls.push(query)
        return []
      },
      async getAttachmentOverview(params: { attachmentIds: string[] }) {
        this.overviewCalls.push(params.attachmentIds)
        return []
      },
      formatForContext() {
        return ''
      },
    }

    const { pipeline, aiProvider, channel, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não deveria ser usada'],
      conversationRepo,
      diagnosticRepo,
      subscriptionRepo: new StubSubscriptionRepo(false),
      attachmentRepo,
      attachmentRag,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    diagnosticRepo.diagnostic.userId = user.id
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      attachmentIds: ['attachment-ready'],
    })

    expect(result.success).toBe(true)
    expect(aiProvider.calls).toHaveLength(0)
    expect(attachmentRag.searchCalls).toHaveLength(0)
    expect(attachmentRag.overviewCalls).toHaveLength(0)
    expect(channel.sentMessages).toHaveLength(1)
    expect((channel.sentMessages[0]?.content as { text: string }).text).toContain(
      'faz parte da assinatura',
    )
  })

  it('processAppMessage envia imagem do app como payload multimodal para a IA', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['Vi a imagem e percebi um tom defensivo no diálogo.'],
      conversationRepo,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'o que você vê aqui?',
      image: {
        data: 'base64-image-data',
        mediaType: 'image/png',
        storagePath: 'users/u1/conversations/c1/inline-images/image-1.png',
        sizeBytes: 12345,
      },
    })

    expect(result.success).toBe(true)
    expect(Array.isArray(aiProvider.calls[0]?.messages.at(-1)?.content)).toBe(true)

    const currentMessage = aiProvider.calls[0]?.messages.at(-1)?.content as Array<{
      type: string
      text?: string
      source?: { type: string; data?: string; mediaType?: string }
    }>

    expect(currentMessage[0]).toMatchObject({
      type: 'image',
      source: {
        type: 'base64',
        data: 'base64-image-data',
        mediaType: 'image/png',
      },
    })
    expect(currentMessage[1]).toMatchObject({
      type: 'text',
      text: 'o que você vê aqui?',
    })

    const messages = await conversationRepo.getMessages(conversation.id)
    expect(messages[0]?.contentType).toBe('image')
    expect(messages[0]?.content).toBe('o que você vê aqui?')
    expect(messages[0]?.metadata).toMatchObject({
      imageStoragePath: 'users/u1/conversations/c1/inline-images/image-1.png',
      imageMimeType: 'image/png',
      imageSizeBytes: 12345,
    })
  })

  it('processAppMessage transcreve áudio do app, salva metadata e usa a transcrição no histórico', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const transcriber = {
      transcribe: vi.fn(async () => 'eu fiquei chateada com a forma como ele falou comigo'),
    }
    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['Vamos trabalhar essa conversa com mais clareza e limite.'],
      conversationRepo,
      transcriber,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'me ajuda com esse áudio',
      audio: {
        url: 'https://cdn.test/audio-1.m4a',
        mediaType: 'audio/mp4',
        durationMs: 24000,
        storagePath: 'users/u1/conversations/c1/inline-audios/audio-1.m4a',
        sizeBytes: 54321,
      },
    })

    expect(result.success).toBe(true)
    expect(transcriber.transcribe).toHaveBeenCalledWith('https://cdn.test/audio-1.m4a')
    expect(typeof aiProvider.calls[0]?.messages.at(-1)?.content).toBe('string')
    expect(aiProvider.calls[0]?.messages.at(-1)?.content).toContain('Transcrição do áudio')
    expect(aiProvider.calls[0]?.messages.at(-1)?.content).toContain('eu fiquei chateada')

    const messages = await conversationRepo.getMessages(conversation.id)
    expect(messages[0]?.contentType).toBe('audio')
    expect(messages[0]?.content).toContain('Transcrição do áudio')
    expect(messages[0]?.metadata).toMatchObject({
      audioStoragePath: 'users/u1/conversations/c1/inline-audios/audio-1.m4a',
      audioMimeType: 'audio/mp4',
      audioSizeBytes: 54321,
      audioDurationMs: 24000,
      audioCaption: 'me ajuda com esse áudio',
    })
  })

  it('processAppMessage remove imagem inline do storage se falhar antes de persistir a mensagem', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const inlineImageStorage = {
      removeObject: vi.fn(async () => {}),
    }
    const { pipeline, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não importa'],
      conversationRepo,
      inlineImageStorage,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: 'conversation-inexistente',
      content: 'analisa isso',
      image: {
        data: 'base64-image-data',
        mediaType: 'image/png',
        storagePath: 'users/u1/conversations/c-inexistente/inline-images/image-1.png',
        sizeBytes: 12345,
      },
    })

    expect(result.success).toBe(false)
    expect(inlineImageStorage.removeObject).toHaveBeenCalledWith(
      'users/u1/conversations/c-inexistente/inline-images/image-1.png',
    )
  })

  it('processAppMessage remove áudio inline do storage se falhar antes de persistir a mensagem', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const inlineImageStorage = {
      removeObject: vi.fn(async () => {}),
    }
    const { pipeline, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não importa'],
      conversationRepo,
      inlineImageStorage,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: 'conversation-inexistente',
      content: 'ouve isso',
      audio: {
        url: 'https://cdn.test/audio-1.m4a',
        mediaType: 'audio/mp4',
        durationMs: 12000,
        storagePath: 'users/u1/conversations/c-inexistente/inline-audios/audio-1.m4a',
        sizeBytes: 54321,
      },
    })

    expect(result.success).toBe(false)
    expect(inlineImageStorage.removeObject).toHaveBeenCalledWith(
      'users/u1/conversations/c-inexistente/inline-audios/audio-1.m4a',
    )
  })

  it('processAppMessage preserva a imagem inline quando a falha acontece depois de persistir a mensagem', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const inlineImageStorage = {
      removeObject: vi.fn(async () => {}),
    }
    const { pipeline, aiProvider, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não importa'],
      conversationRepo,
      inlineImageStorage,
    })

    aiProvider.complete = vi.fn(async () => {
      throw new Error('llm indisponivel')
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    const conversation = await conversationRepo.create({ userId: user.id, channel: 'app' })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'analisa isso',
      image: {
        data: 'base64-image-data',
        mediaType: 'image/png',
        storagePath: 'users/u1/conversations/c1/inline-images/image-1.png',
        sizeBytes: 12345,
      },
    })

    expect(result.success).toBe(false)
    expect(inlineImageStorage.removeObject).not.toHaveBeenCalled()

    const messages = await conversationRepo.getMessages(conversation.id)
    expect(messages[0]?.contentType).toBe('image')
    expect(messages[0]?.metadata).toMatchObject({
      imageStoragePath: 'users/u1/conversations/c1/inline-images/image-1.png',
    })
  })

  it('processAppMessage bloqueia agente derivado sem diagnóstico estruturado completo', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const avatarProfileRepo = new StubAvatarProfileRepo()
    avatarProfileRepo.avatarProfile = {
      id: 'avatar-profile-1',
      userId: 'placeholder',
      status: 'in_progress',
      currentPhase: 3,
      completedPhases: [1, 2],
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
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const { pipeline, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: ['não importa'],
      conversationRepo,
      avatarProfileRepo,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    avatarProfileRepo.avatarProfile!.userId = user.id
    const conversation = await conversationRepo.create({
      userId: user.id,
      channel: 'app',
      metadata: { agentId: 'vsm' },
    })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'quero meu VSM',
    })

    expect(result).toEqual({ success: false, error: 'diagnosis_required' })
  })

  it('agente de diagnóstico persiste avatar_profile e remove bloco oculto da resposta visível', async () => {
    const conversationRepo = new InMemoryConversationRepo()
    const avatarProfileRepo = new StubAvatarProfileRepo()
    const { pipeline, channel, userRepo } = createPipeline({
      message: createTextMessage('ignorada'),
      aiResponses: [
        'Fechamos a fase 1.\n\n[[PERPETUO_STATE]]{"kind":"avatar_profile_update","agentId":"diagnostic","status":"in_progress","currentPhase":1,"completedPhases":[1],"phaseUpdate":{"phase":1,"title":"Identidade & Psicologia","summary":"Mapa inicial concluído","extractedSignals":["autocrítica alta"],"rawAnswers":["resposta 1"]},"profileSummary":{"identity":{"selfImage":"travado","idealSelf":"seguro","mainConflict":"medo de rejeição"},"socialRomanticPatterns":["evita exposição"],"strengths":["honestidade"],"blockers":["ansiedade social"],"values":["família"],"goals90d":["melhorar presença"],"executionRisks":["procrastinação"],"recommendedNextFocus":"exposição gradual"}}[[/PERPETUO_STATE]]',
      ],
      conversationRepo,
      avatarProfileRepo,
    })

    const user = await userRepo.findOrCreateByPhone('5511999999999')
    const conversation = await conversationRepo.create({
      userId: user.id,
      channel: 'app',
      metadata: { agentId: 'diagnostic' },
    })

    const result = await pipeline.processAppMessage({
      userId: user.id,
      conversationId: conversation.id,
      content: 'quero começar',
    })

    expect(result.success).toBe(true)
    expect(channel.sentMessages[0]?.content).toMatchObject({
      type: 'text',
      text: 'Fechamos a fase 1.',
    })
    expect(avatarProfileRepo.upsertCalls).toBe(1)
    expect(avatarProfileRepo.avatarProfile?.status).toBe('in_progress')
    expect(avatarProfileRepo.avatarProfile?.completedPhases).toEqual([1])

    const messages = await conversationRepo.getMessages(conversation.id)
    expect(messages.at(-1)?.content).toBe('Fechamos a fase 1.')
  })
})
