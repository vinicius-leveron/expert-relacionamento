import { describe, expect, it } from 'vitest'
import { ContextBuilder } from './context-builder.js'

describe('ContextBuilder', () => {
  it('inclui contexto de assinatura inativa e link de oferta após o diagnóstico', () => {
    const builder = new ContextBuilder()

    const messages = builder.build({
      systemPrompt: 'BASE',
      userContext: {
        userId: 'user-1',
        archetype: 'romantico',
        diagnosisCompleted: true,
        currentDayInJourney: 4,
        hasActiveSubscription: false,
        subscriptionOfferUrl: 'https://perpetuo.com.br/assinar',
        hasRagAccess: false,
        canAnalyzeImages: false,
        imageAnalysisUsedThisMonth: 3,
        imageAnalysisLimit: 30,
        imageAnalysisRemainingThisMonth: 27,
        imageAnalysisQuotaLabel: 'prints/conversas',
      },
      history: { messages: [] },
      currentMessage: 'oi',
    })

    const systemPrompt = messages[0].content as string

    expect(systemPrompt).toContain('Assinatura: INATIVA')
    expect(systemPrompt).toContain('Link de assinatura: https://perpetuo.com.br/assinar')
    expect(systemPrompt).toContain('RAG: BLOQUEADO até assinatura ativa')
    expect(systemPrompt).toContain('Análise de imagem: BLOQUEADA até assinatura ativa')
  })

  it('inclui saldo de análises de imagem e capacidades liberadas', () => {
    const builder = new ContextBuilder()

    const messages = builder.build({
      systemPrompt: 'BASE',
      userContext: {
        userId: 'user-2',
        archetype: 'provedor',
        diagnosisCompleted: true,
        currentDayInJourney: 11,
        hasActiveSubscription: true,
        hasRagAccess: true,
        canAnalyzeImages: true,
        imageAnalysisUsedThisMonth: 19,
        imageAnalysisLimit: 30,
        imageAnalysisRemainingThisMonth: 11,
        imageAnalysisQuotaLabel: 'prints/conversas',
      },
      history: { messages: [] },
      currentMessage: 'oi',
    })

    const systemPrompt = messages[0].content as string

    expect(systemPrompt).toContain('Assinatura: ATIVA')
    expect(systemPrompt).toContain('RAG: LIBERADO')
    expect(systemPrompt).toContain(
      'Análises de imagem (prints/conversas): 19/30 usadas (restam 11)',
    )
  })
})
