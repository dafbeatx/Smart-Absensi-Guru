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
  roleColor = 'bg-[#287094]/30 text-[#F6F6F6] border-[#287094]',
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
          className="fixed inset-0 bg-[#023246]/80 backdrop-blur-md z-50 transition-opacity duration-300 animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel Drawer (Midnight Navy #023246) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#023246] text-[#F6F6F6] z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-r border-[#D4D4CE]/20 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Sidebar"
      >
        {/* Header Section */}
        <div className="p-5 border-b border-[#D4D4CE]/20 space-y-3 relative bg-[#012332]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#D4D4CE] hover:text-white bg-[#023246] hover:bg-[#287094] rounded-xl transition-all border border-[#D4D4CE]/30"
            aria-label="Tutup Sidebar"
          >
            ✕
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#287094] flex items-center justify-center font-black text-xl text-[#F6F6F6] shadow-lg shadow-[#287094]/30 shrink-0 border border-[#D4D4CE]/30">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="space-y-0.5 overflow-hidden">
              <span className={`inline-block px-2.5 py-0.5 font-bold text-[10px] rounded-full border ${roleColor}`}>
                {roleBadge}
              </span>
              <h2 className="font-extrabold text-sm text-[#F6F6F6] truncate">{user?.full_name || title}</h2>
              <p className="text-[11px] text-[#D4D4CE] truncate">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#D4D4CE]/80">
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
                    ? 'bg-[#287094] text-white font-extrabold shadow-lg shadow-[#287094]/40 translate-x-1 border border-[#D4D4CE]/40'
                    : 'text-[#D4D4CE] hover:bg-[#0c4156] hover:text-white border border-transparent'
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
                        ? 'bg-[#F6F6F6] text-[#023246]'
                        : 'bg-[#287094]/40 text-[#F6F6F6] border border-[#D4D4CE]/30'
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
        <div className="p-4 border-t border-[#D4D4CE]/20 space-y-1.5 bg-[#012332]">
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#D4D4CE]/80">
            ⚙️ Akses Cepat
          </div>

          {onSwitchToGuruView && (
            <button
              onClick={() => {
                onSwitchToGuruView();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#F6F6F6] hover:bg-[#287094] border border-transparent hover:border-[#D4D4CE]/30 transition-all"
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
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#F6F6F6] hover:bg-[#287094] border border-transparent hover:border-[#D4D4CE]/30 transition-all"
            >
              <span>📷</span> Scan Absensi Saya
            </button>
          )}

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-300 hover:bg-red-900/40 border border-transparent hover:border-red-500/40 transition-all"
          >
            <span>🚪</span> Keluar Aplikasi
          </button>
        </div>
      </aside>
    </>
  );
};
