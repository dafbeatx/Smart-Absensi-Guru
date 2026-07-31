import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-white rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
            leftIcon ? 'pl-11' : ''
          } ${rightIcon ? 'pr-11' : ''} ${
            error
              ? 'border border-red-500 focus:ring-red-500'
              : 'border border-slate-200 focus:ring-emerald-500'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 text-slate-400 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
