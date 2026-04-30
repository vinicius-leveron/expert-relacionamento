import { create } from 'zustand';
import { api } from '@/api/client';

interface Diagnostic {
  archetype: string;
  completedAt: string;
}

interface Subscription {
  status: string;
  planId: string;
  endDate: string | null;
}

interface Access {
  diagnosisCompleted: boolean;
  hasActiveSubscription: boolean;
  hasJourneyAccess: boolean;
  canAnalyzeImages: boolean;
}

interface Commerce {
  checkoutUrl: string | null;
  canUpgrade: boolean;
}

interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  diagnostic: Diagnostic | null;
  subscription: Subscription | null;
  access: Access;
  commerce: Commerce;
}

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
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
      }>('/profile');

      if (response.data.success) {
        set({ profile: response.data.data, isLoading: false });
      } else {
        set({ error: 'Failed to fetch profile', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to fetch profile', isLoading: false });
    }
  },
}));
