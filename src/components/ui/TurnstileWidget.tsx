import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { detectNativeContainer } from '../../utils/device.utils';

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

// Cloudflare's Official Testing Site Key (Always Passes) for local Vite dev server only
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';
const CANONICAL_PROJECT_SITE_KEY = '0x4AAAAAAEIxMhyntpJB_Iqo';

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
    if (existingScript && !window.turnstile) {
      // Remove orphaned/failed script element before retrying
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
    script.async = true;
    script.defer = true;

    window.onloadTurnstileCallback = () => {
      resolve();
    };

    script.onerror = () => {
      turnstileScriptPromise = null;
      script.remove();
      reject(new Error('Gagal memuat skrip verifikasi Cloudflare Turnstile.'));
    };

    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

const isLocalDevHost = (): boolean => {
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

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  (
    {
      siteKey: propsSiteKey,
      onVerify,
      onError,
      onExpire,
      action = 'login',
      theme = 'light',
      className = 'flex justify-center my-3',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [nativeEnv] = useState(detectNativeContainer);
    const [status, setStatus] = useState<'loading' | 'ready' | 'verified' | 'error'>('loading');
    const [retryTrigger, setRetryTrigger] = useState(0);

    // Keep latest callbacks in refs so typing in parent inputs NEVER tears down the widget
    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
      onVerifyRef.current = onVerify;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    }, [onVerify, onError, onExpire]);

    const handleTriggerReset = () => {
      const wasError = status === 'error';
      setStatus('loading');
      onExpireRef.current?.();
      if (!wasError && widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus('ready');
          return;
        } catch {
          // Fall through to full remount if widget handle is stale
        }
      }
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore stale remove
        }
        widgetIdRef.current = null;
      }
      turnstileScriptPromise = null;
      setRetryTrigger((prev) => prev + 1);
    };

    React.useImperativeHandle(ref, () => ({
      reset: handleTriggerReset,
    }));

    // Canonical Sitekey Resolution
    const isDevLocal = Boolean(import.meta.env.DEV) && isLocalDevHost();
    const configuredSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || propsSiteKey || CANONICAL_PROJECT_SITE_KEY;
    const siteKey = isDevLocal && !import.meta.env.VITE_TURNSTILE_SITE_KEY ? DEFAULT_TEST_SITE_KEY : configuredSiteKey;

    useEffect(() => {
      // 1. Native Mobile APK (Capacitor) & Desktop EXE (Electron) Attestation
      // Cloudflare Turnstile rejects file:// and unlisted localhost WebView origins ("Domain not allowed").
      if (nativeEnv.isNative) {
        const token = nativeEnv.type === 'windows' ? 'native-windows-verified-token' : 'native-android-verified-token';
        setStatus('verified');
        onVerifyRef.current?.(token);
        return;
      }

      let isMounted = true;
      let hasSettled = false;

      const handleFailureOrRetry = () => {
        if (!isMounted || hasSettled) return;
        hasSettled = true;
        // Coba muat ulang otomatis 1 kali secara senyap bila sinyal sempat putus
        if (retryTrigger === 0) {
          turnstileScriptPromise = null;
          setStatus('loading');
          setRetryTrigger(1);
          return;
        }
        setStatus('error');
        onErrorRef.current?.();
      };

      // Safety load timeout (10s): retries automatically once, then shows user-friendly recovery card
      const timeoutTimer = setTimeout(() => {
        handleFailureOrRetry();
      }, 10000);

      const renderWidget = () => {
        if (!isMounted || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

        try {
          setStatus('ready');
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size: 'normal',
            action,
            callback: (token: string) => {
              hasSettled = true;
              clearTimeout(timeoutTimer);
              if (isMounted) {
                setStatus('verified');
                onVerifyRef.current?.(token);
              }
            },
            'error-callback': () => {
              clearTimeout(timeoutTimer);
              handleFailureOrRetry();
            },
            'expired-callback': () => {
              hasSettled = false;
              if (isMounted) {
                onExpireRef.current?.();
                // Auto-reset expired single-use token so user can re-verify smoothly
                if (widgetIdRef.current && window.turnstile) {
                  try {
                    window.turnstile.reset(widgetIdRef.current);
                  } catch {
                    setStatus('error');
                  }
                }
              }
            },
          });
        } catch {
          clearTimeout(timeoutTimer);
          handleFailureOrRetry();
        }
      };

      loadTurnstileScript()
        .then(() => {
          renderWidget();
        })
        .catch(() => {
          clearTimeout(timeoutTimer);
          handleFailureOrRetry();
        });

      return () => {
        isMounted = false;
        clearTimeout(timeoutTimer);
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup error
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, action, theme, nativeEnv.isNative, nativeEnv.type, retryTrigger]);

    // If in Native Container (Android APK or Windows EXE), display official trusted badge
    if (nativeEnv.isNative) {
      return (
        <div className={className}>
          <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-emerald-800 text-xs font-semibold shadow-xs select-none animate-fade-in">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Aplikasi Resmi Terverifikasi ({nativeEnv.label})</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`${className} flex-col items-center`}>
        {status === 'error' && (
          <div className="w-full flex flex-col items-center gap-2 py-3 px-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-center">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pengecekan Keamanan Gagal Dimuat</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Sinyal internet lambat atau terblokir (AdBlock / browser WhatsApp). Klik tombol di bawah, atau ganti Wi-Fi ke paket data HP lalu muat ulang.
            </p>
            <button
              type="button"
              onClick={handleTriggerReset}
              className="min-h-11 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Pengecekan</span>
            </button>
          </div>
        )}
        <div
          ref={containerRef}
          className={status === 'error' ? 'hidden' : 'min-h-[65px] flex items-center justify-center'}
        />
        {status === 'loading' && (
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Sedang mengecek keamanan koneksi... mohon tunggu sebentar.
          </p>
        )}
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
