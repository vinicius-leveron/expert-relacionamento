import type { ChannelPort, IncomingMessage, User, UserRepository } from '@perpetuo/core'
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
 * MessagePipeline - Orquestra o processamento de mensagens
 *
 * Fluxo: receive -> resolve identity -> (futuro: route -> process -> respond)
 */
export class MessagePipeline {
  private readonly identityResolver: IdentityResolver

  constructor(
    private readonly channel: ChannelPort,
    userRepo: UserRepository,
    private readonly logger: Logger,
  ) {
    this.identityResolver = new IdentityResolver(userRepo)
  }

  async process(rawPayload: unknown, signature: string): Promise<PipelineResult> {
    const startedAt = new Date()

    // 1. Valida webhook
    if (!this.channel.validateWebhook(rawPayload, signature)) {
      this.logger.warn('Invalid webhook signature')
      return { success: false, error: 'invalid_signature' }
    }

    // 2. Parseia mensagem
    const message = this.channel.parseWebhook(rawPayload)
    if (!message) {
      this.logger.debug('Webhook without message (status update, etc)')
      return { success: true } // Webhook válido mas sem mensagem para processar
    }

    // 3. Resolve identidade (ADR 0011)
    // IMPORTANTE: A partir daqui, só usamos user.id, nunca phone_e164
    const user = await this.identityResolver.resolve({
      type: 'phone',
      value: message.senderId,
    })

    this.logger.info(
      {
        userId: user.id, // UUID, não PII
        messageType: message.content.type,
        elapsed: Date.now() - startedAt.getTime(),
      },
      'Message received',
    )

    const _context: PipelineContext = {
      message,
      user,
      startedAt,
    }

    // 4. Roteamento e processamento (FUTURO - Épico 1+)
    // TODO: Verificar assinatura ativa (middleware)
    // TODO: Rotear para handler correto (diagnóstico, análise, etc)
    // TODO: Processar com AI
    // TODO: Responder

    // Por enquanto, retorna sucesso (apenas log)
    return { success: true }
  }
}
