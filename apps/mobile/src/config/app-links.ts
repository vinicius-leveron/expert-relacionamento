export const appLinks = {
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || null,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || null,
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || null,
} as const;

export const posthogConfig = {
  apiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null,
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
} as const;
