import React, { useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import { isUserSarprasOfficer } from '../../sarpras/utils/sarpras-access.utils';
import { WebTrafficService } from '../../../services/web-traffic.service';
import {
  SagaAdminHubIcon,
  SagaAspirationIcon,
  SagaBookMaterialIcon,
  SagaCalendarAgendaIcon,
  SagaClassroomIcon,
  SagaClockStatusIcon,
  SagaCreateExamIcon,
  SagaEditPencilIcon,
  SagaEmergencySosIcon,
  SagaExamCardIcon,
  SagaGamePidIcon,
  SagaGradingIcon,
  SagaHistoryIcon,
  SagaHomeroomIcon,
  SagaInfoCircleIcon,
  SagaKeyPinIcon,
  SagaLogoutDoorIcon,
  SagaMapPinIcon,
  SagaMoodFaceIcon,
  SagaMoreAppsIcon,
  SagaNotulenIcon,
  SagaRfidKioskIcon,
  SagaSarprasIcon,
  SagaSparkAiIcon,
  SagaStudentsIcon,
  SagaVoiceAudioIcon,
} from '../../../components/ui/SagaServiceIcons';

interface MoreFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  hasFilledMoodToday?: boolean;
  hasSubmittedComplaintToday?: boolean;
  hasAwardedMeritToday?: boolean;
  hasRecordedDemeritToday?: boolean;
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
  onOpenStudentBehaviorModal?: (tab?: 'KEBAIKAN' | 'KEDISIPLINAN') => void;
  onOpenEmergencyModal?: () => void;
  onOpenSarprasModal?: () => void;
  onOpenExamCardModal?: () => void;
  onOpenExamCreatorModal?: () => void;
  onOpenQuestionCorrectionModal?: () => void;
  onOpenHomeroomModal?: () => void;
  onOpenAdministrationModal?: () => void;
  onOpenAboutModal?: () => void;
  onOpenTeacherBoard?: () => void;
  onOpenGamePidModal?: () => void;
}

export const MoreFeaturesModal: React.FC<MoreFeaturesModalProps> = ({
  isOpen,
  onClose,
  user,
  hasFilledMoodToday = false,
  hasSubmittedComplaintToday = false,
  hasAwardedMeritToday = false,
  hasRecordedDemeritToday = false,
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
  onOpenStudentBehaviorModal,
  onOpenEmergencyModal,
  onOpenSarprasModal,
  onOpenExamCardModal,
  onOpenExamCreatorModal,
  onOpenQuestionCorrectionModal,
  onOpenHomeroomModal,
  onOpenAdministrationModal,
  onOpenAboutModal,
  onOpenTeacherBoard,
  onOpenGamePidModal,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  interface MenuItem {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
    badgeDone?: boolean;
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
        ...(onOpenAdministrationModal
          ? [
              {
                id: 'administrasi',
                title: 'Administrasi Sekolah & KBM',
                subtitle: 'Pusat berkas ujian, bahan ajar, jadwal, dan perangkat berbasis tahun ajaran',
                icon: <SagaAdminHubIcon className="w-6 h-6" />,
                badge: 'Pusat Berkas',
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'administrasi',
                  });
                  onClose();
                  onOpenAdministrationModal();
                },
              },
            ]
          : []),
        ...(onOpenGamePidModal
          ? [
              {
                id: 'game_pid',
                title: 'Game PID (Pekan Inovasi Digital)',
                subtitle: 'Arena edukasi School Slice 3D & kuis interaktif sekolah berbasis karakter',
                icon: <SagaGamePidIcon className="w-6 h-6" />,
                badge: '3D Ready',
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'game_pid',
                  });
                  onClose();
                  onOpenGamePidModal();
                },
              },
            ]
          : []),
        ...(onOpenHomeroomModal
          ? [
              {
                id: 'homeroom_plan',
                title: 'Ruang Wali Kelas: Rencana Studi Siswa',
                subtitle: 'Pendataan & verifikasi rencana pendidikan lanjutan siswa kelas 9',
                icon: <SagaHomeroomIcon className="w-6 h-6" />,
                badge: 'Wali Kelas 9',
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'homeroom_plan',
                  });
                  onClose();
                  onOpenHomeroomModal();
                },
              },
            ]
          : []),
        ...(onOpenExamCardModal
          ? [
              {
                id: 'exam_card',
                title: 'Cetak Kartu Ujian & Barcode Siswa',
                subtitle: 'Generator kartu peserta ujian & barcode NISN siswa (Format A4)',
                icon: <SagaExamCardIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'exam_card',
                  });
                  onClose();
                  onOpenExamCardModal();
                },
              },
            ]
          : []),
        ...(onOpenExamCreatorModal
          ? [
              {
                id: 'buat_soal_ai',
                title: 'Pembuat Soal & Kisi-Kisi AI',
                subtitle: 'Generator naskah soal KOP SMPT Al-Ittihadiyah, kunci & kisi-kisi',
                icon: <SagaCreateExamIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'buat_soal_ai',
                  });
                  onClose();
                  onOpenExamCreatorModal();
                },
              },
            ]
          : []),
        {
          id: 'koreksi_soal',
          title: 'Koreksi Soal & Input Nilai',
          subtitle: 'Aplikasi koreksi lembar ujian & rekap nilai siswa (In-App)',
          icon: <SagaGradingIcon className="w-6 h-6" />,
          action: () => {
            WebTrafficService.recordFeatureVisit({
              user_id: user.id,
              user_name: user.full_name,
              user_npp: user.nip,
              user_role: user.role,
              feature_id: 'koreksi_soal',
            });
            onClose();
            if (onOpenQuestionCorrectionModal) {
              onOpenQuestionCorrectionModal();
            }
          },
        },
        ...(onOpenStudentBehaviorModal
          ? [
              {
                id: 'student_good_points',
                title: 'Poin Kebaikan Siswa',
                subtitle: 'Apresiasi sikap, kebersihan, dan keaktifan siswa (Sinkron)',
                icon: <SagaSparkAiIcon className="w-6 h-6" />,
                badge: hasAwardedMeritToday ? 'Selesai (+5 Poin)' : '+5 Poin',
                badgeDone: hasAwardedMeritToday,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'student_good',
                  });
                  onClose();
                  onOpenStudentBehaviorModal('KEBAIKAN');
                },
              },
              {
                id: 'student_discipline_points',
                title: 'Poin Kedisiplinan Siswa',
                subtitle: 'Catatan pelanggaran tata tertib & pengurangan poin',
                icon: <SagaClockStatusIcon className="w-6 h-6" />,
                badge: hasRecordedDemeritToday ? 'Selesai (+5 Poin)' : '+5 Poin',
                badgeDone: hasRecordedDemeritToday,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'student_discipline',
                  });
                  onClose();
                  onOpenStudentBehaviorModal('KEDISIPLINAN');
                },
              },
            ]
          : []),
        ...(onOpenStudentDirectoryModal
          ? [
              {
                id: 'student_directory',
                title: 'Direktori Siswa & RFID',
                subtitle: 'Database siswa, kelas, kontak wali, dan kartu RFID',
                icon: <SagaStudentsIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'direktori_siswa',
                  });
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
                icon: <SagaClassroomIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'classroom',
                  });
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
                icon: <SagaBookMaterialIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'materials',
                  });
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
                icon: <SagaCalendarAgendaIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'kalender',
                  });
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
        ...(onOpenTeacherBoard
          ? [
              {
                id: 'teacher_daily_board',
                title: 'Papan Presensi Harian',
                subtitle: 'Lihat kehadiran seluruh rekan guru hari ini secara real-time',
                icon: <SagaHistoryIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'teacher_daily_board',
                  });
                  onClose();
                  onOpenTeacherBoard();
                },
              },
            ]
          : []),
        ...(onOpenCorrectionModal
          ? [
              {
                id: 'correction',
                title: 'Koreksi Presensi Guru',
                subtitle: 'Pengajuan koreksi kehadiran jika lupa atau terkendala GPS',
                icon: <SagaEditPencilIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'koreksi',
                  });
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
                icon: <SagaMapPinIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'location',
                  });
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
                icon: <SagaRfidKioskIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'student_kiosk',
                  });
                  onClose();
                  onOpenStudentKiosk();
                },
              },
            ]
          : []),
      ],
    },
    ...(isUserSarprasOfficer(user) && onOpenSarprasModal
      ? [
          {
            category: 'Sarana & Prasarana (Wakasek)',
            items: [
              {
                id: 'sarpras_inventory',
                title: 'Inventaris Sarana & Prasarana',
                subtitle: 'Pencatatan aset barang, kondisi, dan kebutuhan pengadaan sekolah',
                icon: <SagaSarprasIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'sarpras_inventory',
                  });
                  onClose();
                  onOpenSarprasModal();
                },
              },
            ],
          },
        ]
      : []),
    {
      category: 'Bantuan & Tanggap Darurat',
      items: [
        ...(onOpenEmergencyModal
          ? [
              {
                id: 'classroom_emergency',
                title: 'Panggilan Bantuan Darurat Kelas (SOS)',
                subtitle: 'Panggil Guru Piket & Tim UKS instan dengan deteksi ruang kelas otomatis',
                icon: <SagaEmergencySosIcon className="w-6 h-6" />,
                action: () => {
                  WebTrafficService.recordFeatureVisit({
                    user_id: user.id,
                    user_name: user.full_name,
                    user_npp: user.nip,
                    user_role: user.role,
                    feature_id: 'emergency',
                  });
                  onClose();
                  onOpenEmergencyModal();
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
          icon: <SagaAspirationIcon className="w-6 h-6" />,
          badge: hasSubmittedComplaintToday ? 'Selesai (+5 Poin)' : '+5 Poin',
          badgeDone: hasSubmittedComplaintToday,
          action: () => {
            WebTrafficService.recordFeatureVisit({
              user_id: user.id,
              user_name: user.full_name,
              user_npp: user.nip,
              user_role: user.role,
              feature_id: 'complaint',
            });
            onClose();
            onOpenComplaintModal();
          },
        },
        {
          id: 'mood',
          title: 'Mood & Kesiapan Harian',
          subtitle: 'Catat kesiapan mental dan suasana hati harian guru',
          icon: <SagaMoodFaceIcon mood="VERY_HAPPY" className="w-6 h-6" />,
          badge: hasFilledMoodToday ? 'Selesai (+5 Poin)' : '+5 Poin',
          badgeDone: hasFilledMoodToday,
          action: () => {
            WebTrafficService.recordFeatureVisit({
              user_id: user.id,
              user_name: user.full_name,
              user_npp: user.nip,
              user_role: user.role,
              feature_id: 'mood',
            });
            onClose();
            onOpenMoodModal();
          },
        },
        {
          id: 'voice',
          title: 'Panduan Suara & Audio KBM',
          subtitle: 'Pengaturan alarm bel kelas dan pembacaan teks otomatis',
          icon: <SagaVoiceAudioIcon className="w-6 h-6" />,
          action: () => {
            onClose();
            onOpenVoiceSettings();
          },
        },
        {
          id: 'terms',
          title: 'Syarat & Ketentuan',
          subtitle: 'Aturan absensi GPS, geofence, dan binding perangkat HP',
          icon: <SagaNotulenIcon className="w-6 h-6" />,
          action: () => {
            onClose();
            onOpenTermsModal();
          },
        },
        {
          id: 'pin',
          title: 'Ubah PIN Keamanan',
          subtitle: 'Perbarui 6-digit PIN login akun pengajar Anda',
          icon: <SagaKeyPinIcon className="w-6 h-6" />,
          action: () => {
            onClose();
            onOpenChangePin();
          },
        },
        ...(onOpenAboutModal
          ? [
              {
                id: 'about_app',
                title: 'Tentang Aplikasi & Pengembang',
                subtitle: 'Kisah Dafa Maulana, S.Pd & kolaborasi AI Agent Gemini',
                icon: <SagaInfoCircleIcon className="w-6 h-6" />,
                action: () => {
                  onClose();
                  onOpenAboutModal();
                },
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Semua Fitur dan Pengaturan"
    >
      <div className="bg-white w-full sm:max-w-120 h-dvh sm:h-auto sm:max-h-[92dvh] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#0D5C46] text-white pt-[max(14px,env(safe-area-inset-top))] pb-3.5 px-4 sm:px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/15">
              <SagaMoreAppsIcon tone="dark" className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-tight truncate">Semua Fitur &amp; Pengaturan</h3>
              <p className="text-xs text-emerald-100 font-medium truncate">{user.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-[#F8FAFC]">
          {menuGroups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.category} className="space-y-2">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
                  {group.category}
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {group.items.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      className={`w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer min-h-16 ${
                        idx > 0 ? 'border-t border-slate-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="font-bold text-sm text-slate-900 leading-tight truncate">
                              {item.title}
                            </h5>
                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border shrink-0 ${
                                  item.badgeDone
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Logout Button */}
          <div className="pt-1 pb-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full min-h-12 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <SagaLogoutDoorIcon className="w-5 h-5 shrink-0" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3.5 px-4 pb-[max(14px,env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-12 bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.99] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
