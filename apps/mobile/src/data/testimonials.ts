export type Archetype = 'ansioso' | 'evitante' | 'desorganizado' | 'seguro';

export interface Testimonial {
  text: string;
  name: string;
  archetype?: Archetype;
  result: string;
}

export const TESTIMONIALS = {
  paywall: [
    {
      text: 'Mandei o print achando que tava arrasando. Ela me mostrou 5 erros que eu nem via.',
      name: 'João, 28',
      archetype: 'ansioso' as Archetype,
      result: 'Parou de levar ghosting',
    },
    {
      text: 'Descobri que sou evitante. Fazia sentido porque sempre sumia quando ficava sério.',
      name: 'Pedro, 32',
      archetype: 'evitante' as Archetype,
      result: 'Primeiro relacionamento estável',
    },
    {
      text: 'Achava que o problema era elas. Era eu que não sabia ler os sinais.',
      name: 'Lucas, 25',
      archetype: 'desorganizado' as Archetype,
      result: '3 dates em 2 semanas',
    },
    {
      text: 'Já sabia conversar, mas queria ser ainda melhor. A Isabela me ajudou a refinar.',
      name: 'Marcos, 30',
      archetype: 'seguro' as Archetype,
      result: 'Match virou namorada',
    },
  ],
  diagnostic_result: [
    {
      text: 'Saber meu arquétipo mudou tudo. Agora entendo por que faço o que faço.',
      name: 'Lucas, 25',
      result: '3 dates em 2 semanas',
    },
    {
      text: 'Finalmente parei de me culpar. É um padrão, não um defeito.',
      name: 'Rafael, 27',
      result: 'Menos ansiedade nas conversas',
    },
  ],
  chat_empty: [
    {
      text: 'Achava que o problema era as mulheres. Era eu que não sabia conversar.',
      name: 'Marcos, 30',
      result: 'Match virou namorada',
    },
    {
      text: 'Mandei um print e ela me mostrou exatamente onde eu perdi a mina.',
      name: 'Thiago, 24',
      result: 'Recuperou conversa que tinha morrido',
    },
  ],
} as const;

export function getTestimonialForArchetype(
  context: keyof typeof TESTIMONIALS,
  archetype?: Archetype
): Testimonial {
  const testimonials = TESTIMONIALS[context];

  if (archetype && context === 'paywall') {
    const matching = testimonials.find((t) => 'archetype' in t && t.archetype === archetype);
    if (matching) return matching;
  }

  return testimonials[Math.floor(Math.random() * testimonials.length)];
}
