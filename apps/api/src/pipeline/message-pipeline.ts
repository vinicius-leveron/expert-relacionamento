import {
  ContextBuilder,
  type ConversationHistory,
  ISABELA_GREETING,
  ISABELA_RETURNING,
  type RAGService,
  type UserContext,
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
  rag?: RAGService // Opcional - se não tiver, não faz busca semântica
  transcriber?: TranscriptionService // Opcional - para áudio
}

/**
 * MessagePipeline - Orquestra o processamento de mensagens
 *
 * Fluxo:
 * 1. receive -> validate webhook
 * 2. resolve identity (phone -> user_id)
 * 3. extract content (text, image, audio -> transcribe)
 * 4. RAG search (busca conhecimento relevante)
 * 5. build context (system prompt + RAG + history)
 * 6. process with AI
 * 7. respond via channel
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
    const userContext = this.buildUserContext(user)
    const history = await this.getConversationHistory(user.id)

    // Extrai conteúdo da mensagem (texto, imagem, ou transcrição de áudio)
    const { text: messageText, contentBlocks } = await this.extractMessageContent(message)

    // Busca conhecimento relevante via RAG (se disponível)
    let ragContext: string | undefined
    if (this.deps.rag && messageText) {
      try {
        const chunks = await this.deps.rag.search(messageText, {
          matchThreshold: 0.7,
          matchCount: 3,
        })
        ragContext = this.deps.rag.formatForContext(chunks)
        this.deps.logger.debug({ chunksFound: chunks.length }, 'RAG search completed')
      } catch (error) {
        this.deps.logger.warn({ error }, 'RAG search failed, continuing without')
      }
    }

    // Seleciona prompt baseado no estado
    const systemPrompt = this.selectSystemPrompt(userContext, history)

    // Monta mensagens para a IA
    const currentMessage = contentBlocks ?? messageText
    const messages = this.contextBuilder.build({
      systemPrompt,
      userContext,
      history,
      currentMessage,
      ragContext,
    })

    // Chama a IA
    const result = await this.deps.aiProvider.complete(messages, {
      maxTokens: 500,
      temperature: 0.7,
    })

    return result.content
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
      // Se não tem dados base64, só retorna texto
      if (!message.content.data || !message.content.mediaType) {
        return { text: message.content.caption ?? '[Imagem recebida - dados não disponíveis]' }
      }

      // Para imagens com base64, retorna os blocos de conteúdo para análise multimodal
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
      // Transcreve áudio se tiver transcriber
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
    if (history.messages.length === 0) {
      return ISABELA_GREETING
    }

    if (!context.diagnosisCompleted) {
      return ISABELA_RETURNING
    }

    return ISABELA_RETURNING
  }
}
