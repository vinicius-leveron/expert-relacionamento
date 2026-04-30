export type Archetype = 'ansioso' | 'evitante' | 'desorganizado' | 'seguro';

export const PROMPTS_BY_ARCHETYPE: Record<Archetype | 'default', string[]> = {
  ansioso: [
    'Ela demorou pra responder. Tô pirando?',
    'Mandei 3 mensagens seguidas. Errei?',
    'Ela disse que tá ocupada. Insisto?',
    'Como saber se ela ainda tá interessada?',
  ],
  evitante: [
    'Ela quer conversar todo dia. É demais?',
    'Sinto que preciso de espaço. Como falo?',
    'Ela tá ficando séria. Devo sumir?',
    'Como demonstrar interesse sem me prender?',
  ],
  desorganizado: [
    'Um dia quero tudo, no outro nada. Por quê?',
    'Ela tá gostando e eu tô sabotando. Como paro?',
    'Não sei se gosto dela ou da atenção.',
    'Por que estrago quando tá indo bem?',
  ],
  seguro: [
    'Analisa essa conversa pra mim',
    'Como levo pro date sem parecer afobado?',
    'Ela tá dando sinal de interesse?',
    'Quero melhorar minha comunicação',
  ],
  default: [
    'Analisa essa conversa pra mim',
    'Onde eu tô errando no meu perfil?',
    'Ela parou de responder. O que faço?',
    'Quero melhorar minha comunicação',
  ],
};

export function getPromptsForArchetype(archetype?: Archetype | null): string[] {
  if (!archetype || !PROMPTS_BY_ARCHETYPE[archetype]) {
    return PROMPTS_BY_ARCHETYPE.default;
  }
  return PROMPTS_BY_ARCHETYPE[archetype];
}

export const PAYWALL_CONTENT: Record<
  Archetype | 'default',
  {
    headline: string;
    subheadline: string;
    cta: string;
  }
> = {
  ansioso: {
    headline: 'Você sabe que manda mensagem demais.',
    subheadline: 'Mas não consegue parar. A Isabela te mostra EXATAMENTE onde você perde a pessoa.',
    cta: 'Quero parar de errar',
  },
  evitante: {
    headline: 'Você some quando a pessoa começa a gostar.',
    subheadline: 'E depois se arrepende. A Isabela te ajuda a ficar sem sufocar.',
    cta: 'Quero parar de fugir',
  },
  desorganizado: {
    headline: 'Um dia você quer tudo, no outro quer distância.',
    subheadline: 'Isso confunde todo mundo. Inclusive você. A Isabela te ajuda a se entender.',
    cta: 'Quero me entender',
  },
  seguro: {
    headline: 'Você sabe conversar.',
    subheadline: 'Mas quer resultados melhores ainda. A Isabela te ajuda a refinar.',
    cta: 'Quero evoluir mais',
  },
  default: {
    headline: 'Você repete os mesmos erros.',
    subheadline: 'E nem sabe quais são. A Isabela analisa suas conversas e te mostra onde você erra.',
    cta: 'Descobrir meus erros',
  },
};

export function getPaywallContent(archetype?: Archetype | null) {
  if (!archetype || !PAYWALL_CONTENT[archetype]) {
    return PAYWALL_CONTENT.default;
  }
  return PAYWALL_CONTENT[archetype];
}

export const DIAGNOSTIC_IMPACT_COPY: Record<
  Archetype,
  {
    title: string;
    impact: string;
    stat: string;
  }
> = {
  ansioso: {
    title: 'ANSIOSO',
    impact:
      'Você precisa de resposta. Agora. E quando não vem, você manda mais mensagem. Que só piora a situação.',
    stat: '23% dos usuários do Perpétuo têm esse padrão.',
  },
  evitante: {
    title: 'EVITANTE',
    impact:
      'Quando a pessoa chega perto, você some. E depois se pergunta por que tá sozinho.',
    stat: '31% dos usuários do Perpétuo têm esse padrão.',
  },
  desorganizado: {
    title: 'DESORGANIZADO',
    impact: 'Um dia você quer tudo. No outro, quer distância. Quem aguenta isso?',
    stat: '18% dos usuários do Perpétuo têm esse padrão.',
  },
  seguro: {
    title: 'SEGURO',
    impact: 'Você sabe se relacionar. Mas pode ser ainda melhor.',
    stat: '28% dos usuários do Perpétuo têm esse padrão.',
  },
};
