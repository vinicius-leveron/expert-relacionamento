import { useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/stores/auth.store';
import { colors } from '@/theme';
import { PostHogScreenTracker } from '@/analytics/PostHogScreenTracker';
import { posthogClient } from '@/analytics/posthog';
import { Sentry, sentryEnabled } from '@/monitoring/sentry';
import { SentryScreenTracker } from '@/monitoring/SentryScreenTracker';

// Mantém splash screen visível enquanto carrega
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { checkAuth, isLoading: authLoading } = useAuthStore();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && !authLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  const content = (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <View style={styles.container} onLayout={onLayoutRootView}>
        <SentryScreenTracker />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        </Stack>
        <StatusBar style="auto" />
        {(!fontsLoaded && !fontError) || authLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}
      </View>
    </Sentry.ErrorBoundary>
  );

  if (!posthogClient) {
    return content;
  }

  return (
    <PostHogProvider
      client={posthogClient}
      autocapture={{
        captureTouches: false,
        captureScreens: false,
      }}
    >
      <PostHogScreenTracker />
      {content}
    </PostHogProvider>
  );
}

function ErrorFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const ExportedRootLayout = sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;

export default ExportedRootLayout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
});
