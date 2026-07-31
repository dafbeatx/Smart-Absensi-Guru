/**
 * SMART ABSENSI GURU - DEVICE FINGERPRINT UTILITIES
 */

export const getOrCreateDeviceUUID = (): string => {
  const STORAGE_KEY = 'smart_absensi_device_uuid';
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = 'f81d4fae-7dec-4xxx-yxxx-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
};

export const getDeviceModelString = (): string => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Perangkat Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Perangkat iOS (Apple)';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac OS';
  return 'Browser Web Perangkat';
};
