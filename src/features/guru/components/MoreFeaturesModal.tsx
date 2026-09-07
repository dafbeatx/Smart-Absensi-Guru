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
  onOpenStudentKiosk?: () => void;
  onOpenCorrectionModal?: () => void;
  onOpenClassroomModal?: () => void;
  onOpenLocationModal?: () => void;
  onOpenStudentDirectoryModal?: () => void;
  onOpenTeachingMaterialsModal?: () => void;
  onOpenEventsCalendarModal?: () => void;
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
  onOpenStudentKiosk,
  onOpenCorrectionModal,
  onOpenClassroomModal,
  onOpenLocationModal,
  onOpenStudentDirectoryModal,
  onOpenTeachingMaterialsModal,
  onOpenEventsCalendarModal,
}) => {
  if (!isOpen) return null;

  interface MenuItem {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    action: () => void;
  }

  interface MenuGroup {
    category: string;
    items: MenuItem[];
  }

  const menuGroups: MenuGroup[] = [
    {
      category: 'Akademik & KBM',
      items: [
        ...(onOpenStudentDirectoryModal
          ? [
              {
                id: 'student_directory',
                title: 'Direktori Siswa & RFID',
                subtitle: 'Database siswa, kelas, kontak wali, dan kartu RFID',
                icon: '🎓',
                action: () => {
                  onClose();
                  onOpenStudentDirectoryModal();
                },
              },
            ]
          : []),
        ...(onOpenClassroomModal
          ? [
              {
                id: 'classroom',
                title: 'Ruang Kelas & Rombel',
                subtitle: 'Daftar rombongan belajar dan jadwal kelas',
                icon: '🏫',
                action: () => {
                  onClose();
                  onOpenClassroomModal();
                },
              },
            ]
          : []),
        ...(onOpenTeachingMaterialsModal
          ? [
              {
                id: 'materials',
                title: 'Modul & Bahan Ajar KBM',
                subtitle: 'Bank materi pembelajaran dan referensi ajar',
                icon: '📚',
                action: () => {
                  onClose();
                  onOpenTeachingMaterialsModal();
                },
              },
            ]
          : []),
        ...(onOpenEventsCalendarModal
          ? [
              {
                id: 'events',
                title: 'Kalender Acara & Agenda',
                subtitle: 'Jadwal kegiatan akademik, ujian, dan hari libur',
                icon: '📅',
                action: () => {
                  onClose();
                  onOpenEventsCalendarModal();
                },
              },
            ]
          : []),
      ],
    },
    {
      category: 'Presensi & Kehadiran',
      items: [
        ...(onOpenCorrectionModal
          ? [
              {
                id: 'correction',
                title: 'Koreksi Presensi Guru',
                subtitle: 'Pengajuan koreksi kehadiran jika lupa atau terkendala GPS',
                icon: '📝',
                action: () => {
                  onClose();
                  onOpenCorrectionModal();
                },
              },
            ]
          : []),
        ...(onOpenLocationModal
          ? [
              {
                id: 'location',
                title: 'Peta Lokasi & Geofence GPS',
                subtitle: 'Pantau koordinat GPS sekolah dan radius presensi',
                icon: '📍',
                action: () => {
                  onClose();
                  onOpenLocationModal();
                },
              },
            ]
          : []),
        ...(onOpenStudentKiosk
          ? [
              {
                id: 'rfid_kiosk',
                title: 'Terminal Presensi RFID Siswa 2',
                subtitle: 'Kiosk tap kartu RFID siswa untuk guru piket',
                icon: '📡',
                action: () => {
                  onClose();
                  onOpenStudentKiosk();
                },
              },
            ]
          : []),
      ],
    },
    {
      category: 'Pengaturan & Komunikasi',
      items: [
        {
          id: 'complaint',
          title: 'Kotak Aspirasi Guru',
          subtitle: 'Sampaikan aspirasi & masukan secara anonim ke Kepala Sekolah',
          icon: '💬',
          action: () => {
            onClose();
            onOpenComplaintModal();
          },
        },
        {
          id: 'mood',
          title: 'Mood & Kesiapan Harian',
          subtitle: 'Catat kesiapan mental dan suasana hati harian guru',
          icon: '😊',
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
          action: () => {
            onClose();
            onOpenChangePin();
          },
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0 border border-white/10">
              ⚙️
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight truncate">Semua Fitur & Pengaturan</h3>
              <p className="text-[11px] text-slate-300 font-medium truncate">{user.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {menuGroups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.category} className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                  {group.category}
                </h4>
                <div className="bg-slate-50/70 rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-white active:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-base shrink-0 shadow-2xs">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-[#023246] leading-tight truncate">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400 font-bold text-sm shrink-0">›</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Logout Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full h-11 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-2xs"
            >
              <span>🚪</span>
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 bg-[#023246] hover:bg-[#034560] active:scale-98 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
