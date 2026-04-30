import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type AgentIcon = ComponentProps<typeof Ionicons>['name'];

export interface SpecializedAgent {
  id: string;
  name: string;
  shortName: string;
  description: string;
  prompt: string;
  icon: AgentIcon;
  color: string;
  phase?: number;
}

export const SPECIALIZED_AGENTS: SpecializedAgent[] = [
  {
    id: 'diagnostic',
    name: 'Diagnóstico Pessoal',
    shortName: 'Diagnóstico',
    description: 'Mapeamento completo das suas áreas de vida',
    prompt:
      'Quero fazer meu diagnóstico pessoal completo. Me ajude a mapear minhas áreas de vida, identificar onde estou forte e onde preciso melhorar. Quero entender meus padrões, bloqueios e o que preciso ajustar.',
    icon: 'clipboard-outline',
    color: '#FE3C72',
    phase: 0,
  },
  {
    id: 'identity',
    name: 'Diagnóstico de Identidade',
    shortName: 'Identidade',
    description: 'Descobrir quem você realmente é',
    prompt:
      'Quero fazer um diagnóstico de identidade. Me ajude a descobrir quem eu realmente sou, meus valores, crenças e o que me define como pessoa.',
    icon: 'finger-print-outline',
    color: '#A855F7',
    phase: 1,
  },
  {
    id: 'value-builder',
    name: 'Construtor de Homem de Valor',
    shortName: 'Valor',
    description: 'Plano de ajustes nas áreas de vida',
    prompt:
      'Quero usar o Construtor de Homem de Valor. Com base no meu diagnóstico, me ajude a montar um plano prático para ajustar minhas áreas de vida e me tornar um homem de alto valor.',
    icon: 'construct-outline',
    color: '#30D158',
    phase: 2,
  },
  {
    id: 'vsm',
    name: 'Método VSM',
    shortName: 'VSM',
    description: 'Framework de desenvolvimento pessoal',
    prompt:
      'Quero aplicar o método VSM no meu desenvolvimento. Me guie pelo framework para entender meu Valor, Status e Masculinidade.',
    icon: 'trending-up-outline',
    color: '#00D4FF',
    phase: 3,
  },
  {
    id: 'personal-image',
    name: 'Imagem Pessoal',
    shortName: 'Imagem',
    description: 'Melhorar sua apresentação visual',
    prompt:
      'Quero trabalhar minha imagem pessoal. Me ajude a entender como me apresentar melhor, desde roupas até postura e comunicação não-verbal.',
    icon: 'shirt-outline',
    color: '#FF6B8A',
    phase: 4,
  },
  {
    id: 'wealth-plan',
    name: 'Plano de Riqueza',
    shortName: 'Riqueza',
    description: 'Estratégia financeira e abundância',
    prompt:
      'Quero criar meu plano de riqueza. Me ajude a desenvolver uma estratégia financeira, identificar oportunidades e construir abundância.',
    icon: 'cash-outline',
    color: '#FFD700',
    phase: 5,
  },
  {
    id: 'study-plan',
    name: 'Plano de Estudos',
    shortName: 'Estudos',
    description: 'Rotina de aprendizado e evolução',
    prompt:
      'Quero montar meu plano de estudos. Me ajude a criar uma rotina de aprendizado focada no meu desenvolvimento pessoal e profissional.',
    icon: 'book-outline',
    color: '#3B82F6',
    phase: 6,
  },
  {
    id: 'instagram-analyzer',
    name: 'Analisador de Instagram',
    shortName: 'Instagram',
    description: 'Análise do seu perfil nas redes',
    prompt:
      'Quero analisar meu perfil do Instagram. Me ajude a entender como meu perfil é percebido, o que posso melhorar e como usar as redes de forma estratégica.',
    icon: 'logo-instagram',
    color: '#E1306C',
    phase: 7,
  },
];
