import type { ChatMessage, ContentBlock } from '@perpetuo/core'

export interface UserContext {
  userId: string
  archetype?: string // Após diagnóstico: 'provedor' | 'aventureiro' | 'romantico' | 'racional'
  diagnosisCompleted: boolean
  currentDayInJourney: number // Dia na jornada de 30 dias
}

export interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
  summary?: string // Resumo comprimido de conversas antigas
}

export interface ContextBuilderOptions {
  maxHistoryMessages?: number
  includeTimestamps?: boolean
}

/**
 * ContextBuilder - Monta o contexto para chamadas de IA
 *
 * Responsabilidades:
 * - Selecionar system prompt baseado no estado do usuário
 * - Incluir histórico relevante
 * - Comprimir contexto quando necessário
 * - Adicionar metadata útil
 */
export class ContextBuilder {
  private readonly maxHistoryMessages: number
  private readonly includeTimestamps: boolean

  constructor(options: ContextBuilderOptions = {}) {
    this.maxHistoryMessages = options.maxHistoryMessages ?? 20
    this.includeTimestamps = options.includeTimestamps ?? false
  }

  /**
   * Monta mensagens completas para enviar à IA
   */
  build(params: {
    systemPrompt: string
    userContext: UserContext
    history: ConversationHistory
    currentMessage: string | ContentBlock[]
  }): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 1. System prompt com contexto do usuário
    const enrichedSystemPrompt = this.enrichSystemPrompt(params.systemPrompt, params.userContext)
    messages.push({
      role: 'system',
      content: enrichedSystemPrompt,
    })

    // 2. Resumo de conversas antigas (se existir)
    if (params.history.summary) {
      messages.push({
        role: 'user',
        content: `[Contexto anterior resumido: ${params.history.summary}]`,
      })
      messages.push({
        role: 'assistant',
        content: 'Entendi o contexto. Vou continuar de onde paramos.',
      })
    }

    // 3. Histórico recente
    const recentHistory = params.history.messages.slice(-this.maxHistoryMessages)
    for (const msg of recentHistory) {
      const content = this.includeTimestamps
        ? `[${msg.timestamp.toISOString()}] ${msg.content}`
        : msg.content

      messages.push({
        role: msg.role,
        content,
      })
    }

    // 4. Mensagem atual
    messages.push({
      role: 'user',
      content: params.currentMessage,
    })

    return messages
  }

  /**
   * Enriquece system prompt com informações do usuário
   */
  private enrichSystemPrompt(basePrompt: string, context: UserContext): string {
    const contextLines: string[] = []

    if (context.archetype) {
      contextLines.push(`Arquétipo do usuário: ${context.archetype}`)
      contextLines.push(`Dia na jornada: ${context.currentDayInJourney}/30`)
    } else if (!context.diagnosisCompleted) {
      contextLines.push('Status: Usuário ainda não completou o diagnóstico inicial')
    }

    if (contextLines.length === 0) {
      return basePrompt
    }

    return `${basePrompt}

---
CONTEXTO DO USUÁRIO:
${contextLines.join('\n')}
---`
  }

  /**
   * Estima tokens de uma mensagem (aproximação simples)
   * ~4 caracteres por token em português
   */
  estimateTokens(messages: ChatMessage[]): number {
    let totalChars = 0
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
      } else {
        for (const block of msg.content) {
          if (block.type === 'text') {
            totalChars += block.text.length
          }
          if (block.type === 'image') {
            // Imagens custam ~1000 tokens
            totalChars += 4000
          }
        }
      }
    }
    return Math.ceil(totalChars / 4)
  }
}
