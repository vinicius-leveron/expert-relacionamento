/**
 * Design System - Sombras
 *
 * Sombras para criar hierarquia visual e profundidade.
 * Compatível com iOS, Android e Web.
 */

import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

// ============================================
// SOMBRAS BASE
// 3 níveis de elevação para hierarquia visual
// ============================================

const shadowSm: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

const shadowMd: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

const shadowLg: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 5,
};

const shadowXl: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.2,
  shadowRadius: 16,
  elevation: 8,
};

// Sem sombra (reset)
const shadowNone: ShadowStyle = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

export const shadows = {
  none: shadowNone,
  sm: shadowSm,
  md: shadowMd,
  lg: shadowLg,
  xl: shadowXl,
} as const;

// ============================================
// HELPER PARA WEB
// Box-shadow CSS equivalente para web
// ============================================

export const webShadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 2px 4px rgba(0, 0, 0, 0.1)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.15)',
  xl: '0 8px 16px rgba(0, 0, 0, 0.2)',
} as const;

/**
 * Helper para aplicar sombra cross-platform
 * Usa box-shadow no web e shadow* props no native
 */
export function getShadow(level: keyof typeof shadows): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      // @ts-ignore - boxShadow é válido no web
      boxShadow: webShadows[level],
    };
  }
  return shadows[level];
}

// Tipos
export type ShadowKey = keyof typeof shadows;
