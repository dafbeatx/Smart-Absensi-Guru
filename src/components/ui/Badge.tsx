import React from 'react';
import type { AttendanceStatus } from '../../types/database.types';

export interface BadgeProps {
  status?: AttendanceStatus | string;
  variant?: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  children?: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant,
  children,
  className = '',
  pulse = false,
}) => {
  let badgeVariant = variant || 'neutral';

  if (status) {
    switch (status) {
      case 'HADIR':
        badgeVariant = 'success';
        break;
      case 'TERLAMBAT':
        badgeVariant = 'warning';
        break;
      case 'IZIN':
      case 'SAKIT':
      case 'DINAS':
        badgeVariant = 'info';
        break;
      case 'ALFA':
        badgeVariant = 'danger';
        break;
      case 'BELUM_ABSEN':
        badgeVariant = 'warning';
        break;
      default:
        badgeVariant = 'neutral';
    }
  }

  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
    danger: 'bg-red-500',
    neutral: 'bg-slate-400',
  };

  const displayText = children || (status ? status.replace('_', ' ') : '');

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide uppercase ${variants[badgeVariant]} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColors[badgeVariant]} ${pulse ? 'animate-ping' : ''}`} />
      <span>{displayText}</span>
    </span>
  );
};
