import React from 'react';

export interface TopDashboardNavbarProps {
  onToggleSidebar: () => void;
  onOpenQrGenerator?: () => void;
  onLogout: () => void;
}

export const TopDashboardNavbar: React.FC<TopDashboardNavbarProps> = ({
  onToggleSidebar,
  onOpenQrGenerator,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-[#D4D4CE]/30 sticky top-0 z-40 px-4 py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Desktop Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-[#023246] hover:bg-slate-100 rounded-xl transition-all border border-slate-200 cursor-pointer"
            aria-label="Toggle Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile Center Brand Logo (Visible on mobile screens) */}
          <div className="flex sm:hidden items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-white p-0.5 border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              <img src="/school-logo.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="space-y-0 overflow-hidden text-left">
              <h2 className="font-black text-xs text-[#023246] uppercase tracking-wide truncate">Smart Absensi Guru</h2>
              <p className="text-[9px] text-slate-500 truncate">SMP Terpadu Al-Ittihadiyah</p>
            </div>
          </div>

          {/* Search Bar with Ctrl / shortcut (Visible on desktop) */}
          <div className="relative flex-1 hidden sm:block">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Cari guru, NPP, atau mata pelajaran..."
              className="navbar-search-input"
            />
            <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
                Ctrl /
              </kbd>
            </span>
          </div>
        </div>

        {/* Right: Actions & Notifications */}
        <div className="flex items-center gap-2">
          {onOpenQrGenerator && (
            <button
              onClick={onOpenQrGenerator}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[#023246] text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <span>🖨️</span> Poster QR
            </button>
          )}

          {/* Notification Bell with Badge 3 */}
          <button
            className="relative p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            aria-label="Notifications"
          >
            <span className="text-lg">🔔</span>
            <span className="absolute top-1 right-1 px-1 py-0.2 text-[9px] font-black bg-red-500 text-white rounded-full min-w-3.5 text-center ring-2 ring-white">
              3
            </span>
          </button>

          {/* Logout button on desktop */}
          <button
            onClick={onLogout}
            className="hidden sm:flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
            title="Keluar dari Akun"
          >
            <span>➔</span>
          </button>
        </div>
      </div>
    </header>
  );
};
