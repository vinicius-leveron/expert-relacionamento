import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { appLinks } from '@/config/app-links';
import { openExternalLink } from '@/utils/external-link';
import { captureAnalyticsEvent } from '@/analytics/posthog';

const HELP_ITEMS = [
  {
    title: 'Como ativar a assinatura',
    body:
      'Abra a tela de assinatura pelo perfil ou pela jornada bloqueada, conclua o checkout e depois toque em atualizar status dentro do app.',
  },
  {
    title: 'Por que um anexo ainda não foi usado',
    body:
      'Arquivos passam por upload, processamento e indexação. Enquanto o status não estiver como pronto, a IA ainda não consegue usá-los como contexto.',
  },
  {
    title: 'Como funciona a análise de imagem',
    body:
      'A imagem é enviada como entrada multimodal para a IA. Se sua conta não tiver acesso premium ativo, o recurso fica bloqueado após o diagnóstico.',
  },
];

export default function HelpScreen() {
  useEffect(() => {
    captureAnalyticsEvent('help_screen_viewed');
  }, []);

  const handleOpenSupport = () => {
    captureAnalyticsEvent('help_support_clicked');
    void openExternalLink(appLinks.supportUrl, {
      unavailableTitle: 'Suporte indisponível',
      unavailableMessage:
        'O canal externo de suporte ainda não foi configurado neste build.',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajuda</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Ionicons name="help-circle-outline" size={28} color={colors.primaryDark} />
          <Text style={styles.heroTitle}>Central rápida de suporte</Text>
          <Text style={styles.heroText}>
            Aqui ficam as respostas mais importantes para acesso, cobrança e uso do chat multimodal.
          </Text>
        </View>

        {HELP_ITEMS.map((item) => (
          <View key={item.title} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleOpenSupport} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Falar com suporte</Text>
          <Ionicons name="open-outline" size={18} color={colors.white} />
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
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...getShadow('md'),
  },
  heroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  heroText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...getShadow('sm'),
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: 'Inter_600SemiBold',
  },
  cardText: {
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
  primaryButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
