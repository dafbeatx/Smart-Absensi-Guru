import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { logger } from './utils/logger.utils';

import { AutoUpdateService } from './services/auto-update.service';
import { pwaService } from './services/pwa.service';

// Global Unhandled Error & Promise Rejection Handlers
if (typeof window !== 'undefined') {
  // Seamless Native APK API Resolver: Routes relative /api/* requests to production Vercel backend
  // when the application is running inside a Capacitor/Android native container.
  const isLocalContainer =
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (isLocalContainer && !import.meta.env.DEV) {
    const PROD_API_ORIGIN = 'https://smart-absensi-guru-eight.vercel.app';
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let urlStr: string;
      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else {
        urlStr = input.url;
      }

      if (urlStr.startsWith('/api/')) {
        const fullUrl = `${PROD_API_ORIGIN}${urlStr}`;
        if (typeof input === 'string') {
          return originalFetch(fullUrl, init);
        } else if (input instanceof URL) {
          return originalFetch(new URL(fullUrl), init);
        } else {
          return originalFetch(new Request(fullUrl, input), init);
        }
      }

      return originalFetch(input, init);
    };
  }

  // Initialize Auto-Update & Version Monitoring Engine for HP Mobile & Desktop
  AutoUpdateService.initAutoUpdateEngine();

  // Register PWA Service Worker for offline caching & background push reminders
  pwaService.registerServiceWorker();

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('GlobalWindow', 'Unhandled Promise Rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    logger.error('GlobalWindow', 'Unhandled Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
