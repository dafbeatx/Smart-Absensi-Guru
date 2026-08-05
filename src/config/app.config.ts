/**
 * SMART ABSENSI GURU - APPLICATION CONFIGURATION
 */

const getEnvValue = (key: string, defaultValue: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env[key] as string) || defaultValue;
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
  API_URL: getEnvValue('VITE_API_URL', 'https://script.google.com/macros/s/DEV_DEPLOYMENT_ID/exec'),
  IS_DEV: getIsDev(),
  ENABLE_LOGS: getEnvValue('VITE_ENABLE_LOGS', 'false') === 'true',

  // Enterprise Feature Flags & External AI Engine Config
  GROQ_API_KEY: getEnvValue('VITE_GROQ_API_KEY', ''),
  GROQ_MODEL: getEnvValue('VITE_GROQ_MODEL', 'llama-3.3-70b-versatile'),

  // Request & Cache Timings (Optimized for GAS Web App cold starts & concurrency)
  REQUEST_TIMEOUT_MS: 30000, // 30 Seconds timeout for standard API operations
  HEAVY_REQUEST_TIMEOUT_MS: 60000, // 60 Seconds timeout for heavy write/mutation operations
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1500,
  AUTO_LOGOUT_DAYS: 7,
  SUCCESS_MODAL_DISMISS_MS: 2000,
} as const;
