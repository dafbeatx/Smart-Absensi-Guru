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
      className={`bg-[#023246] text-[#F6F6F6] z-50 shadow-2xl flex flex-col border-r border-[#D4D4CE]/20 h-full w-64 ${
        isDesktopFixed ? 'hidden lg:flex fixed top-0 left-0 bottom-0' : 'w-64'
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

      {/* Mobile Drawer Overlay & Sidebar */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-[#023246]/80 backdrop-blur-md z-50 transition-opacity duration-300 animate-fadeIn lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 left-0 bottom-0 w-64 bg-[#023246] text-[#F6F6F6] z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out border-r border-[#D4D4CE]/20 lg:hidden translate-x-0"
            aria-label="Mobile Navigation Sidebar"
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
};
