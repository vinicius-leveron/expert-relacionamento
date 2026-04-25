import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProviderPort,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  ContentBlock,
} from '@perpetuo/core'

export interface AnthropicConfig {
  apiKey?: string
  model?: string
  maxTokens?: number
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 1024

/**
 * AnthropicAdapter - Implementação do AIProviderPort usando Claude
 */
export class AnthropicAdapter implements AIProviderPort {
  readonly providerName = 'anthropic'

  private readonly client: Anthropic
  private readonly model: string
  private readonly defaultMaxTokens: number

  constructor(config: AnthropicConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    })
    this.model = config.model ?? DEFAULT_MODEL
    this.defaultMaxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
  }

  async complete(
    messages: ChatMessage[],
    options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    // Separa system prompt das mensagens
    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')

    // Converte para formato Anthropic
    const anthropicMessages = chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: this.convertContent(m.content),
    }))

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? this.defaultMaxTokens,
      temperature: options.temperature,
      stop_sequences: options.stopSequences,
      system: systemMessage ? this.extractSystemText(systemMessage.content) : undefined,
      messages: anthropicMessages,
    })

    // Extrai texto da resposta
    const textContent = response.content.find((c) => c.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : ''

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      finishReason: this.mapStopReason(response.stop_reason),
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }

  private convertContent(
    content: string | ContentBlock[],
  ): string | Anthropic.MessageParam['content'] {
    if (typeof content === 'string') {
      return content
    }

    return content.map((block): Anthropic.TextBlockParam | Anthropic.ImageBlockParam => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text }
      }
      if (block.type === 'image') {
        // Anthropic SDK só suporta base64, não URL direta
        if (block.source.type !== 'base64') {
          throw new Error(
            'Anthropic SDK only supports base64 image sources. URL images must be fetched first.',
          )
        }
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: block.source.mediaType,
            data: block.source.data,
          },
        }
      }
      // Fallback para tipos desconhecidos
      return { type: 'text', text: '' }
    })
  }

  private extractSystemText(content: string | ContentBlock[]): string {
    if (typeof content === 'string') {
      return content
    }
    return content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
  }

  private mapStopReason(reason: string | null): 'end_turn' | 'max_tokens' | 'stop_sequence' {
    switch (reason) {
      case 'end_turn':
        return 'end_turn'
      case 'max_tokens':
        return 'max_tokens'
      case 'stop_sequence':
        return 'stop_sequence'
      default:
        return 'end_turn'
    }
  }
}
