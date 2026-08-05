import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger.utils';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan sistem yang tidak terduga.',
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

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5 animate-fade-in">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full flex items-center justify-center text-3xl mx-auto">
              ⚠️
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold tracking-tight text-white">Terjadi Kesalahan Aplikasi</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Maaf, sistem mengalami kendala teknis saat memuat komponen ini. Silakan muat ulang halaman.
              </p>
            </div>

            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all cursor-pointer"
            >
              🔄 Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
