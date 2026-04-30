import { describe, expect, it } from 'vitest'
import pino from 'pino'
import { User, type AIProviderPort, type ChannelPort, type UserRepository } from '@perpetuo/core'
import type {
  Archetype,
  Conversation,
  ConversationRepository,
  Diagnostic,
  DiagnosticRepository,
  JourneyProgress,
  Message,
} from '@perpetuo/database'
import { JourneyWorker } from './journey-worker.js'

class RecordingChannel implements ChannelPort {
  readonly channelType = 'whatsapp' as const
  readonly sentMessages: Array<{ recipientId: string; text: string }> = []

  async sendMessage(message: { recipientId: string; content: { type: 'text'; text: string } }) {
    this.sentMessages.push({ recipientId: message.recipientId, text: message.content.text })
    return { messageId: `sent-${this.sentMessages.length}` }
  }

  validateWebhook(): boolean {
    return true
  }

  parseWebhook() {
    return null
  }
}

class RecordingAIProvider implements AIProviderPort {
  readonly providerName = 'recording'
  readonly prompts: string[] = []

  constructor(private readonly responses: string[]) {}

  async complete(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
    this.prompts.push(messages.map((message) => message.content).join('\n\n'))
    return {
      content: this.responses[this.prompts.length - 1] ?? 'ok',
      usage: { inputTokens: 10, outputTokens: 10 },
      finishReason: 'end_turn' as const,
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

class InMemoryUserRepo implements UserRepository {
  constructor(private readonly users: User[]) {}

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null
  }

  async findByPhone(phoneE164: string): Promise<User | null> {
    return this.users.find((user) => user.phoneE164 === phoneE164) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null
  }

  async save(): Promise<void> {}

  async findOrCreateByPhone(phoneE164: string): Promise<User> {
    const existing = await this.findByPhone(phoneE164)
    if (!existing) {
      throw new Error('User not found in test')
    }
    return existing
  }

  async findOrCreateByEmail(email: string): Promise<User> {
    const existing = await this.findByEmail(email)
    if (!existing) {
      throw new Error('User not found in test')
    }
    return existing
  }

  async linkPhone(): Promise<User> {
    throw new Error('Not implemented in test')
  }
}

class InMemoryConversationRepo implements ConversationRepository {
  readonly messages: Message[] = []
  private readonly conversations = new Map<string, Conversation>()

  constructor(private readonly summary?: string) {}

  async create(params: { userId: string; channel: string }): Promise<Conversation> {
    return this.getOrCreateActive(params.userId, params.channel)
  }

  async findById(conversationId: string): Promise<Conversation | null> {
    return [...this.conversations.values()].find((conversation) => conversation.id === conversationId) ?? null
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    return [...this.conversations.values()].filter((conversation) => conversation.userId === userId)
  }

  async getOrCreateActive(userId: string, channel: string): Promise<Conversation> {
    const key = `${userId}:${channel}`
    const existing = this.conversations.get(key)
    if (existing) {
      return existing
    }

    const conversation: Conversation = {
      id: `conversation-${this.conversations.size + 1}`,
      userId,
      channel,
      status: 'active',
      summary: this.summary,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    }

    this.conversations.set(key, conversation)
    return conversation
  }

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    return this.messages
      .filter((message) => message.conversationId === conversationId)
      .slice(-limit)
  }

  async addMessage(params: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    contentType?: 'text' | 'image' | 'audio'
    metadata?: Record<string, unknown>
  }): Promise<Message> {
    const message: Message = {
      id: `message-${this.messages.length + 1}`,
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
    return this.getMessages(conversationId, limit)
  }

  async getUserHistory(userId: string, limit = 100): Promise<Message[]> {
    const conversations = await this.findByUserId(userId)
    const conversationIds = conversations.map((conversation) => conversation.id)
    return this.messages
      .filter((message) => conversationIds.includes(message.conversationId))
      .slice(-limit)
  }

  async countUserMessagesByTypeSince(params: {
    userId: string
    role: 'user' | 'assistant'
    contentType: 'text' | 'image' | 'audio'
    since: Date
  }): Promise<number> {
    const conversations = await this.findByUserId(params.userId)
    const conversationIds = conversations.map((conversation) => conversation.id)
    return this.messages.filter(
      (message) =>
        conversationIds.includes(message.conversationId) &&
        message.role === params.role &&
        message.contentType === params.contentType &&
        message.createdAt >= params.since,
    ).length
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    const conversation = await this.findById(conversationId)
    if (!conversation) return
    this.conversations.set(`${conversation.userId}:${conversation.channel}`, {
      ...conversation,
      summary,
    })
  }

  async archive(conversationId: string): Promise<void> {
    const conversation = await this.findById(conversationId)
    if (!conversation) return
    this.conversations.set(`${conversation.userId}:${conversation.channel}`, {
      ...conversation,
      status: 'archived',
    })
  }
}

class InMemoryDiagnosticRepo implements DiagnosticRepository {
  readonly diagnostics = new Map<string, Diagnostic>()
  readonly journeys = new Map<string, JourneyProgress>()

  async getByUserId(userId: string): Promise<Diagnostic | null> {
    return this.diagnostics.get(userId) ?? null
  }

  async save(params: {
    userId: string
    archetype: Archetype
    scores: Record<Archetype, number>
    answers: Array<{ questionIndex: number; answer: string }>
  }): Promise<Diagnostic> {
    const diagnostic: Diagnostic = {
      id: `diagnostic-${this.diagnostics.size + 1}`,
      userId: params.userId,
      archetype: params.archetype,
      scores: params.scores,
      answers: params.answers,
      completedAt: new Date(),
    }
    this.diagnostics.set(params.userId, diagnostic)
    return diagnostic
  }

  async getJourneyProgress(userId: string): Promise<JourneyProgress | null> {
    return this.journeys.get(userId) ?? null
  }

  async startJourney(userId: string): Promise<JourneyProgress> {
    const journey: JourneyProgress = {
      id: `journey-${this.journeys.size + 1}`,
      userId,
      currentDay: 1,
      startedAt: new Date(),
      lastInteractionAt: new Date(),
      lastNurturingSentAt: null,
      lastReengagementSentAt: null,
      status: 'active',
    }
    this.journeys.set(userId, journey)
    return journey
  }

  async updateJourneyProgress(
    userId: string,
    updates: Partial<Pick<JourneyProgress, 'currentDay' | 'status'>>,
  ): Promise<void> {
    const current = this.journeys.get(userId)
    if (!current) return
    this.journeys.set(userId, { ...current, ...updates })
  }

  async listJourneyProgress(): Promise<JourneyProgress[]> {
    return [...this.journeys.values()]
  }

  async recordInteraction(userId: string): Promise<void> {
    const current = this.journeys.get(userId)
    if (!current) return
    this.journeys.set(userId, { ...current, lastInteractionAt: new Date() })
  }

  async markNurturingSent(userId: string, sentAt = new Date()): Promise<void> {
    const current = this.journeys.get(userId)
    if (!current) return
    this.journeys.set(userId, { ...current, lastNurturingSentAt: sentAt })
  }

  async markReengagementSent(userId: string, sentAt = new Date()): Promise<void> {
    const current = this.journeys.get(userId)
    if (!current) return
    this.journeys.set(userId, { ...current, lastReengagementSentAt: sentAt })
  }
}

function createJourney(params: {
  userId: string
  currentDay: number
  lastInteractionAt: Date
  status?: JourneyProgress['status']
  lastNurturingSentAt?: Date | null
  lastReengagementSentAt?: Date | null
}): JourneyProgress {
  return {
    id: `journey-${params.userId}`,
    userId: params.userId,
    currentDay: params.currentDay,
    startedAt: new Date('2026-04-20T10:00:00.000Z'),
    lastInteractionAt: params.lastInteractionAt,
    lastNurturingSentAt: params.lastNurturingSentAt ?? null,
    lastReengagementSentAt: params.lastReengagementSentAt ?? null,
    status: params.status ?? 'active',
  }
}

function createDiagnostic(userId: string, archetype: Archetype): Diagnostic {
  return {
    id: `diagnostic-${userId}`,
    userId,
    archetype,
    scores: { provedor: 4, aventureiro: 4, romantico: 4, racional: 9 },
    answers: [],
    completedAt: new Date(),
  }
}

describe('JourneyWorker', () => {
  it('sincroniza o dia da jornada e envia o nurturing diário', async () => {
    const now = new Date('2026-04-27T12:00:00.000Z')
    const user = User.create({ phoneE164: '5511999999999', email: 'user@example.com' })
    const channel = new RecordingChannel()
    const aiProvider = new RecordingAIProvider(['Mensagem do dia 7'])
    const userRepo = new InMemoryUserRepo([user])
    const conversationRepo = new InMemoryConversationRepo('Usuária quer relações mais estáveis.')
    const diagnosticRepo = new InMemoryDiagnosticRepo()

    diagnosticRepo.diagnostics.set(user.id, createDiagnostic(user.id, 'racional'))
    diagnosticRepo.journeys.set(
      user.id,
      createJourney({
        userId: user.id,
        currentDay: 4,
        lastInteractionAt: new Date('2026-04-24T09:00:00.000Z'),
      }),
    )

    const worker = new JourneyWorker(
      {
        channel,
        aiProvider,
        userRepo,
        conversationRepo,
        diagnosticRepo,
        logger: pino({ enabled: false }),
      },
      { now: () => now, reengagementAfterDays: 4 },
    )

    const stats = await worker.runCycle()

    expect(stats).toEqual({
      processed: 1,
      nurturingSent: 1,
      reengagementSent: 0,
      skipped: 0,
      failed: 0,
    })
    expect(diagnosticRepo.journeys.get(user.id)?.currentDay).toBe(7)
    expect(diagnosticRepo.journeys.get(user.id)?.lastNurturingSentAt).toEqual(now)
    expect(channel.sentMessages).toEqual([
      { recipientId: '5511999999999', text: 'Mensagem do dia 7' },
    ])
    expect(conversationRepo.messages[0]?.metadata).toMatchObject({
      source: 'worker',
      workerKind: 'nurturing',
      journeyDay: 7,
    })
  })

  it('prioriza reengajamento quando o usuário está inativo há dias', async () => {
    const now = new Date('2026-04-27T12:00:00.000Z')
    const user = User.create({ phoneE164: '5511888888888' })
    const channel = new RecordingChannel()
    const aiProvider = new RecordingAIProvider(['Volta aqui quando fizer sentido'])
    const userRepo = new InMemoryUserRepo([user])
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new InMemoryDiagnosticRepo()

    diagnosticRepo.diagnostics.set(user.id, createDiagnostic(user.id, 'provedor'))
    diagnosticRepo.journeys.set(
      user.id,
      createJourney({
        userId: user.id,
        currentDay: 6,
        lastInteractionAt: new Date('2026-04-23T08:00:00.000Z'),
      }),
    )

    const worker = new JourneyWorker(
      {
        channel,
        aiProvider,
        userRepo,
        conversationRepo,
        diagnosticRepo,
        logger: pino({ enabled: false }),
      },
      { now: () => now, reengagementAfterDays: 3 },
    )

    const stats = await worker.runCycle()

    expect(stats.reengagementSent).toBe(1)
    expect(stats.nurturingSent).toBe(0)
    expect(diagnosticRepo.journeys.get(user.id)?.lastReengagementSentAt).toEqual(now)
    expect(diagnosticRepo.journeys.get(user.id)?.lastNurturingSentAt).toBeNull()
    expect(conversationRepo.messages[0]?.metadata).toMatchObject({
      workerKind: 'reengagement',
      journeyDay: 10,
    })
  })

  it('marca a jornada como concluída após enviar o dia 30', async () => {
    const now = new Date('2026-04-27T12:00:00.000Z')
    const user = User.create({ phoneE164: '5511777777777' })
    const channel = new RecordingChannel()
    const aiProvider = new RecordingAIProvider(['Fechando o ciclo'])
    const userRepo = new InMemoryUserRepo([user])
    const conversationRepo = new InMemoryConversationRepo()
    const diagnosticRepo = new InMemoryDiagnosticRepo()

    diagnosticRepo.diagnostics.set(user.id, createDiagnostic(user.id, 'romantico'))
    diagnosticRepo.journeys.set(
      user.id,
      createJourney({
        userId: user.id,
        currentDay: 30,
        lastInteractionAt: new Date('2026-04-27T08:00:00.000Z'),
      }),
    )

    const worker = new JourneyWorker(
      {
        channel,
        aiProvider,
        userRepo,
        conversationRepo,
        diagnosticRepo,
        logger: pino({ enabled: false }),
      },
      { now: () => now },
    )

    const stats = await worker.runCycle()

    expect(stats.nurturingSent).toBe(1)
    expect(diagnosticRepo.journeys.get(user.id)?.status).toBe('completed')
  })
})
