import { DAILY_CHECKIN, getJourneyPrompt, type Archetype } from '@perpetuo/ai-gateway'
import type { AIProviderPort, ChannelPort, User, UserRepository } from '@perpetuo/core'
import type {
  Conversation,
  ConversationRepository,
  DiagnosticRepository,
  JourneyProgress,
} from '@perpetuo/database'
import type { Logger } from 'pino'

export interface JourneyWorkerConfig {
  maxJourneysPerCycle?: number
  reengagementAfterDays?: number
  now?: () => Date
}

export interface JourneyWorkerStats {
  processed: number
  nurturingSent: number
  reengagementSent: number
  skipped: number
  failed: number
}

export class JourneyWorker {
  private readonly maxJourneysPerCycle: number
  private readonly reengagementAfterDays: number
  private readonly now: () => Date

  constructor(
    private readonly deps: {
      channel: ChannelPort
      aiProvider: AIProviderPort
      userRepo: UserRepository
      conversationRepo: ConversationRepository
      diagnosticRepo: DiagnosticRepository
      logger: Logger
    },
    config: JourneyWorkerConfig = {},
  ) {
    this.maxJourneysPerCycle = config.maxJourneysPerCycle ?? 25
    this.reengagementAfterDays = config.reengagementAfterDays ?? 3
    this.now = config.now ?? (() => new Date())
  }

  async runCycle(): Promise<JourneyWorkerStats> {
    const stats: JourneyWorkerStats = {
      processed: 0,
      nurturingSent: 0,
      reengagementSent: 0,
      skipped: 0,
      failed: 0,
    }

    const journeys = await this.deps.diagnosticRepo.listJourneyProgress({
      statuses: ['active', 'paused'],
      limit: this.maxJourneysPerCycle,
    })

    for (const journey of journeys) {
      stats.processed += 1

      try {
        const handled = await this.processJourney(journey)
        if (handled === 'nurturing') {
          stats.nurturingSent += 1
        } else if (handled === 'reengagement') {
          stats.reengagementSent += 1
        } else {
          stats.skipped += 1
        }
      } catch (error) {
        stats.failed += 1
        this.deps.logger.error(
          {
            error,
            userId: journey.userId,
            currentDay: journey.currentDay,
          },
          'Worker failed to process journey',
        )
      }
    }

    return stats
  }

  private async processJourney(
    journey: JourneyProgress,
  ): Promise<'nurturing' | 'reengagement' | 'skipped'> {
    const syncedJourney = await this.syncJourneyProgress(journey)
    const user = await this.deps.userRepo.findById(syncedJourney.userId)

    if (!user?.phoneE164) {
      return 'skipped'
    }

    const diagnostic = await this.deps.diagnosticRepo.getByUserId(syncedJourney.userId)
    if (!diagnostic) {
      return 'skipped'
    }

    const conversation = await this.deps.conversationRepo.getOrCreateActive(user.id, 'whatsapp')

    if (this.shouldSendReengagement(syncedJourney)) {
      const content = await this.buildReengagementMessage(
        user,
        diagnostic.archetype,
        syncedJourney,
        conversation,
      )

      await this.sendAndPersistMessage(user, conversation, content, {
        kind: 'reengagement',
        journeyDay: syncedJourney.currentDay,
      })
      await this.deps.diagnosticRepo.markReengagementSent(user.id, this.now())

      this.deps.logger.info(
        { userId: user.id, currentDay: syncedJourney.currentDay },
        'Worker sent reengagement touch',
      )

      return 'reengagement'
    }

    if (!this.shouldSendNurturing(syncedJourney)) {
      return 'skipped'
    }

    const content = await this.buildNurturingMessage(
      user,
      diagnostic.archetype,
      syncedJourney,
      conversation,
    )

    await this.sendAndPersistMessage(user, conversation, content, {
      kind: 'nurturing',
      journeyDay: syncedJourney.currentDay,
    })
    await this.deps.diagnosticRepo.markNurturingSent(user.id, this.now())

    if (syncedJourney.currentDay >= 30 && syncedJourney.status !== 'completed') {
      await this.deps.diagnosticRepo.updateJourneyProgress(user.id, { status: 'completed' })
    }

    this.deps.logger.info(
      { userId: user.id, currentDay: syncedJourney.currentDay },
      'Worker sent daily nurturing touch',
    )

    return 'nurturing'
  }

  private async syncJourneyProgress(journey: JourneyProgress): Promise<JourneyProgress> {
    const currentDay = calculateJourneyDay(journey.currentDay, journey.lastInteractionAt, this.now())

    if (currentDay === journey.currentDay) {
      return journey
    }

    await this.deps.diagnosticRepo.updateJourneyProgress(journey.userId, {
      currentDay,
      status: journey.status,
    })

    return {
      ...journey,
      currentDay,
    }
  }

  private shouldSendNurturing(journey: JourneyProgress): boolean {
    if (journey.status !== 'active') {
      return false
    }

    if (journey.currentDay < 1 || journey.currentDay > 30) {
      return false
    }

    return !isSameLocalDay(journey.lastNurturingSentAt, this.now())
  }

  private shouldSendReengagement(journey: JourneyProgress): boolean {
    if (journey.status === 'completed' || journey.status === 'churned') {
      return false
    }

    if (daysBetween(journey.lastInteractionAt, this.now()) < this.reengagementAfterDays) {
      return false
    }

    return !isSameLocalDay(journey.lastReengagementSentAt, this.now())
  }

  private async buildNurturingMessage(
    _user: User,
    archetype: Archetype,
    journey: JourneyProgress,
    conversation: Conversation,
  ): Promise<string> {
    const fallback = buildFallbackNurturingMessage(archetype, journey.currentDay)
    if (this.deps.aiProvider.providerName === 'mock') {
      return fallback
    }

    try {
      const prompt = [
        'Você está enviando uma mensagem proativa curta no WhatsApp para manter a jornada de 30 dias viva.',
        `Dia atual: ${journey.currentDay}/30.`,
        'Escreva em português do Brasil.',
        'Máximo 120 palavras.',
        'Traga 1 insight prático ou micro-ação para hoje.',
        'Feche com uma pergunta simples que incentive resposta.',
        conversation.summary ? `Resumo recente do contexto:\n${conversation.summary}` : undefined,
      ]
        .filter(Boolean)
        .join('\n\n')

      const result = await this.deps.aiProvider.complete(
        [
          { role: 'system', content: getJourneyPrompt(archetype, journey.currentDay) },
          { role: 'user', content: prompt },
        ],
        {
          maxTokens: 220,
          temperature: 0.7,
        },
      )

      return result.content.trim() || fallback
    } catch (error) {
      this.deps.logger.warn({ error, userId: journey.userId }, 'Falling back to static nurturing')
      return fallback
    }
  }

  private async buildReengagementMessage(
    _user: User,
    archetype: Archetype,
    journey: JourneyProgress,
    conversation: Conversation,
  ): Promise<string> {
    const daysWithoutReply = daysBetween(journey.lastInteractionAt, this.now())
    const fallback = buildFallbackReengagementMessage(archetype, journey.currentDay, daysWithoutReply)

    if (this.deps.aiProvider.providerName === 'mock') {
      return fallback
    }

    try {
      const prompt = [
        'Escreva uma mensagem curta de reengajamento para WhatsApp.',
        `O usuário está há ${daysWithoutReply} dias sem responder.`,
        `Dia da jornada: ${journey.currentDay}/30.`,
        'Tom: acolhedor, sem culpa, sem soar cobrança.',
        'Lembre um benefício concreto de retomar a jornada agora.',
        'Máximo 90 palavras e termine com uma pergunta simples.',
        conversation.summary ? `Resumo recente do contexto:\n${conversation.summary}` : undefined,
      ]
        .filter(Boolean)
        .join('\n\n')

      const result = await this.deps.aiProvider.complete(
        [
          { role: 'system', content: `${getJourneyPrompt(archetype, journey.currentDay)}\n\n${DAILY_CHECKIN}` },
          { role: 'user', content: prompt },
        ],
        {
          maxTokens: 180,
          temperature: 0.7,
        },
      )

      return result.content.trim() || fallback
    } catch (error) {
      this.deps.logger.warn(
        { error, userId: journey.userId },
        'Falling back to static reengagement message',
      )
      return fallback
    }
  }

  private async sendAndPersistMessage(
    user: User,
    conversation: Conversation,
    content: string,
    metadata: {
      kind: 'nurturing' | 'reengagement'
      journeyDay: number
    },
  ): Promise<void> {
    if (!user.phoneE164) {
      return
    }

    const sendResult = await this.deps.channel.sendMessage({
      recipientId: user.phoneE164,
      content: { type: 'text', text: content },
    })

    await this.deps.conversationRepo.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content,
      contentType: 'text',
      metadata: {
        source: 'worker',
        workerKind: metadata.kind,
        journeyDay: metadata.journeyDay,
        externalMessageId: sendResult.messageId,
      },
    })
  }
}

function calculateJourneyDay(currentDay: number, lastInteractionAt: Date, now: Date): number {
  const elapsedDays = daysBetween(lastInteractionAt, now)
  return Math.min(30, currentDay + elapsedDays)
}

function daysBetween(from: Date, to: Date): number {
  const millisPerDay = 24 * 60 * 60 * 1000
  const fromDay = startOfLocalDay(from).getTime()
  const toDay = startOfLocalDay(to).getTime()
  return Math.max(0, Math.floor((toDay - fromDay) / millisPerDay))
}

function isSameLocalDay(date: Date | null, now: Date): boolean {
  if (!date) {
    return false
  }

  return startOfLocalDay(date).getTime() === startOfLocalDay(now).getTime()
}

function startOfLocalDay(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

function buildFallbackNurturingMessage(archetype: Archetype, day: number): string {
  const actions: Record<Archetype, string> = {
    provedor:
      'observe hoje um momento em que você tende a se antecipar demais e experimente dizer o que você precisa antes de resolver tudo sozinha',
    aventureiro:
      'perceba hoje onde você perde interesse rápido e teste ficar mais dois minutos numa conversa em vez de buscar estímulo novo',
    romantico:
      'pegue uma situação recente e separe fatos concretos do que foi expectativa sua, sem se julgar por isso',
    racional:
      'escolha uma emoção que apareceu hoje e tente nomeá-la com uma frase simples, sem explicar demais',
  }

  return `Dia ${day} da sua jornada. Hoje eu queria te provocar com uma prática pequena: ${actions[archetype]}. Se fizer sentido, me conta depois como isso apareceu no seu dia?`
}

function buildFallbackReengagementMessage(
  archetype: Archetype,
  day: number,
  daysWithoutReply: number,
): string {
  const hooks: Record<Archetype, string> = {
    provedor: 'reciprocidade',
    aventureiro: 'constância',
    romantico: 'realidade afetiva',
    racional: 'expressão emocional',
  }

  return `Faz ${daysWithoutReply} dias que você sumiu da jornada, então passei aqui só para te lembrar do nosso foco em ${hooks[archetype]}. Você está no dia ${day}, e não precisa voltar perfeito para retomar. Quer que eu te mande um próximo passo bem simples para hoje?`
}
