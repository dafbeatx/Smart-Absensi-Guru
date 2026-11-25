/**
 * SMART ABSENSI GURU - DEVICE FINGERPRINT UTILITIES
 */

export const getOrCreateDeviceUUID = (): string => {
  const STORAGE_KEY = 'smart_absensi_device_uuid';
  if (typeof localStorage === 'undefined') {
    return 'node_dev_uuid_1001';
  }
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = 'f81d4fae-7dec-4xxx-yxxx-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
};

export const getDeviceModelString = (): string => {
  if (typeof navigator === 'undefined') {
    return 'Perangkat Web Test';
  }
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Perangkat Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Perangkat iOS (Apple)';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'Mac OS';
  return 'Browser Web Perangkat';
};

export interface NativeContainerInfo {
  isNative: boolean;
  type: 'android' | 'windows' | 'none';
  platformHeader: 'android-capacitor' | 'electron-desktop' | '';
  label: string;
}

/**
 * Detects whether the app is running inside Capacitor Android APK or Electron Desktop EXE.
 * Shared across TurnstileWidget and SupabaseProvider to eliminate duplicated platform checks.
 */
export const detectNativeContainer = (): NativeContainerInfo => {
  if (typeof window === 'undefined') {
    return { isNative: false, type: 'none', platformHeader: '', label: '' };
  }

  const isFile = window.location.protocol === 'file:';
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isElectron = isFile || /electron/i.test(navigator.userAgent) || Boolean((window as any).electronAPI?.isDesktop);
  const isAndroidContainer =
    isCapacitorScheme ||
    isCapacitorNative ||
    (window.location.hostname === 'localhost' && /android/i.test(navigator.userAgent));

  if (isElectron) {
    return {
      isNative: true,
      type: 'windows',
      platformHeader: 'electron-desktop',
      label: 'Windows Desktop',
    };
  }
  if (isAndroidContainer) {
    return {
      isNative: true,
      type: 'android',
      platformHeader: 'android-capacitor',
      label: 'Android Native',
    };
  }

  return { isNative: false, type: 'none', platformHeader: '', label: '' };
};
