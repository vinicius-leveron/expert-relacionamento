import { storage } from '@/utils/storage';

// Configure this based on environment
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'perpetuo_access_token';

interface ApiResponse<T> {
  data: T;
  status: number;
}

class ApiClient {
  private baseUrl: string;

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

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const authHeader = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });

    const data = await response.json();
    return { data, status: response.status };
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const authHeader = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return { data, status: response.status };
  }

  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const authHeader = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return { data, status: response.status };
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const authHeader = await this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });

    const data = await response.json();
    return { data, status: response.status };
  }
}

export const api = new ApiClient(API_BASE_URL);
