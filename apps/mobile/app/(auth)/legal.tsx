import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { appLinks } from '@/config/app-links';
import { openExternalLink } from '@/utils/external-link';
import { captureAnalyticsEvent } from '@/analytics/posthog';

type LegalDocument = 'terms' | 'privacy';

export default function LegalScreen() {
  const params = useLocalSearchParams<{ document?: string }>();
  const document = params.document === 'privacy' ? 'privacy' : 'terms';

  const content = useMemo(() => getLegalContent(document), [document]);

  const handleOpenExternal = () => {
    const url = document === 'privacy' ? appLinks.privacyUrl : appLinks.termsUrl;
    captureAnalyticsEvent(document === 'privacy' ? 'legal_privacy_external_opened' : 'legal_terms_external_opened', {
      source: 'legal_screen',
    });
    void openExternalLink(url, {
      unavailableTitle: 'Documento externo indisponível',
      unavailableMessage:
        'A versão externa desse documento ainda não foi configurada. Por enquanto, consulte a versão resumida no app.',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>{content.summary}</Text>

        {content.sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenExternal} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Abrir versão externa</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function getLegalContent(document: LegalDocument) {
  if (document === 'privacy') {
    return {
      title: 'Política de Privacidade',
      summary:
        'Usamos seus dados para autenticação, personalização da experiência e melhoria do produto, com acesso restrito aos serviços necessários para operar o app.',
      sections: [
        {
          title: 'Dados coletados',
          body:
            'Podemos armazenar email, telefone, mensagens trocadas com a assistente, diagnóstico gerado, progresso de jornada e status da sua assinatura.',
        },
        {
          title: 'Como usamos esses dados',
          body:
            'Os dados servem para autenticar sua conta, responder no chat, manter o histórico, liberar recursos do plano e medir a qualidade da experiência.',
        },
        {
          title: 'Compartilhamento',
          body:
            'Compartilhamos dados apenas com provedores operacionais necessários, como autenticação, infraestrutura, pagamento e analytics do produto.',
        },
        {
          title: 'Seus controles',
          body:
            'Você pode sair da conta a qualquer momento e solicitar ajustes operacionais sobre seus dados pelos canais oficiais de suporte quando estiverem configurados.',
        },
      ],
    };
  }

  return {
    title: 'Termos de Uso',
    summary:
      'A experiência do app é voltada a orientação assistida por IA e conteúdo educacional. Ela não substitui aconselhamento jurídico, médico ou terapêutico especializado.',
    sections: [
      {
        title: 'Uso da plataforma',
        body:
          'Ao usar o app, você concorda em fornecer informações verdadeiras, não abusar da infraestrutura e não utilizar a plataforma para fins ilegais ou ofensivos.',
      },
      {
        title: 'Assinatura e acesso',
        body:
          'Parte dos recursos depende de assinatura ativa, incluindo jornada premium, análise multimodal e uso de anexos como contexto no chat.',
      },
      {
        title: 'Limites e disponibilidade',
        body:
          'Podemos aplicar limites de uso, manutenção e ajustes operacionais para preservar desempenho, segurança e sustentabilidade do serviço.',
      },
      {
        title: 'Responsabilidade',
        body:
          'As respostas da IA são assistivas e podem falhar. Você continua responsável por decisões tomadas com base no conteúdo recebido no app.',
      },
    ],
  };
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  sectionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
});
