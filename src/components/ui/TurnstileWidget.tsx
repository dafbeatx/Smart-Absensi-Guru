import React, { useEffect, useRef } from 'react';

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

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY,
  onVerify,
  onError,
  onExpire,
  action = 'login',
  theme = 'light',
  className = 'flex justify-center my-3',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: 'normal',
          action,
          callback: (token: string) => {
            if (isMounted && onVerify) onVerify(token);
          },
          'error-callback': () => {
            if (isMounted && onError) onError();
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
        });
      } catch (err) {
        console.warn('Failed to render Turnstile widget:', err);
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
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme]);

  return <div ref={containerRef} className={className} />;
};
