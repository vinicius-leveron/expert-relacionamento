import type {
  AIProviderPort,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
} from '@perpetuo/core'

/**
 * MockAIAdapter - Para testes sem consumir API
 */
export class MockAIAdapter implements AIProviderPort {
  readonly providerName = 'mock'

  private responses: string[] = []
  private responseIndex = 0

  /**
   * Define respostas que serão retornadas em sequência
   */
  setResponses(responses: string[]): void {
    this.responses = responses
    this.responseIndex = 0
  }

  async complete(
    _messages: ChatMessage[],
    _options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    const content =
      this.responses[this.responseIndex] ?? 'Mock response: Olá! Como posso ajudar você hoje?'

    this.responseIndex = (this.responseIndex + 1) % Math.max(1, this.responses.length)

    return {
      content,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
      },
      finishReason: 'end_turn',
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}
