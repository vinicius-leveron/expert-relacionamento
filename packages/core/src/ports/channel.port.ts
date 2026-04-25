/**
 * ChannelPort - Interface channel-agnostic (ADR 0008)
 * Implementações: WhatsAppAdapter (ADR 0001 pendente)
 */
export interface IncomingMessage {
  externalId: string // ID da mensagem no canal
  channelType: 'whatsapp' | 'web' | 'app'
  senderId: string // phone_e164 para WhatsApp
  timestamp: Date
  content: MessageContent
  metadata?: Record<string, unknown>
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'audio'; url: string }
  | { type: 'interactive'; payload: InteractivePayload }

export interface InteractivePayload {
  type: 'button_reply' | 'list_reply'
  id: string
  title: string
}

export interface OutgoingMessage {
  recipientId: string // phone_e164 para WhatsApp
  content: OutgoingContent
}

export type OutgoingContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'buttons'; text: string; buttons: Button[] }
  | { type: 'list'; text: string; sections: ListSection[] }

export interface Button {
  id: string
  title: string
}

export interface ListSection {
  title: string
  rows: { id: string; title: string; description?: string }[]
}

export interface ChannelPort {
  readonly channelType: 'whatsapp' | 'web' | 'app'

  /**
   * Envia mensagem para o canal
   */
  sendMessage(message: OutgoingMessage): Promise<{ messageId: string }>

  /**
   * Valida webhook signature
   */
  validateWebhook(payload: unknown, signature: string): boolean

  /**
   * Parseia webhook payload para IncomingMessage
   */
  parseWebhook(payload: unknown): IncomingMessage | null
}
