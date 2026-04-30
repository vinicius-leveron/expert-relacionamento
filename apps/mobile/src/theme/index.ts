/**
 * Design System - Exports
 *
 * Ponto central de importação do design system.
 * Importar sempre daqui: import { colors, spacing } from '@/theme';
 */

export { colors } from './colors';
export type { ColorKey, ColorValue } from './colors';

export { spacing, radius, sizes } from './spacing';
export type { SpacingKey, RadiusKey, SizeKey } from './spacing';

export { shadows, webShadows, getShadow } from './shadows';
export type { ShadowKey } from './shadows';

export { typography, fontFamily, fontFamilyFallback } from './typography';
export type { TypographyKey } from './typography';
