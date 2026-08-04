import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
  color?: string;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
  roleBadge,
  roleColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  items,
  activeTab,
  onSelectTab,
  onSwitchToGuruView,
  onOpenScanner,
  onLogout,
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

  return (
    <>
      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-slate-900 text-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Sidebar"
      >
        {/* Header Section */}
        <div className="p-5 border-b border-slate-800 space-y-3 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-all"
            aria-label="Tutup Sidebar"
          >
            ✕
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-500/20 shrink-0">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="space-y-0.5 overflow-hidden">
              <span className={`inline-block px-2.5 py-0.5 font-bold text-[10px] rounded-full border ${roleColor}`}>
                {roleBadge}
              </span>
              <h2 className="font-extrabold text-sm text-white truncate">{user?.full_name || title}</h2>
              <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            📊 Menu Utama & Aplikasi
          </div>

          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 translate-x-1'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge !== null && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                      isActive
                        ? 'bg-slate-950 text-emerald-400'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Actions Footer */}
        <div className="p-4 border-t border-slate-800 space-y-1.5 bg-slate-950/40">
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            ⚙️ Akses Cepat
          </div>

          {onSwitchToGuruView && (
            <button
              onClick={() => {
                onSwitchToGuruView();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-300 hover:bg-purple-600/20 transition-all"
            >
              <span>📱</span> Mode Tampilan Guru
            </button>
          )}

          {onOpenScanner && (
            <button
              onClick={() => {
                onOpenScanner();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-300 hover:bg-emerald-600/20 transition-all"
            >
              <span>📷</span> Scan Absensi Saya
            </button>
          )}

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-600/20 transition-all"
          >
            <span>🚪</span> Keluar Aplikasi
          </button>
        </div>
      </aside>
    </>
  );
};
