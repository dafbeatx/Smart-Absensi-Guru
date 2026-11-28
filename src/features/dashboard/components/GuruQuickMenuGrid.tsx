import React from 'react';
import {
  SagaAdminHubIcon,
  SagaAspirationIcon,
  SagaBimtekIcon,
  SagaBookMaterialIcon,
  SagaCalendarAgendaIcon,
  SagaClassroomIcon,
  SagaCounselingIcon,
  SagaCreateExamIcon,
  SagaEditPencilIcon,
  SagaEmergencySosIcon,
  SagaExamCardIcon,
  SagaFingerprintIcon,
  SagaGamePidIcon,
  SagaGradingIcon,
  SagaHistoryIcon,
  SagaHomeroomIcon,
  SagaLeavePermitIcon,
  SagaMapPinIcon,
  SagaMoodFaceIcon,
  SagaMoreAppsIcon,
  SagaNotulenIcon,
  SagaOralExamIcon,
  SagaRfidKioskIcon,
  SagaSarprasIcon,
  SagaScheduleIcon,
  SagaStudentsIcon,
} from '../../../components/ui/SagaServiceIcons';

interface QuickMenuVisualMeta {
  id: string;
  label: string;
  tileClass: string;
  icon: React.ReactNode;
}

const WHITE_DOODLE_TILE = 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs';

function resolveQuickMenuVisual(id: string): QuickMenuVisualMeta {
  switch (id) {
    case 'jadwal':
      return {
        id,
        label: 'Jadwal',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaScheduleIcon className="w-8 h-8" />,
      };
    case 'rekap':
      return {
        id,
        label: 'Rekap',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaHistoryIcon className="w-8 h-8" />,
      };
    case 'riwayat':
      return {
        id,
        label: 'Riwayat',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaHistoryIcon className="w-8 h-8" />,
      };
    case 'administrasi':
      return {
        id,
        label: 'Administrasi',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaAdminHubIcon className="w-8 h-8" />,
      };
    case 'homeroom_plan':
      return {
        id,
        label: 'Wali Kelas',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaHomeroomIcon className="w-8 h-8" />,
      };
    case 'oral_exam':
      return {
        id,
        label: 'Ujian Lisan',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaOralExamIcon className="w-8 h-8" />,
      };
    case 'buat_soal_ai':
      return {
        id,
        label: 'Buat Soal',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaCreateExamIcon className="w-8 h-8" />,
      };
    case 'koreksi_soal':
      return {
        id,
        label: 'Koreksi',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaGradingIcon className="w-8 h-8" />,
      };
    case 'direktori_siswa':
      return {
        id,
        label: 'Siswa',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaStudentsIcon className="w-8 h-8" />,
      };
    case 'presensi':
      return {
        id,
        label: 'Absensi',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaFingerprintIcon className="w-8 h-8" />,
      };
    case 'izin_cuti':
      return {
        id,
        label: 'Izin Cuti',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaLeavePermitIcon className="w-8 h-8" />,
      };
    case 'koreksi':
      return {
        id,
        label: 'Koreksi Absen',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaEditPencilIcon className="w-8 h-8" />,
      };
    case 'location':
      return {
        id,
        label: 'Lokasi GPS',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaMapPinIcon className="w-8 h-8" />,
      };
    case 'kalender':
      return {
        id,
        label: 'Kalender',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaCalendarAgendaIcon className="w-8 h-8" />,
      };
    case 'materials':
      return {
        id,
        label: 'Bahan Ajar',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaBookMaterialIcon className="w-8 h-8" />,
      };
    case 'classroom':
      return {
        id,
        label: 'Ruang Kelas',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaClassroomIcon className="w-8 h-8" />,
      };
    case 'exam_card':
      return {
        id,
        label: 'Kartu Ujian',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaExamCardIcon className="w-8 h-8" />,
      };
    case 'jadwal_ujian_ngawas':
      return {
        id,
        label: 'Jadwal Ujian',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaScheduleIcon className="w-8 h-8" />,
      };
    case 'notulen':
      return {
        id,
        label: 'Notulen',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaNotulenIcon className="w-8 h-8" />,
      };
    case 'bimtek':
      return {
        id,
        label: 'Bimtek',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaBimtekIcon className="w-8 h-8" />,
      };
    case 'game_pid':
      return {
        id,
        label: 'Game PID',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaGamePidIcon className="w-8 h-8" />,
      };
    case 'counseling_bk':
      return {
        id,
        label: 'Catatan BK',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaCounselingIcon className="w-8 h-8" />,
      };
    case 'student_kiosk':
      return {
        id,
        label: 'Kiosk RFID',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaRfidKioskIcon className="w-8 h-8" />,
      };
    case 'student_good':
    case 'student_discipline':
      return {
        id,
        label: id === 'student_good' ? 'Poin Baik' : 'Disiplin',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaStudentsIcon className="w-8 h-8" />,
      };
    case 'emergency':
      return {
        id,
        label: 'Darurat SOS',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaEmergencySosIcon className="w-8 h-8" />,
      };
    case 'complaint':
      return {
        id,
        label: 'Aspirasi',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaAspirationIcon className="w-8 h-8" />,
      };
    case 'mood':
      return {
        id,
        label: 'Mood Harian',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaMoodFaceIcon mood="VERY_HAPPY" className="w-8 h-8" />,
      };
    case 'survey_hasil':
      return {
        id,
        label: 'Suara Guru',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaAspirationIcon className="w-8 h-8" />,
      };
    case 'sarpras_inventory':
      return {
        id,
        label: 'Sarpras',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaSarprasIcon className="w-8 h-8" />,
      };
    case 'lainnya':
    default:
      return {
        id: 'lainnya',
        label: 'Lainnya',
        tileClass: WHITE_DOODLE_TILE,
        icon: <SagaMoreAppsIcon className="w-8 h-8" />,
      };
  }
}

export interface GuruQuickMenuGridProps {
  menuIds: string[];
  activeEmergenciesCount?: number;
  onSelectMenu: (menuId: string) => void;
  onOpenCustomize: () => void;
}

export const GuruQuickMenuGrid: React.FC<GuruQuickMenuGridProps> = ({
  menuIds,
  activeEmergenciesCount = 0,
  onSelectMenu,
  onOpenCustomize,
}) => {
  return (
    <section aria-label="Menu Layanan Utama Guru" className="pt-1">
      <div className="flex items-center justify-between px-0.5 mb-3">
        <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">
          Layanan Utama
        </h2>
        <button
          type="button"
          onClick={onOpenCustomize}
          className="min-h-9 px-2.5 rounded-lg text-xs font-semibold text-[#0D5C46] hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer"
        >
          Atur Menu
        </button>
      </div>

      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5">
        {Array.from(new Set(menuIds)).slice(0, 8).map((id) => {
          const item = resolveQuickMenuVisual(id);
          const hasSosAlert = id === 'emergency' && activeEmergenciesCount > 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectMenu(id)}
              className="group min-w-0 flex flex-col items-center text-center cursor-pointer py-1 rounded-xl focus-visible:outline-2 focus-visible:outline-[#0D5C46]"
            >
              <div
                className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center transition-colors group-active:scale-95 ${item.tileClass}`}
              >
                {item.icon}
                {hasSosAlert && (
                  <span
                    aria-label={`${activeEmergenciesCount} panggilan darurat aktif`}
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#DC2626] ring-2 ring-[#F8FAFC]"
                  />
                )}
              </div>
              <span className="mt-1.5 text-[11px] min-[360px]:text-[12px] sm:text-[13px] font-semibold text-[#0F172A] leading-tight line-clamp-2 max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
