/**
 * SMART ABSENSI GURU - FEATURE FLAG SYSTEM
 * Enterprise Feature Toggling Engine
 */

export interface FeatureFlags {
  ENABLE_WHATSAPP: boolean;
  ENABLE_AUDIT: boolean;
  ENABLE_ANALYTICS: boolean;
  ENABLE_PWA: boolean;
  ENABLE_OFFLINE_SYNC: boolean;
  ENABLE_EXCEL_EXPORT: boolean;
}

const parseEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[key] as string | undefined;
    if (val === undefined || val === '') return defaultValue;
    return val.toLowerCase() === 'true' || val === '1';
  }
  return defaultValue;
};

export const FEATURE_FLAGS: FeatureFlags = {
  ENABLE_WHATSAPP: parseEnvBoolean('VITE_FEATURE_WHATSAPP', true),
  ENABLE_AUDIT: parseEnvBoolean('VITE_FEATURE_AUDIT', true),
  ENABLE_ANALYTICS: parseEnvBoolean('VITE_FEATURE_ANALYTICS', true),
  ENABLE_PWA: parseEnvBoolean('VITE_FEATURE_PWA', true),
  ENABLE_OFFLINE_SYNC: parseEnvBoolean('VITE_FEATURE_OFFLINE_SYNC', true),
  ENABLE_EXCEL_EXPORT: parseEnvBoolean('VITE_FEATURE_EXCEL_EXPORT', true),
};

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return FEATURE_FLAGS[flag] ?? true;
};
