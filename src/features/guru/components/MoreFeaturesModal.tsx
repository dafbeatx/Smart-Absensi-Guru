import React from 'react';
import type { UserProfile } from '../../../types/database.types';

interface MoreFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onOpenComplaintModal: () => void;
  onOpenMoodModal: () => void;
  onOpenVoiceSettings: () => void;
  onOpenTermsModal: () => void;
  onOpenChangePin: () => void;
  onLogout: () => void;
}

export const MoreFeaturesModal: React.FC<MoreFeaturesModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenComplaintModal,
  onOpenMoodModal,
  onOpenVoiceSettings,
  onOpenTermsModal,
  onOpenChangePin,
  onLogout,
}) => {
  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'complaint',
      title: 'Kotak Aspirasi Guru',
      subtitle: 'Sampaikan aspirasi & masukan secara anonim ke Kepsek',
      icon: '💬',
      bgIcon: 'bg-teal-50 text-teal-700 border-teal-200',
      action: () => {
        onClose();
        onOpenComplaintModal();
      },
    },
    {
      id: 'mood',
      title: 'Mood & Suasana Hati',
      subtitle: 'Catat kesiapan mental & suasana hati harian guru',
      icon: '😊',
      bgIcon: 'bg-rose-50 text-rose-700 border-rose-200',
      action: () => {
        onClose();
        onOpenMoodModal();
      },
    },
    {
      id: 'voice',
      title: 'Panduan Suara & Audio KBM',
      subtitle: 'Pengaturan alarm bel kelas dan pembacaan teks otomatis',
      icon: '🔊',
      bgIcon: 'bg-blue-50 text-blue-700 border-blue-200',
      action: () => {
        onClose();
        onOpenVoiceSettings();
      },
    },
    {
      id: 'terms',
      title: 'Syarat & Ketentuan',
      subtitle: 'Aturan absensi GPS, geofence, dan binding perangkat HP',
      icon: '📋',
      bgIcon: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      action: () => {
        onClose();
        onOpenTermsModal();
      },
    },
    {
      id: 'pin',
      title: 'Ubah PIN Keamanan',
      subtitle: 'Perbarui 6-digit PIN login akun pengajar Anda',
      icon: '🔐',
      bgIcon: 'bg-amber-50 text-amber-700 border-amber-200',
      action: () => {
        onClose();
        onOpenChangePin();
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-slate-700 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              ⚙️
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Fitur Tambahan & Pengaturan</h3>
              <p className="text-[11px] text-slate-300 font-semibold truncate">{user.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={item.action}
              className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:bg-slate-50/60 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0 shadow-2xs ${item.bgIcon}`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-xs text-[#023246] leading-tight truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <span className="text-slate-400 font-bold text-base shrink-0">›</span>
            </div>
          ))}

          {/* Logout Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-2xs"
            >
              <span>🚪</span>
              <span>Keluar dari Akun (Logout)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
