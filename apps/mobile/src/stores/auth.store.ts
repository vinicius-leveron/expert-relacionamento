import { create } from 'zustand';
import { api, registerAuthInvalidationHandler } from '@/api/client';
import { storage } from '@/utils/storage';
import {
  captureAnalyticsEvent,
  identifyAnalyticsUser,
  resetAnalyticsUser,
} from '@/analytics/posthog';
import { clearSentryUser, setSentryUser } from '@/monitoring/sentry';
import { useChatStore } from '@/stores/chat.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { useProfileStore } from '@/stores/profile.store';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<string | undefined>;
  verifyMagicLink: (token: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = 'perpetuo_access_token';
const REFRESH_TOKEN_KEY = 'perpetuo_refresh_token';
const USER_KEY = 'perpetuo_user';

function resetDependentStores(): void {
  useChatStore.getState().disconnectSSE();
  useChatStore.setState({
    messages: [],
    pendingAttachments: [],
    conversationId: null,
    isLoading: false,
    responseStartedAt: null,
    isUploadingAttachment: false,
    isConnected: false,
    eventSource: null,
  });
  useConversationsStore.setState({
    conversations: [],
    activeId: null,
    isLoading: false,
    error: null,
  });
  useProfileStore.setState({
    profile: null,
    isLoading: false,
    error: null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  refreshToken: null,

  checkAuth: async () => {
    try {
      const accessToken = await storage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
      const userJson = await storage.getItem(USER_KEY);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson);
        set({
          accessToken,
          refreshToken,
          user,
        });

        try {
          await get().refreshAccessToken();
          identifyAnalyticsUser(user);
          setSentryUser(user);
          set({
            isAuthenticated: true,
            user,
            isLoading: false,
          });
          return;
        } catch {}
      }

      resetAnalyticsUser();
      clearSentryUser();
      resetDependentStores();
      set({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  sendMagicLink: async (email: string) => {
    const response = await api.post<{
      success: boolean;
      data: {
        message: string;
        devLink?: string;
      };
    }>('/auth/magic-link', { email });

    // Em dev, retorna o link para redirect automático
    return response.data.data.devLink;
  },

  verifyMagicLink: async (token: string) => {
    const response = await api.post<{
      success: boolean;
      data: {
        accessToken: string;
        refreshToken: string;
        user: User;
      };
    }>('/auth/verify', { token });

    if (!response.data.success) {
      throw new Error('Verification failed');
    }

    const { accessToken, refreshToken, user } = response.data.data;

    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    identifyAnalyticsUser(user);
    setSentryUser(user);
    captureAnalyticsEvent('auth_magic_link_verified', {
      has_email: Boolean(user.email),
      has_phone: Boolean(user.phone),
    });

    set({
      isAuthenticated: true,
      accessToken,
      refreshToken,
      user,
    });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await api.post<{
      success: boolean;
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }>('/auth/refresh', { refreshToken });

    if (!response.data.success) {
      // Token refresh failed, logout
      await get().logout();
      throw new Error('Token refresh failed');
    }

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;

    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

    set({
      accessToken,
      refreshToken: newRefreshToken,
    });
  },

  logout: async () => {
    const { refreshToken } = get();

    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore logout errors
    }

    await storage.removeItem(ACCESS_TOKEN_KEY);
    await storage.removeItem(REFRESH_TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    resetAnalyticsUser();
    clearSentryUser();
    captureAnalyticsEvent('auth_logout_completed');

    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },
}));

registerAuthInvalidationHandler(() => {
  resetAnalyticsUser();
  clearSentryUser();
  resetDependentStores();
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    accessToken: null,
    refreshToken: null,
  });
});
