import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { colors, spacing, typography, radius, getShadow } from '@/theme';
import { captureAnalyticsEvent } from '@/analytics/posthog';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { sendMagicLink, verifyMagicLink } = useAuthStore();

  useEffect(() => {
    captureAnalyticsEvent('auth_login_viewed');
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Digite seu email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Email inválido');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const link = await sendMagicLink(email);
      captureAnalyticsEvent('auth_magic_link_requested', {
        email_domain: email.split('@')[1] ?? 'unknown',
      });
      setSuccess(true);

      // Em dev, faz auto-login
      if (link) {
        const url = new URL(link);
        const token = url.searchParams.get('token');
        if (token) {
          await verifyMagicLink(token);
          router.replace('/(app)');
        }
      }
    } catch (err) {
      captureAnalyticsEvent('auth_magic_link_request_failed');
      setError(err instanceof Error ? err.message : 'Falha ao enviar link. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Ionicons name="mail" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Quase lá</Text>
          <Text style={styles.subtitle}>
            Enviamos seu acesso para{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setSuccess(false)}
          >
            <Text style={styles.linkText}>Usar outro email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Avatar da Isabela */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>I</Text>
          </View>

          <Text style={styles.title}>Para de repetir os mesmos erros</Text>
          <Text style={styles.subtitle}>
            Entra e descobre onde você tá falhando nas conversas e nos relacionamentos
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, Platform.OS === 'web' ? styles.webTextInputReset : null]}
                placeholder="seu@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.buttonText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </>
              )}
            </TouchableOpacity>

            {/* Prova Social */}
            <View style={styles.socialProof}>
              <View style={styles.socialProofIcon}>
                <Ionicons name="people" size={16} color={colors.primary} />
              </View>
              <Text style={styles.socialProofText}>
                Acesso seguro por link no email, sem senha para memorizar.
              </Text>
            </View>
          </View>

          {/* Termos */}
          <Text style={styles.termsText}>
            Ao continuar, você concorda com nossos{' '}
            <Text
              style={styles.termsLink}
              onPress={() => {
                captureAnalyticsEvent('legal_terms_opened', { source: 'login' });
                router.push('/(auth)/legal?document=terms');
              }}
            >
              Termos de Uso
            </Text>{' '}
            e{' '}
            <Text
              style={styles.termsLink}
              onPress={() => {
                captureAnalyticsEvent('legal_privacy_opened', { source: 'login' });
                router.push('/(auth)/legal?document=privacy');
              }}
            >
              Política de Privacidade
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...getShadow('md'),
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    maxWidth: 280,
    fontFamily: 'Inter_400Regular',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  webTextInputReset: {
    outlineStyle: 'none',
    outlineWidth: 0,
    boxShadow: 'none',
  } as never,
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    fontFamily: 'Inter_400Regular',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    gap: spacing.sm,
    ...getShadow('sm'),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  socialProofIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialProofText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  termsText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    fontFamily: 'Inter_400Regular',
  },
  termsLink: {
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  linkButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emailHighlight: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
});
