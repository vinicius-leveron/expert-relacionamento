/**
 * Design System - Paleta de Cores
 *
 * Cores centralizadas para consistência visual em todo o app.
 * Usar estas constantes ao invés de valores hardcoded.
 */

export const colors = {
  // ============================================
  // CORES PRIMÁRIAS
  // Usadas para elementos de destaque, CTAs, links
  // ============================================
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  primaryLight: '#F5F3FF',

  // ============================================
  // CORES NEUTRAS
  // Usadas para backgrounds, textos, bordas
  // ============================================
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  black: '#000000',

  // ============================================
  // CORES DE SISTEMA
  // Usadas para feedback e estados
  // ============================================
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',

  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',

  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',

  // ============================================
  // CORES SEMÂNTICAS
  // Aliases para uso contextual
  // ============================================
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Status online/offline
  online: '#10B981',
  offline: '#9CA3AF',
} as const;

// Tipo para autocomplete e type safety
export type ColorKey = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorKey];
