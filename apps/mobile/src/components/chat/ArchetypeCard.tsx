import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, getShadow } from '@/theme';
import type { ArchetypeCardData } from '@/utils/message-parser';

const ARCHETYPE_INFO = {
  ansioso: {
    name: 'Ansioso',
    icon: 'heart' as const,
    color: '#EC4899',
    tagline: 'Busca conexão e proximidade',
  },
  seguro: {
    name: 'Seguro',
    icon: 'shield-checkmark' as const,
    color: '#10B981',
    tagline: 'Equilibra intimidade e independência',
  },
  evitante: {
    name: 'Evitante',
    icon: 'shield' as const,
    color: '#3B82F6',
    tagline: 'Valoriza espaço e autonomia',
  },
  desorganizado: {
    name: 'Desorganizado',
    icon: 'shuffle' as const,
    color: '#F59E0B',
    tagline: 'Oscila entre proximidade e distância',
  },
};

interface ArchetypeCardProps {
  data: ArchetypeCardData;
  onPress?: () => void;
}

export function ArchetypeCard({ data, onPress }: ArchetypeCardProps) {
  const info = ARCHETYPE_INFO[data.archetype] || ARCHETYPE_INFO.seguro;

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: info.color }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${info.color}20` }]}>
          <Ionicons name={info.icon} size={24} color={info.color} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>Seu arquétipo</Text>
          <Text style={[styles.name, { color: info.color }]}>{info.name}</Text>
        </View>
      </View>

      <Text style={styles.tagline}>{info.tagline}</Text>

      {data.description && (
        <Text style={styles.description}>{data.description}</Text>
      )}

      {onPress && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Toque para saber mais</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 4,
    ...getShadow('sm'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  name: {
    ...typography.h3,
    fontFamily: 'Inter_700Bold',
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    marginRight: spacing.xs,
  },
});
