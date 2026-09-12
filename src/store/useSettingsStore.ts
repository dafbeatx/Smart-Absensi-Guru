import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SystemSettings } from '../types/database.types';
import { CONSTANTS } from '../config/constants';
import { ProviderFactory } from '../providers/provider-factory';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  app_name: 'Smart Absensi Guru',
  institution_name: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
  work_checkin_start: CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
  work_checkin_end: CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
  work_checkout_start: CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
  friday_checkout_start: CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START,
  saturday_is_holiday: CONSTANTS.DEFAULTS.SATURDAY_IS_HOLIDAY,
  sunday_is_holiday: CONSTANTS.DEFAULTS.SUNDAY_IS_HOLIDAY,
  geofence_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
  geofence_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
  geofence_radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
};

export interface SettingsState {
  settings: SystemSettings;
  isLoading: boolean;
  isLoaded: boolean;
  loadSettings: (force?: boolean) => Promise<SystemSettings>;
  updateSettings: (newSettings: SystemSettings, token?: string) => Promise<boolean>;
  setSettingsLocally: (settings: Partial<SystemSettings>) => void;
}

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage?.getItem) {
        return localStorage.getItem(key);
      }
    } catch {
      // ignore
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage?.setItem) {
        localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SYSTEM_SETTINGS,
      isLoading: false,
      isLoaded: false,

      loadSettings: async (force = false): Promise<SystemSettings> => {
        // Return existing loaded settings if not forced
        if (get().isLoaded && !force) {
          return get().settings;
        }

        set({ isLoading: true });

        // 1. Try local cache first for instant responsiveness
        const cached = safeLocalStorage.getItem('smart_absensi_system_settings');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            set((state) => ({
              settings: { ...state.settings, ...parsed },
              isLoaded: true,
            }));
            if (parsed.app_name && typeof document !== 'undefined') {
              document.title = parsed.app_name;
            }
          } catch (e) {
            console.warn('Failed to parse cached system settings:', e);
          }
        }

        // 2. Fetch authoritative settings from backend/database
        try {
          const provider = ProviderFactory.getProvider();
          const remote = await provider.getSettings();
          if (remote) {
            const merged: SystemSettings = {
              ...get().settings,
              ...remote,
              app_name: remote.app_name || get().settings.app_name,
              institution_name: remote.institution_name || get().settings.institution_name,
            };

            set({
              settings: merged,
              isLoaded: true,
              isLoading: false,
            });

            safeLocalStorage.setItem('smart_absensi_system_settings', JSON.stringify(merged));
            if (merged.app_name && typeof document !== 'undefined') {
              document.title = merged.app_name;
            }

            return merged;
          }
        } catch (err) {
          console.warn('Failed to fetch remote system settings, using cache:', err);
        }

        set({ isLoading: false, isLoaded: true });
        return get().settings;
      },

      updateSettings: async (newSettings: SystemSettings, token = ''): Promise<boolean> => {
        set({ isLoading: true });

        const merged: SystemSettings = {
          ...get().settings,
          ...newSettings,
        };

        // 1. Update in-memory and local storage immediately
        set({ settings: merged, isLoading: false, isLoaded: true });

        safeLocalStorage.setItem('smart_absensi_system_settings', JSON.stringify(merged));
        if (merged.app_name && typeof document !== 'undefined') {
          document.title = merged.app_name;
        }

        if (typeof window !== 'undefined') {
          // Broadcast to other components and tabs
          try {
            window.dispatchEvent(
              new CustomEvent('smart_absensi_settings_updated', {
                detail: merged,
              })
            );
          } catch {
            window.dispatchEvent(new Event('smart_absensi_settings_updated'));
          }
        }

        // 2. Persist to backend provider
        try {
          const provider = ProviderFactory.getProvider();
          await provider.updateSettings(merged, token);
          return true;
        } catch (err) {
          console.error('Failed to persist settings to backend provider:', err);
          throw err;
        }
      },

      setSettingsLocally: (partial: Partial<SystemSettings>) => {
        const merged = { ...get().settings, ...partial };
        set({ settings: merged });
        safeLocalStorage.setItem('smart_absensi_system_settings', JSON.stringify(merged));
        if (merged.app_name && typeof document !== 'undefined') {
          document.title = merged.app_name;
        }
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(
              new CustomEvent('smart_absensi_settings_updated', {
                detail: merged,
              })
            );
          } catch {
            window.dispatchEvent(new Event('smart_absensi_settings_updated'));
          }
        }
      },
    }),
    {
      name: 'smart_absensi_system_settings_store',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Global Cross-Tab & Event Listener Setup
if (typeof window !== 'undefined') {
  const syncHandler = () => {
    const raw = safeLocalStorage.getItem('smart_absensi_system_settings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        useSettingsStore.setState((prev) => ({
          settings: { ...prev.settings, ...parsed },
          isLoaded: true,
        }));
        if (parsed.app_name && typeof document !== 'undefined') {
          document.title = parsed.app_name;
        }
      } catch (e) {
        // ignore
      }
    }
  };

  window.addEventListener('smart_absensi_settings_updated', syncHandler);
  window.addEventListener('storage', (e) => {
    if (e.key === 'smart_absensi_system_settings') {
      syncHandler();
    }
  });
}
