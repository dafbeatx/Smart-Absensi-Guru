import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer';

  const variants = {
    primary: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20 border border-emerald-700',
    secondary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20 border border-slate-900',
    outline: 'bg-transparent border-2 border-emerald-700 text-emerald-700 hover:bg-emerald-50',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 border border-red-600',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-2 gap-1.5 min-h-[44px] min-w-[44px]',
    md: 'text-sm px-5 py-2.5 gap-2 min-h-[48px] min-w-[48px]', // Touch target min 48px
    lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[52px] min-w-[48px]',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
      ) : (
        leftIcon
      )}
      <span className="inline-flex items-center justify-center gap-2 shrink-0">{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
