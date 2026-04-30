export interface ExploreCategory {
  id: string;
  title: string;
  gradient: [string, string];
  activeUsers: number;
  prompt: string;
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: 'self-knowledge',
    title: 'Autoconhecimento',
    gradient: ['#7C3AED', '#A855F7'],
    activeUsers: 1420,
    prompt:
      'Quero que você atue como uma analista do meu perfil afetivo. Me ajude a identificar padrões, inseguranças, sabotagens e os ajustes mais importantes para eu me relacionar melhor.',
  },
  {
    id: 'serious-relationship',
    title: 'Relacionamento sério',
    gradient: ['#E11D48', '#F43F5E'],
    activeUsers: 890,
    prompt:
      'Quero construir um relacionamento sério e duradouro. Me ajude a entender o que preciso desenvolver em mim e quais comportamentos atraem conexões profundas.',
  },
  {
    id: 'communication',
    title: 'Comunicação',
    gradient: ['#10B981', '#14B8A6'],
    activeUsers: 1150,
    prompt:
      'Quero melhorar minha comunicação em relacionamentos. Me ajude a expressar necessidades, resolver conflitos e ter conversas difíceis de forma saudável.',
  },
  {
    id: 'healing',
    title: 'Recomeço',
    gradient: ['#06B6D4', '#3B82F6'],
    activeUsers: 640,
    prompt:
      'Estou passando por um término ou fase difícil. Me ajude a processar, curar e me preparar emocionalmente para recomeçar quando estiver pronto.',
  },
  {
    id: 'conversation-analyzer',
    title: 'Análise de conversas',
    gradient: ['#EC4899', '#D946EF'],
    activeUsers: 1870,
    prompt:
      'Quero usar este chat como um analisador de conversas. Vou te mandar mensagens e quero que você leia intenção, sinais, erros meus e a melhor forma de responder.',
  },
  {
    id: 'action-plan',
    title: 'Plano de ação',
    gradient: ['#F59E0B', '#F97316'],
    activeUsers: 730,
    prompt:
      'Quero criar uma jornada prática de desenvolvimento emocional e relacional. Me ajude a montar um plano claro, com etapas, foco e próximos passos.',
  },
];
