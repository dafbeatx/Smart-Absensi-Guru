import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types/database.types';
import { getOrCreateDeviceUUID, getDeviceModelString } from '../utils/device.utils';

export const AUTH_STORAGE_KEY = 'smart_absensi_auth_storage';

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
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
        const currentToken = get().token;
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (currentToken && (currentToken.startsWith('saga_sess_') || currentToken.startsWith('saga_tok_'))) {
            headers['Authorization'] = `Bearer ${currentToken}`;
          }
          // Fire-and-forget server revocation & HttpOnly cookie clearing across all platforms
          if ((currentToken && (currentToken.startsWith('saga_sess_') || currentToken.startsWith('saga_tok_'))) || window.location.protocol.startsWith('http')) {
            fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
              keepalive: true,
              headers,
            }).catch(() => {
              // fail gracefully if offline
            });
          }
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('smart_absensi_logout'));
          } catch {
            // ignore
          }
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isLoading: false,
        });
      },

      updateUserProfile: (updates: Partial<UserProfile>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      setError: (error: string | null) => set({ error, isLoading: false }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: AUTH_STORAGE_KEY, // Persist session in LocalStorage
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        deviceUUID: state.deviceUUID,
      }),
    }
  )
);

// Cross-tab auth synchronization: if user logs out or switches account in another tab, sync immediately
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY) {
      useAuthStore.persist.rehydrate();
    }
  });
}
