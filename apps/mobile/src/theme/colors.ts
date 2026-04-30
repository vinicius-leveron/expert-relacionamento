/**
 * Design System - Paleta de Cores (Estilo Tinder Dark)
 *
 * Cores centralizadas para consistência visual em todo o app.
 * Usar estas constantes ao invés de valores hardcoded.
 */

export const colors = {
  // ============================================
  // CORES PRIMÁRIAS (Gradiente Tinder)
  // ============================================
  primary: '#FE3C72', // Rosa Tinder
  primaryDark: '#FF655B', // Laranja-rosa
  primaryLight: '#FF7854', // Laranja claro
  primaryGradient: ['#FE3C72', '#FF655B', '#FF7854'] as const,

  // Accent (dourado premium)
  accent: '#FFD700',
  accentLight: '#FFE55C',

  // ============================================
  // CORES NEUTRAS (Dark Mode)
  // ============================================
  white: '#FFFFFF',
  gray50: '#2C2C2E', // Cards claros no dark
  gray100: '#1C1C1E', // Cards escuros
  gray200: '#3A3A3C', // Bordas no dark
  gray300: '#48484A',
  gray400: '#636366',
  gray500: '#8E8E93',
  gray600: '#AEAEB2',
  gray700: '#C7C7CC',
  gray800: '#D1D1D6',
  gray900: '#E5E5EA',
  black: '#000000',

  // ============================================
  // CORES DE SISTEMA
  // ============================================
  success: '#30D158', // Verde iOS
  successLight: '#1C3829',
  successDark: '#28A745',

  error: '#FF453A', // Vermelho iOS
  errorLight: '#3D1E1E',
  errorDark: '#D32F2F',

  warning: '#FFD60A', // Amarelo iOS
  warningLight: '#3D3A1E',
  warningDark: '#FF9500',

  info: '#0A84FF', // Azul iOS
  infoLight: '#1E2D3D',
  infoDark: '#007AFF',

  // ============================================
  // CORES SEMÂNTICAS (Dark Theme)
  // ============================================
  background: '#000000', // Fundo principal preto
  surface: '#1C1C1E', // Cards e superfícies
  surfaceElevated: '#2C2C2E', // Superfícies elevadas
  border: '#38383A', // Bordas sutis

  textPrimary: '#FFFFFF', // Texto principal branco
  textSecondary: '#8E8E93', // Texto secundário
  textMuted: '#636366', // Texto apagado
  textInverse: '#000000', // Texto em fundos claros

  // Status
  online: '#30D158',
  offline: '#636366',

  // ============================================
  // CORES ESPECIAIS TINDER
  // ============================================
  like: '#30D158', // Verde like
  nope: '#FF453A', // Vermelho nope
  superlike: '#00D4FF', // Azul super like
  boost: '#A855F7', // Roxo boost
  gold: '#FFD700', // Dourado premium
} as const;

// Tipo para autocomplete e type safety
export type ColorKey = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorKey];
