import React from 'react';
import { useToastStore } from '../../store/useToastStore';
import type { ToastMessage } from '../../store/useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const typeStyles = {
    success: 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20',
    warning: 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20',
    error: 'bg-red-600 text-white border-red-500 shadow-red-600/20',
    info: 'bg-blue-600 text-white border-blue-500 shadow-blue-600/20',
  };

  const icons = {
    success: '🟢',
    warning: '⚠️',
    error: '🔴',
    info: 'ℹ️',
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 space-y-2.5 pointer-events-none">
      {toasts.map((toast: ToastMessage) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start gap-3 animate-scale-up ${typeStyles[toast.type]}`}
        >
          <span className="text-xl leading-none mt-0.5">{icons[toast.type]}</span>
          <div className="flex-1 space-y-0.5">
            <h4 className="font-extrabold text-sm leading-tight">{toast.title}</h4>
            <p className="text-xs opacity-90">{toast.message}</p>
            {toast.solution && (
              <p className="text-[11px] opacity-80 pt-1 border-t border-white/20 mt-1">
                💡 {toast.solution}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white font-bold text-sm leading-none p-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
