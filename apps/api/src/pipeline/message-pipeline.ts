import {
  type Archetype,
  ContextBuilder,
  type ConversationHistory,
  DIAGNOSIS_INTRO,
  IMAGE_ANALYSIS_SYSTEM_ADDITION,
  ISABELA_GREETING,
  ISABELA_RETURNING,
  type RAGService,
  type UserContext,
  getJourneyPrompt,
} from '@perpetuo/ai-gateway'
import type {
  AIProviderPort,
  ChannelPort,
  ContentBlock,
  IncomingMessage,
  User,
  UserRepository,
} from '@perpetuo/core'
import { IdentityResolver } from '@perpetuo/core'
import type {
  ConversationRepository,
  DiagnosticRepository,
  SubscriptionRepository,
} from '@perpetuo/database'
import type { Logger } from 'pino'
import { DiagnosticHandler } from './diagnostic-handler.js'
import { SubscriptionGuard } from './subscription-guard.js'

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

/**
 * TranscriptionService - Interface para transcrição de áudio
 */
export interface TranscriptionService {
  transcribe(audioUrl: string): Promise<string>
}

export interface PipelineDependencies {
  channel: ChannelPort
  userRepo: UserRepository
  aiProvider: AIProviderPort
  logger: Logger
  // Opcional - degradação graciosa se não configurado
  rag?: RAGService
  transcriber?: TranscriptionService
  conversationRepo?: ConversationRepository
  diagnosticRepo?: DiagnosticRepository
  subscriptionRepo?: SubscriptionRepository
  /** URL para redirecionamento de pagamento */
  paymentUrl?: string
  /** Se true, bloqueia usuários sem assinatura */
  enforcePaywall?: boolean
}

/**
 * MessagePipeline - Orquestra o processamento de mensagens
 *
 * Fluxo:
 * 1. receive -> validate webhook
 * 2. resolve identity (phone -> user_id)
 * 3. get/create conversation
 * 4. extract content (text, image, audio -> transcribe)
 * 5. save user message
 * 6. RAG search (busca conhecimento relevante)
 * 7. build context (system prompt + RAG + history)
 * 8. process with AI
 * 9. save AI response
 * 10. respond via channel
 */
export class MessagePipeline {
  private readonly identityResolver: IdentityResolver
  private readonly contextBuilder: ContextBuilder
  private readonly diagnosticHandler: DiagnosticHandler | null
  private readonly subscriptionGuard: SubscriptionGuard | null

  constructor(private readonly deps: PipelineDependencies) {
    this.identityResolver = new IdentityResolver(deps.userRepo)
    this.contextBuilder = new ContextBuilder({ maxHistoryMessages: 20 })
    this.diagnosticHandler = deps.diagnosticRepo ? new DiagnosticHandler(deps.diagnosticRepo) : null
    this.subscriptionGuard = deps.subscriptionRepo
      ? new SubscriptionGuard(deps.subscriptionRepo, {
          enforcePaywall: deps.enforcePaywall ?? false,
          paymentUrl: deps.paymentUrl,
        })
      : null
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
      return { success: true }
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
    // Busca/cria conversa e contexto do usuário
    const conversation = this.deps.conversationRepo
      ? await this.deps.conversationRepo.getOrCreateActive(user.id, message.channelType)
      : null

    const userContext = await this.buildUserContext(user)

    // Extrai conteúdo da mensagem
    const { text: messageText, contentBlocks } = await this.extractMessageContent(message)

    // Salva mensagem do usuário
    await this.saveUserMessage(conversation?.id, message, messageText)

    // Busca histórico
    const history = await this.getConversationHistory(user.id, conversation?.id)

    // Verifica assinatura (após diagnóstico completo)
    if (userContext.diagnosisCompleted) {
      const blockMessage = await this.checkSubscription(user.id)
      if (blockMessage) {
        await this.saveAIResponse(conversation?.id, {
          content: blockMessage,
          usage: { inputTokens: 0, outputTokens: 0 },
        })
        return blockMessage
      }
    }

    // Busca RAG (apenas se diagnóstico completo)
    const ragContext = userContext.diagnosisCompleted
      ? await this.searchRAG(messageText)
      : undefined

    // Seleciona prompt e monta contexto
    const hasImage = contentBlocks?.some((b) => b.type === 'image') ?? false
    const systemPrompt = this.selectSystemPrompt(userContext, history, hasImage)
    const messages = this.contextBuilder.build({
      systemPrompt,
      userContext,
      history,
      currentMessage: contentBlocks ?? messageText,
      ragContext,
    })

    // Chama a IA
    const result = await this.deps.aiProvider.complete(messages, {
      maxTokens: 500,
      temperature: 0.7,
    })

    // Processa diagnóstico se IA indicou conclusão
    const finalContent = await this.processDiagnosisIfComplete(user, result.content, history)

    // Salva resposta da IA (com conteúdo processado)
    await this.saveAIResponse(conversation?.id, { ...result, content: finalContent })

    // Registra interação na jornada
    if (this.deps.diagnosticRepo && userContext.diagnosisCompleted) {
      await this.deps.diagnosticRepo.recordInteraction(user.id).catch(() => {})
    }

    return finalContent
  }

  /**
   * Processa diagnóstico quando IA indica conclusão com [PERFIL:arquetipo]
   */
  private async processDiagnosisIfComplete(
    user: User,
    aiResponse: string,
    history: ConversationHistory,
  ): Promise<string> {
    // Detecta marcador [PERFIL:arquetipo]
    const match = aiResponse.match(/^\[PERFIL:(provedor|aventureiro|romantico|racional)\]/i)
    if (!match || !this.diagnosticHandler) return aiResponse

    const archetype = match[1].toLowerCase() as
      | 'provedor'
      | 'aventureiro'
      | 'romantico'
      | 'racional'

    this.deps.logger.info({ userId: user.id, archetype }, 'Diagnosis completed by AI')

    // Extrai respostas do histórico para registro
    const answers = this.diagnosticHandler.extractAnswersFromHistory(history)

    // Salva diagnóstico com scores baseados no arquétipo detectado
    const scores = this.generateScoresForArchetype(archetype)
    await this.diagnosticHandler.saveDiagnosis(user.id, archetype, scores, answers)

    // Remove o marcador da resposta
    return aiResponse.replace(/^\[PERFIL:\w+\]\s*/i, '')
  }

  /**
   * Gera scores representativos para o arquétipo identificado pela IA
   */
  private generateScoresForArchetype(
    archetype: 'provedor' | 'aventureiro' | 'romantico' | 'racional',
  ) {
    const baseScores = { provedor: 4, aventureiro: 4, romantico: 4, racional: 4 }
    return { ...baseScores, [archetype]: 9 }
  }

  /**
   * Verifica assinatura e retorna mensagem de bloqueio se necessário
   */
  private async checkSubscription(userId: string): Promise<string | null> {
    if (!this.subscriptionGuard) return null

    const blockMessage = await this.subscriptionGuard.getBlockMessage(userId)

    if (blockMessage) {
      this.deps.logger.info({ userId }, 'User blocked: no active subscription')
    }

    return blockMessage
  }

  private async saveUserMessage(
    conversationId: string | undefined,
    message: IncomingMessage,
    messageText: string,
  ): Promise<void> {
    if (!conversationId || !this.deps.conversationRepo) return

    const contentType =
      message.content.type === 'image'
        ? 'image'
        : message.content.type === 'audio'
          ? 'audio'
          : 'text'

    await this.deps.conversationRepo.addMessage({
      conversationId,
      role: 'user',
      content: messageText,
      contentType,
    })
  }

  private async searchRAG(query: string): Promise<string | undefined> {
    if (!this.deps.rag || !query) return undefined

    try {
      const chunks = await this.deps.rag.search(query, {
        matchThreshold: 0.7,
        matchCount: 3,
      })
      this.deps.logger.debug({ chunksFound: chunks.length }, 'RAG search completed')
      return this.deps.rag.formatForContext(chunks)
    } catch (error) {
      this.deps.logger.warn({ error }, 'RAG search failed, continuing without')
      return undefined
    }
  }

  private async saveAIResponse(
    conversationId: string | undefined,
    result: { content: string; usage: { inputTokens: number; outputTokens: number } },
  ): Promise<void> {
    if (!conversationId || !this.deps.conversationRepo) return

    await this.deps.conversationRepo.addMessage({
      conversationId,
      role: 'assistant',
      content: result.content,
      contentType: 'text',
      metadata: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    })
  }

  /**
   * Extrai conteúdo da mensagem, transcrevendo áudio se necessário
   */
  private async extractMessageContent(
    message: IncomingMessage,
  ): Promise<{ text: string; contentBlocks?: ContentBlock[] }> {
    if (message.content.type === 'text') {
      return { text: message.content.text }
    }

    if (message.content.type === 'image') {
      if (!message.content.data || !message.content.mediaType) {
        return { text: message.content.caption ?? '[Imagem recebida - dados não disponíveis]' }
      }

      const blocks: ContentBlock[] = [
        {
          type: 'image',
          source: {
            type: 'base64',
            data: message.content.data,
            mediaType: message.content.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
          },
        },
        {
          type: 'text',
          text: message.content.caption ?? 'Analise esta imagem.',
        },
      ]
      return {
        text: message.content.caption ?? 'Analise esta imagem.',
        contentBlocks: blocks,
      }
    }

    if (message.content.type === 'audio') {
      if (this.deps.transcriber) {
        try {
          const transcription = await this.deps.transcriber.transcribe(message.content.url)
          return { text: `[Áudio transcrito]: ${transcription}` }
        } catch (error) {
          this.deps.logger.warn({ error }, 'Audio transcription failed')
          return { text: '[Áudio recebido - transcrição indisponível]' }
        }
      }
      return { text: '[Áudio recebido - transcrição não configurada]' }
    }

    return { text: '[Mensagem não suportada]' }
  }

  private async buildUserContext(user: User): Promise<UserContext> {
    // Se não tem repo de diagnóstico, retorna contexto padrão
    if (!this.deps.diagnosticRepo) {
      return {
        userId: user.id,
        diagnosisCompleted: false,
        currentDayInJourney: 0,
      }
    }

    // Busca diagnóstico
    const diagnostic = await this.deps.diagnosticRepo.getByUserId(user.id)
    if (!diagnostic) {
      return {
        userId: user.id,
        diagnosisCompleted: false,
        currentDayInJourney: 0,
      }
    }

    // Busca progresso na jornada
    const journey = await this.deps.diagnosticRepo.getJourneyProgress(user.id)

    return {
      userId: user.id,
      archetype: diagnostic.archetype,
      diagnosisCompleted: true,
      currentDayInJourney: journey?.currentDay ?? 0,
    }
  }

  private async getConversationHistory(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationHistory> {
    if (!this.deps.conversationRepo || !conversationId) {
      return { messages: [] }
    }

    try {
      const messages = await this.deps.conversationRepo.getRecentMessages(conversationId, 20)

      return {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
      }
    } catch (error) {
      this.deps.logger.warn({ error }, 'Failed to get conversation history')
      return { messages: [] }
    }
  }

  private selectSystemPrompt(
    context: UserContext,
    history: ConversationHistory,
    hasImage = false,
  ): string {
    let basePrompt: string

    // Primeiro contato
    if (history.messages.length === 0) {
      basePrompt = ISABELA_GREETING
    }
    // Ainda não fez diagnóstico - IA conduz naturalmente
    else if (!context.diagnosisCompleted) {
      basePrompt = DIAGNOSIS_INTRO
    }
    // Tem arquétipo - usa prompt da jornada
    else if (context.archetype) {
      basePrompt = getJourneyPrompt(context.archetype as Archetype, context.currentDayInJourney)
    }
    // Fallback
    else {
      basePrompt = ISABELA_RETURNING
    }

    // Adiciona contexto de análise de imagem se necessário
    if (hasImage) {
      return basePrompt + IMAGE_ANALYSIS_SYSTEM_ADDITION
    }

    return basePrompt
  }
}
