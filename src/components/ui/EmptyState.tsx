import React from 'react';
import { SagaEmptyListIllustration } from './SagaServiceIcons';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 text-center space-y-3 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-600 text-2xl flex items-center justify-center mx-auto">
        {icon ?? <SagaEmptyListIllustration className="w-12 h-12" />}
      </div>
      <div className="space-y-1 max-w-sm mx-auto">
        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{title}</h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};
