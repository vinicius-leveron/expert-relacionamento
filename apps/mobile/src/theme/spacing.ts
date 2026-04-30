/**
 * Design System - Espaçamentos
 *
 * Grid baseado em múltiplos de 4px/8px para consistência.
 * Usar estas constantes para padding, margin, gap.
 */

export const spacing = {
  // ============================================
  // ESPAÇAMENTOS BASE
  // Escala consistente para layouts
  // ============================================
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  // ============================================
  // BORDER RADIUS
  // Arredondamentos padronizados
  // ============================================
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const sizes = {
  // ============================================
  // TAMANHOS COMUNS
  // Dimensões reutilizáveis para componentes
  // ============================================

  // Ícones
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,

  // Avatares
  avatarSm: 32,
  avatarMd: 44,
  avatarLg: 64,
  avatarXl: 80,

  // Botões
  buttonHeight: 52,
  buttonHeightSm: 40,

  // Inputs
  inputHeight: 52,
  inputHeightSm: 44,

  // Touch targets (acessibilidade)
  touchMin: 44,
} as const;

// Tipos para autocomplete
export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type SizeKey = keyof typeof sizes;
