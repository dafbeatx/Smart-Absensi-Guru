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
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none';

  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 border border-emerald-600',
    secondary: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm',
    outline: 'bg-transparent border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 border border-red-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3 py-2 gap-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-3 gap-2 min-h-[48px]', // Touch target 48px
    lg: 'text-base px-6 py-4 gap-2.5 min-h-[56px]',
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
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
