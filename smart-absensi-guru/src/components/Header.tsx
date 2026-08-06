import React from 'react';
import { Bell, ShieldCheck, MapPin } from 'lucide-react';

interface HeaderProps {
  unreadCount: number;
  onOpenNotifications: () => void;
  isSimulatedOutside: boolean;
  onToggleSimulatedLocation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  unreadCount,
  onOpenNotifications,
  isSimulatedOutside,
  onToggleSimulatedLocation
}) => {
  return (
    <header className="bg-[#023246] text-white px-6 pt-5 pb-14 rounded-b-[40px] shadow-lg relative overflow-hidden">
      {/* Decorative subtle background pattern */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center p-1 shadow-inner border border-white/20 flex-shrink-0">
            {/* Logo Sekolah */}
            <div className="bg-[#0D7A5F] w-full h-full rounded-lg flex items-center justify-center text-[11px] font-black text-white tracking-wider">
              AI
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight tracking-tight uppercase text-white">Smart Absensi Guru</h1>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase flex items-center gap-1 opacity-90">
              <span>SMP Terpadu Al-Ittihadiyah</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Location Simulator toggle pill */}
          <button
            onClick={onToggleSimulatedLocation}
            title={isSimulatedOutside ? "Mode: Luar Geofence (Klik untuk Masuk)" : "Mode: Dalam Geofence (Klik untuk Keluar)"}
            className={`text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 transition-all border ${
              isSimulatedOutside
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <MapPin size={10} />
            {isSimulatedOutside ? 'Luar Radius' : 'Dalam Radius'}
          </button>

          <button
            onClick={onOpenNotifications}
            aria-label="Notifikasi"
            className="relative p-2.5 bg-white/10 rounded-full backdrop-blur-md border border-white/20 active:scale-95 transition-transform hover:bg-white/20"
          >
            <Bell size={18} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-[#023246] rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
