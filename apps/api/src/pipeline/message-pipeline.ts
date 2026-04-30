import {
  ATTACHMENT_CITATION_SYSTEM_ADDITION,
  type AttachmentRAGService,
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
  AttachmentRepository,
  ConversationRepository,
  Conversation,
  DiagnosticRepository,
  SubscriptionRepository,
} from '@perpetuo/database'
import type { Logger } from 'pino'
import { DiagnosticHandler } from './diagnostic-handler.js'

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
  attachmentRag?: AttachmentRAGService
  transcriber?: TranscriptionService
  conversationRepo?: ConversationRepository
  attachmentRepo?: AttachmentRepository
  diagnosticRepo?: DiagnosticRepository
  subscriptionRepo?: SubscriptionRepository
  inlineImageStorage?: {
    removeObject(path: string): Promise<void>
  }
  /** URL para redirecionamento de pagamento */
  paymentUrl?: string
}

export interface AppMessageParams {
  userId: string
  conversationId: string
  content?: string
  image?: {
    data: string
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
    caption?: string
    storagePath?: string
    sizeBytes?: number
  }
  audio?: {
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
    storagePath?: string
    sizeBytes?: number
    durationMs?: number
  }
  attachmentIds?: string[]
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

  constructor(private readonly deps: PipelineDependencies) {
    this.identityResolver = new IdentityResolver(deps.userRepo)
    this.contextBuilder = new ContextBuilder({ maxHistoryMessages: 20 })
    this.diagnosticHandler = deps.diagnosticRepo ? new DiagnosticHandler(deps.diagnosticRepo) : null
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

  private async processWithAI(
    message: IncomingMessage,
    user: User,
    options: {
      conversationOverride?: Conversation | null
      attachmentIds?: string[]
      contentProvided?: boolean
      onUserMessageSaved?: () => void
    } = {},
  ): Promise<string> {
    // Busca/cria conversa e contexto do usuário
    const conversation = options.conversationOverride
      ? options.conversationOverride
      : this.deps.conversationRepo
        ? await this.deps.conversationRepo.getOrCreateActive(user.id, message.channelType)
        : null

    const userContext = await this.buildUserContext(user)

    // Extrai conteúdo da mensagem
    const { text: messageText, contentBlocks } = await this.extractMessageContent(message)

    // Salva mensagem do usuário
    await this.saveUserMessage(conversation?.id, message, messageText, options.attachmentIds)
    options.onUserMessageSaved?.()

    // Busca histórico
    const history = await this.getConversationHistory(conversation)

    // Pós-diagnóstico, acesso completo depende de assinatura ativa.
    const hasSubscribedJourneyAccess = userContext.hasRagAccess === true

    // O RAG só entra depois do diagnóstico e com assinatura ativa.
    const ragContext = hasSubscribedJourneyAccess && options.contentProvided !== false
      ? await this.searchRAG(messageText)
      : undefined

    const attachmentContext = conversation
      ? await this.searchAttachmentContext({
          userId: user.id,
          conversationId: conversation.id,
          query: messageText,
          contentProvided: options.contentProvided !== false,
          attachmentIds: options.attachmentIds,
          enabled: hasSubscribedJourneyAccess,
        })
      : { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: false }

    const combinedRagContext = [
      ragContext,
      attachmentContext.context,
      attachmentContext.hasPendingAttachments
        ? `---
STATUS DOS ARQUIVOS ANEXADOS:
Alguns arquivos desta conversa ainda estão sendo processados. Não invente conteúdo desses arquivos; se a resposta depender deles, avise que a indexação ainda não terminou.
---`
        : undefined,
      attachmentContext.isBlockedBySubscription
        ? `---
STATUS DOS ARQUIVOS ANEXADOS:
Os arquivos enviados nesta conversa estão bloqueados até a assinatura ativa. Não use o conteúdo desses arquivos; explique gentilmente que esse recurso faz parte do plano pago.
---`
        : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n')

    if (
      options.contentProvided === false &&
      attachmentContext.isBlockedBySubscription
    ) {
      const lockedAttachmentResponse =
        'Recebi seus arquivos, mas o uso de anexos no chat faz parte da assinatura. Ative seu plano para eu conseguir ler e usar esse conteúdo na conversa.'

      await this.saveAIResponse(conversation?.id, {
        content: lockedAttachmentResponse,
        usage: { inputTokens: 0, outputTokens: 0 },
      })

      return lockedAttachmentResponse
    }

    if (
      options.contentProvided === false &&
      !attachmentContext.context &&
      attachmentContext.hasPendingAttachments
    ) {
      const pendingResponse =
        'Recebi seus arquivos, mas eles ainda estão sendo indexados. Em instantes eu já consigo usar esse conteúdo como contexto.'

      await this.saveAIResponse(conversation?.id, {
        content: pendingResponse,
        usage: { inputTokens: 0, outputTokens: 0 },
      })

      return pendingResponse
    }

    // Antes do diagnóstico não há bloqueio procedural; depois, imagem exige assinatura.
    const hasImage = contentBlocks?.some((b) => b.type === 'image') ?? false
    const canAnalyzeImage = userContext.canAnalyzeImages === true

    // Se enviou imagem mas não pode analisar, remove contentBlocks
    const effectiveContent =
      hasImage && !canAnalyzeImage ? messageText : (contentBlocks ?? messageText)

    // Seleciona prompt e monta contexto
    const systemPrompt = [
      this.selectSystemPrompt(userContext, history, hasImage && canAnalyzeImage),
      attachmentContext.context ? ATTACHMENT_CITATION_SYSTEM_ADDITION : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n')
    const messages = this.contextBuilder.build({
      systemPrompt,
      userContext,
      history,
      currentMessage: effectiveContent,
      ragContext: combinedRagContext || undefined,
    })

    let result

    try {
      // Chama a IA
      result = await this.deps.aiProvider.complete(messages, {
        maxTokens: 500,
        temperature: 0.7,
      })
    } catch (error) {
      const aiErrorMessage = this.extractAIErrorMessage(error)

      if (hasImage && this.isRecoverableImageProcessingError(aiErrorMessage)) {
        this.deps.logger.warn(
          { error, userId: user.id, conversationId: conversation?.id, aiErrorMessage },
          'AI provider could not process image, using graceful fallback response',
        )

        const fallbackContent =
          'Recebi sua imagem, mas não consegui processá-la visualmente agora. Tente reenviar uma foto mais nítida em JPG ou PNG, ou me diga em texto o que você quer que eu observe nela.'

        await this.saveAIResponse(conversation?.id, {
          content: fallbackContent,
          usage: { inputTokens: 0, outputTokens: 0 },
        })

        return fallbackContent
      }

      throw error
    }

    // Processa diagnóstico se IA indicou conclusão
    const finalContent = await this.processDiagnosisIfComplete(user, result.content, history)

    // Salva resposta da IA (com conteúdo processado)
    await this.saveAIResponse(conversation?.id, { ...result, content: finalContent })

    // Resume histórico antigo quando a conversa começa a crescer.
    await this.maybeSummarizeConversation(conversation)

    // Registra interação na jornada
    if (this.deps.diagnosticRepo && userContext.diagnosisCompleted) {
      await this.deps.diagnosticRepo.recordInteraction(user.id).catch(() => {})
    }

    return finalContent
  }

  private extractAIErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error && error.message) {
      return error.message
    }

    if (
      error &&
      typeof error === 'object' &&
      'error' in error &&
      error.error &&
      typeof error.error === 'object' &&
      'error' in error.error &&
      error.error.error &&
      typeof error.error.error === 'object' &&
      'message' in error.error.error &&
      typeof error.error.error.message === 'string'
    ) {
      return error.error.error.message
    }

    return undefined
  }

  private isRecoverableImageProcessingError(message?: string): boolean {
    if (!message) {
      return false
    }

    const normalizedMessage = message.toLowerCase()
    return normalizedMessage.includes('could not process image')
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

    // Remove o marcador da resposta e anexa o plano direcional padrão.
    const cleanedResponse = aiResponse.replace(/^\[PERFIL:\w+\]\s*/i, '').trim()
    return this.diagnosticHandler.appendDirectionalPlan(cleanedResponse, archetype)
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

  private async saveUserMessage(
    conversationId: string | undefined,
    message: IncomingMessage,
    messageText: string,
    attachmentIds?: string[],
  ): Promise<void> {
    if (!conversationId || !this.deps.conversationRepo) return

    const contentType =
      message.content.type === 'image'
        ? 'image'
        : message.content.type === 'audio'
          ? 'audio'
          : 'text'

    const storedContent =
      message.content.type === 'image'
        ? (message.content.caption?.trim() ?? '[Imagem enviada para análise]')
        : messageText

    const metadata =
      message.content.type === 'image'
        ? {
            ...(message.metadata ?? {}),
            imageStoragePath:
              typeof message.metadata?.imageStoragePath === 'string'
                ? message.metadata.imageStoragePath
                : undefined,
            imageMimeType:
              typeof message.metadata?.imageMimeType === 'string'
                ? message.metadata.imageMimeType
                : undefined,
            imageSizeBytes:
              typeof message.metadata?.imageSizeBytes === 'number'
                ? message.metadata.imageSizeBytes
                : undefined,
          }
        : message.content.type === 'audio'
          ? {
              ...(message.metadata ?? {}),
              audioStoragePath:
                typeof message.metadata?.audioStoragePath === 'string'
                  ? message.metadata.audioStoragePath
                  : undefined,
              audioMimeType:
                typeof message.metadata?.audioMimeType === 'string'
                  ? message.metadata.audioMimeType
                  : undefined,
              audioSizeBytes:
                typeof message.metadata?.audioSizeBytes === 'number'
                  ? message.metadata.audioSizeBytes
                  : undefined,
              audioDurationMs:
                typeof message.metadata?.audioDurationMs === 'number'
                  ? message.metadata.audioDurationMs
                  : undefined,
              audioCaption:
                typeof message.metadata?.audioCaption === 'string'
                  ? message.metadata.audioCaption
                  : undefined,
            }
        : (message.metadata as Record<string, unknown> | undefined)

    await this.deps.conversationRepo.addMessage({
      conversationId,
      role: 'user',
      content: storedContent,
      contentType,
      metadata,
      attachmentIds,
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

  private async searchAttachmentContext(params: {
    userId: string
    conversationId: string
    query: string
    contentProvided: boolean
    attachmentIds?: string[]
    enabled: boolean
  }): Promise<{ context?: string; hasPendingAttachments: boolean; isBlockedBySubscription: boolean }> {
    if (!params.attachmentIds || params.attachmentIds.length === 0) {
      return { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: false }
    }

    if (!params.enabled) {
      return { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: true }
    }

    if (
      !this.deps.attachmentRepo ||
      !this.deps.attachmentRag ||
      !params.attachmentIds ||
      params.attachmentIds.length === 0
    ) {
      return { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: false }
    }

    try {
      const attachments = await this.deps.attachmentRepo.findByConversationAndIds({
        conversationId: params.conversationId,
        userId: params.userId,
        attachmentIds: params.attachmentIds,
      })

      if (attachments.length === 0) {
        return { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: false }
      }

      const readyAttachmentIds = attachments
        .filter((attachment) => attachment.status === 'ready')
        .map((attachment) => attachment.id)

      const hasPendingAttachments = attachments.some((attachment) => attachment.status !== 'ready')

      if (readyAttachmentIds.length === 0) {
        return { context: undefined, hasPendingAttachments, isBlockedBySubscription: false }
      }

      const chunks =
        params.contentProvided && params.query
          ? await this.deps.attachmentRag.search(params.query, {
              userId: params.userId,
              conversationId: params.conversationId,
              attachmentIds: readyAttachmentIds,
              matchThreshold: 0.65,
              matchCount: 5,
            })
          : await this.deps.attachmentRag.getAttachmentOverview({
              userId: params.userId,
              conversationId: params.conversationId,
              attachmentIds: readyAttachmentIds,
              maxChunks: 6,
            })

      return {
        context: this.deps.attachmentRag.formatForContext(chunks),
        hasPendingAttachments,
        isBlockedBySubscription: false,
      }
    } catch (error) {
      this.deps.logger.warn({ error }, 'Attachment RAG search failed, continuing without')
      return { context: undefined, hasPendingAttachments: false, isBlockedBySubscription: false }
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
      const caption =
        typeof message.metadata?.audioCaption === 'string'
          ? message.metadata.audioCaption.trim()
          : undefined

      if (this.deps.transcriber) {
        try {
          const transcription = await this.deps.transcriber.transcribe(message.content.url)
          const normalizedTranscription = transcription.trim()

          if (caption) {
            return {
              text: normalizedTranscription.length > 0
                ? `${caption}\n\nTranscrição do áudio:\n${normalizedTranscription}`
                : `${caption}\n\n[Áudio recebido - transcrição vazia]`,
            }
          }

          return {
            text:
              normalizedTranscription.length > 0
                ? normalizedTranscription
                : '[Áudio recebido - transcrição vazia]',
          }
        } catch (error) {
          this.deps.logger.warn({ error }, 'Audio transcription failed')
          return {
            text: caption
              ? `${caption}\n\n[Áudio recebido - transcrição indisponível]`
              : '[Áudio recebido - transcrição indisponível]',
          }
        }
      }
      return {
        text: caption
          ? `${caption}\n\n[Áudio recebido - transcrição não configurada]`
          : '[Áudio recebido - transcrição não configurada]',
      }
    }

    return { text: '[Mensagem não suportada]' }
  }

  private async buildUserContext(user: User): Promise<UserContext> {
    const context: UserContext = {
      userId: user.id,
      diagnosisCompleted: false,
      currentDayInJourney: 0,
      imageAnalysisLimit: 20,
      subscriptionOfferUrl: this.deps.paymentUrl,
    }

    // Busca diagnóstico
    if (this.deps.diagnosticRepo) {
      const diagnostic = await this.deps.diagnosticRepo.getByUserId(user.id)
      if (diagnostic) {
        context.archetype = diagnostic.archetype
        context.diagnosisCompleted = true

        const journey = await this.deps.diagnosticRepo.getJourneyProgress(user.id)
        if (journey) {
          const currentDay = await this.syncJourneyProgressIfNeeded(user.id, journey)
          context.currentDayInJourney = currentDay
        }
      }
    }

    // Busca status de assinatura
    if (this.deps.subscriptionRepo) {
      context.hasActiveSubscription = await this.deps.subscriptionRepo.isActive(user.id)
    }

    // Conta uso de imagens no mês
    context.imageAnalysisUsedThisMonth = await this.countImageAnalysisThisMonth(user.id)
    context.imageAnalysisRemainingThisMonth = Math.max(
      (context.imageAnalysisLimit ?? 20) - context.imageAnalysisUsedThisMonth,
      0,
    )

    const subscriptionCheckEnabled = this.deps.subscriptionRepo !== undefined
    const hasActiveSubscription = context.hasActiveSubscription === true

    context.hasRagAccess =
      context.diagnosisCompleted && (!subscriptionCheckEnabled || hasActiveSubscription)
    context.canAnalyzeImages =
      (context.imageAnalysisRemainingThisMonth ?? 0) > 0 &&
      (!context.diagnosisCompleted || !subscriptionCheckEnabled || hasActiveSubscription)

    return context
  }

  /**
   * Conta quantas análises de imagem o usuário fez este mês
   */
  private async countImageAnalysisThisMonth(userId: string): Promise<number> {
    if (!this.deps.conversationRepo) return 0

    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      return await this.deps.conversationRepo.countUserMessagesByTypeSince({
        userId,
        role: 'user',
        contentType: 'image',
        since: startOfMonth,
      })
    } catch {
      return 0
    }
  }

  private async syncJourneyProgressIfNeeded(
    userId: string,
    journey: NonNullable<Awaited<ReturnType<DiagnosticRepository['getJourneyProgress']>>>,
  ): Promise<number> {
    const nextDay = this.calculateJourneyDay(journey.currentDay, journey.lastInteractionAt)
    if (nextDay === journey.currentDay || !this.deps.diagnosticRepo) {
      return journey.currentDay
    }

    await this.deps.diagnosticRepo.updateJourneyProgress(userId, {
      currentDay: nextDay,
      status: journey.status,
    })

    return nextDay
  }

  private calculateJourneyDay(currentDay: number, lastInteractionAt: Date): number {
    const millisPerDay = 24 * 60 * 60 * 1000

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastInteractionDay = new Date(lastInteractionAt)
    lastInteractionDay.setHours(0, 0, 0, 0)

    const elapsedDays = Math.max(
      0,
      Math.floor((today.getTime() - lastInteractionDay.getTime()) / millisPerDay),
    )

    return Math.min(30, currentDay + elapsedDays)
  }

  private async getConversationHistory(
    conversation: Conversation | null,
  ): Promise<ConversationHistory> {
    if (!this.deps.conversationRepo || !conversation) {
      return { messages: [] }
    }

    try {
      const messages = await this.deps.conversationRepo.getRecentMessages(conversation.id, 20)

      return {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
        summary: conversation.summary,
      }
    } catch (error) {
      this.deps.logger.warn({ error }, 'Failed to get conversation history')
      return { messages: [] }
    }
  }

  private async maybeSummarizeConversation(conversation: Conversation | null): Promise<void> {
    if (!conversation || !this.deps.conversationRepo) return

    try {
      const messages = await this.deps.conversationRepo.getRecentMessages(conversation.id, 40)
      if (messages.length <= 24) return

      const olderMessages = messages.slice(0, -20)
      if (olderMessages.length === 0) return

      const summary = await this.generateConversationSummary(
        olderMessages.map((message) => ({
          role: message.role,
          content: message.content,
          timestamp: message.createdAt,
        })),
        conversation.summary,
      )

      await this.deps.conversationRepo.updateSummary(conversation.id, summary)
    } catch (error) {
      this.deps.logger.warn({ error, conversationId: conversation.id }, 'Failed to summarize conversation')
    }
  }

  private async generateConversationSummary(
    messages: ConversationHistory['messages'],
    existingSummary?: string,
  ): Promise<string> {
    const transcript = messages
      .map((message) => `${message.role === 'user' ? 'Usuário' : 'Isabela'}: ${message.content}`)
      .join('\n')

    const prompt = [
      'Resuma a conversa abaixo em português para uso interno de contexto de IA.',
      'Mantenha no máximo 8 bullets curtos.',
      'Preserve fatos sobre perfil do usuário, objetivos, dores, contexto relacional e combinados anteriores.',
      'Remova redundâncias e não invente nada.',
      existingSummary ? `Resumo anterior:\n${existingSummary}` : undefined,
      `Trecho da conversa:\n${transcript}`,
      'Responda apenas com o resumo final em bullets.',
    ]
      .filter(Boolean)
      .join('\n\n')

    const result = await this.deps.aiProvider.complete(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        maxTokens: 250,
        temperature: 0.2,
      },
    )

    return result.content.trim()
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

  /**
   * Processa mensagem do app (canal app via REST + SSE)
   *
   * Diferente do processo padrão:
   * - Não valida webhook (já autenticado via JWT)
   * - Usuário já identificado pelo ID
   * - Resposta enviada via SSE (channel.sendMessage emite evento)
   */
  async processAppMessage(params: AppMessageParams): Promise<PipelineResult> {
    const { userId, conversationId } = params
    const startedAt = new Date()
    let userMessageSaved = false

    try {
      // Busca usuário
      const user = await this.identityResolver.resolve({
        type: 'user_id',
        value: userId,
      })

      const conversation = this.deps.conversationRepo
        ? await this.deps.conversationRepo.findById(conversationId)
        : null

      if (this.deps.conversationRepo && (!conversation || conversation.userId !== userId)) {
        throw new Error('Conversation not found for user')
      }

      const content = params.content?.trim()
      const imageCaption = params.image?.caption?.trim() ?? content
      const audioCaption = params.audio?.caption?.trim() ?? content
      const normalizedContent =
        content && content.length > 0
          ? content
          : params.image
            ? imageCaption && imageCaption.length > 0
              ? imageCaption
              : 'Analise esta imagem.'
            : params.audio
              ? audioCaption && audioCaption.length > 0
                ? audioCaption
                : 'Transcreva e analise este áudio.'
            : params.attachmentIds && params.attachmentIds.length > 0
              ? 'Analise os arquivos anexados e use-os como contexto para responder.'
              : ''

      this.deps.logger.info(
        {
          userId: user.id,
          conversationId,
          elapsed: Date.now() - startedAt.getTime(),
        },
        'App message received',
      )

      // Cria IncomingMessage simulada
      const message: IncomingMessage = {
        externalId: `app-${Date.now()}`,
        channelType: 'app',
        senderId: userId,
        timestamp: new Date(),
        content: params.image
          ? {
              type: 'image',
              data: params.image.data,
              mediaType: params.image.mediaType,
              caption: imageCaption,
            }
          : params.audio
            ? {
                type: 'audio',
                url: params.audio.url,
                duration:
                  typeof params.audio.durationMs === 'number'
                    ? Math.round(params.audio.durationMs / 1000)
                    : undefined,
              }
          : { type: 'text', text: normalizedContent },
        metadata:
          params.image
            ? {
                imageStoragePath: params.image.storagePath,
                imageMimeType: params.image.mediaType,
                imageSizeBytes: params.image.sizeBytes,
                ...(params.attachmentIds && params.attachmentIds.length > 0
                  ? { attachmentIds: params.attachmentIds }
                  : {}),
              }
            : params.audio
              ? {
                  audioStoragePath: params.audio.storagePath,
                  audioMimeType: params.audio.mediaType,
                  audioSizeBytes: params.audio.sizeBytes,
                  audioDurationMs: params.audio.durationMs,
                  audioCaption: audioCaption,
                  ...(params.attachmentIds && params.attachmentIds.length > 0
                    ? { attachmentIds: params.attachmentIds }
                    : {}),
                }
            : params.attachmentIds && params.attachmentIds.length > 0
              ? { attachmentIds: params.attachmentIds }
              : undefined,
      }

      // Processa com IA (reutiliza toda a lógica existente)
      const response = await this.processWithAI(message, user, {
        conversationOverride: conversation,
        attachmentIds: params.attachmentIds,
        contentProvided: Boolean((params.image ? imageCaption : params.audio ? audioCaption : content)?.length),
        onUserMessageSaved: () => {
          userMessageSaved = true
        },
      })

      // Responde via canal (AppChannelAdapter emite via SSE)
      const sendResult = await this.deps.channel.sendMessage({
        recipientId: userId,
        content: { type: 'text', text: response },
      })

      this.deps.logger.info(
        {
          userId: user.id,
          responseMessageId: sendResult.messageId,
          elapsed: Date.now() - startedAt.getTime(),
        },
        'App response sent',
      )

      return { success: true, responseMessageId: sendResult.messageId }
    } catch (error) {
      const inlineMediaPath = params.image?.storagePath ?? params.audio?.storagePath

      if (inlineMediaPath && !userMessageSaved && this.deps.inlineImageStorage) {
        await this.deps.inlineImageStorage.removeObject(inlineMediaPath).catch((cleanupError) => {
          this.deps.logger.warn(
            { cleanupError, userId, inlineMediaPath },
            'Failed to cleanup inline media after app message failure',
          )
        })
      }

      this.deps.logger.error({ error, userId }, 'Failed to process app message')
      return { success: false, error: 'processing_failed' }
    }
  }
}
