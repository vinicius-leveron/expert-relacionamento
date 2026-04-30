import { randomUUID } from 'node:crypto'
import type { ChannelPort, IncomingMessage, OutgoingMessage } from '@perpetuo/core'

/**
 * MessageEmitter interface - permite o adapter emitir mensagens via SSE
 */
export interface MessageEmitter {
  emit(userId: string, message: EmittedMessage): void
}

export interface EmittedMessage {
  id: string
  type: 'assistant_message' | 'typing' | 'error'
  content: unknown
  timestamp: Date
}

/**
 * AppChannelAdapter - Adapter para o canal App (mobile/web)
 *
 * Diferenças do WhatsApp adapter:
 * - Não usa webhooks externos - mensagens vêm via REST API autenticada
 * - sendMessage emite via SSE em vez de chamar API externa
 * - Autenticação via JWT (já validado no middleware)
 */
export class AppChannelAdapter implements ChannelPort {
  readonly channelType = 'app' as const

  private messageEmitter?: MessageEmitter

  constructor(config?: { messageEmitter?: MessageEmitter }) {
    this.messageEmitter = config?.messageEmitter
  }

  /**
   * Define o emitter para mensagens SSE
   */
  setMessageEmitter(emitter: MessageEmitter): void {
    this.messageEmitter = emitter
  }

  /**
   * Envia mensagem para o usuário via SSE
   */
  async sendMessage(message: OutgoingMessage): Promise<{ messageId: string }> {
    const messageId = randomUUID()

    if (this.messageEmitter) {
      this.messageEmitter.emit(message.recipientId, {
        id: messageId,
        type: 'assistant_message',
        content: message.content,
        timestamp: new Date(),
      })
    }

    return { messageId }
  }

  /**
   * App não usa webhooks - autenticação via JWT
   */
  validateWebhook(_payload: unknown, _signature: string): boolean {
    // Validação feita via JWT no middleware
    return true
  }

  /**
   * App não usa webhooks - mensagens vêm via REST
   */
  parseWebhook(_payload: unknown): IncomingMessage | null {
    // Não usado - mensagens parseadas diretamente na rota REST
    return null
  }

  /**
   * Parseia mensagem do app (usado pela rota REST)
   */
  parseAppMessage(params: {
    userId: string
    conversationId?: string
    content:
      | string
      | {
          type: 'image'
          data: string
          mediaType: string
          caption?: string
        }
      | {
          type: 'audio'
          url: string
          duration?: number
        }
    timestamp?: Date
  }): IncomingMessage {
    const { userId, content, timestamp } = params

    return {
      externalId: randomUUID(),
      channelType: 'app',
      senderId: userId,
      timestamp: timestamp ?? new Date(),
      content:
        typeof content === 'string'
          ? { type: 'text', text: content }
          : content.type === 'image'
            ? {
                type: 'image',
                data: content.data,
                mediaType: content.mediaType,
                caption: content.caption,
              }
            : {
                type: 'audio',
                url: content.url,
                duration: content.duration,
              },
    }
  }

  /**
   * Emite evento de "digitando" para o usuário
   */
  emitTyping(userId: string): void {
    if (this.messageEmitter) {
      this.messageEmitter.emit(userId, {
        id: randomUUID(),
        type: 'typing',
        content: null,
        timestamp: new Date(),
      })
    }
  }

  /**
   * Emite erro para o usuário
   */
  emitError(userId: string, error: string): void {
    if (this.messageEmitter) {
      this.messageEmitter.emit(userId, {
        id: randomUUID(),
        type: 'error',
        content: { message: error },
        timestamp: new Date(),
      })
    }
  }
}
