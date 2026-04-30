import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow, sizes } from '@/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const ARCHETYPES = {
  ansioso: {
    name: 'Ansioso',
    icon: 'heart' as const,
    color: '#EC4899',
    description:
      'Você tende a buscar muita proximidade e validação nos relacionamentos. Tem medo de abandono e pode ficar ansioso quando sente distância do parceiro.',
    strengths: [
      'Muito dedicado e comprometido',
      'Expressivo emocionalmente',
      'Busca conexão profunda',
    ],
    challenges: [
      'Pode parecer "grudento"',
      'Dificuldade com incertezas',
      'Tendência a interpretar sinais negativamente',
    ],
    focus:
      'Desenvolver autoconfiança e aprender a se acalmar sozinho quando sentir ansiedade.',
  },
  seguro: {
    name: 'Seguro',
    icon: 'shield-checkmark' as const,
    color: '#10B981',
    description:
      'Você tem uma visão equilibrada dos relacionamentos. Consegue ser íntimo sem perder sua individualidade e lida bem com conflitos.',
    strengths: [
      'Comunica-se de forma clara e saudável',
      'Equilibra proximidade e independência',
      'Lida bem com conflitos',
    ],
    challenges: [
      'Pode se frustrar com parceiros inseguros',
      'Às vezes subestima problemas',
      'Pode parecer "desligado" para parceiros ansiosos',
    ],
    focus:
      'Manter suas qualidades e desenvolver ainda mais empatia com diferentes estilos de apego.',
  },
  evitante: {
    name: 'Evitante',
    icon: 'shield' as const,
    color: '#3B82F6',
    description:
      'Você valoriza muito sua independência e pode sentir desconforto com muita intimidade. Tende a se afastar quando as coisas ficam muito intensas.',
    strengths: [
      'Independente e autossuficiente',
      'Mantém a calma em situações difíceis',
      'Não é "carente"',
    ],
    challenges: [
      'Dificuldade em expressar emoções',
      'Pode parecer distante ou frio',
      'Tendência a evitar conflitos',
    ],
    focus:
      'Aprender a tolerar mais intimidade e expressar suas necessidades emocionais.',
  },
  desorganizado: {
    name: 'Desorganizado',
    icon: 'shuffle' as const,
    color: '#F59E0B',
    description:
      'Você oscila entre querer muita proximidade e se afastar. Pode ter reações intensas e imprevisíveis nos relacionamentos.',
    strengths: [
      'Capaz de grande paixão',
      'Busca conexões significativas',
      'Pode ser muito empático',
    ],
    challenges: [
      'Comportamentos contraditórios',
      'Dificuldade em confiar',
      'Reações intensas ao estresse',
    ],
    focus:
      'Trabalhar em regular suas emoções e desenvolver um senso de segurança interno.',
  },
};

export default function DiagnosticResultScreen() {
  const { archetype: archetypeKey } = useLocalSearchParams<{ archetype: string }>();
  const archetype = ARCHETYPES[archetypeKey as keyof typeof ARCHETYPES] || ARCHETYPES.seguro;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate reveal
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [scaleAnim, fadeAnim, slideAnim]);

  const handleContinue = () => {
    router.replace('/(app)/(tabs)/journey');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Icon Reveal */}
        <Animated.View
          style={[
            styles.iconContainer,
            { backgroundColor: archetype.color },
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons name={archetype.icon} size={60} color={colors.white} />
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.label}>Seu padrão dominante hoje é</Text>
          <Text style={[styles.title, { color: archetype.color }]}>
            {archetype.name}
          </Text>
          <Text style={styles.description}>{archetype.description}</Text>

          {/* Strengths */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Forças que já existem em você</Text>
            </View>
            {archetype.strengths.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: colors.success }]} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Challenges */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Pontos de atenção</Text>
            </View>
            {archetype.challenges.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: colors.warning }]} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Focus */}
          <View style={styles.focusCard}>
            <Ionicons name="bulb" size={24} color={colors.primary} />
            <Text style={styles.focusTitle}>Próximo passo mais útil</Text>
            <Text style={styles.focusText}>{archetype.focus}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Ver meu plano inicial</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...getShadow('lg'),
  },
  content: {
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_500Medium',
  },
  title: {
    ...typography.display,
    marginBottom: spacing.md,
    fontFamily: 'Inter_700Bold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.lg + spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: spacing.sm,
  },
  listText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
  focusCard: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  focusTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  focusText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    ...getShadow('sm'),
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
