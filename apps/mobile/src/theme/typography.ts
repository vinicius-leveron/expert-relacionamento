/**
 * Design System - Tipografia
 *
 * Escala tipográfica usando fonte Inter.
 * Definições para títulos, corpo e elementos UI.
 */

import { TextStyle } from 'react-native';

// ============================================
// FAMÍLIA DE FONTES
// ============================================

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

// Fallback para sistema caso fonte não carregue
export const fontFamilyFallback = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

// ============================================
// ESCALA TIPOGRÁFICA
// ============================================

type TypographyStyle = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>;

export const typography = {
  // Display - Títulos grandes e impactantes
  display: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  } as TypographyStyle,

  // H1 - Títulos principais
  h1: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 31,
    letterSpacing: -0.3,
  } as TypographyStyle,

  // H2 - Subtítulos
  h2: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.2,
  } as TypographyStyle,

  // H3 - Títulos de seção
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: 0,
  } as TypographyStyle,

  // Body - Texto principal
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0,
  } as TypographyStyle,

  // Body Medium - Texto com ênfase
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0,
  } as TypographyStyle,

  // Body Small - Texto secundário
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    letterSpacing: 0,
  } as TypographyStyle,

  // Caption - Rótulos e metadados
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: 0.2,
  } as TypographyStyle,

  // Button - Texto de botões
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.3,
  } as TypographyStyle,

  // Button Small - Botões menores
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.2,
  } as TypographyStyle,

  // Label - Labels de inputs
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0,
  } as TypographyStyle,
} as const;

// Tipo para autocomplete
export type TypographyKey = keyof typeof typography;
