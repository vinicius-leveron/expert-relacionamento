import { ISABELA_BASE } from './base.js'

/**
 * Prompts para a fase de diagnóstico
 *
 * O diagnóstico identifica o arquétipo do usuário:
 * - Provedor: Foca em dar, às vezes esquece de receber
 * - Aventureiro: Busca novidade, pode ter dificuldade com rotina
 * - Romântico: Idealiza, pode frustrar com a realidade
 * - Racional: Analítico, pode ter dificuldade com emoções
 */

export const DIAGNOSIS_INTRO = `${ISABELA_BASE}

## Contexto: Conhecendo o Usuário
Você está conhecendo esse usuário. Através de uma conversa natural, descubra o perfil de relacionamento dele.

## Arquétipos Possíveis
- **Provedor**: Cuida dos outros, generoso, às vezes esquece de si
- **Aventureiro**: Busca novidade, intensidade, pode enjoar da rotina
- **Romântico**: Idealiza, valoriza gestos, pode frustrar com realidade
- **Racional**: Analítico, estável, pode parecer frio

## Como Conduzir
- Faça perguntas naturais sobre relacionamentos passados, o que valoriza, como lida com conflitos
- Reaja genuinamente às respostas
- Não mencione "teste", "diagnóstico" ou "arquétipo"
- Use seu julgamento - pode precisar de 3 perguntas ou 7, depende das respostas

## Quando Estiver Pronto
Quando tiver informação suficiente para identificar o perfil, comece sua resposta EXATAMENTE com:
[PERFIL:nome_do_arquetipo]

Onde nome_do_arquetipo é: provedor, aventureiro, romantico ou racional

Depois do marcador, compartilhe os insights de forma positiva e convide para a jornada de 30 dias.
`

export const DIAGNOSIS_QUESTIONS = [
  'Quando você tá num relacionamento, você sente mais que precisa cuidar do outro ou ser cuidado?',
  'O que te atrai mais: a segurança de uma rotina a dois ou a emoção de momentos novos juntos?',
  'Quando vocês brigam, você costuma querer resolver na hora ou prefere pensar antes de falar?',
  'Você acha que idealiza demais as pessoas no começo ou costuma ser mais pé no chão?',
  'O que te frustra mais: quando seu parceiro não reconhece o que você faz, ou quando ele não te surpreende?',
]

export const DIAGNOSIS_COMPLETE = `${ISABELA_BASE}

## Contexto: Diagnóstico Completo
O usuário completou o diagnóstico. Agora você sabe o arquétipo dele.
Compartilhe os insights de forma positiva, focando nos pontos fortes primeiro.
Convide-o a começar a jornada de 30 dias.
`

export const ARCHETYPE_INSIGHTS = {
  provedor: {
    name: 'Provedor',
    strengths: [
      'Você é generoso e atencioso',
      'Parceiros se sentem cuidados com você',
      'Você é confiável e presente',
    ],
    challenges: [
      'Às vezes esquece de pedir o que precisa',
      'Pode se frustrar quando o cuidado não é recíproco',
      'Tende a colocar o outro sempre em primeiro lugar',
    ],
    focus: 'aprender a receber tanto quanto dá',
  },
  aventureiro: {
    name: 'Aventureiro',
    strengths: [
      'Você traz energia e novidade pros relacionamentos',
      'Sabe manter a chama acesa',
      'É espontâneo e divertido',
    ],
    challenges: [
      'Pode se entediar com rotina',
      'Às vezes confunde intensidade com profundidade',
      'Pode ter dificuldade com compromissos de longo prazo',
    ],
    focus: 'encontrar aventura dentro da estabilidade',
  },
  romantico: {
    name: 'Romântico',
    strengths: [
      'Você acredita no amor de verdade',
      'Sabe criar momentos especiais',
      'É sensível e conectado emocionalmente',
    ],
    challenges: [
      'Pode idealizar demais no começo',
      'Frustração quando a realidade não bate com a fantasia',
      'Às vezes demora a ver red flags',
    ],
    focus: 'amar a pessoa real, não a projeção',
  },
  racional: {
    name: 'Racional',
    strengths: [
      'Você é estável e previsível (no bom sentido)',
      'Resolve problemas com clareza',
      'Não se deixa levar por impulsos',
    ],
    challenges: [
      'Pode parecer frio ou distante',
      'Às vezes analisa quando deveria só sentir',
      'Dificuldade em expressar vulnerabilidade',
    ],
    focus: 'se permitir sentir sem precisar entender tudo',
  },
} as const

export type Archetype = keyof typeof ARCHETYPE_INSIGHTS
