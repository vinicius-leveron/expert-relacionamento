import { randomUUID } from 'node:crypto'
import {
  ATTACHMENT_CITATION_SYSTEM_ADDITION,
  type AttachmentRAGService,
  agentRequiresStructuredDiagnosis,
  type AgentId,
  type Archetype,
  ContextBuilder,
  type ConversationHistory,
  DIAGNOSIS_INTRO,
  ImageGenerationService,
  getAgentSystemPrompt,
  IMAGE_ANALYSIS_SYSTEM_ADDITION,
  ISABELA_GREETING,
  ISABELA_RETURNING,
  isAgentId,
  type ImageGenerationOptions,
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
  AvatarPhaseSnapshot,
  AvatarProfile,
  AvatarProfileRepository,
  AvatarProfileStatus,
  AvatarProfileSummary,
  ConversationRepository,
  Conversation,
  DiagnosticRepository,
  SubscriptionRepository,
  UsageCounterRepository,
} from '@perpetuo/database'
import { createEmptyAvatarProfileSummary } from '@perpetuo/database'
import type { Logger } from 'pino'
import {
  incrementMonthlyQuota,
  loadMonthlyQuota,
} from '../services/monthly-usage-quota.service.js'
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
  avatarProfileRepo?: AvatarProfileRepository
  diagnosticRepo?: DiagnosticRepository
  subscriptionRepo?: SubscriptionRepository
  usageCounterRepo?: UsageCounterRepository
  imageService?: ImageGenerationService
  inlineImageStorage?: {
    removeObject(path: string): Promise<void>
    uploadBuffer?(params: {
      path: string
      data: Buffer
      contentType: string
    }): Promise<{ path: string; fullPath?: string }>
    createSignedReadUrl?(path: string, expiresInSeconds?: number): Promise<string>
  }
  /** URL para redirecionamento de pagamento */
  paymentUrl?: string
}

interface AvatarProfileUpdatePayload {
  kind: 'avatar_profile_update'
  agentId?: string
  status: AvatarProfileStatus
  currentPhase: number | null
  completedPhases: number[]
  phaseUpdate?: {
    phase: number
    title?: string
    summary: string
    extractedSignals: string[]
    rawAnswers: string[]
  }
  profileSummary: AvatarProfileSummary
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

const CONVERSATION_IMAGE_ANALYSIS_LIMIT = 30
const PROFILE_IMAGE_ANALYSIS_LIMIT = 5
const CHAT_IMAGE_GENERATION_RESOURCE_TYPE = 'chat_image_generation'
const CHAT_IMAGE_GENERATION_MONTHLY_LIMIT = 10
const CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS: ImageGenerationOptions = {
  style: 'vivid',
  quality: 'standard',
  size: '1024x1024',
}
const CHAT_IMAGE_GENERATION_ASSISTANT_COPY = 'Aqui está a imagem que criei para você.'
const PROFILE_IMAGE_ANALYSIS_AGENT_IDS = new Set<AgentId>(['instagram-analyzer'])

type ImageAnalysisQuotaScope = 'conversation' | 'profile'
type ChatImageGenerationDecision = 'reply' | 'generate_image'

interface ChatImageGenerationIntent {
  decision: ChatImageGenerationDecision
  confidence: 'low' | 'medium' | 'high'
  prompt?: string
  style?: 'vivid' | 'natural'
  quality?: 'standard' | 'hd'
}

function getGeneratedImageExtension(mediaType: string): string {
  switch (mediaType) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/webp':
      return '.webp'
    case 'image/png':
    default:
      return '.png'
  }
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
      userContextOverride?: UserContext
    } = {},
  ): Promise<string> {
    // Busca/cria conversa e contexto do usuário
    const conversation = options.conversationOverride
      ? options.conversationOverride
      : this.deps.conversationRepo
        ? await this.deps.conversationRepo.getOrCreateActive(user.id, message.channelType)
        : null

    const userContext =
      options.userContextOverride ?? (await this.buildUserContext(user, conversation))

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

    const conversationAgentId = this.getConversationAgentId(conversation)

    // Seleciona prompt e monta contexto
    const systemPrompt = [
      this.selectSystemPrompt(userContext, history, hasImage && canAnalyzeImage, conversation),
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

    // Preserva o fluxo legado só para conversas sem agente especializado.
    const contentBeforeStateExtraction = conversationAgentId
      ? result.content
      : await this.processDiagnosisIfComplete(user, result.content, history)
    const {
      content: finalContent,
      profileUpdate,
    } = this.extractAvatarProfileUpdate(contentBeforeStateExtraction)

    if (conversationAgentId === 'diagnostic' && profileUpdate) {
      await this.persistStructuredAvatarState(user.id, conversation?.id, profileUpdate)
    }

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

  private deriveConversationSummaryFromUserMessage(content: string): string | undefined {
    const normalized = content.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      return undefined
    }

    const lowerCased = normalized.toLowerCase()
    const genericFallbacks = new Set([
      'analise esta imagem.',
      'analise esta imagem',
      'transcreva e analise este áudio.',
      'transcreva e analise este áudio',
      'transcreva e analise este audio.',
      'transcreva e analise este audio',
      'analise os arquivos anexados e use-os como contexto para responder.',
      'analise os arquivos anexados e use-os como contexto para responder',
    ])

    if (genericFallbacks.has(lowerCased)) {
      return undefined
    }

    const firstSentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized
    const preview = firstSentence || normalized

    return preview.length > 80 ? `${preview.slice(0, 80).trim()}...` : preview
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
        ? (message.content.caption?.trim() ?? '')
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

    const currentConversation = await this.deps.conversationRepo.findById(conversationId)
    if (!currentConversation?.summary) {
      const nextSummary = this.deriveConversationSummaryFromUserMessage(storedContent)
      if (nextSummary) {
        await this.deps.conversationRepo.updateSummary(conversationId, nextSummary)
      }
    }
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

  private async saveAIImageResponse(
    conversationId: string | undefined,
    params: {
      content: string
      imageStoragePath: string
      imageMimeType: string
      prompt: string
      provider: string
      style: 'vivid' | 'natural'
      quality: 'standard' | 'hd'
      revisedPrompt?: string
    },
  ): Promise<void> {
    if (!conversationId || !this.deps.conversationRepo) return

    await this.deps.conversationRepo.addMessage({
      conversationId,
      role: 'assistant',
      content: params.content,
      contentType: 'image',
      metadata: {
        imageStoragePath: params.imageStoragePath,
        imageMimeType: params.imageMimeType,
        imagePrompt: params.prompt,
        imageProvider: params.provider,
        imageStyle: params.style,
        imageQuality: params.quality,
        revisedPrompt: params.revisedPrompt,
      },
    })
  }

  private shouldAttemptAppChatImageGeneration(params: {
    content: string
    hasImage: boolean
    hasAudio: boolean
    attachmentIds?: string[]
    conversationId: string
  }): boolean {
    return (
      params.content.length > 0 &&
      !params.hasImage &&
      !params.hasAudio &&
      (!params.attachmentIds || params.attachmentIds.length === 0) &&
      Boolean(this.deps.imageService) &&
      Boolean(this.deps.inlineImageStorage?.uploadBuffer) &&
      Boolean(this.deps.inlineImageStorage?.createSignedReadUrl) &&
      Boolean(this.deps.conversationRepo) &&
      Boolean(params.conversationId)
    )
  }

  private async classifyChatImageGenerationIntent(params: {
    conversation: Conversation
    messageText: string
  }): Promise<ChatImageGenerationIntent> {
    const recentMessages = await this.deps.conversationRepo?.getRecentMessages(params.conversation.id, 6)
    const recentTranscript =
      recentMessages && recentMessages.length > 0
        ? recentMessages
            .map((message) => {
              const contentTypeLabel =
                message.contentType === 'image'
                  ? '[imagem] '
                  : message.contentType === 'audio'
                    ? '[audio] '
                    : ''
              return `${message.role === 'user' ? 'Usuário' : 'Assistente'}: ${contentTypeLabel}${message.content}`
            })
            .join('\n')
        : 'Sem histórico recente relevante.'

    const summary = params.conversation.summary?.trim()
    const result = await this.deps.aiProvider.complete(
      [
        {
          role: 'system',
          content: [
            'Você é um classificador determinístico para um chat de relacionamentos.',
            'Sua tarefa é decidir se a mensagem atual pede criação de UMA imagem nova a partir de texto.',
            'Use "generate_image" apenas quando o usuário quer que você crie uma imagem original.',
            'Use "reply" para aconselhamento, conversa normal, dúvidas, análise de relacionamento, edição/análise de imagem existente, ou pedidos ambíguos.',
            'Se a confiança não for suficiente, responda "reply". Seja conservador.',
            'Se o pedido mencionar múltiplas variações, normalize para uma única imagem representativa.',
            'Se decidir "generate_image", devolva um prompt visual claro em português.',
            'Responda apenas JSON válido, sem markdown, com o formato:',
            '{"decision":"reply"|"generate_image","confidence":"low"|"medium"|"high","prompt":"string opcional","style":"vivid"|"natural","quality":"standard"|"hd"}',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            summary ? `Resumo da conversa:\n${summary}` : undefined,
            `Histórico recente:\n${recentTranscript}`,
            `Mensagem atual do usuário:\n${params.messageText}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      {
        maxTokens: 250,
        temperature: 0,
      },
    )

    return this.parseChatImageGenerationIntent(result.content)
  }

  private parseChatImageGenerationIntent(rawContent: string): ChatImageGenerationIntent {
    const trimmed = rawContent.trim()
    const jsonCandidate = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed

    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>
      const decision =
        parsed.decision === 'generate_image' ? 'generate_image' : 'reply'
      const confidence =
        parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
          ? parsed.confidence
          : 'low'
      const prompt =
        typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0
          ? parsed.prompt.trim()
          : undefined
      const style = parsed.style === 'natural' ? 'natural' : 'vivid'
      const quality = parsed.quality === 'hd' ? 'hd' : 'standard'

      return {
        decision: prompt || decision === 'reply' ? decision : 'reply',
        confidence,
        prompt,
        style,
        quality,
      }
    } catch (error) {
      this.deps.logger.warn({ error, rawContent }, 'Failed to parse chat image generation intent')
      return {
        decision: 'reply',
        confidence: 'low',
      }
    }
  }

  private async loadChatImageGenerationQuota(userId: string) {
    return loadMonthlyQuota({
      userId,
      resourceType: CHAT_IMAGE_GENERATION_RESOURCE_TYPE,
      limit: CHAT_IMAGE_GENERATION_MONTHLY_LIMIT,
      usageCounterRepo: this.deps.usageCounterRepo,
      logger: this.deps.logger,
      unavailableWarningMessage:
        'usage_counters table is unavailable, falling back to stateless chat image quota',
    })
  }

  private async incrementChatImageGenerationQuota(userId: string) {
    return incrementMonthlyQuota({
      userId,
      resourceType: CHAT_IMAGE_GENERATION_RESOURCE_TYPE,
      usageCounterRepo: this.deps.usageCounterRepo,
      logger: this.deps.logger,
      unavailableWarningMessage:
        'usage_counters table is unavailable, skipping chat image quota persistence',
    })
  }

  private async persistGeneratedConversationImage(params: {
    conversationId: string
    userId: string
    base64?: string
    sourceUrl?: string
    mimeType?: string
  }): Promise<{ storagePath: string; mimeType: string; signedUrl?: string }> {
    const uploadBuffer = this.deps.inlineImageStorage?.uploadBuffer
    if (!uploadBuffer) {
      throw new Error('Inline image storage upload is not configured')
    }

    let contentType = params.mimeType?.trim().toLowerCase() || 'image/png'
    let buffer: Buffer

    if (params.base64) {
      buffer = Buffer.from(params.base64, 'base64')
    } else if (params.sourceUrl) {
      const response = await fetch(params.sourceUrl)
      if (!response.ok) {
        throw new Error(`Failed to download generated image: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      contentType = response.headers.get('content-type')?.trim().toLowerCase() || contentType
    } else {
      throw new Error('Generated image payload is empty')
    }

    const normalizedMimeType =
      contentType === 'image/jpeg' || contentType === 'image/webp' ? contentType : 'image/png'
    const storagePath = `users/${params.userId}/conversations/${params.conversationId}/generated-images/${randomUUID()}${getGeneratedImageExtension(normalizedMimeType)}`

    await uploadBuffer({
      path: storagePath,
      data: buffer,
      contentType: normalizedMimeType,
    })

    const signedUrl = this.deps.inlineImageStorage?.createSignedReadUrl
      ? await this.deps.inlineImageStorage.createSignedReadUrl(storagePath)
      : undefined

    return {
      storagePath,
      mimeType: normalizedMimeType,
      signedUrl,
    }
  }

  private async handleAppChatImageGeneration(params: {
    user: User
    conversation: Conversation
    message: IncomingMessage
    messageText: string
    attachmentIds?: string[]
  }): Promise<
    | {
        handled: false
      }
    | {
        handled: true
        content: string
        outgoingContent:
          | { type: 'text'; text: string }
          | { type: 'image'; url: string; caption?: string }
      }
  > {
    if (!this.shouldAttemptAppChatImageGeneration({
      content: params.messageText,
      hasImage: params.message.content.type === 'image',
      hasAudio: params.message.content.type === 'audio',
      attachmentIds: params.attachmentIds,
      conversationId: params.conversation.id,
    })) {
      return { handled: false }
    }

    const intent = await this.classifyChatImageGenerationIntent({
      conversation: params.conversation,
      messageText: params.messageText,
    })

    if (
      intent.decision !== 'generate_image' ||
      intent.confidence === 'low' ||
      !intent.prompt ||
      !this.deps.imageService
    ) {
      return { handled: false }
    }

    await this.saveUserMessage(params.conversation.id, params.message, params.messageText)

    this.deps.logger.info(
      {
        userId: params.user.id,
        conversationId: params.conversation.id,
        prompt: intent.prompt,
        style: intent.style ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.style,
        quality: intent.quality ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.quality,
      },
      'chat_image_generation_detected',
    )

    const quota = await this.loadChatImageGenerationQuota(params.user.id)
    if (quota && !quota.available) {
      const blockedMessage =
        'Você já usou suas 10 gerações de imagem no chat neste mês. Se quiser, me peça outra estratégia em texto ou volte no próximo ciclo.'

      await this.saveAIResponse(params.conversation.id, {
        content: blockedMessage,
        usage: { inputTokens: 0, outputTokens: 0 },
      })

      this.deps.logger.info(
        {
          userId: params.user.id,
          conversationId: params.conversation.id,
          used: quota.used,
          limit: quota.limit,
        },
        'chat_image_generation_quota_blocked',
      )

      return {
        handled: true,
        content: blockedMessage,
        outgoingContent: { type: 'text', text: blockedMessage },
      }
    }

    const options: ImageGenerationOptions = {
      ...CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS,
      style: intent.style ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.style,
      quality: intent.quality ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.quality,
    }

    try {
      const generated = await this.deps.imageService.generate(params.user.id, intent.prompt, options)
      const storedImage = await this.persistGeneratedConversationImage({
        conversationId: params.conversation.id,
        userId: params.user.id,
        base64: generated.image.base64,
        sourceUrl: generated.image.url,
        mimeType: generated.image.mimeType,
      })

      await this.saveAIImageResponse(params.conversation.id, {
        content: CHAT_IMAGE_GENERATION_ASSISTANT_COPY,
        imageStoragePath: storedImage.storagePath,
        imageMimeType: storedImage.mimeType,
        prompt: intent.prompt,
        provider: generated.provider,
        style: options.style ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.style!,
        quality: options.quality ?? CHAT_IMAGE_GENERATION_DEFAULT_OPTIONS.quality!,
        revisedPrompt: generated.image.revisedPrompt,
      })
      await this.incrementChatImageGenerationQuota(params.user.id)

      this.deps.logger.info(
        {
          userId: params.user.id,
          conversationId: params.conversation.id,
          provider: generated.provider,
        },
        'chat_image_generation_executed',
      )

      return {
        handled: true,
        content: CHAT_IMAGE_GENERATION_ASSISTANT_COPY,
        outgoingContent: {
          type: 'image',
          url: storedImage.signedUrl ?? generated.image.url ?? '',
          caption: CHAT_IMAGE_GENERATION_ASSISTANT_COPY,
        },
      }
    } catch (error) {
      const failureMessage =
        'Não consegui gerar essa imagem agora. Se quiser, reformule a cena com mais detalhes ou tente de novo em instantes.'

      await this.saveAIResponse(params.conversation.id, {
        content: failureMessage,
        usage: { inputTokens: 0, outputTokens: 0 },
      })

      this.deps.logger.error(
        {
          error,
          userId: params.user.id,
          conversationId: params.conversation.id,
        },
        'chat_image_generation_failed',
      )

      return {
        handled: true,
        content: failureMessage,
        outgoingContent: { type: 'text', text: failureMessage },
      }
    }
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

  private async buildUserContext(
    user: User,
    conversation: Conversation | null = null,
  ): Promise<UserContext> {
    const activeImageQuota = this.resolveImageAnalysisQuota(conversation)
    const context: UserContext = {
      userId: user.id,
      diagnosisCompleted: false,
      currentDayInJourney: 0,
      hasStructuredDiagnosis: false,
      structuredDiagnosisStatus: 'not_started',
      structuredDiagnosisCurrentPhase: null,
      imageAnalysisQuotaKey: activeImageQuota.scope,
      imageAnalysisQuotaLabel: activeImageQuota.label,
      imageAnalysisLimit: activeImageQuota.limit,
      conversationImageAnalysisLimit: CONVERSATION_IMAGE_ANALYSIS_LIMIT,
      profileImageAnalysisLimit: PROFILE_IMAGE_ANALYSIS_LIMIT,
      subscriptionOfferUrl: this.deps.paymentUrl,
    }

    const avatarProfile = this.deps.avatarProfileRepo
      ? await this.deps.avatarProfileRepo.getByUserId(user.id)
      : null

    if (avatarProfile) {
      context.hasStructuredDiagnosis = avatarProfile.status === 'completed'
      context.structuredDiagnosisStatus = avatarProfile.status
      context.structuredDiagnosisCurrentPhase = avatarProfile.currentPhase
      context.avatarProfileContext = this.formatAvatarProfileContext(avatarProfile)
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

    const [conversationImageAnalysisUsedThisMonth, profileImageAnalysisUsedThisMonth] =
      await Promise.all([
        this.countImageAnalysisThisMonth(user.id, 'conversation'),
        this.countImageAnalysisThisMonth(user.id, 'profile'),
      ])

    context.conversationImageAnalysisUsedThisMonth = conversationImageAnalysisUsedThisMonth
    context.conversationImageAnalysisRemainingThisMonth = Math.max(
      CONVERSATION_IMAGE_ANALYSIS_LIMIT - conversationImageAnalysisUsedThisMonth,
      0,
    )
    context.profileImageAnalysisUsedThisMonth = profileImageAnalysisUsedThisMonth
    context.profileImageAnalysisRemainingThisMonth = Math.max(
      PROFILE_IMAGE_ANALYSIS_LIMIT - profileImageAnalysisUsedThisMonth,
      0,
    )

    context.imageAnalysisUsedThisMonth =
      activeImageQuota.scope === 'profile'
        ? profileImageAnalysisUsedThisMonth
        : conversationImageAnalysisUsedThisMonth
    context.imageAnalysisRemainingThisMonth =
      activeImageQuota.scope === 'profile'
        ? context.profileImageAnalysisRemainingThisMonth
        : context.conversationImageAnalysisRemainingThisMonth

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
  private async countImageAnalysisThisMonth(
    userId: string,
    scope: ImageAnalysisQuotaScope,
  ): Promise<number> {
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
        conversationAgentIds:
          scope === 'profile' ? [...PROFILE_IMAGE_ANALYSIS_AGENT_IDS] : undefined,
        excludeConversationAgentIds:
          scope === 'conversation' ? [...PROFILE_IMAGE_ANALYSIS_AGENT_IDS] : undefined,
      })
    } catch {
      return 0
    }
  }

  private resolveImageAnalysisQuota(
    conversation: Conversation | null,
  ): { scope: ImageAnalysisQuotaScope; label: string; limit: number } {
    const agentId = this.getConversationAgentId(conversation)

    if (agentId && PROFILE_IMAGE_ANALYSIS_AGENT_IDS.has(agentId)) {
      return {
        scope: 'profile',
        label: 'perfil/Instagram',
        limit: PROFILE_IMAGE_ANALYSIS_LIMIT,
      }
    }

    return {
      scope: 'conversation',
      label: 'prints/conversas',
      limit: CONVERSATION_IMAGE_ANALYSIS_LIMIT,
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

  private getConversationAgentId(conversation: Conversation | null): AgentId | undefined {
    const candidate = conversation?.metadata?.agentId
    return isAgentId(candidate) ? candidate : undefined
  }

  private extractAvatarProfileUpdate(content: string): {
    content: string
    profileUpdate: AvatarProfileUpdatePayload | null
  } {
    // Padrão principal: tag de abertura e fechamento corretas
    const pattern = /\[\[PERPETUO_STATE\]\]([\s\S]*?)\[\[\/PERPETUO_STATE\]\]/
    const match = pattern.exec(content)
    let cleanedContent = content.replace(pattern, '').trim()

    // Padrão de fallback: captura casos mal formatados (sem tag de fechamento)
    // Remove qualquer coisa que comece com [[PERPETUO_STATE]] até o fim da linha ou próximo parágrafo
    const fallbackPattern = /\[\[PERPETUO_STATE\]\][\s\S]*?(?=\n\n|$)/g
    cleanedContent = cleanedContent.replace(fallbackPattern, '').trim()

    if (!match?.[1]) {
      return {
        content: cleanedContent,
        profileUpdate: null,
      }
    }

    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>
      const status = parsed.status

      if (
        parsed.kind !== 'avatar_profile_update' ||
        (status !== 'not_started' && status !== 'in_progress' && status !== 'completed')
      ) {
        return { content: cleanedContent, profileUpdate: null }
      }

      const completedPhases = Array.isArray(parsed.completedPhases)
        ? [...new Set(parsed.completedPhases.filter((value): value is number => typeof value === 'number'))]
            .filter((value) => value >= 1 && value <= 7)
            .sort((left, right) => left - right)
        : []

      const currentPhase =
        typeof parsed.currentPhase === 'number' && parsed.currentPhase >= 1 && parsed.currentPhase <= 7
          ? parsed.currentPhase
          : null

      const phaseUpdateValue = parsed.phaseUpdate
      const phaseUpdateRecord =
        phaseUpdateValue &&
        typeof phaseUpdateValue === 'object' &&
        !Array.isArray(phaseUpdateValue)
          ? (phaseUpdateValue as Record<string, unknown>)
          : null
      const phaseUpdate =
        phaseUpdateRecord && typeof phaseUpdateRecord.phase === 'number'
          ? {
              phase: phaseUpdateRecord.phase,
              title: typeof phaseUpdateRecord.title === 'string' ? phaseUpdateRecord.title : undefined,
              summary: typeof phaseUpdateRecord.summary === 'string' ? phaseUpdateRecord.summary : '',
              extractedSignals: this.coerceStringArray(phaseUpdateRecord.extractedSignals),
              rawAnswers: this.coerceStringArray(phaseUpdateRecord.rawAnswers),
            }
          : undefined

      return {
        content: cleanedContent,
        profileUpdate: {
          kind: 'avatar_profile_update',
          agentId: typeof parsed.agentId === 'string' ? parsed.agentId : undefined,
          status,
          currentPhase,
          completedPhases,
          phaseUpdate,
          profileSummary: this.normalizeAvatarProfileSummary(parsed.profileSummary),
        },
      }
    } catch (error) {
      this.deps.logger.warn({ error }, 'Failed to parse structured avatar state block')
      return { content: cleanedContent, profileUpdate: null }
    }
  }

  private async persistStructuredAvatarState(
    userId: string,
    conversationId: string | undefined,
    payload: AvatarProfileUpdatePayload,
  ): Promise<void> {
    if (!this.deps.avatarProfileRepo) {
      return
    }

    try {
      const currentProfile = await this.deps.avatarProfileRepo.getByUserId(userId)
      await this.deps.avatarProfileRepo.upsert(
        this.applyAvatarProfileUpdate(userId, currentProfile, payload, conversationId),
      )
    } catch (error) {
      this.deps.logger.warn(
        { error, userId, conversationId },
        'Failed to persist structured avatar profile update',
      )
    }
  }

  private applyAvatarProfileUpdate(
    userId: string,
    currentProfile: AvatarProfile | null,
    payload: AvatarProfileUpdatePayload,
    conversationId: string | undefined,
  ): {
    status: AvatarProfileStatus
    currentPhase: number | null
    completedPhases: number[]
    phaseData: Record<string, AvatarPhaseSnapshot>
    profileSummary: AvatarProfileSummary
    sourceConversationId?: string | null
    userId: string
  } {
    const existingSummary = currentProfile?.profileSummary ?? createEmptyAvatarProfileSummary()
    const phaseData = { ...(currentProfile?.phaseData ?? {}) }
    const nextCompletedPhases = [
      ...new Set([...(currentProfile?.completedPhases ?? []), ...payload.completedPhases]),
    ].sort((left, right) => left - right)

    if (payload.phaseUpdate) {
      phaseData[`phase${payload.phaseUpdate.phase}`] = {
        title: payload.phaseUpdate.title,
        summary: payload.phaseUpdate.summary,
        extractedSignals: payload.phaseUpdate.extractedSignals,
        rawAnswers: payload.phaseUpdate.rawAnswers,
        updatedAt: new Date().toISOString(),
      }
    }

    return {
      userId,
      status: payload.status,
      currentPhase: payload.currentPhase,
      completedPhases: nextCompletedPhases,
      phaseData,
      profileSummary: this.mergeAvatarProfileSummary(existingSummary, payload.profileSummary),
      sourceConversationId: conversationId ?? currentProfile?.sourceConversationId ?? null,
    }
  }

  private normalizeAvatarProfileSummary(value: unknown): AvatarProfileSummary {
    const emptySummary = createEmptyAvatarProfileSummary()
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return emptySummary
    }

    const record = value as Record<string, unknown>
    const identityValue = record.identity
    const identity =
      identityValue && typeof identityValue === 'object' && !Array.isArray(identityValue)
        ? (identityValue as Record<string, unknown>)
        : {}

    return {
      identity: {
        selfImage: typeof identity.selfImage === 'string' ? identity.selfImage : '',
        idealSelf: typeof identity.idealSelf === 'string' ? identity.idealSelf : '',
        mainConflict: typeof identity.mainConflict === 'string' ? identity.mainConflict : '',
      },
      socialRomanticPatterns: this.coerceStringArray(record.socialRomanticPatterns),
      strengths: this.coerceStringArray(record.strengths),
      blockers: this.coerceStringArray(record.blockers),
      values: this.coerceStringArray(record.values),
      goals90d: this.coerceStringArray(record.goals90d),
      executionRisks: this.coerceStringArray(record.executionRisks),
      recommendedNextFocus:
        typeof record.recommendedNextFocus === 'string' ? record.recommendedNextFocus : '',
    }
  }

  private mergeAvatarProfileSummary(
    current: AvatarProfileSummary,
    incoming: AvatarProfileSummary,
  ): AvatarProfileSummary {
    const pickString = (baseValue: string, nextValue: string) =>
      nextValue.trim().length > 0 ? nextValue.trim() : baseValue
    const pickArray = (baseValue: string[], nextValue: string[]) =>
      nextValue.length > 0 ? [...new Set(nextValue.map((item) => item.trim()).filter(Boolean))] : baseValue

    return {
      identity: {
        selfImage: pickString(current.identity.selfImage, incoming.identity.selfImage),
        idealSelf: pickString(current.identity.idealSelf, incoming.identity.idealSelf),
        mainConflict: pickString(current.identity.mainConflict, incoming.identity.mainConflict),
      },
      socialRomanticPatterns: pickArray(current.socialRomanticPatterns, incoming.socialRomanticPatterns),
      strengths: pickArray(current.strengths, incoming.strengths),
      blockers: pickArray(current.blockers, incoming.blockers),
      values: pickArray(current.values, incoming.values),
      goals90d: pickArray(current.goals90d, incoming.goals90d),
      executionRisks: pickArray(current.executionRisks, incoming.executionRisks),
      recommendedNextFocus: pickString(current.recommendedNextFocus, incoming.recommendedNextFocus),
    }
  }

  private formatAvatarProfileContext(profile: AvatarProfile): string {
    const lines: string[] = [
      `Status: ${profile.status}`,
      `Fase atual: ${profile.currentPhase ?? 'nenhuma'}`,
      `Fases concluídas: ${profile.completedPhases.length > 0 ? profile.completedPhases.join(', ') : 'nenhuma'}`,
    ]

    if (profile.profileSummary.identity.selfImage) {
      lines.push(`Autoimagem: ${profile.profileSummary.identity.selfImage}`)
    }
    if (profile.profileSummary.identity.idealSelf) {
      lines.push(`Eu ideal: ${profile.profileSummary.identity.idealSelf}`)
    }
    if (profile.profileSummary.identity.mainConflict) {
      lines.push(`Conflito central: ${profile.profileSummary.identity.mainConflict}`)
    }
    if (profile.profileSummary.strengths.length > 0) {
      lines.push(`Forças: ${profile.profileSummary.strengths.join('; ')}`)
    }
    if (profile.profileSummary.blockers.length > 0) {
      lines.push(`Bloqueios: ${profile.profileSummary.blockers.join('; ')}`)
    }
    if (profile.profileSummary.values.length > 0) {
      lines.push(`Valores: ${profile.profileSummary.values.join('; ')}`)
    }
    if (profile.profileSummary.goals90d.length > 0) {
      lines.push(`Metas 90d: ${profile.profileSummary.goals90d.join('; ')}`)
    }
    if (profile.profileSummary.socialRomanticPatterns.length > 0) {
      lines.push(`Padrões sociais/românticos: ${profile.profileSummary.socialRomanticPatterns.join('; ')}`)
    }
    if (profile.profileSummary.executionRisks.length > 0) {
      lines.push(`Riscos de execução: ${profile.profileSummary.executionRisks.join('; ')}`)
    }
    if (profile.profileSummary.recommendedNextFocus) {
      lines.push(`Próximo foco recomendado: ${profile.profileSummary.recommendedNextFocus}`)
    }

    const phaseEntries = Object.entries(profile.phaseData).sort(([left], [right]) =>
      left.localeCompare(right, 'pt-BR', { numeric: true }),
    )
    if (phaseEntries.length > 0) {
      lines.push('Resumo por fase:')
      for (const [phaseKey, snapshot] of phaseEntries) {
        lines.push(`- ${snapshot.title ?? phaseKey}: ${snapshot.summary}`)
      }
    }

    return lines.join('\n')
  }

  private coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
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
    conversation: Conversation | null = null,
  ): string {
    let basePrompt: string
    const agentId = this.getConversationAgentId(conversation)

    if (agentId) {
      basePrompt = getAgentSystemPrompt(agentId)
    }
    // Conversa genérica com memória estruturada já existente.
    else if (context.structuredDiagnosisStatus && context.structuredDiagnosisStatus !== 'not_started') {
      basePrompt = ISABELA_RETURNING
    }
    // Primeiro contato
    else if (history.messages.length === 0) {
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

      const userContext = await this.buildUserContext(user, conversation)
      const conversationAgentId = this.getConversationAgentId(conversation)

      if (
        conversationAgentId &&
        agentRequiresStructuredDiagnosis(conversationAgentId) &&
        userContext.hasStructuredDiagnosis !== true
      ) {
        return { success: false, error: 'diagnosis_required' }
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

      const imageGenerationResult = conversation
        ? await this.handleAppChatImageGeneration({
            user,
            conversation,
            message,
            messageText: normalizedContent,
            attachmentIds: params.attachmentIds,
          })
        : { handled: false as const }

      if (imageGenerationResult.handled) {
        userMessageSaved = true

        const sendResult = await this.deps.channel.sendMessage({
          recipientId: userId,
          content: imageGenerationResult.outgoingContent,
        })

        this.deps.logger.info(
          {
            userId: user.id,
            conversationId,
            responseMessageId: sendResult.messageId,
            elapsed: Date.now() - startedAt.getTime(),
          },
          'App response sent',
        )

        return { success: true, responseMessageId: sendResult.messageId }
      }

      // Processa com IA (reutiliza toda a lógica existente)
      const response = await this.processWithAI(message, user, {
        conversationOverride: conversation,
        attachmentIds: params.attachmentIds,
        contentProvided: Boolean((params.image ? imageCaption : params.audio ? audioCaption : content)?.length),
        onUserMessageSaved: () => {
          userMessageSaved = true
        },
        userContextOverride: userContext,
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
