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
    <header className="bg-white border-b border-[#D4D4CE]/30 sticky top-0 z-40 px-4 py-3 shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Global Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-[#023246] hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
            aria-label="Toggle Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search Bar with Ctrl / shortcut */}
          <div className="relative flex-1 hidden sm:block">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Cari guru, NIP, atau mata pelajaran..."
              className="navbar-search-input"
            />
            <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
                Ctrl /
              </kbd>
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onOpenQrGenerator && (
            <button
              onClick={onOpenQrGenerator}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-[#023246] text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <span>🖨️</span> Poster QR
            </button>
          )}

          {/* Notification Bell with Badge 8 */}
          <button
            className="relative p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all"
            aria-label="Notifikasi"
            title="8 Notifikasi Baru"
          >
            <span className="text-base">🔔</span>
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white font-black text-[9px] rounded-full flex items-center justify-center border border-white">
              8
            </span>
          </button>

          {/* Dark / Moon Mode Toggle */}
          <button
            className="p-2 text-slate-600 hover:text-[#023246] hover:bg-slate-100 rounded-xl transition-all"
            aria-label="Toggle Theme"
            title="Ganti Mode Warna"
          >
            <span className="text-base">🌙</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            aria-label="Keluar"
            title="Keluar / Logout"
          >
            <span className="text-base">➔</span>
          </button>
        </div>
      </div>
    </header>
  );
};
