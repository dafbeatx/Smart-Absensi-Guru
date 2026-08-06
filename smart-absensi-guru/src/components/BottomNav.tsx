import React from 'react';
import { Home, History, Bell, User, QrCode } from 'lucide-react';

export type ActiveTab = 'home' | 'history' | 'notif' | 'profile';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  unreadNotifCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  unreadNotifCount
}) => {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] bg-[#023246]/95 backdrop-blur-md rounded-full py-2.5 px-6 shadow-2xl border border-white/10 flex justify-between items-center z-40 transition-all">
      
      {/* 🏠 Beranda */}
      <button
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'home' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Home size={20} />
        <span className="text-[9px] font-bold tracking-tight">Beranda</span>
      </button>

      {/* 📊 Riwayat */}
      <button
        onClick={() => setActiveTab('history')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'history' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <History size={20} />
        <span className="text-[9px] font-bold tracking-tight">Riwayat</span>
      </button>

      {/* CENTER FAB - Floating QR Scanner Button */}
      <div className="relative -mt-8">
        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center p-1 shadow-inner border border-white/20">
          <button
            onClick={onOpenScanner}
            aria-label="Pindai QR Code"
            className="w-full h-full bg-[#0D7A5F] hover:bg-[#0a664f] rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all group relative"
          >
            <QrCode size={22} className="group-hover:rotate-12 transition-transform text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
            </span>
          </button>
        </div>
      </div>

      {/* 🔔 Notif */}
      <button
        onClick={() => setActiveTab('notif')}
        className={`flex flex-col items-center gap-0.5 transition-all relative ${
          activeTab === 'notif' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Bell size={20} />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#023246] animate-pulse"></span>
          )}
        </div>
        <span className="text-[9px] font-bold tracking-tight">Notif</span>
      </button>

      {/* 👤 Profil */}
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center gap-0.5 transition-all ${
          activeTab === 'profile' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <User size={20} />
        <span className="text-[9px] font-bold tracking-tight">Profil</span>
      </button>

    </nav>
  );
};
