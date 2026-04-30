import { storage } from '@/utils/storage';

// Configure this based on environment
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://perpetuo-api-fdrf.onrender.com/api/v1';

const ACCESS_TOKEN_KEY = 'perpetuo_access_token';
const REFRESH_TOKEN_KEY = 'perpetuo_refresh_token';
const USER_KEY = 'perpetuo_user';

interface ApiResponse<T> {
  data: T;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await storage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: T;

    try {
      data = (await response.json()) as T;
    } catch {
      data = {} as T;
    }

    return { data, status: response.status };
  }

  private async clearAuthState(): Promise<void> {
    await Promise.all([
      storage.removeItem(ACCESS_TOKEN_KEY),
      storage.removeItem(REFRESH_TOKEN_KEY),
      storage.removeItem(USER_KEY),
    ]);
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        await this.clearAuthState();
        return false;
      }

      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        const result = await this.parseResponse<{
          success?: boolean;
          data?: {
            accessToken?: string;
            refreshToken?: string;
          };
        }>(response);

        if (
          response.status >= 400 ||
          !result.data?.success ||
          !result.data?.data?.accessToken ||
          !result.data?.data?.refreshToken
        ) {
          await this.clearAuthState();
          return false;
        }

        await storage.setItem(ACCESS_TOKEN_KEY, result.data.data.accessToken);
        await storage.setItem(REFRESH_TOKEN_KEY, result.data.data.refreshToken);
        return true;
      } catch {
        await this.clearAuthState();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    options?: { retryOnUnauthorized?: boolean },
  ): Promise<ApiResponse<T>> {
    const retryOnUnauthorized = options?.retryOnUnauthorized ?? true;
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
        ...authHeader,
      },
    });

    if (
      response.status === 401 &&
      retryOnUnauthorized &&
      !path.startsWith('/auth/')
    ) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(path, init, { retryOnUnauthorized: false });
      }
    }

    return this.parseResponse<T>(response);
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'GET',
    });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      { retryOnUnauthorized: !path.startsWith('/auth/') },
    );
  }

  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
