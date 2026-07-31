import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types/database.types';
import { getOrCreateDeviceUUID, getDeviceModelString } from '../utils/device.utils';

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  deviceUUID: string;
  deviceModel: string;
  loginSuccess: (token: string, user: UserProfile) => void;
  logout: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      deviceUUID: getOrCreateDeviceUUID(),
      deviceModel: getDeviceModelString(),

      loginSuccess: (token: string, user: UserProfile) => {
        set({
          token,
          user,
          isAuthenticated: true,
          error: null,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isLoading: false,
        });
      },

      setError: (error: string | null) => set({ error, isLoading: false }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: 'smart_absensi_auth_storage', // Persist session in LocalStorage
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        deviceUUID: state.deviceUUID,
      }),
    }
  )
);
