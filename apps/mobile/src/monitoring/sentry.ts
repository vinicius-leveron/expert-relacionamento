import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

type SentryUser = {
  id: string;
  email: string | null;
  phone: string | null;
};

type SentryContext = {
  tags?: Record<string, string | number | boolean | null | undefined>;
  extras?: Record<string, unknown>;
};

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || null;

export const sentryEnabled = Boolean(sentryDsn);
export { Sentry };

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    debug: __DEV__,
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    profilesSampleRate: __DEV__ ? 1 : 0.1,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
  });

  Sentry.setTags({
    app_variant: process.env.APP_VARIANT || 'production',
    expo_execution_environment: String(Constants.executionEnvironment),
    native_application_id: Application.applicationId || 'unknown',
    native_application_version: Application.nativeApplicationVersion || 'unknown',
    native_build_version: Application.nativeBuildVersion || 'unknown',
  });
}

export function setSentryUser(user: SentryUser): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email || undefined,
    phone: user.phone || undefined,
  });
}

export function clearSentryUser(): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.setUser(null);
}

export function captureSentryException(
  error: unknown,
  context?: SentryContext
): string | undefined {
  if (!sentryEnabled) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          scope.setTag(key, String(value));
        }
      });
    }

    if (context?.extras) {
      Object.entries(context.extras).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    return Sentry.captureException(error);
  });
}
