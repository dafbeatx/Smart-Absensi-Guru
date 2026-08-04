import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
  color?: string;
  hasDropdown?: boolean;
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  roleBadge: string;
  roleColor?: string;
  items: SidebarItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onSwitchToGuruView?: () => void;
  onOpenScanner?: () => void;
  onLogout: () => void;
  isDesktopFixed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'SMP Terpadu Al-Ittihadiyah',
  roleBadge: _roleBadge,
  roleColor: _roleColor = 'bg-[#287094]/30 text-[#F6F6F6] border-[#287094]',
  items,
  activeTab,
  onSelectTab,
  onSwitchToGuruView,
  onOpenScanner: _onOpenScanner,
  onLogout,
  isDesktopFixed = true,
}) => {
  const { user } = useAuthStore();

  // Close sidebar on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sidebarContent = (
    <aside
      className={`bg-[#023246] text-[#F6F6F6] z-50 shadow-2xl flex flex-col border-r border-[#D4D4CE]/20 h-full w-56 ${
        isDesktopFixed ? 'hidden lg:flex fixed top-0 left-0 bottom-0' : 'w-56'
      }`}
      aria-label="Navigation Sidebar"
    >
      {/* Brand Logo Header (Delta Symbol + SMART ABSENSI GURU) */}
      <div className="p-5 border-b border-[#D4D4CE]/15 flex items-center gap-3 bg-[#012332]">
        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-lg text-white shrink-0 shadow-inner">
          ∆
        </div>
        <div className="space-y-0.5 overflow-hidden">
          <h2 className="font-black text-xs tracking-wider text-white uppercase truncate">Smart Absensi Guru</h2>
          <p className="text-[10px] text-[#D4D4CE] truncate">{subtitle}</p>
        </div>
      </div>

      {/* Navigation Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#287094] text-white font-extrabold shadow-md shadow-[#287094]/40 border border-[#D4D4CE]/30'
                  : 'text-[#D4D4CE] hover:bg-[#0c4156] hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.badge !== undefined && item.badge !== null && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                      isActive
                        ? 'bg-[#F6F6F6] text-[#023246]'
                        : 'bg-[#287094]/40 text-[#F6F6F6] border border-[#D4D4CE]/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.hasDropdown && <span className="text-[10px] text-[#D4D4CE]/60">▼</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* User Profile & Footer Actions */}
      <div className="p-3.5 border-t border-[#D4D4CE]/15 bg-[#012332] space-y-2">
        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#023246]/80 border border-[#D4D4CE]/15">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#287094] text-white flex items-center justify-center font-bold text-xs shrink-0 border border-[#D4D4CE]/30">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="space-y-0 overflow-hidden text-left">
              <p className="text-xs font-bold text-white truncate">{user?.full_name || title}</p>
              <p className="text-[10px] text-[#D4D4CE]/80 truncate">admin@sag.sch.id</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-[#D4D4CE] hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all"
            title="Keluar / Logout"
            aria-label="Logout"
          >
            ⋮
          </button>
        </div>

        {/* Quick Mode Switches */}
        {onSwitchToGuruView && (
          <button
            onClick={() => {
              onSwitchToGuruView();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#F6F6F6] bg-[#287094]/30 hover:bg-[#287094] border border-[#287094]/50 transition-all"
          >
            <span>📱</span> Switch ke Mode Guru
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Permanent Desktop Sidebar */}
      {isDesktopFixed && sidebarContent}

      {/* Mobile Drawer Overlay & Sidebar (Exact Match with Screen 2 Mockup) */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-999 transition-opacity duration-300 animate-fadeIn lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white text-slate-800 z-1000 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden translate-x-0 overflow-y-auto"
            aria-label="Mobile Navigation Drawer"
          >
            {/* Header with Delta Logo & Close button */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-1001">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#023246] text-white flex items-center justify-center font-black text-lg shadow-sm">
                  ∆
                </div>
                <div className="space-y-0.5 overflow-hidden text-left">
                  <h2 className="font-black text-xs tracking-wider text-[#023246] uppercase truncate">Smart Absensi Guru</h2>
                  <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* User Profile Card (Screen 2 Mockup) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-600 font-bold text-xl flex items-center justify-center shadow-inner">
                  👤
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-[#023246] text-sm">{user?.full_name || title}</h3>
                  <p className="text-xs text-slate-400">admin@sag.sch.id</p>
                </div>
                <span className="px-3 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                  ● Online
                </span>
              </div>

              {/* Navigation Items List */}
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 text-[#023246] font-black border border-slate-200/80 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge !== undefined && item.badge !== null && (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-200 text-[#023246]">
                            {item.badge}
                          </span>
                        )}
                        {item.hasDropdown && <span className="text-[10px] text-slate-400">▼</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Utilities & Logout */}
            <div className="p-4 border-t border-slate-100 bg-white space-y-3 text-xs font-semibold">
              <div className="flex items-center justify-between p-2 rounded-xl text-slate-700">
                <span className="flex items-center gap-2">
                  <span>🌙</span> Mode Gelap
                </span>
                <input type="checkbox" className="toggle toggle-sm" disabled />
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              >
                <span>➔</span> Keluar
              </button>

              <div className="text-center pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono space-y-0.5">
                <p>v1.0 RC1</p>
                <p>© 2026 Smart Absensi Guru</p>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
};
