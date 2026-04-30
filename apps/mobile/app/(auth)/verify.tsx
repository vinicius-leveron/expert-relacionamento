import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

const processedMagicLinkTokens = new Set<string>();

export default function VerifyScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { verifyMagicLink } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedVerification = useRef(false);

  useEffect(() => {
    if (hasAttemptedVerification.current) {
      return;
    }

    const normalizedToken = Array.isArray(token) ? token[0] : token;

    if (!normalizedToken) {
      setError('Token não encontrado');
      return;
    }

    if (processedMagicLinkTokens.has(normalizedToken)) {
      return;
    }

    hasAttemptedVerification.current = true;
    processedMagicLinkTokens.add(normalizedToken);

    verifyMagicLink(normalizedToken)
      .then(() => {
        router.replace('/(app)/(tabs)/chat');
      })
      .catch(() => {
        setError('Link inválido ou expirado. Solicite um novo.');
      });
  }, [token, verifyMagicLink]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>❌</Text>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C3AED" />
      <Text style={styles.loadingText}>Verificando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});
