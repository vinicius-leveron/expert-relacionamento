import {
  ContextBuilder,
  type ConversationHistory,
  ISABELA_GREETING,
  ISABELA_RETURNING,
  type UserContext,
} from '@perpetuo/ai-gateway'
import type {
  AIProviderPort,
  ChannelPort,
  IncomingMessage,
  User,
  UserRepository,
} from '@perpetuo/core'
import { IdentityResolver } from '@perpetuo/core'
import type { Logger } from 'pino'

export interface PipelineContext {
  message: IncomingMessage
  user: User
  startedAt: Date
}

export interface PipelineResult {
  success: boolean
  responseMessageId?: string
  error?: string
}

export interface PipelineDependencies {
  channel: ChannelPort
  userRepo: UserRepository
  aiProvider: AIProviderPort
  logger: Logger
}

/**
 * MessagePipeline - Orquestra o processamento de mensagens
 *
 * Fluxo: receive -> resolve identity -> build context -> process with AI -> respond
 */
export class MessagePipeline {
  private readonly identityResolver: IdentityResolver
  private readonly contextBuilder: ContextBuilder

  constructor(private readonly deps: PipelineDependencies) {
    this.identityResolver = new IdentityResolver(deps.userRepo)
    this.contextBuilder = new ContextBuilder({ maxHistoryMessages: 20 })
  }

  async process(rawPayload: unknown, signature: string): Promise<PipelineResult> {
    const startedAt = new Date()

    // 1. Valida webhook
    if (!this.deps.channel.validateWebhook(rawPayload, signature)) {
      this.deps.logger.warn('Invalid webhook signature')
      return { success: false, error: 'invalid_signature' }
    }

    // 2. Parseia mensagem
    const message = this.deps.channel.parseWebhook(rawPayload)
    if (!message) {
      this.deps.logger.debug('Webhook without message (status update, etc)')
      return { success: true } // Webhook válido mas sem mensagem para processar
    }

    // 3. Resolve identidade (ADR 0011)
    const user = await this.identityResolver.resolve({
      type: 'phone',
      value: message.senderId,
    })

    this.deps.logger.info(
      {
        userId: user.id,
        messageType: message.content.type,
        elapsed: Date.now() - startedAt.getTime(),
      },
      'Message received',
    )

    // 4. Monta contexto e processa com IA
    try {
      const response = await this.processWithAI(message, user)

      // 5. Responde via canal
      const sendResult = await this.deps.channel.sendMessage({
        recipientId: message.senderId,
        content: { type: 'text', text: response },
      })

      this.deps.logger.info(
        {
          userId: user.id,
          responseMessageId: sendResult.messageId,
          elapsed: Date.now() - startedAt.getTime(),
        },
        'Response sent',
      )

      return { success: true, responseMessageId: sendResult.messageId }
    } catch (error) {
      this.deps.logger.error({ error, userId: user.id }, 'Failed to process message')
      return { success: false, error: 'processing_failed' }
    }
  }

  private async processWithAI(message: IncomingMessage, user: User): Promise<string> {
    // TODO: Buscar contexto real do usuário do banco
    const userContext = this.buildUserContext(user)
    const history = await this.getConversationHistory(user.id)

    // Seleciona prompt baseado no estado
    const systemPrompt = this.selectSystemPrompt(userContext, history)

    // Extrai texto da mensagem
    const currentMessage = this.extractMessageText(message)

    // Monta mensagens para a IA
    const messages = this.contextBuilder.build({
      systemPrompt,
      userContext,
      history,
      currentMessage,
    })

    // Chama a IA
    const result = await this.deps.aiProvider.complete(messages, {
      maxTokens: 500,
      temperature: 0.7,
    })

    return result.content
  }

  private buildUserContext(user: User): UserContext {
    // TODO: Buscar dados reais do banco (arquétipo, dia da jornada, etc)
    return {
      userId: user.id,
      diagnosisCompleted: false,
      currentDayInJourney: 0,
    }
  }

  private async getConversationHistory(_userId: string): Promise<ConversationHistory> {
    // TODO: Buscar histórico real do banco
    return {
      messages: [],
    }
  }

  private selectSystemPrompt(context: UserContext, history: ConversationHistory): string {
    // Se não tem histórico, é primeiro contato
    if (history.messages.length === 0) {
      return ISABELA_GREETING
    }

    // Se ainda não completou diagnóstico
    if (!context.diagnosisCompleted) {
      // TODO: Usar DIAGNOSIS_INTRO quando tivermos mais lógica
      return ISABELA_RETURNING
    }

    // Usuário retornando com diagnóstico completo
    // TODO: Usar getJourneyPrompt quando tivermos arquétipo
    return ISABELA_RETURNING
  }

  private extractMessageText(message: IncomingMessage): string {
    if (message.content.type === 'text') {
      return message.content.text
    }
    if (message.content.type === 'image') {
      return '[Imagem recebida]'
    }
    return '[Mensagem não suportada]'
  }
}
