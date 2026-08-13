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
