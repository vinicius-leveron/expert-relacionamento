import {
  ARCHETYPE_INSIGHTS,
  buildDirectionalPlan,
  type Archetype,
  type ConversationHistory,
} from '@perpetuo/ai-gateway'
import type { DiagnosticRepository } from '@perpetuo/database'

export interface DiagnosticScores {
  provedor: number
  aventureiro: number
  romantico: number
  racional: number
}

interface ExtractedAnswer {
  questionIndex: number
  question: string
  answer: string
}

/**
 * DiagnosticHandler - Auxilia no processamento de diagnóstico
 *
 * A IA conduz o diagnóstico autonomamente. Este handler apenas:
 * - Extrai respostas do histórico para registro
 * - Salva o diagnóstico final
 * - Formata mensagem de resultado
 */
export class DiagnosticHandler {
  constructor(private readonly diagnosticRepo: DiagnosticRepository) {}

  /**
   * Extrai pares pergunta/resposta do histórico para registro
   */
  extractAnswersFromHistory(history: ConversationHistory): ExtractedAnswer[] {
    const answers: ExtractedAnswer[] = []
    let questionIndex = 0

    for (let i = 0; i < history.messages.length - 1; i++) {
      const msg = history.messages[i]
      const nextMsg = history.messages[i + 1]

      // Se assistente fez pergunta e usuário respondeu
      if (msg.role === 'assistant' && nextMsg?.role === 'user') {
        // Detecta se parece uma pergunta (termina com ?)
        if (msg.content.includes('?')) {
          answers.push({
            questionIndex: questionIndex++,
            question: this.extractQuestion(msg.content),
            answer: nextMsg.content,
          })
        }
      }
    }

    return answers
  }

  /**
   * Extrai a última pergunta de uma mensagem
   */
  private extractQuestion(content: string): string {
    const sentences = content.split(/[.!]/).filter((s) => s.includes('?'))
    return sentences[sentences.length - 1]?.trim() || content
  }

  /**
   * Salva diagnóstico completo
   */
  async saveDiagnosis(
    userId: string,
    archetype: Archetype,
    scores: DiagnosticScores,
    answers: ExtractedAnswer[],
  ) {
    await this.diagnosticRepo.save({
      userId,
      archetype,
      scores,
      answers: answers.map((a) => ({
        questionIndex: a.questionIndex,
        answer: a.answer,
      })),
    })

    // Inicia jornada automaticamente
    await this.diagnosticRepo.startJourney(userId)
  }

  /**
   * Gera mensagem com resultado do diagnóstico
   */
  formatResultMessage(archetype: Archetype): string {
    const insights = ARCHETYPE_INSIGHTS[archetype]

    const strengths = insights.strengths.map((s) => `• ${s}`).join('\n')
    const challenges = insights.challenges.map((c) => `• ${c}`).join('\n')

    return `Descobri algo interessante sobre você!

Seu perfil é o **${insights.name}**.

*O que você faz muito bem:*
${strengths}

*Onde você pode crescer:*
${challenges}

*Seu foco na jornada:* ${insights.focus}

Que tal começarmos uma jornada de 30 dias juntos? Vou te ajudar a fortalecer seus pontos fortes e trabalhar nos desafios. É só me dizer que quer começar!`
  }

  appendDirectionalPlan(message: string, archetype: Archetype): string {
    if (message.includes('## Seu Plano Direcional de 30 Dias')) {
      return message
    }

    return `${message.trim()}\n\n${buildDirectionalPlan(archetype)}`
  }
}
