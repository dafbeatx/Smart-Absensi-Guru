import React, { useEffect, useState } from 'react';
import { SagaBellIcon, SagaRoleSwitchIcon } from '../../../components/ui/SagaServiceIcons';

export interface GuruDashboardHeaderProps {
  greeting: string;
  userName: string;
  avatarUrl?: string | null;
  institutionName: string;
  dateLabel: string;
  unreadCount: number;
  isDualRoleUser?: boolean;
  onSwitchRoleMode?: () => void;
  onOpenNotifications: () => void;
}

export const GuruDashboardHeader: React.FC<GuruDashboardHeaderProps> = ({
  greeting,
  userName,
  avatarUrl,
  institutionName,
  dateLabel,
  unreadCount,
  isDualRoleUser = false,
  onSwitchRoleMode,
  onOpenNotifications,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const initial = userName ? userName.trim().charAt(0).toUpperCase() : 'G';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-120 md:max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-[#0D5C46] text-white flex items-center justify-center font-bold text-sm">
            {avatarUrl && !imgError ? (
              <img
                src={avatarUrl}
                alt={userName}
                width={44}
                height={44}
                fetchPriority="high"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight truncate">
              {greeting}, {userName}
            </h1>
            <p className="text-xs text-slate-600 leading-tight truncate mt-0.5">
              {institutionName} &bull; {dateLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDualRoleUser && onSwitchRoleMode && (
            <button
              type="button"
              onClick={onSwitchRoleMode}
              className="min-h-11 px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-[#0F172A] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              aria-label="Beralih mode tampilan akun"
              title="Beralih Peran (Mode Guru / Admin)"
            >
              <SagaRoleSwitchIcon className="w-4 h-4 text-[#0D5C46] shrink-0" />
              <span className="hidden min-[380px]:inline">Mode Guru</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={
              unreadCount > 0
                ? `Notifikasi, ${unreadCount} belum dibaca`
                : 'Buka notifikasi dan pengumuman'
            }
            className="relative w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#0F172A] flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#0D5C46]"
          >
            <SagaBellIcon className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-[#DC2626] text-white text-[11px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
