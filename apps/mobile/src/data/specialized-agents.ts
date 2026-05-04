import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type AgentIcon = ComponentProps<typeof Ionicons>['name'];
export type AgentId =
  | 'diagnostic'
  | 'identity'
  | 'value-builder'
  | 'vsm'
  | 'personal-image'
  | 'wealth-plan'
  | 'study-plan'
  | 'instagram-analyzer';

export interface SpecializedAgent {
  id: AgentId;
  name: string;
  shortName: string;
  description: string;
  prompt: string;
  icon: AgentIcon;
  color: string;
  phase?: number;
  requiresStructuredDiagnosis: boolean;
}

export const SPECIALIZED_AGENTS: SpecializedAgent[] = [
  {
    id: 'diagnostic',
    name: 'Diagnóstico Pessoal',
    shortName: 'Diagnóstico',
    description: 'Mapeamento completo das suas áreas de vida',
    prompt: 'Quero começar meu diagnóstico pessoal completo.',
    icon: 'clipboard-outline',
    color: '#FE3C72',
    phase: 0,
    requiresStructuredDiagnosis: false,
  },
  {
    id: 'identity',
    name: 'Diagnóstico de Identidade',
    shortName: 'Identidade',
    description: 'Descobrir quem você realmente é',
    prompt: 'Quero aprofundar minha identidade com base no meu diagnóstico.',
    icon: 'finger-print-outline',
    color: '#A855F7',
    phase: 1,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'value-builder',
    name: 'Construtor de Homem de Valor',
    shortName: 'Valor',
    description: 'Plano de ajustes nas áreas de vida',
    prompt: 'Quero meu plano de 90 dias do Construtor de Homem de Valor.',
    icon: 'construct-outline',
    color: '#30D158',
    phase: 2,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'vsm',
    name: 'Método VSM',
    shortName: 'VSM',
    description: 'Framework de desenvolvimento pessoal',
    prompt: 'Quero calcular e interpretar meu VSM com base no meu diagnóstico.',
    icon: 'trending-up-outline',
    color: '#00D4FF',
    phase: 3,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'personal-image',
    name: 'Imagem Pessoal',
    shortName: 'Imagem',
    description: 'Melhorar sua apresentação visual',
    prompt: 'Quero montar meu plano de imagem pessoal.',
    icon: 'shirt-outline',
    color: '#FF6B8A',
    phase: 4,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'wealth-plan',
    name: 'Plano de Riqueza',
    shortName: 'Riqueza',
    description: 'Estratégia financeira e abundância',
    prompt: 'Quero meu plano de riqueza e carreira para os próximos 12 meses.',
    icon: 'cash-outline',
    color: '#FFD700',
    phase: 5,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'study-plan',
    name: 'Plano de Estudos',
    shortName: 'Estudos',
    description: 'Rotina de aprendizado e evolução',
    prompt: 'Quero meu plano de estudos estruturado com base no meu diagnóstico.',
    icon: 'book-outline',
    color: '#3B82F6',
    phase: 6,
    requiresStructuredDiagnosis: true,
  },
  {
    id: 'instagram-analyzer',
    name: 'Analisador de Instagram',
    shortName: 'Instagram',
    description: 'Análise do seu perfil nas redes',
    prompt: 'Quero analisar meu Instagram com foco em atração e posicionamento.',
    icon: 'logo-instagram',
    color: '#E1306C',
    phase: 7,
    requiresStructuredDiagnosis: true,
  },
];
