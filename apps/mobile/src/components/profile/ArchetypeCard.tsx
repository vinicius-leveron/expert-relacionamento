import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

const ARCHETYPE_DATA = {
  ansioso: {
    name: 'Ansioso',
    icon: 'heart' as const,
    color: '#EC4899',
    shortDescription: 'Busca proximidade e validação nos relacionamentos.',
  },
  seguro: {
    name: 'Seguro',
    icon: 'shield-checkmark' as const,
    color: '#10B981',
    shortDescription: 'Equilibra intimidade e independência com facilidade.',
  },
  evitante: {
    name: 'Evitante',
    icon: 'shield' as const,
    color: '#3B82F6',
    shortDescription: 'Valoriza independência e espaço pessoal.',
  },
  desorganizado: {
    name: 'Desorganizado',
    icon: 'shuffle' as const,
    color: '#F59E0B',
    shortDescription: 'Oscila entre proximidade e distância emocional.',
  },
};

interface ArchetypeCardProps {
  archetype: string;
  completedAt?: string;
}

export function ArchetypeCard({ archetype, completedAt }: ArchetypeCardProps) {
  const data = ARCHETYPE_DATA[archetype as keyof typeof ARCHETYPE_DATA] || ARCHETYPE_DATA.seguro;

  const handlePress = () => {
    router.push({
      pathname: '/(app)/archetype',
      params: { archetype },
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: data.color }]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityLabel={`Seu arquétipo é ${data.name}. Toque para ver detalhes.`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${data.color}20` }]}>
          <Ionicons name={data.icon} size={28} color={data.color} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.label}>Seu arquétipo</Text>
          <Text style={[styles.name, { color: data.color }]}>{data.name}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <Text style={styles.description}>{data.shortDescription}</Text>

      {completedAt && (
        <Text style={styles.date}>
          Descoberto em {new Date(completedAt).toLocaleDateString('pt-BR')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...getShadow('sm'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  name: {
    ...typography.h2,
    fontFamily: 'Inter_700Bold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
  },
});
