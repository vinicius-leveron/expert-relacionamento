/**
 * AIProviderPort - Interface para providers de IA (ADR 0009 pendente)
 * Implementações: ClaudeAdapter, OpenAIAdapter, GeminiAdapter
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentBlock[]
}

export type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: ImageSource }

export interface ImageSource {
  type: 'url' | 'base64'
  data: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  stopSequences?: string[]
}

export interface CompletionResult {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
  finishReason: 'end_turn' | 'max_tokens' | 'stop_sequence'
}

export interface AIProviderPort {
  readonly providerName: string

  /**
   * Executa completion
   */
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>

  /**
   * Verifica health do provider
   */
  healthCheck(): Promise<boolean>
}
