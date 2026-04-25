import type { ChannelPort, IncomingMessage, OutgoingMessage } from '@perpetuo/core'

/**
 * MockChannelAdapter - Adapter de teste para WhatsApp
 *
 * Usado até ADR 0001 (WhatsApp Gateway) ser fechada.
 * Simula comportamento básico de webhook e envio.
 */
export class MockChannelAdapter implements ChannelPort {
  readonly channelType = 'whatsapp' as const

  private readonly validSignature = 'mock-valid-signature'
  private readonly sentMessages: OutgoingMessage[] = []

  async sendMessage(message: OutgoingMessage): Promise<{ messageId: string }> {
    this.sentMessages.push(message)
    return { messageId: `mock-${Date.now()}` }
  }

  validateWebhook(_payload: unknown, signature: string): boolean {
    // Em produção, validaria HMAC SHA256
    // Para mock, aceita qualquer signature não vazia ou a signature de teste
    return signature === this.validSignature || signature.length > 0
  }

  parseWebhook(payload: unknown): IncomingMessage | null {
    // Tenta parsear como formato WhatsApp Cloud API
    const data = payload as Record<string, unknown>

    // Verifica se é um status update (não mensagem)
    if (data.statuses) {
      return null
    }

    // Formato simplificado de mock
    if (data.mock === true) {
      const mockData = data as {
        mock: true
        from: string
        text?: string
        type?: string
      }
      return {
        externalId: `mock-${Date.now()}`,
        channelType: 'whatsapp',
        senderId: mockData.from,
        timestamp: new Date(),
        content: { type: 'text', text: mockData.text ?? '' },
      }
    }

    // Formato WhatsApp Cloud API
    interface WhatsAppEntry {
      changes?: Array<{
        value?: {
          messages?: Array<{
            id: string
            from: string
            timestamp: string
            text?: { body: string }
            type: string
          }>
        }
      }>
    }
    const entries = data.entry as WhatsAppEntry[] | undefined
    const entry = entries?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return null
    }

    const msg = messages[0]
    return {
      externalId: msg.id,
      channelType: 'whatsapp',
      senderId: msg.from,
      timestamp: new Date(Number(msg.timestamp) * 1000),
      content: {
        type: 'text',
        text: msg.text?.body ?? '',
      },
    }
  }

  // Test helpers
  getSentMessages(): OutgoingMessage[] {
    return [...this.sentMessages]
  }

  clearSentMessages(): void {
    this.sentMessages.length = 0
  }

  getValidSignature(): string {
    return this.validSignature
  }
}
