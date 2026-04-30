import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_DEV) return 'Perpétuo (Dev)';
  if (IS_PREVIEW) return 'Perpétuo (Preview)';
  return 'Perpétuo';
};

const getBundleId = () => {
  if (IS_DEV) return 'com.perpetuo.app.dev';
  if (IS_PREVIEW) return 'com.perpetuo.app.preview';
  return 'com.perpetuo.app';
};

const getApiUrl = () => {
  if (IS_DEV) return 'http://localhost:3000/api/v1';
  if (IS_PREVIEW) return process.env.EXPO_PUBLIC_API_URL_PREVIEW || 'https://perpetuo-api-fdrf.onrender.com/api/v1';
  return process.env.EXPO_PUBLIC_API_URL || 'https://perpetuo-api-fdrf.onrender.com/api/v1';
};

const getSentryPlugin = () => {
  const pluginConfig: {
    organization?: string;
    project?: string;
    url?: string;
  } = {};

  if (process.env.SENTRY_ORG) {
    pluginConfig.organization = process.env.SENTRY_ORG;
  }

  if (process.env.SENTRY_PROJECT) {
    pluginConfig.project = process.env.SENTRY_PROJECT;
  }

  if (process.env.SENTRY_URL) {
    pluginConfig.url = process.env.SENTRY_URL;
  }

  return ['@sentry/react-native/expo', pluginConfig] as [string, typeof pluginConfig];
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: 'perpetuo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'perpetuo',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#7C3AED',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Permite que você escolha imagens para enviar no chat.',
      NSCameraUsageDescription: 'Permite que você tire fotos para enviar no chat.',
      NSMicrophoneUsageDescription: 'Permite que você grave áudios para enviar no chat.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7C3AED',
    },
    package: getBundleId(),
    permissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-asset',
    [
      'expo-av',
      {
        microphonePermission: 'Permite que você grave áudios para enviar no chat.',
      },
    ],
    getSentryPlugin(),
    [
      'expo-image-picker',
      {
        photosPermission: 'Permite que você escolha imagens para enviar no chat.',
        cameraPermission: 'Permite que você tire fotos para enviar no chat.',
      },
    ],
    'expo-document-picker',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: getApiUrl(),
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  owner: process.env.EXPO_OWNER || 'perpetuo',
});
