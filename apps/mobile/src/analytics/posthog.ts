import PostHog from 'posthog-react-native';
import { posthogConfig } from '@/config/app-links';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type AnalyticsUser = {
  id: string;
  email: string | null;
  phone: string | null;
};

export const posthogEnabled = Boolean(posthogConfig.apiKey);

export const posthogClient = posthogConfig.apiKey
  ? new PostHog(posthogConfig.apiKey, {
      host: posthogConfig.host,
      persistence: 'file',
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
    })
  : null;

function sanitizeProperties(
  properties?: AnalyticsProperties
): Record<string, string | number | boolean | null> | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean | null>;
}

export function captureAnalyticsEvent(name: string, properties?: AnalyticsProperties): void {
  if (!posthogClient) {
    return;
  }

  posthogClient.capture(name, sanitizeProperties(properties));
}

export function captureAnalyticsScreen(
  pathname: string,
  properties?: AnalyticsProperties
): void {
  if (!posthogClient) {
    return;
  }

  void posthogClient.screen(pathname, sanitizeProperties(properties));
}

export function identifyAnalyticsUser(user: AnalyticsUser): void {
  if (!posthogClient) {
    return;
  }

  posthogClient.identify(user.id, sanitizeProperties({
    email: user.email,
    phone: user.phone,
  }));
}

export function resetAnalyticsUser(): void {
  if (!posthogClient) {
    return;
  }

  posthogClient.reset();
}
