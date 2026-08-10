import { NotificationBellDropdown } from './NotificationBellDropdown';

export interface TopDashboardNavbarProps {
  onToggleSidebar: () => void;
  onOpenQrGenerator?: () => void;
  onOpenCommandPalette?: () => void;
  onLogout: () => void;
}

export const TopDashboardNavbar: React.FC<TopDashboardNavbarProps> = ({
  onToggleSidebar,
  onOpenQrGenerator,
  onOpenCommandPalette,
  onLogout,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-[#D4D4CE]/30 sticky top-0 z-40 px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Mobile Toggle & Desktop Search Bar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-[#023246] hover:bg-slate-100 rounded-xl transition-all border border-slate-200 cursor-pointer shrink-0 active:scale-95"
            aria-label="Toggle Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile Center Brand Logo (Visible on mobile screens) */}
          <div className="flex sm:hidden items-center gap-2 overflow-hidden min-w-0">
            <div className="w-7 h-7 rounded-full bg-white p-0.5 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <img src="/school-logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="space-y-0 overflow-hidden text-left min-w-0">
              <h2 className="font-black text-[11px] text-[#023246] uppercase tracking-wide truncate">Smart Absensi Guru</h2>
              <p className="text-[8px] text-slate-500 truncate">SMP Terpadu Al-Ittihadiyah</p>
            </div>
          </div>

          {/* Search Bar with Ctrl K / Cmd K shortcut */}
          <div
            onClick={onOpenCommandPalette}
            className="relative flex-1 hidden sm:block cursor-pointer group"
          >
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 group-hover:text-emerald-600 text-sm pointer-events-none transition-colors">
              🔍
            </span>
            <input
              type="text"
              readOnly
              onClick={onOpenCommandPalette}
              placeholder="Cari guru, menu, atau tekan Ctrl + K..."
              className="navbar-search-input cursor-pointer group-hover:border-emerald-300 transition-all"
            />
            <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-800 border border-slate-200 rounded-md shadow-2xs transition-colors">
                Ctrl K
              </kbd>
            </span>
          </div>
        </div>

        {/* Right: Actions & Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Search Button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95"
              title="Cari Guru / Menu"
              aria-label="Cari Guru / Menu"
            >
              <span className="text-sm">🔍</span>
            </button>
          )}

          {onOpenQrGenerator && (
            <button
              onClick={onOpenQrGenerator}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[#023246] text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95"
            >
              <span>🖨️</span> Poster QR
            </button>
          )}

          {/* Dynamic Realtime Notification Bell Dropdown */}
          <NotificationBellDropdown />

          {/* Logout button on desktop */}
          <button
            onClick={onLogout}
            className="hidden sm:flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer active:scale-95"
            title="Keluar dari Akun"
          >
            <span>➔</span>
          </button>
        </div>
      </div>
    </header>
  );
};
