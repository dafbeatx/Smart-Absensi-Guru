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
  roleColor = 'bg-[#2563EB]/20 text-[#60A5FA] border-[#2563EB]/40',
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
          className="fixed inset-0 bg-[#09090B]/80 backdrop-blur-md z-50 transition-opacity duration-300 animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel Drawer (Linear / Vercel Dark Theme) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#09090B] text-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-r border-[#27272A] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Sidebar"
      >
        {/* Header Section */}
        <div className="p-5 border-b border-[#27272A] space-y-3 relative bg-[#121316]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#A1A1AA] hover:text-white bg-[#18191E] hover:bg-[#27272A] rounded-xl transition-all border border-[#27272A]"
            aria-label="Tutup Sidebar"
          >
            ✕
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2563EB] flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/25 shrink-0">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="space-y-0.5 overflow-hidden">
              <span className={`inline-block px-2.5 py-0.5 font-bold text-[10px] rounded-full border ${roleColor}`}>
                {roleBadge}
              </span>
              <h2 className="font-extrabold text-sm text-white truncate">{user?.full_name || title}</h2>
              <p className="text-[11px] text-[#A1A1AA] truncate">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#71717A]">
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
                    ? 'bg-[#2563EB] text-white font-extrabold shadow-lg shadow-blue-500/30 translate-x-1 border border-blue-400/30'
                    : 'text-[#D4D4D8] hover:bg-[#18191E] hover:text-white'
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
                        ? 'bg-white text-[#2563EB]'
                        : 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
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
        <div className="p-4 border-t border-[#27272A] space-y-1.5 bg-[#0D0E11]">
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#71717A]">
            ⚙️ Akses Cepat
          </div>

          {onSwitchToGuruView && (
            <button
              onClick={() => {
                onSwitchToGuruView();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#A7F3D0] hover:bg-[#18191E] border border-transparent hover:border-[#27272A] transition-all"
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
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#60A5FA] hover:bg-[#18191E] border border-transparent hover:border-[#27272A] transition-all"
            >
              <span>📷</span> Scan Absensi Saya
            </button>
          )}

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#F87171] hover:bg-[#EF4444]/20 border border-transparent hover:border-[#EF4444]/40 transition-all"
          >
            <span>🚪</span> Keluar Aplikasi
          </button>
        </div>
      </aside>
    </>
  );
};
