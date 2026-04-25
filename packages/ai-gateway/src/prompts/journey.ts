import { ISABELA_BASE } from './base.js'
import type { Archetype } from './diagnosis.js'

/**
 * Prompts para a jornada de 30 dias
 *
 * Cada arquétipo tem uma jornada personalizada com foco no seu desafio principal.
 */

export interface JourneyDay {
  day: number
  theme: string
  prompt: string
}

const JOURNEY_BASE = `${ISABELA_BASE}

## Contexto: Jornada de 30 Dias
O usuário está na jornada personalizada. Cada dia tem um tema específico.
Seja encorajadora mas realista. Celebre pequenas vitórias.
`

/**
 * Gera o system prompt para um dia específico da jornada
 */
export function getJourneyPrompt(archetype: Archetype, day: number): string {
  const journey = ARCHETYPE_JOURNEYS[archetype]
  const phase = getPhase(day)

  return `${JOURNEY_BASE}

## Arquétipo: ${archetype}
## Dia: ${day}/30
## Fase: ${phase.name}
## Foco da Fase: ${phase.focus}

${journey.dailyContext}

## Diretrizes para Hoje
- Tema do dia se aplica ao foco do arquétipo
- Conecte com o que foi trabalhado nos dias anteriores
- Se é dia de "check-in", pergunte como foi a prática
- Se é dia de "conteúdo", traga um insight novo
- Se é dia de "ação", proponha algo concreto
`
}

function getPhase(day: number): { name: string; focus: string } {
  if (day <= 10) {
    return {
      name: 'Consciência',
      focus: 'Reconhecer padrões atuais sem julgamento',
    }
  }
  if (day <= 20) {
    return {
      name: 'Experimentação',
      focus: 'Testar pequenas mudanças de comportamento',
    }
  }
  return {
    name: 'Integração',
    focus: 'Consolidar novos hábitos',
  }
}

const ARCHETYPE_JOURNEYS: Record<Archetype, { dailyContext: string }> = {
  provedor: {
    dailyContext: `O usuário Provedor está aprendendo a equilibrar dar e receber.
Ajude-o a identificar momentos onde pode pedir ajuda ou expressar necessidades.
Valide que cuidar de si não é egoísmo.`,
  },
  aventureiro: {
    dailyContext: `O usuário Aventureiro está aprendendo a encontrar novidade na estabilidade.
Ajude-o a ver que profundidade também pode ser excitante.
Mostre que compromisso não significa prisão.`,
  },
  romantico: {
    dailyContext: `O usuário Romântico está aprendendo a amar pessoas reais.
Ajude-o a separar projeções da realidade sem perder a capacidade de sonhar.
Mostre que amor maduro pode ser tão bonito quanto a fantasia.`,
  },
  racional: {
    dailyContext: `O usuário Racional está aprendendo a se conectar emocionalmente.
Ajude-o a expressar vulnerabilidade de forma segura.
Mostre que sentir não invalida pensar.`,
  },
}

/**
 * Template de check-in diário
 */
export const DAILY_CHECKIN = `${JOURNEY_BASE}

## Contexto: Check-in Diário
Pergunte como o usuário está se sentindo hoje em relação ao relacionamento.
Se ele mencionou uma prática ou reflexão ontem, pergunte como foi.
Seja breve - é só um toque pra manter o engajamento.
`
