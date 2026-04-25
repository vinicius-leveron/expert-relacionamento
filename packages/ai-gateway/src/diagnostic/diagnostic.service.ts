import type { AIProviderPort } from '@perpetuo/core'
import { ARCHETYPE_INSIGHTS, type Archetype, DIAGNOSIS_QUESTIONS } from '../prompts/diagnosis.js'

export interface DiagnosticAnswer {
  questionIndex: number
  question: string
  answer: string
  timestamp: Date
}

export interface DiagnosticScores {
  provedor: number
  aventureiro: number
  romantico: number
  racional: number
}

export interface DiagnosticResult {
  archetype: Archetype
  scores: DiagnosticScores
  answers: DiagnosticAnswer[]
}

export interface DiagnosticState {
  currentQuestionIndex: number
  answers: DiagnosticAnswer[]
  isComplete: boolean
}

/**
 * DiagnosticService - Gerencia o fluxo de diagnóstico
 *
 * Conduz 5 perguntas e classifica respostas usando IA
 * para determinar o arquétipo do usuário.
 */
export class DiagnosticService {
  private readonly questions = DIAGNOSIS_QUESTIONS

  constructor(private readonly aiProvider: AIProviderPort) {}

  /**
   * Retorna a próxima pergunta do diagnóstico
   */
  getNextQuestion(state: DiagnosticState): string | null {
    if (state.currentQuestionIndex >= this.questions.length) {
      return null
    }
    return this.questions[state.currentQuestionIndex]
  }

  /**
   * Processa uma resposta do usuário e retorna novo estado
   */
  processAnswer(state: DiagnosticState, answer: string): DiagnosticState {
    const newAnswer: DiagnosticAnswer = {
      questionIndex: state.currentQuestionIndex,
      question: this.questions[state.currentQuestionIndex],
      answer,
      timestamp: new Date(),
    }

    const newAnswers = [...state.answers, newAnswer]
    const nextIndex = state.currentQuestionIndex + 1

    return {
      currentQuestionIndex: nextIndex,
      answers: newAnswers,
      isComplete: nextIndex >= this.questions.length,
    }
  }

  /**
   * Analisa respostas e determina arquétipo usando IA
   */
  async analyzeAndClassify(answers: DiagnosticAnswer[]): Promise<DiagnosticResult> {
    const scores = await this.calculateScores(answers)
    const archetype = this.determineArchetype(scores)

    return {
      archetype,
      scores,
      answers,
    }
  }

  /**
   * Calcula scores por arquétipo usando análise de IA
   */
  private async calculateScores(answers: DiagnosticAnswer[]): Promise<DiagnosticScores> {
    const analysisPrompt = this.buildAnalysisPrompt(answers)

    const result = await this.aiProvider.complete(
      [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      {
        maxTokens: 200,
        temperature: 0.3,
      },
    )

    return this.parseScoresFromResponse(result.content)
  }

  private buildAnalysisPrompt(answers: DiagnosticAnswer[]): string {
    const qaPairs = answers
      .map((a, i) => `Pergunta ${i + 1}: ${a.question}\nResposta: ${a.answer}`)
      .join('\n\n')

    return `Analise as respostas abaixo de um questionário sobre estilo de relacionamento.

${qaPairs}

Baseado nessas respostas, atribua uma pontuação de 0 a 10 para cada arquétipo:
- Provedor: Cuida dos outros, generoso, pode esquecer de si
- Aventureiro: Busca novidade, intensidade, pode enjoar da rotina
- Romântico: Idealiza, valoriza gestos, pode frustrar com realidade
- Racional: Analítico, estável, pode parecer frio

RESPONDA APENAS com JSON no formato:
{"provedor": X, "aventureiro": X, "romantico": X, "racional": X}

Sem explicações, apenas o JSON.`
  }

  private parseScoresFromResponse(response: string): DiagnosticScores {
    // Tenta extrair JSON da resposta
    const jsonMatch = response.match(/\{[^}]+\}/)
    if (!jsonMatch) {
      return this.defaultScores()
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        provedor: Math.max(0, Math.min(10, Number(parsed.provedor) || 0)),
        aventureiro: Math.max(0, Math.min(10, Number(parsed.aventureiro) || 0)),
        romantico: Math.max(0, Math.min(10, Number(parsed.romantico) || 0)),
        racional: Math.max(0, Math.min(10, Number(parsed.racional) || 0)),
      }
    } catch {
      return this.defaultScores()
    }
  }

  private defaultScores(): DiagnosticScores {
    return { provedor: 5, aventureiro: 5, romantico: 5, racional: 5 }
  }

  private determineArchetype(scores: DiagnosticScores): Archetype {
    const entries = Object.entries(scores) as [Archetype, number][]
    entries.sort((a, b) => b[1] - a[1])
    return entries[0][0]
  }

  /**
   * Gera mensagem de resultado para o usuário
   */
  formatResultMessage(archetype: Archetype): string {
    const insights = ARCHETYPE_INSIGHTS[archetype]

    const strengths = insights.strengths.map((s) => `• ${s}`).join('\n')
    const challenges = insights.challenges.map((c) => `• ${c}`).join('\n')

    return `Descobri algo interessante sobre você! 🌟

Seu perfil é o **${insights.name}**.

*O que você faz muito bem:*
${strengths}

*Onde você pode crescer:*
${challenges}

*Seu foco na jornada:* ${insights.focus}

Que tal começarmos uma jornada de 30 dias juntos? Vou te ajudar a fortalecer seus pontos fortes e trabalhar nos desafios. É só me dizer que quer começar!`
  }

  /**
   * Estado inicial do diagnóstico
   */
  static createInitialState(): DiagnosticState {
    return {
      currentQuestionIndex: 0,
      answers: [],
      isComplete: false,
    }
  }

  /**
   * Reconstrói estado a partir de respostas salvas
   */
  static restoreState(savedAnswers: DiagnosticAnswer[]): DiagnosticState {
    return {
      currentQuestionIndex: savedAnswers.length,
      answers: savedAnswers,
      isComplete: savedAnswers.length >= DIAGNOSIS_QUESTIONS.length,
    }
  }
}
