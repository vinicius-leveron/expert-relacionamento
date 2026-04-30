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

interface DirectionalPlan {
  centralFocus: string
  stopDoing: string
  startDoing: string
  days1to10: string
  days11to20: string
  days21to30: string
  todayAction: string
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

## Card do Dia (OBRIGATÓRIO)
Ao iniciar o dia ou quando o usuário perguntar sobre a jornada, inclua no FINAL da mensagem:
[DAY_CARD:dia|título|descrição do exercício]

Por exemplo:
[DAY_CARD:3|Seus Padrões|Observe hoje onde você se anula para cuidar dos outros]

O título deve ter no máximo 3 palavras. A descrição deve ser uma frase curta e prática.

## Botões de Resposta
Se fizer pergunta com opções claras, inclua:
[QUICK_REPLIES:opção1|opção2|opção3|opção4]

Use no máximo 4 opções curtas (até 25 caracteres cada).
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

const ARCHETYPE_DIRECTIONAL_PLANS: Record<Archetype, DirectionalPlan> = {
  provedor: {
    centralFocus: 'equilibrar cuidado com reciprocidade',
    stopDoing: 'tentar conquistar valor só pelo que você entrega',
    startDoing: 'nomear suas necessidades com clareza e sem culpa',
    days1to10: 'observar onde você se cala, cede demais ou tenta merecer afeto no esforço',
    days11to20: 'praticar pedidos simples, limites claros e presença sem se anular',
    days21to30: 'consolidar relações mais recíprocas e sair do papel de salvador',
    todayAction: 'escreva uma situação recente em que você deu mais do que recebeu e diga o que teria sido mais justo pedir',
  },
  aventureiro: {
    centralFocus: 'trocar intensidade solta por presença consistente',
    stopDoing: 'confundir novidade com conexão profunda',
    startDoing: 'sustentar interesse mesmo quando a relação entra em ritmo mais estável',
    days1to10: 'mapear seus gatilhos de tédio, fuga e busca de validação rápida',
    days11to20: 'testar constância, curiosidade e conversas mais profundas sem perder leveza',
    days21to30: 'integrar liberdade com compromisso e virar alguém mais confiável afetivamente',
    todayAction: 'pense em uma conversa ou relação que esfriou rápido e identifique em que momento você trocou profundidade por estímulo novo',
  },
  romantico: {
    centralFocus: 'substituir idealização por vínculo com a pessoa real',
    stopDoing: 'preencher lacunas com fantasia antes de conhecer de verdade',
    startDoing: 'observar fatos, coerência e compatibilidade emocional',
    days1to10: 'notar expectativas irreais, projeções e sinais que você costuma ignorar',
    days11to20: 'praticar leituras mais objetivas sem perder sensibilidade',
    days21to30: 'construir um amor mais maduro, bonito e menos ansioso',
    todayAction: 'lembre de alguém que você idealizou no começo e liste três fatos reais que você não quis ver naquela fase',
  },
  racional: {
    centralFocus: 'aproximar clareza mental de expressão emocional',
    stopDoing: 'usar análise como escudo para não se expor',
    startDoing: 'dar nome ao que sente e comunicar isso com simplicidade',
    days1to10: 'reconhecer onde você se protege demais e racionaliza em excesso',
    days11to20: 'praticar vulnerabilidade em doses seguras e conversas mais abertas',
    days21to30: 'integrar sensibilidade com estabilidade, sem perder seu eixo',
    todayAction: 'escolha uma emoção que você costuma esconder e descreva como ela aparece no seu corpo e no seu jeito de responder',
  },
}

export function buildDirectionalPlan(archetype: Archetype): string {
  const plan = ARCHETYPE_DIRECTIONAL_PLANS[archetype]

  return `## Seu Plano Direcional de 30 Dias
- Foco central: ${plan.centralFocus}
- Pare de: ${plan.stopDoing}
- Comece a: ${plan.startDoing}
- Dias 1-10: ${plan.days1to10}
- Dias 11-20: ${plan.days11to20}
- Dias 21-30: ${plan.days21to30}

## Primeira ação prática
${plan.todayAction}`
}

/**
 * Template de check-in diário
 */
export const DAILY_CHECKIN = `${JOURNEY_BASE}

## Contexto: Check-in Diário
Pergunte como o usuário está se sentindo hoje em relação ao relacionamento.
Se ele mencionou uma prática ou reflexão ontem, pergunte como foi.
Seja breve - é só um toque pra manter o engajamento.

## Botões de Resposta
Inclua opções de resposta rápida:
[QUICK_REPLIES:Estou bem|Dia difícil|Tive uma reflexão|Preciso de ajuda]
`
