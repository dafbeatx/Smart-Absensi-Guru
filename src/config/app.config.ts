/**
 * SMART ABSENSI GURU - APPLICATION CONFIGURATION
 */

const getEnvValue = (key: string, defaultValue: string): string => {
  const withoutPrefix = key.startsWith('VITE_') ? key.replace('VITE_', '') : '';
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (
      (import.meta.env[key] as string) ||
      (withoutPrefix ? (import.meta.env[withoutPrefix] as string) : '') ||
      defaultValue
    );
  }
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env[key] ||
      (withoutPrefix ? process.env[withoutPrefix] : '') ||
      defaultValue
    );
  }
  return defaultValue;
};

const getIsDev = (): boolean => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE === 'development';
  }
  return true;
};

export const APP_CONFIG = {
  APP_NAME: 'Smart Absensi Guru',
  INSTITUTION_NAME: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
  VERSION: '1.0.0',
  IS_DEV: getIsDev(),
  ENABLE_LOGS: getEnvValue('VITE_ENABLE_LOGS', 'false') === 'true',

  // Enterprise Feature Flags & External AI Engine Config
  GROQ_API_KEY: getEnvValue('VITE_GROQ_API_KEY', ''),
  GROQ_MODEL: getEnvValue('VITE_GROQ_MODEL', 'qwen/qwen3.8-27b'),
} as const;
