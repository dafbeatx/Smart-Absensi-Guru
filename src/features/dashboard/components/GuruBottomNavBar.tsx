import React from 'react';
import {
  SagaNavAccountIcon,
  SagaNavAdminIcon,
  SagaNavHistoryIcon,
  SagaNavHomeIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';

export type GuruMainTab = 'BERANDA' | 'RIWAYAT' | 'ADMIN' | 'NOTIFIKASI' | 'AKUN';

export interface GuruBottomNavBarProps {
  activeTab: GuruMainTab;
  onSelectTab: (tab: Exclude<GuruMainTab, 'NOTIFIKASI'>) => void;
  onPressAbsen: () => void;
}

export const GuruDesktopNavBar: React.FC<GuruBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onPressAbsen,
}) => {
  const navItems: Array<{
    id: Exclude<GuruMainTab, 'NOTIFIKASI'>;
    label: string;
    renderIcon: (active: boolean) => React.ReactNode;
  }> = [
    {
      id: 'BERANDA',
      label: 'Beranda',
      renderIcon: (active) => <SagaNavHomeIcon active={active} className="w-5 h-5" />,
    },
    {
      id: 'RIWAYAT',
      label: 'Riwayat',
      renderIcon: (active) => <SagaNavHistoryIcon active={active} className="w-5 h-5" />,
    },
    {
      id: 'ADMIN',
      label: 'Administrasi Guru',
      renderIcon: (active) => <SagaNavAdminIcon active={active} className="w-5 h-5" />,
    },
    {
      id: 'AKUN',
      label: 'Akun',
      renderIcon: (active) => <SagaNavAccountIcon active={active} className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama Desktop"
      className="hidden md:block bg-white border-b border-slate-200 sticky top-[69px] z-20"
    >
      <div className="max-w-3xl mx-auto px-6 h-13 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`min-h-10 px-3.5 rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-[#0D5C46] font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F172A] font-medium'
                }`}
              >
                {item.renderIcon(isActive)}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onPressAbsen}
          className="h-10 px-4 rounded-xl bg-[#0D5C46] hover:bg-[#094736] active:bg-[#07382B] text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <SagaScanQrIcon tone="dark" className="w-5 h-5" />
          <span>Absen Sekarang</span>
        </button>
      </div>
    </nav>
  );
};

export const GuruBottomNavBar: React.FC<GuruBottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onPressAbsen,
}) => {
  return (
    <nav
      id="app-bottom-nav"
      aria-label="Bilah Navigasi Bawah Guru"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-120 mx-auto grid grid-cols-5 items-end px-1 pt-1.5">
        <button
          type="button"
          onClick={() => onSelectTab('BERANDA')}
          aria-current={activeTab === 'BERANDA' ? 'page' : undefined}
          className={`min-h-11 min-w-0 flex flex-col items-center justify-center gap-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'BERANDA' ? 'text-[#0D5C46] font-semibold' : 'text-slate-600 font-medium'
          }`}
        >
          <SagaNavHomeIcon active={activeTab === 'BERANDA'} className="w-6 h-6" />
          <span className="text-[11px] leading-none whitespace-nowrap">Beranda</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('RIWAYAT')}
          aria-current={activeTab === 'RIWAYAT' ? 'page' : undefined}
          className={`min-h-11 min-w-0 flex flex-col items-center justify-center gap-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'RIWAYAT' ? 'text-[#0D5C46] font-semibold' : 'text-slate-600 font-medium'
          }`}
        >
          <SagaNavHistoryIcon active={activeTab === 'RIWAYAT'} className="w-6 h-6" />
          <span className="text-[11px] leading-none whitespace-nowrap">Riwayat</span>
        </button>

        <div className="min-w-0 flex flex-col items-center justify-end pb-1">
          <button
            type="button"
            onClick={onPressAbsen}
            aria-label="Absen Sekarang (Pindai QR atau Sidik Jari)"
            className="w-14 h-14 -mt-5 rounded-full bg-[#0D5C46] hover:bg-[#094736] active:bg-[#07382B] text-white flex items-center justify-center ring-4 ring-white shadow-md transition-colors cursor-pointer"
          >
            <SagaScanQrIcon tone="dark" className="w-7.5 h-7.5" />
          </button>
          <span className="text-[11px] font-semibold text-[#0D5C46] mt-1 leading-none whitespace-nowrap">
            Absen
          </span>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('ADMIN')}
          aria-current={activeTab === 'ADMIN' ? 'page' : undefined}
          className={`min-h-11 min-w-0 flex flex-col items-center justify-center gap-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'ADMIN' ? 'text-[#0D5C46] font-semibold' : 'text-slate-600 font-medium'
          }`}
        >
          <SagaNavAdminIcon active={activeTab === 'ADMIN'} className="w-6 h-6" />
          <span className="text-[11px] leading-none whitespace-nowrap">Admin</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('AKUN')}
          aria-current={activeTab === 'AKUN' ? 'page' : undefined}
          className={`min-h-11 min-w-0 flex flex-col items-center justify-center gap-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'AKUN' ? 'text-[#0D5C46] font-semibold' : 'text-slate-600 font-medium'
          }`}
        >
          <SagaNavAccountIcon active={activeTab === 'AKUN'} className="w-6 h-6" />
          <span className="text-[11px] leading-none whitespace-nowrap">Akun</span>
        </button>
      </div>
    </nav>
  );
};
