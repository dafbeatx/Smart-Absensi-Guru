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
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-[16px] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer';

  const variants = {
    primary: 'bg-[#287094] hover:bg-[#023246] text-white shadow-md shadow-[#287094]/20 border border-[#287094]',
    secondary: 'bg-[#023246] hover:bg-[#287094] text-white shadow-md shadow-[#023246]/20 border border-[#023246]',
    outline: 'bg-transparent border-2 border-[#287094] text-[#287094] hover:bg-[#287094]/10',
    danger: 'bg-[#DC2626] hover:bg-red-700 text-white shadow-md shadow-red-600/20 border border-red-600',
    ghost: 'bg-transparent text-[#023246] hover:bg-[#F6F6F6] border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-2 gap-1.5 min-h-[48px] min-w-[48px]',
    md: 'text-sm px-5 py-3 gap-2 min-h-[52px] min-w-[48px]', // Exact 52px height spec
    lg: 'text-base px-6 py-4 gap-2.5 min-h-[56px] min-w-[48px]',
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
