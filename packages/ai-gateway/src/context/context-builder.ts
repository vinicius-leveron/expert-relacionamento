import type { ChatMessage, ContentBlock } from '@perpetuo/core'

export interface UserContext {
  userId: string
  archetype?: string // Após diagnóstico: 'provedor' | 'aventureiro' | 'romantico' | 'racional'
  diagnosisCompleted: boolean
  currentDayInJourney: number // Dia na jornada de 30 dias
  // Assinatura
  hasActiveSubscription?: boolean
  subscriptionOfferUrl?: string
  hasRagAccess?: boolean
  canAnalyzeImages?: boolean
  hasStructuredDiagnosis?: boolean
  structuredDiagnosisStatus?: 'not_started' | 'in_progress' | 'completed'
  structuredDiagnosisCurrentPhase?: number | null
  avatarProfileContext?: string
  // Quota ativa de imagem para o contexto atual da conversa
  imageAnalysisQuotaKey?: 'conversation' | 'profile'
  imageAnalysisQuotaLabel?: string
  imageAnalysisUsedThisMonth?: number
  imageAnalysisLimit?: number
  imageAnalysisRemainingThisMonth?: number
  // Quotas globais por categoria
  conversationImageAnalysisUsedThisMonth?: number
  conversationImageAnalysisLimit?: number
  conversationImageAnalysisRemainingThisMonth?: number
  profileImageAnalysisUsedThisMonth?: number
  profileImageAnalysisLimit?: number
  profileImageAnalysisRemainingThisMonth?: number
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
    ragContext?: string // Conhecimento relevante do RAG
  }): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 1. System prompt com contexto do usuário e RAG
    const enrichedSystemPrompt = this.enrichSystemPrompt(
      params.systemPrompt,
      params.userContext,
      params.ragContext,
    )
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
   * Enriquece system prompt com informações do usuário e RAG
   */
  private enrichSystemPrompt(
    basePrompt: string,
    context: UserContext,
    ragContext?: string,
  ): string {
    const sections: string[] = [basePrompt]

    // Contexto do usuário
    const contextLines: string[] = []

    // Status de diagnóstico/arquétipo
    if (context.archetype) {
      contextLines.push(`Arquétipo: ${context.archetype}`)
      contextLines.push(`Dia na jornada: ${context.currentDayInJourney}/30`)
    } else if (!context.diagnosisCompleted) {
      contextLines.push('Diagnóstico: Ainda não feito')
    }

    if (context.hasStructuredDiagnosis !== undefined) {
      contextLines.push(
        `Diagnóstico estruturado: ${context.hasStructuredDiagnosis ? 'SIM' : 'NÃO'}`,
      )
    }

    if (context.structuredDiagnosisStatus) {
      contextLines.push(`Status diagnóstico estruturado: ${context.structuredDiagnosisStatus}`)
    }

    if (typeof context.structuredDiagnosisCurrentPhase === 'number') {
      contextLines.push(`Fase atual do diagnóstico estruturado: ${context.structuredDiagnosisCurrentPhase}/7`)
    }

    // Status de assinatura e capacidades pós-diagnóstico
    if (context.diagnosisCompleted && context.hasActiveSubscription === true) {
      contextLines.push('Assinatura: ATIVA')
    }

    if (context.diagnosisCompleted && context.hasActiveSubscription === false) {
      contextLines.push(
        'Assinatura: INATIVA - Convide gentilmente a assinar para continuar a jornada',
      )
      if (context.subscriptionOfferUrl) {
        contextLines.push(`Link de assinatura: ${context.subscriptionOfferUrl}`)
      }
    }

    if (context.diagnosisCompleted && context.hasRagAccess !== undefined) {
      contextLines.push(
        `RAG: ${context.hasRagAccess ? 'LIBERADO' : 'BLOQUEADO até assinatura ativa'}`,
      )
    }

    if (context.canAnalyzeImages === false) {
      if (context.diagnosisCompleted && context.hasActiveSubscription === false) {
        contextLines.push('Análise de imagem: BLOQUEADA até assinatura ativa')
      } else {
        contextLines.push('Análise de imagem: BLOQUEADA')
      }
    }

    // Rate limiting de imagens
    if (context.imageAnalysisUsedThisMonth !== undefined) {
      const limit = context.imageAnalysisLimit ?? 20
      const used = context.imageAnalysisUsedThisMonth
      const remaining = context.imageAnalysisRemainingThisMonth ?? limit - used
      const quotaLabel = context.imageAnalysisQuotaLabel
        ? ` (${context.imageAnalysisQuotaLabel})`
        : ''

      if (remaining <= 0) {
        contextLines.push(
          `Análises de imagem${quotaLabel}: LIMITE ATINGIDO (${used}/${limit} este mês)`,
        )
        contextLines.push(
          'Se o usuário enviar imagem, explique gentilmente que o limite mensal foi atingido',
        )
      } else {
        contextLines.push(
          `Análises de imagem${quotaLabel}: ${used}/${limit} usadas (restam ${remaining})`,
        )
      }
    }

    if (contextLines.length > 0) {
      sections.push(`---
CONTEXTO DO USUÁRIO:
${contextLines.join('\n')}
---`)
    }

    if (context.avatarProfileContext) {
      sections.push(`---
MEMÓRIA CENTRAL DO AVATAR:
${context.avatarProfileContext}
---`)
    }

    // Conhecimento do RAG
    if (ragContext) {
      sections.push(ragContext)
    }

    return sections.join('\n\n')
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
