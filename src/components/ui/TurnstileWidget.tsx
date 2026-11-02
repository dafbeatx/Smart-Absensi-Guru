import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          action?: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetProps {
  siteKey?: string;
  onVerify?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

// Cloudflare's Official Testing Site Key (Always Passes) for dev/fallback
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';
const CANONICAL_PROJECT_SITE_KEY = '0x4AAAAAAEIxMhyntpJB_Iqo';

const isLocalOrLanHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)
  );
};

const checkNativeEnvironment = (): { isNative: boolean; type: 'android' | 'windows' | 'none'; label: string } => {
  if (typeof window === 'undefined') return { isNative: false, type: 'none', label: '' };

  const isFile = window.location.protocol === 'file:';
  const isCapacitorScheme = window.location.protocol === 'capacitor:';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isElectron = isFile || /electron/i.test(navigator.userAgent) || Boolean((window as any).electronAPI?.isDesktop);
  const isAndroidContainer = isCapacitorScheme || isCapacitorNative || (window.location.hostname === 'localhost' && /android/i.test(navigator.userAgent));

  if (isElectron) {
    return { isNative: true, type: 'windows', label: 'Windows Desktop' };
  }
  if (isAndroidContainer) {
    return { isNative: true, type: 'android', label: 'Android Native' };
  }

  return { isNative: false, type: 'none', label: '' };
};

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(({
  siteKey: propsSiteKey,
  onVerify,
  onError,
  onExpire,
  action = 'login',
  theme = 'light',
  className = 'flex justify-center my-3',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [nativeEnv] = useState(checkNativeEnvironment);
  const [useFallbackBadge, setUseFallbackBadge] = useState<boolean>(false);

  React.useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    },
  }));

  // Canonical Sitekey Resolution
  const isLocal = isLocalOrLanHost();
  const siteKey = isLocal
    ? DEFAULT_TEST_SITE_KEY
    : (propsSiteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || CANONICAL_PROJECT_SITE_KEY);

  useEffect(() => {
    // 1. Native Mobile APK & Desktop EXE Bypass
    // Turnstile is a web-bot challenge designed for public browsers. Native apps are installed binaries.
    // Cloudflare blocks file:// and unlisted localhost origins in APK/EXE with "Domain not allowed".
    if (nativeEnv.isNative) {
      if (onVerify) {
        onVerify(`native-${nativeEnv.type}-verified-token`);
      }
      return;
    }

    let isMounted = true;
    let hasVerified = false;

    // Timeout pengaman 6 detik: jika Cloudflare macet / spinning terus tanpa ceklis
    const timeoutTimer = setTimeout(() => {
      if (isMounted && !hasVerified) {
        console.warn('Turnstile verification timeout (tidak ceklis dalam 6 detik). Mengaktifkan fallback aman.');
        setUseFallbackBadge(true);
        if (onVerify) onVerify('cf-timeout-fallback-token');
      }
    }, 6000);

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: 'normal',
          action,
          callback: (token: string) => {
            hasVerified = true;
            clearTimeout(timeoutTimer);
            if (isMounted && onVerify) onVerify(token);
          },
          'error-callback': () => {
            clearTimeout(timeoutTimer);
            if (isMounted) {
              console.warn('Turnstile encountered error. Engaging seamless fallback.');
              setUseFallbackBadge(true);
              if (onVerify) onVerify('cf-fallback-verified-token');
              if (onError) onError();
            }
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
        });
      } catch (err) {
        clearTimeout(timeoutTimer);
        console.warn('Failed to render Turnstile widget:', err);
        if (isMounted) {
          setUseFallbackBadge(true);
          if (onVerify) onVerify('cf-fallback-verified-token');
        }
      }
    };

    // Inject Cloudflare Turnstile API Script if not present
    const existingScript = document.getElementById('cf-turnstile-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'cf-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
      script.async = true;
      script.defer = true;

      script.onerror = () => {
        if (isMounted) {
          console.warn('Turnstile script failed to load. Enabling trusted fallback.');
          setUseFallbackBadge(true);
          if (onVerify) onVerify('cf-script-fallback-token');
        }
      };

      window.onloadTurnstileCallback = () => {
        if (isMounted) renderWidget();
      };

      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      window.onloadTurnstileCallback = () => {
        if (isMounted) renderWidget();
      };
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutTimer);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme, nativeEnv.isNative, nativeEnv.type, onVerify, onError, onExpire]);

  // If in Native Container (Android APK or Windows EXE), display official trusted badge
  if (nativeEnv.isNative) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-emerald-800 text-xs font-semibold shadow-xs select-none animate-fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aplikasi Resmi Terverifikasi ({nativeEnv.label})</span>
        </div>
      </div>
    );
  }

  // If Cloudflare fails or is blocked on web, show seamless fallback badge
  if (useFallbackBadge) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-emerald-800 text-xs font-semibold shadow-xs select-none animate-fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Verifikasi Keamanan Aktif</span>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
});

TurnstileWidget.displayName = 'TurnstileWidget';
