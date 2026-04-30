import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar, QuestionCard, type DiagnosticQuestion } from '@/components/diagnostic';
import { colors, spacing, typography, radius, getShadow } from '@/theme';

const QUESTIONS: DiagnosticQuestion[] = [
  {
    id: '1',
    question: 'Quando a pessoa esfria, demora para responder ou some um pouco, o que costuma acontecer com você?',
    helperText: 'Escolha a reação que mais parece com você na prática.',
    options: [
      { id: '1a', text: 'Minha cabeça acelera e eu sinto vontade de insistir para ter uma resposta.', value: 'ansioso' },
      { id: '1b', text: 'Eu noto, mas consigo esperar sem perder o eixo.', value: 'seguro' },
      { id: '1c', text: 'Eu me fecho rápido e penso “deixa pra lá”.', value: 'evitante' },
      { id: '1d', text: 'Uma hora quero correr atrás, outra hora quero sumir também.', value: 'desorganizado' },
    ],
  },
  {
    id: '2',
    question: 'Quando a relação começa a ficar séria de verdade, qual tendência aparece mais em você?',
    helperText: 'Pense no início da intimidade, não no ideal que você gostaria de ter.',
    options: [
      { id: '2a', text: 'Eu preciso de sinais frequentes de que está tudo bem entre nós.', value: 'ansioso' },
      { id: '2b', text: 'Eu consigo me envolver sem perder meu equilíbrio.', value: 'seguro' },
      { id: '2c', text: 'Eu começo a sentir necessidade de mais espaço e menos cobrança.', value: 'evitante' },
      { id: '2d', text: 'Eu quero proximidade, mas fico desconfiado e mudo rápido.', value: 'desorganizado' },
    ],
  },
  {
    id: '3',
    question: 'Num conflito ou conversa difícil, como você tende a reagir?',
    helperText: 'Marque o padrão mais comum, mesmo que você não goste dele.',
    options: [
      { id: '3a', text: 'Eu preciso resolver na hora, senão fico muito inquieto.', value: 'ansioso' },
      { id: '3b', text: 'Eu consigo ouvir, falar e tentar construir uma solução.', value: 'seguro' },
      { id: '3c', text: 'Eu tendo a evitar, adiar ou agir como se não fosse tão importante.', value: 'evitante' },
      { id: '3d', text: 'Ou eu explodo, ou travo completamente.', value: 'desorganizado' },
    ],
  },
  {
    id: '4',
    question: 'Quando você gosta muito de alguém, qual é o seu maior incômodo interno?',
    helperText: 'Aqui o foco é no medo que mais te organiza por dentro.',
    options: [
      { id: '4a', text: 'Medo de perder a pessoa e ficar sem chão.', value: 'ansioso' },
      { id: '4b', text: 'Não é tão difícil me abrir e continuar sendo eu mesmo.', value: 'seguro' },
      { id: '4c', text: 'Sentir que estão entrando demais no meu espaço ou me cobrando demais.', value: 'evitante' },
      { id: '4d', text: 'Querer intimidade e, ao mesmo tempo, sentir medo dela.', value: 'desorganizado' },
    ],
  },
  {
    id: '5',
    question: 'Depois de um término, qual costuma ser seu movimento mais automático?',
    helperText: 'Não pense no que você posta; pense no que acontece por dentro.',
    options: [
      { id: '5a', text: 'Eu fico preso, revisitando tudo e tentando reabrir a conexão.', value: 'ansioso' },
      { id: '5b', text: 'Eu sofro, mas consigo elaborar e seguir adiante com o tempo.', value: 'seguro' },
      { id: '5c', text: 'Eu corto rápido e tento seguir como se já estivesse resolvido.', value: 'evitante' },
      { id: '5d', text: 'Eu oscilo: uma hora alívio, outra hora desespero total.', value: 'desorganizado' },
    ],
  },
];

export default function DiagnosticScreen() {
  const [stage, setStage] = useState<'intro' | 'questions'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const currentQuestion = QUESTIONS[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;
  const selectedOption = answers[currentQuestion.id] || null;

  const handleSelectOption = (optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  };

  const handleBack = () => {
    if (stage === 'intro') {
      router.back();
      return;
    }

    if (isFirstQuestion) {
      setStage('intro');
    } else {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (stage === 'intro') {
      setStage('questions');
      return;
    }

    if (!selectedOption) return;

    if (isLastQuestion) {
      // Calculate result and navigate
      const archetype = calculateArchetype(answers);
      router.push({
        pathname: '/(app)/diagnostic-result',
        params: { archetype },
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const calculateArchetype = (answers: Record<string, string>): string => {
    const counts: Record<string, number> = {
      ansioso: 0,
      seguro: 0,
      evitante: 0,
      desorganizado: 0,
    };

    Object.values(answers).forEach((optionId) => {
      const question = QUESTIONS.find((q) =>
        q.options.some((o) => o.id === optionId)
      );
      const option = question?.options.find((o) => o.id === optionId);
      if (option) {
        counts[option.value]++;
      }
    });

    return Object.entries(counts).reduce((a, b) =>
      counts[a[0]] > counts[b[0]] ? a : b
    )[0];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diagnóstico</Text>
        <View style={styles.headerSpacer} />
      </View>

      {stage === 'intro' ? (
        <View style={styles.introContainer}>
          <View style={styles.introHero}>
            <View style={styles.introAvatar}>
              <Text style={styles.introAvatarText}>I</Text>
            </View>
            <Text style={styles.introEyebrow}>Diagnóstico guiado pela Isabela</Text>
            <Text style={styles.introTitle}>Antes da jornada, eu preciso entender como você se vincula.</Text>
            <Text style={styles.introText}>
              Em 5 perguntas rápidas, eu vou identificar o padrão que mais aparece hoje nos seus relacionamentos.
              Não existe resposta certa. O objetivo é descobrir onde você se sabota e por onde começar.
            </Text>
          </View>

          <View style={styles.introBenefits}>
            <View style={styles.benefitCard}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.benefitTitle}>Leva menos de 2 minutos</Text>
              <Text style={styles.benefitText}>Sem texto longo e sem enrolação.</Text>
            </View>
            <View style={styles.benefitCard}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.benefitTitle}>Entrega direção prática</Text>
              <Text style={styles.benefitText}>Você sai com um foco claro para melhorar.</Text>
            </View>
            <View style={styles.benefitCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={styles.benefitTitle}>Sem julgamento</Text>
              <Text style={styles.benefitText}>É leitura de padrão, não rótulo definitivo.</Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          <ProgressBar current={currentIndex + 1} total={QUESTIONS.length} />

          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            selectedOption={selectedOption}
            onSelectOption={handleSelectOption}
          />
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            stage === 'questions' && !selectedOption && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={stage === 'questions' && !selectedOption}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {stage === 'intro'
              ? 'Começar diagnóstico'
              : isLastQuestion
                ? 'Ver meu resultado'
                : 'Próxima'}
          </Text>
          <Ionicons
            name={stage === 'questions' && isLastQuestion ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  introContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  introHero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...getShadow('md'),
  },
  introAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  introAvatarText: {
    color: colors.white,
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  introEyebrow: {
    ...typography.caption,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  introTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontFamily: 'Inter_700Bold',
  },
  introText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  introBenefits: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  benefitCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  benefitText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
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
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    ...getShadow('sm'),
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  nextButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
