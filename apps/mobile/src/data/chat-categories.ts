import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type ChatCategoryIcon = ComponentProps<typeof Ionicons>['name'];

export interface ChatCategory {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  prompt: string;
  icon: ChatCategoryIcon;
}

export const CHAT_CATEGORIES: ChatCategory[] = [
  {
    id: 'profile-analyzer',
    eyebrow: 'Leitura pessoal',
    title: 'Analisador de Perfil',
    description:
      'Quero entender meus padrões, inseguranças e pontos cegos nos relacionamentos.',
    prompt:
      'Quero que você atue como uma analista do meu perfil afetivo. Me ajude a identificar padrões, inseguranças, sabotagens e os ajustes mais importantes para eu me relacionar melhor.',
    icon: 'person-circle-outline',
  },
  {
    id: 'conversation-analyzer',
    eyebrow: 'Leitura de contexto',
    title: 'Analisador de Conversas',
    description:
      'Vou te mostrar mensagens e quero entender o que a outra pessoa está comunicando de verdade.',
    prompt:
      'Quero usar este chat como um analisador de conversas. Vou te mandar mensagens e quero que você leia intenção, sinais, erros meus e a melhor forma de responder.',
    icon: 'chatbox-ellipses-outline',
  },
  {
    id: 'journey-builder',
    eyebrow: 'Plano de ação',
    title: 'Criador de Jornada',
    description:
      'Quero montar uma jornada prática de desenvolvimento para evoluir meu comportamento afetivo.',
    prompt:
      'Quero criar uma jornada prática de desenvolvimento emocional e relacional. Me ajude a montar um plano claro, com etapas, foco e próximos passos.',
    icon: 'map-outline',
  },
];
