import React from 'react';
import { TeacherProfile } from '../types';
import { UserCheck, Sparkles } from 'lucide-react';

interface ProfileCardProps {
  profile: TeacherProfile;
  currentTime: Date;
  onOpenProfileTab: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  currentTime,
  onOpenProfileTab
}) => {
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 4 && hour < 11) return '☀️ Selamat Pagi,';
    if (hour >= 11 && hour < 15) return '🌤️ Selamat Siang,';
    if (hour >= 15 && hour < 18) return '🌆 Selamat Sore,';
    return '🌙 Selamat Malam,';
  };

  return (
    <section className="px-6 -mt-9 relative z-10">
      <div 
        onClick={onOpenProfileTab}
        className="bg-white rounded-2xl p-4 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-4 cursor-pointer hover:shadow-2xl transition-all active:scale-[0.99] group"
      >
        <div className="relative flex-shrink-0">
          <img 
            src={profile.photoUrl} 
            alt={profile.name} 
            className="w-14 h-14 rounded-full object-cover bg-emerald-50 border-2 border-emerald-500/20 group-hover:border-emerald-500 transition-colors shadow-sm"
          />
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>{getGreeting()}</span>
          </p>
          <h2 className="text-base font-bold text-[#023246] truncate group-hover:text-[#0D7A5F] transition-colors">
            {profile.name}
          </h2>
          <p className="text-[10px] text-slate-500 font-mono tracking-tight truncate">
            NIP. {profile.nip}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/80 flex items-center gap-1 shadow-2xs">
            <UserCheck size={11} className="text-[#0D7A5F]" />
            <span className="text-[9px] font-black text-[#0D7A5F]">AKTIF</span>
          </div>
          <span className="text-[9px] text-slate-400 font-medium tracking-tight truncate max-w-[85px]">
            {profile.subject.split('&')[0]}
          </span>
        </div>
      </div>
    </section>
  );
};
