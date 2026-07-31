/**
 * SMART ABSENSI GURU - APPLICATION CONFIGURATION
 */

export const APP_CONFIG = {
  APP_NAME: 'Smart Absensi Guru',
  INSTITUTION_NAME: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
  VERSION: '1.0.0',
  API_URL: import.meta.env.VITE_API_URL || 'https://script.google.com/macros/s/DEV_DEPLOYMENT_ID/exec',
  IS_DEV: import.meta.env.MODE === 'development',
  ENABLE_LOGS: import.meta.env.VITE_ENABLE_LOGS === 'true',

  // Request & Cache Timings
  REQUEST_TIMEOUT_MS: 15000, // 15 Seconds timeout
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  AUTO_LOGOUT_DAYS: 7,
  SUCCESS_MODAL_DISMISS_MS: 2000,
} as const;
