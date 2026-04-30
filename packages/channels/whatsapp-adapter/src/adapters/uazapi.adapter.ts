import type {
  Button,
  ChannelPort,
  IncomingMessage,
  ListSection,
  OutgoingContent,
  OutgoingMessage,
} from '@perpetuo/core'

export interface UazapiAdapterConfig {
  subdomain: string
  instanceToken: string
  webhookSignature?: string
  fetch?: typeof fetch
}

type JsonRecord = Record<string, unknown>

export class UazapiAdapter implements ChannelPort {
  readonly channelType = 'whatsapp' as const

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly config: UazapiAdapterConfig) {
    this.baseUrl = normalizeBaseUrl(config.subdomain)
    this.fetchImpl = config.fetch ?? fetch
  }

  async sendMessage(message: OutgoingMessage): Promise<{ messageId: string }> {
    const response = await this.sendContent(message.recipientId, message.content)

    const messageId =
      getString(response, 'messageid') ??
      getString(response, 'messageId') ??
      getString(response, 'id') ??
      getNestedString(response, ['response', 'messageId']) ??
      getNestedString(response, ['response', 'id']) ??
      `uazapi-${Date.now()}`

    return { messageId }
  }

  validateWebhook(_payload: unknown, signature: string): boolean {
    if (!this.config.webhookSignature) {
      return true
    }

    return signature === this.config.webhookSignature
  }

  parseWebhook(payload: unknown): IncomingMessage | null {
    const envelope = asRecord(payload)
    if (!envelope) {
      return null
    }

    const eventName = getString(envelope, 'event') ?? getString(envelope, 'type') ?? ''
    const normalizedEvent = eventName.toLowerCase()

    if (
      normalizedEvent &&
      !normalizedEvent.includes('message') &&
      !normalizedEvent.includes('messages')
    ) {
      return null
    }

    const rawData = envelope.data ?? payload
    const data = Array.isArray(rawData) ? asRecord(rawData[0]) : asRecord(rawData)
    if (!data) {
      return null
    }

    const fromMe = getBoolean(data, 'fromMe') ?? false
    const sentByApi = getBoolean(data, 'wasSentByApi') ?? false
    if (fromMe || sentByApi) {
      return null
    }

    const externalId =
      getString(data, 'messageid') ??
      getString(data, 'id') ??
      getString(data, 'externalId') ??
      getNestedString(data, ['key', 'id'])

    const senderId = normalizeSenderId(
      getString(data, 'sender') ??
        getString(data, 'from') ??
        getString(data, 'author') ??
        getNestedString(data, ['key', 'remoteJid']),
    )

    if (!externalId || !senderId) {
      return null
    }

    const messageType = (
      getString(data, 'messageType') ??
      getString(data, 'type') ??
      inferMessageTypeFromContent(data) ??
      normalizedEvent
    ).toLowerCase()

    const text = extractText(data)
    const timestamp = coerceTimestamp(
      getNumber(data, 'messageTimestamp') ??
        getNumber(data, 'timestamp') ??
        getNumber(data, 'message_time'),
    )

    const fileUrl = getString(data, 'fileURL') ?? getString(data, 'fileUrl') ?? getString(data, 'url')
    const mimeType = getString(data, 'mimetype')

    return {
      externalId,
      channelType: 'whatsapp',
      senderId,
      timestamp,
      content: buildIncomingContent({
        messageType,
        text,
        fileUrl,
        mimeType,
        interactiveId: getString(data, 'buttonOrListid'),
      }),
      metadata: {
        event: eventName,
        instance: getString(envelope, 'instance'),
      },
    }
  }

  private async sendContent(recipientId: string, content: OutgoingContent): Promise<JsonRecord> {
    switch (content.type) {
      case 'text':
        return this.post('/send/text', {
          number: recipientId,
          text: content.text,
        })
      case 'image':
        return this.post('/send/media', {
          number: recipientId,
          type: 'image',
          file: content.url,
          text: content.caption,
        })
      case 'buttons':
        return this.post('/send/menu', {
          number: recipientId,
          type: 'button',
          text: content.text,
          choices: content.buttons.map(formatButtonChoice),
        })
      case 'list':
        return this.post('/send/menu', {
          number: recipientId,
          type: 'list',
          text: content.text,
          listButton: 'Ver opções',
          choices: formatListChoices(content.sections),
        })
      default:
        throw new Error(`Unsupported outgoing content type: ${(content as { type: string }).type}`)
    }
  }

  private async post(path: string, body: JsonRecord): Promise<JsonRecord> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        token: this.config.instanceToken,
      },
      body: JSON.stringify(body),
    })

    const responseBody = (await response.json().catch(() => ({}))) as JsonRecord
    if (!response.ok) {
      const error = getString(responseBody, 'error') ?? response.statusText
      throw new Error(`Uazapi request failed (${response.status}): ${error}`)
    }

    return responseBody
  }
}

function normalizeBaseUrl(subdomain: string): string {
  const trimmed = subdomain.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  if (trimmed.includes('.')) {
    return `https://${trimmed}`
  }

  return `https://${trimmed}.uazapi.com`
}

function formatButtonChoice(button: Button): string {
  return `${button.title}|${button.id}`
}

function formatListChoices(sections: ListSection[]): string[] {
  const choices: string[] = []

  for (const section of sections) {
    choices.push(`[${section.title}]`)
    for (const row of section.rows) {
      const parts = [row.title, row.id, row.description].filter(
        (value): value is string => value !== undefined && value.length > 0,
      )
      choices.push(parts.join('|'))
    }
  }

  return choices
}

function buildIncomingContent(params: {
  messageType: string
  text: string
  fileUrl?: string
  mimeType?: string
  interactiveId?: string
}): IncomingMessage['content'] {
  const { messageType, text, fileUrl, mimeType, interactiveId } = params
  const normalizedType = messageType.toLowerCase()

  if (interactiveId) {
    return {
      type: 'interactive',
      payload: {
        type: normalizedType.includes('list') ? 'list_reply' : 'button_reply',
        id: interactiveId,
        title: text || interactiveId,
      },
    }
  }

  if (
    normalizedType.includes('image') ||
    normalizedType.includes('photo') ||
    normalizedType.includes('sticker')
  ) {
    return {
      type: 'image',
      url: fileUrl,
      caption: text || undefined,
      mediaType: mimeType,
    }
  }

  if (
    normalizedType.includes('audio') ||
    normalizedType.includes('voice') ||
    normalizedType.includes('ptt') ||
    normalizedType.includes('myaudio')
  ) {
    return {
      type: 'audio',
      url: fileUrl ?? '',
    }
  }

  return {
    type: 'text',
    text,
  }
}

function inferMessageTypeFromContent(data: JsonRecord): string | null {
  const content = data.content
  if (typeof content === 'string') {
    return null
  }

  const contentRecord = asRecord(content)
  if (!contentRecord) {
    return null
  }

  return (
    getString(contentRecord, 'type') ??
    getString(contentRecord, 'mimetype') ??
    getNestedString(contentRecord, ['message', 'type'])
  ) ?? null
}

function extractText(data: JsonRecord): string {
  return (
    getString(data, 'text') ??
    getString(data, 'body') ??
    getNestedString(data, ['content', 'text']) ??
    getNestedString(data, ['content', 'body']) ??
    getNestedString(data, ['content', 'conversation']) ??
    ''
  )
}

function coerceTimestamp(value: number | undefined): Date {
  if (!value) {
    return new Date()
  }

  const timestampMs = value > 1_000_000_000_000 ? value : value * 1000
  return new Date(timestampMs)
}

function normalizeSenderId(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const [raw] = value.split('@')
  const normalized = raw.replace(/\D/g, '')
  return normalized.length > 0 ? normalized : raw
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null ? (value as JsonRecord) : null
}

function getString(record: JsonRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getNumber(record: JsonRecord, key: string): number | undefined {
  const value = record[key]
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function getBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function getNestedString(record: JsonRecord, path: string[]): string | undefined {
  let current: unknown = record

  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined
    }
    current = (current as JsonRecord)[key]
  }

  return typeof current === 'string' && current.length > 0 ? current : undefined
}
