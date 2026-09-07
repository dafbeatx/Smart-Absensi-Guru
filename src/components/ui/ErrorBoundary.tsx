import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger.utils';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack?: string;
  isCopied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    errorStack: '',
    isCopied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan sistem yang tidak terduga.',
      errorStack: error.stack || '',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ErrorBoundary', 'React Component Crash Caught:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  public handleReload = (): void => {
    window.location.reload();
  };

  public handleClearCacheAndReload = (): void => {
    try {
      // Clear corrupt cache items that may cause component re-render crashes
      const keysToClear = [
        'smart_absensi_teachers',
        'smart_absensi_teaching_schedules',
        'smart_absensi_leaves',
        'smart_absensi_notifications',
        'smart_absensi_notifications_read',
        'smart_absensi_subjects',
      ];
      keysToClear.forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public handleLogoutAndReset = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public handleCopyError = (): void => {
    const text = `Error: ${this.state.errorMessage}\n\nStack:\n${this.state.errorStack || 'No stack trace available'}`;
    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ isCopied: true });
      setTimeout(() => this.setState({ isCopied: false }), 2000);
    }).catch(() => {});
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 text-center">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-fade-in text-left">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto">
              ⚠️
            </div>

            <div className="text-center space-y-1.5">
              <h2 className="text-xl font-extrabold tracking-tight text-white">Terjadi Kesalahan Aplikasi</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Maaf, sistem mengalami kendala teknis saat memuat komponen ini. Silakan muat ulang halaman atau bersihkan cache sistem.
              </p>
            </div>

            {/* Error Message Display */}
            {this.state.errorMessage && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-red-300">
                  <span className="flex items-center gap-1.5">
                    <span>🛑</span> Detail Error
                  </span>
                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="px-2 py-0.5 bg-red-900/60 hover:bg-red-800/80 text-red-200 text-[11px] font-semibold rounded-lg border border-red-700/50 transition-all cursor-pointer active:scale-95"
                  >
                    {this.state.isCopied ? '✅ Disalin!' : '📋 Salin Error'}
                  </button>
                </div>
                <p className="text-xs font-mono text-red-200/90 break-words leading-snug">
                  {this.state.errorMessage}
                </p>
                {this.state.errorStack && (
                  <details className="text-[11px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200 font-semibold pt-1">
                      Lihat Stack Trace Lengkap
                    </summary>
                    <pre className="mt-2 p-2 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-[10px] text-slate-400 overflow-x-auto max-h-36 whitespace-pre-wrap">
                      {this.state.errorStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🔄</span> Muat Ulang Halaman
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={this.handleClearCacheAndReload}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-[11px] rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Membersihkan data cache lokal dan memuat ulang data segar dari server"
                >
                  <span>🧹</span> Bersihkan Cache
                </button>

                <button
                  onClick={this.handleLogoutAndReset}
                  className="py-2.5 px-3 bg-rose-950/50 hover:bg-rose-900/60 active:scale-95 text-rose-300 font-bold text-[11px] rounded-xl border border-rose-800/50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Keluar dari sesi dan kembali ke halaman login"
                >
                  <span>🚪</span> Keluar / Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

