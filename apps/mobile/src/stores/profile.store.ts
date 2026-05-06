import { create } from 'zustand';
import { api } from '@/api/client';

export interface Diagnostic {
  archetype: string;
  completedAt: string;
}

export type SubscriptionStatus =
  | 'active'
  | 'pending'
  | 'cancelled'
  | 'expired'
  | 'payment_failed';

export interface Subscription {
  status: SubscriptionStatus;
  planId: string;
  endDate: string | null;
}

export interface Access {
  diagnosisCompleted: boolean;
  hasActiveSubscription: boolean;
  hasChatAccess: boolean;
  hasJourneyAccess: boolean;
  canAnalyzeImages: boolean;
  hasStructuredDiagnosis: boolean;
}

export interface Commerce {
  checkoutUrl: string | null;
  nativeCheckoutMode: 'external_link' | 'blocked';
  canUpgrade: boolean;
}

export interface AvatarProfile {
  status: 'not_started' | 'in_progress' | 'completed';
  currentPhase: number | null;
  completedPhases: number[];
  updatedAt: string;
}

export interface ImageAnalysisUsageBucket {
  used: number;
  limit: number;
  remaining: number;
}

export interface Usage {
  imageAnalyses: {
    conversation: ImageAnalysisUsageBucket;
    profile: ImageAnalysisUsageBucket;
  };
}

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  diagnostic: Diagnostic | null;
  avatarProfile: AvatarProfile | null;
  subscription: Subscription | null;
  access: Access;
  usage: Usage;
  commerce: Commerce;
}

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<Profile | null>;
  updateProfile: (params: {
    displayName?: string | null;
    avatar?:
      | {
          base64: string;
          mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
        }
      | null;
  }) => Promise<Profile | null>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<{
        success: boolean;
        data: Profile;
        error?: {
          message?: string;
        };
      }>('/profile');

      if (response.data.success) {
        set({ profile: response.data.data, isLoading: false });
        return response.data.data;
      } else {
        set({
          error: response.data.error?.message ?? 'Failed to fetch profile',
          isLoading: false,
        });
        return null;
      }
    } catch (error) {
      set({ error: 'Failed to fetch profile', isLoading: false });
      return null;
    }
  },

  updateProfile: async (params) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.put<{
        success: boolean;
        data: Profile;
        error?: {
          message?: string;
        };
      }>('/profile', {
        displayName: params.displayName,
        avatar:
          params.avatar === undefined
            ? undefined
            : params.avatar === null
              ? null
              : {
                  data: params.avatar.base64,
                  mediaType: params.avatar.mediaType,
                },
      });

      if (response.data.success) {
        set({ profile: response.data.data, isLoading: false });
        return response.data.data;
      }

      set({
        error: response.data.error?.message ?? 'Failed to update profile',
        isLoading: false,
      });
      return null;
    } catch (error) {
      set({ error: 'Failed to update profile', isLoading: false });
      return null;
    }
  },
}));
