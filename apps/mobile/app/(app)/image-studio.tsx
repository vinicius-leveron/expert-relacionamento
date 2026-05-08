import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/api/client';
import { SubscriptionRequiredState } from '@/components/paywall';
import { useProfileStore } from '@/stores/profile.store';
import { colors, getShadow, radius, spacing, typography } from '@/theme';

type ImageStyle = 'vivid' | 'natural';
type ImageQuality = 'standard' | 'hd';

interface ImageQuotaResponse {
  available: boolean;
  remaining: number;
  used: number;
  limit: number;
  resetAt: number;
}

interface ImageGenerateSuccessResponse {
  success: true;
  image: {
    base64?: string;
    mimeType?: string;
    url?: string;
  };
  provider: string;
  rateLimitInfo?: {
    remaining: number | null;
    resetAt: number;
  };
}

type ImageGenerateErrorResponse = {
  error?: string;
  message?: string;
  usage?: {
    remaining?: number;
    used?: number;
    limit?: number;
  };
  resetAt?: number;
};

const PROMPT_SUGGESTIONS = [
  'Retrato editorial masculino com luz lateral, fundo neutro e presença confiante.',
  'Moodboard quadrado de estilo pessoal com relógio, blazer escuro e tons dourados.',
  'Foto de perfil premium para Instagram com estética clean, direta e sofisticada.',
];

const STYLE_OPTIONS: Array<{
  value: ImageStyle;
  label: string;
  description: string;
}> = [
  {
    value: 'vivid',
    label: 'Impacto',
    description: 'Mais contraste e presença visual.',
  },
  {
    value: 'natural',
    label: 'Natural',
    description: 'Tons realistas e estética mais suave.',
  },
];

const QUALITY_OPTIONS: Array<{
  value: ImageQuality;
  label: string;
  description: string;
}> = [
  {
    value: 'standard',
    label: 'Rápida',
    description: 'Entrega mais leve para iteração.',
  },
  {
    value: 'hd',
    label: 'HD',
    description: 'Mais detalhe quando o criativo já estiver claro.',
  },
];

export default function ImageStudioScreen() {
  const { profile, fetchProfile, isLoading: isProfileLoading } = useProfileStore();
  const [prompt, setPrompt] = useState(PROMPT_SUGGESTIONS[0]);
  const [style, setStyle] = useState<ImageStyle>('vivid');
  const [quality, setQuality] = useState<ImageQuality>('standard');
  const [quota, setQuota] = useState<ImageQuotaResponse | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [isQuotaLoading, setIsQuotaLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile && !isProfileLoading) {
      void fetchProfile();
    }
  }, [fetchProfile, isProfileLoading, profile]);

  const hasActiveSubscription = profile?.access.hasActiveSubscription === true;

  const loadQuota = useCallback(async () => {
    setIsQuotaLoading(true);
    setQuotaError(null);

    try {
      const response = await api.get<ImageQuotaResponse & { error?: string; message?: string }>(
        '/images/quota',
      );

      if (response.status === 200) {
        setQuota(response.data);
        return;
      }

      if (response.status === 403) {
        setQuota(null);
        return;
      }

      if (response.status === 503) {
        setQuotaError('A geração de imagem ainda não está configurada neste ambiente.');
        return;
      }

      setQuotaError(
        response.data?.message || 'Não consegui carregar sua cota de imagens agora.',
      );
    } catch {
      setQuotaError('Não consegui carregar sua cota de imagens agora.');
    } finally {
      setIsQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasActiveSubscription) {
      void loadQuota();
      return;
    }

    setIsQuotaLoading(false);
    setQuota(null);
    setQuotaError(null);
  }, [hasActiveSubscription, loadQuota]);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setGenerationError('Descreva a imagem antes de gerar.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await api.post<
        ImageGenerateSuccessResponse | ImageGenerateErrorResponse
      >('/images/generate', {
        prompt: trimmedPrompt,
        style,
        quality,
        size: '1024x1024',
      });

      if (response.status === 200 && 'success' in response.data && response.data.success) {
        const imageUri = response.data.image.base64
          ? `data:${response.data.image.mimeType ?? 'image/png'};base64,${response.data.image.base64}`
          : response.data.image.url ?? null;

        setGeneratedImageUri(imageUri);
        setProviderName(response.data.provider);

        if (quota) {
          setQuota({
            available: (response.data.rateLimitInfo?.remaining ?? 0) > 0,
            remaining:
              response.data.rateLimitInfo?.remaining === null
                ? quota.remaining
                : response.data.rateLimitInfo?.remaining ?? quota.remaining,
            used:
              response.data.rateLimitInfo?.remaining === null
                ? quota.used
                : Math.max(0, quota.limit - (response.data.rateLimitInfo?.remaining ?? quota.remaining)),
            limit: quota.limit,
            resetAt: response.data.rateLimitInfo?.resetAt ?? quota.resetAt,
          });
        } else {
          await loadQuota();
        }

        return;
      }

      if (response.status === 429) {
        const errorBody = response.data as ImageGenerateErrorResponse;
        setGenerationError(
          errorBody.message || 'Sua cota mensal de imagens foi consumida.',
        );

        if (quota && errorBody.usage) {
          setQuota({
            available: false,
            remaining: errorBody.usage.remaining ?? 0,
            used: errorBody.usage.used ?? quota.used,
            limit: errorBody.usage.limit ?? quota.limit,
            resetAt: errorBody.resetAt ?? quota.resetAt,
          });
        }

        return;
      }

      if (response.status === 503) {
        setGenerationError('A geração de imagem ainda não está configurada neste ambiente.');
        return;
      }

      const errorBody = response.data as ImageGenerateErrorResponse;
      setGenerationError(errorBody.message || 'Não consegui gerar a imagem agora.');
    } catch {
      setGenerationError('Não consegui gerar a imagem agora.');
    } finally {
      setIsGenerating(false);
    }
  }, [loadQuota, prompt, quality, quota, style]);

  const resetDateLabel = useMemo(() => {
    if (!quota?.resetAt) {
      return null;
    }

    return new Date(quota.resetAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  }, [quota?.resetAt]);

  if (profile && !profile.access.hasActiveSubscription) {
    return (
      <SubscriptionRequiredState
        title="O Estúdio Visual faz parte do acesso premium"
        description="Ative sua assinatura para gerar imagens no app, acompanhar sua cota e iterar criativos com o Gemini."
        onPrimaryPress={() => router.push('/(app)/subscription')}
        checkoutBlocked={
          Platform.OS !== 'web' && profile.commerce.nativeCheckoutMode === 'blocked'
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Estúdio Visual</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <LinearGradient
          colors={['#0F172A', '#4C1D95', '#FE3C72']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color={colors.white} />
            <Text style={styles.heroBadgeText}>Gemini</Text>
          </View>
          <Text style={styles.heroTitle}>Gere visuais sem sair do app</Text>
          <Text style={styles.heroDescription}>
            Use prompts rápidos para explorar retratos, capas e criativos
            quadrados com estética premium.
          </Text>

          <View style={styles.quotaCard}>
            <Text style={styles.quotaLabel}>Cota do mês</Text>
            {isQuotaLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : quota ? (
              <>
                <Text style={styles.quotaValue}>
                  {quota.remaining}/{quota.limit}
                </Text>
                <Text style={styles.quotaDescription}>
                  {resetDateLabel
                    ? `Renova em ${resetDateLabel}`
                    : 'Cota ativa neste ciclo'}
                </Text>
              </>
            ) : (
              <Text style={styles.quotaDescription}>
                {quotaError || 'A cota aparece assim que sua assinatura estiver ativa.'}
              </Text>
            )}
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ideias prontas</Text>
          <View style={styles.suggestions}>
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionChip}
                activeOpacity={0.9}
                onPress={() => setPrompt(suggestion)}
              >
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prompt</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Descreva o visual que você quer gerar..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={styles.promptInput}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Direção visual</Text>
          <View style={styles.optionGrid}>
            {STYLE_OPTIONS.map((option) => (
              <SelectableCard
                key={option.value}
                title={option.label}
                description={option.description}
                selected={style === option.value}
                onPress={() => setStyle(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qualidade</Text>
          <View style={styles.optionGrid}>
            {QUALITY_OPTIONS.map((option) => (
              <SelectableCard
                key={option.value}
                title={option.label}
                description={option.description}
                selected={quality === option.value}
                onPress={() => setQuality(option.value)}
              />
            ))}
          </View>
        </View>

        {generationError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{generationError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          activeOpacity={0.9}
          onPress={() => void handleGenerate()}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="image" size={18} color={colors.white} />
              <Text style={styles.generateButtonText}>Gerar imagem</Text>
            </>
          )}
        </TouchableOpacity>

        {generatedImageUri ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultTitle}>Última geração</Text>
                <Text style={styles.resultSubtitle}>
                  {providerName ?? 'Gemini'} • formato quadrado
                </Text>
              </View>
              {quota ? (
                <View style={styles.resultBadge}>
                  <Text style={styles.resultBadgeText}>{quota.remaining} restantes</Text>
                </View>
              ) : null}
            </View>
            <Image source={{ uri: generatedImageUri }} style={styles.generatedImage} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface SelectableCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

function SelectableCard({
  title,
  description,
  selected,
  onPress,
}: SelectableCardProps) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
      <Text
        style={[
          styles.optionDescription,
          selected && styles.optionDescriptionSelected,
        ]}
      >
        {description}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  topBarTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  topBarSpacer: {
    width: 42,
  },
  heroCard: {
    borderRadius: 30,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  heroTitle: {
    ...typography.h1,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  heroDescription: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: 'Inter_400Regular',
  },
  quotaCard: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: spacing.xs,
  },
  quotaLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Inter_600SemiBold',
  },
  quotaValue: {
    ...typography.display,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  quotaDescription: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.84)',
    fontFamily: 'Inter_400Regular',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    marginBottom: spacing.sm,
  },
  suggestions: {
    gap: spacing.sm,
  },
  suggestionChip: {
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
  },
  promptInput: {
    minHeight: 160,
    borderRadius: radius.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    ...typography.body,
    fontFamily: 'Inter_400Regular',
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(254,60,114,0.12)',
  },
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  optionTitleSelected: {
    color: colors.white,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  optionDescriptionSelected: {
    color: 'rgba(255,255,255,0.78)',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.25)',
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.white,
    flex: 1,
    fontFamily: 'Inter_500Medium',
  },
  generateButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_700Bold',
  },
  resultCard: {
    borderRadius: radius.xxl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  resultSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  resultBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.successLight,
  },
  resultBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontFamily: 'Inter_700Bold',
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.gray100,
  },
});
