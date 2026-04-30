import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

const ARCHETYPES = {
  ansioso: {
    name: 'Ansioso',
    icon: 'heart' as const,
    color: '#EC4899',
    description:
      'O arquétipo Ansioso se caracteriza por uma intensa necessidade de proximidade e validação nos relacionamentos. Pessoas com esse perfil tendem a se preocupar constantemente com a disponibilidade emocional do parceiro e podem interpretar pequenos sinais como indicadores de rejeição.',
    strengths: [
      { title: 'Dedicação', text: 'Extremamente dedicado e comprometido com o relacionamento.' },
      { title: 'Expressividade', text: 'Expressa emoções de forma clara e busca conexão profunda.' },
      { title: 'Atenção', text: 'Muito atento às necessidades do parceiro.' },
    ],
    challenges: [
      { title: 'Dependência', text: 'Pode desenvolver dependência emocional excessiva.' },
      { title: 'Interpretação', text: 'Tendência a interpretar situações de forma negativa.' },
      { title: 'Ansiedade', text: 'Dificuldade em lidar com incertezas no relacionamento.' },
    ],
    tips: [
      'Pratique técnicas de auto-regulação emocional',
      'Desenvolva hobbies e interesses próprios',
      'Comunique suas necessidades de forma clara, não através de comportamentos',
      'Aprenda a tolerar pequenos períodos de distância',
    ],
  },
  seguro: {
    name: 'Seguro',
    icon: 'shield-checkmark' as const,
    color: '#10B981',
    description:
      'O arquétipo Seguro representa o equilíbrio ideal nos relacionamentos. Pessoas com esse perfil conseguem ser íntimas sem perder sua individualidade, lidam bem com conflitos e mantêm expectativas realistas sobre seus parceiros.',
    strengths: [
      { title: 'Comunicação', text: 'Comunica-se de forma clara, aberta e respeitosa.' },
      { title: 'Equilíbrio', text: 'Equilibra naturalmente proximidade e independência.' },
      { title: 'Resiliência', text: 'Lida bem com conflitos e desafios no relacionamento.' },
    ],
    challenges: [
      { title: 'Frustração', text: 'Pode se frustrar com parceiros mais inseguros.' },
      { title: 'Complacência', text: 'Às vezes pode minimizar problemas reais.' },
      { title: 'Percepção', text: 'Pode parecer "frio" para parceiros mais ansiosos.' },
    ],
    tips: [
      'Continue desenvolvendo sua inteligência emocional',
      'Seja paciente com parceiros de outros arquétipos',
      'Use suas habilidades para ajudar o parceiro a se sentir seguro',
      'Mantenha a comunicação aberta sobre expectativas',
    ],
  },
  evitante: {
    name: 'Evitante',
    icon: 'shield' as const,
    color: '#3B82F6',
    description:
      'O arquétipo Evitante valoriza profundamente a independência e autonomia. Pessoas com esse perfil podem sentir desconforto com muita intimidade emocional e tendem a se afastar quando sentem que estão "perdendo" sua liberdade.',
    strengths: [
      { title: 'Independência', text: 'Altamente independente e autossuficiente.' },
      { title: 'Estabilidade', text: 'Mantém a calma em situações emocionalmente intensas.' },
      { title: 'Autonomia', text: 'Não é "carente" e respeita o espaço do outro.' },
    ],
    challenges: [
      { title: 'Expressão', text: 'Dificuldade em expressar emoções e vulnerabilidade.' },
      { title: 'Distância', text: 'Pode parecer distante, frio ou desinteressado.' },
      { title: 'Evitação', text: 'Tendência a evitar conflitos ao invés de resolvê-los.' },
    ],
    tips: [
      'Pratique pequenos atos de vulnerabilidade diariamente',
      'Aprenda a identificar e nomear suas emoções',
      'Comunique quando precisar de espaço, ao invés de simplesmente se afastar',
      'Reconheça que intimidade não significa perda de identidade',
    ],
  },
  desorganizado: {
    name: 'Desorganizado',
    icon: 'shuffle' as const,
    color: '#F59E0B',
    description:
      'O arquétipo Desorganizado é caracterizado por um padrão conflitante: deseja intimidade mas também a teme. Pessoas com esse perfil podem oscilar entre buscar proximidade intensamente e se afastar abruptamente.',
    strengths: [
      { title: 'Intensidade', text: 'Capaz de sentir e expressar grande paixão.' },
      { title: 'Profundidade', text: 'Busca conexões significativas e autênticas.' },
      { title: 'Empatia', text: 'Pode ser extremamente empático e compreensivo.' },
    ],
    challenges: [
      { title: 'Inconsistência', text: 'Comportamentos podem parecer contraditórios.' },
      { title: 'Confiança', text: 'Dificuldade em confiar plenamente no parceiro.' },
      { title: 'Regulação', text: 'Reações intensas ao estresse relacional.' },
    ],
    tips: [
      'Busque apoio terapêutico para processar experiências passadas',
      'Pratique técnicas de regulação emocional regularmente',
      'Comunique ao parceiro sobre seus padrões antes que causem conflito',
      'Desenvolva um senso de segurança interno através de auto-cuidado',
    ],
  },
};

export default function ArchetypeDetailScreen() {
  const { archetype: archetypeKey } = useLocalSearchParams<{ archetype: string }>();
  const archetype = ARCHETYPES[archetypeKey as keyof typeof ARCHETYPES] || ARCHETYPES.seguro;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seu Arquétipo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: archetype.color }]}>
            <Ionicons name={archetype.icon} size={48} color={colors.white} />
          </View>

          {/* Name */}
          <Text style={[styles.name, { color: archetype.color }]}>{archetype.name}</Text>

          {/* Description */}
          <Text style={styles.description}>{archetype.description}</Text>

          {/* Strengths */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Pontos Fortes</Text>
            </View>
            {archetype.strengths.map((item, index) => (
              <View key={index} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{item.title}</Text>
                <Text style={styles.listCardText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Challenges */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Desafios</Text>
            </View>
            {archetype.challenges.map((item, index) => (
              <View key={index} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{item.title}</Text>
                <Text style={styles.listCardText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Tips */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Dicas de Crescimento</Text>
            </View>
            <View style={styles.tipsCard}>
              {archetype.tips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <View style={styles.tipNumber}>
                    <Text style={styles.tipNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...getShadow('lg'),
  },
  name: {
    ...typography.display,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'Inter_700Bold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...getShadow('sm'),
  },
  listCardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  listCardText: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  tipsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  tipNumberText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  tipText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
});
