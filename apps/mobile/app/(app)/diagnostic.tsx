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
    question: 'Como você geralmente reage quando seu parceiro(a) não responde suas mensagens rapidamente?',
    options: [
      { id: '1a', text: 'Fico ansioso e mando mais mensagens', value: 'ansioso' },
      { id: '1b', text: 'Não me incomodo, sei que ela está ocupada', value: 'seguro' },
      { id: '1c', text: 'Prefiro nem mandar mensagem para evitar rejeição', value: 'evitante' },
      { id: '1d', text: 'Depende do meu humor no dia', value: 'desorganizado' },
    ],
  },
  {
    id: '2',
    question: 'Em um relacionamento, você costuma:',
    options: [
      { id: '2a', text: 'Buscar proximidade e validação constantemente', value: 'ansioso' },
      { id: '2b', text: 'Manter equilíbrio entre proximidade e independência', value: 'seguro' },
      { id: '2c', text: 'Valorizar muito sua independência e espaço pessoal', value: 'evitante' },
      { id: '2d', text: 'Alternar entre querer muita proximidade e se afastar', value: 'desorganizado' },
    ],
  },
  {
    id: '3',
    question: 'Quando surgem conflitos no relacionamento, você:',
    options: [
      { id: '3a', text: 'Precisa resolver tudo imediatamente', value: 'ansioso' },
      { id: '3b', text: 'Consegue discutir com calma e encontrar soluções', value: 'seguro' },
      { id: '3c', text: 'Prefere evitar ou minimizar o conflito', value: 'evitante' },
      { id: '3d', text: 'Às vezes explode, às vezes se fecha', value: 'desorganizado' },
    ],
  },
  {
    id: '4',
    question: 'Como você se sente em relação à intimidade emocional?',
    options: [
      { id: '4a', text: 'Desejo muito, mas tenho medo de ser abandonado', value: 'ansioso' },
      { id: '4b', text: 'Me sinto confortável sendo vulnerável', value: 'seguro' },
      { id: '4c', text: 'Me sinto desconfortável quando fica muito íntimo', value: 'evitante' },
      { id: '4d', text: 'Quero, mas ao mesmo tempo me assusta', value: 'desorganizado' },
    ],
  },
  {
    id: '5',
    question: 'Quando o relacionamento termina, você geralmente:',
    options: [
      { id: '5a', text: 'Sofro muito e tenho dificuldade em seguir em frente', value: 'ansioso' },
      { id: '5b', text: 'Processo a dor e eventualmente sigo em frente', value: 'seguro' },
      { id: '5c', text: 'Sigo em frente rapidamente, "supero" logo', value: 'evitante' },
      { id: '5d', text: 'Fico confuso, às vezes aliviado, às vezes devastado', value: 'desorganizado' },
    ],
  },
];

export default function DiagnosticScreen() {
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
    if (isFirstQuestion) {
      router.back();
    } else {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
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
      {/* Header */}
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

      {/* Progress */}
      <ProgressBar current={currentIndex + 1} total={QUESTIONS.length} />

      {/* Question */}
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        selectedOption={selectedOption}
        onSelectOption={handleSelectOption}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            !selectedOption && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!selectedOption}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastQuestion ? 'Ver Resultado' : 'Próxima'}
          </Text>
          <Ionicons
            name={isLastQuestion ? 'checkmark' : 'arrow-forward'}
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
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
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
