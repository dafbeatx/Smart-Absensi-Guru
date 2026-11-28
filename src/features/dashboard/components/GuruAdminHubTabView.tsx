import React from 'react';
import {
  SagaAdminHubIcon,
  SagaAspirationIcon,
  SagaBimtekIcon,
  SagaBookMaterialIcon,
  SagaCalendarAgendaIcon,
  SagaChallengeTrophyIcon,
  SagaClassroomIcon,
  SagaCounselingIcon,
  SagaCreateExamIcon,
  SagaEmergencySosIcon,
  SagaExamCardIcon,
  SagaGamePidIcon,
  SagaGradingIcon,
  SagaHistoryIcon,
  SagaHomeroomIcon,
  SagaNotulenIcon,
  SagaOralExamIcon,
  SagaRfidKioskIcon,
  SagaSarprasIcon,
  SagaScheduleIcon,
  SagaStudentsIcon,
} from '../../../components/ui/SagaServiceIcons';

export interface AdminHubActionItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  tileClass: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface GuruAdminHubTabViewProps {
  oralExamBadgeText: string;
  oralExamSubtitle: string;
  isSarprasOfficer: boolean;
  activeEmergenciesCount: number;
  streakDays: number;
  userPoints: number;
  userRank: number;
  activeAssignmentSection?: React.ReactNode;
  onOpenAdministration: () => void;
  onOpenOralExam: () => void;
  onOpenExamCreator: () => void;
  onOpenQuestionCorrection: () => void;
  onOpenExamCard: () => void;
  onOpenSchedule: () => void;
  onOpenMaterials: () => void;
  onOpenNotulen: () => void;
  onOpenBimtek: () => void;
  onOpenCalendar: () => void;
  onOpenHomeroom: () => void;
  onOpenStudents: () => void;
  onOpenClassroom: () => void;
  onOpenStudentBehavior: (tab: 'KEBAIKAN' | 'KEDISIPLINAN') => void;
  onOpenCounseling: () => void;
  onOpenTeacherBoard: () => void;
  onOpenChallenge: () => void;
  onOpenLeaderboard: () => void;
  onOpenSurveyAnalytics: () => void;
  onOpenRfidKiosk: () => void;
  onOpenGamePid: () => void;
  onOpenSarpras: () => void;
  onOpenEmergency: () => void;
}

export const GuruAdminHubTabView: React.FC<GuruAdminHubTabViewProps> = ({
  oralExamBadgeText,
  oralExamSubtitle,
  isSarprasOfficer,
  activeEmergenciesCount,
  streakDays,
  userPoints,
  userRank,
  activeAssignmentSection,
  onOpenAdministration,
  onOpenOralExam,
  onOpenExamCreator,
  onOpenQuestionCorrection,
  onOpenExamCard,
  onOpenSchedule,
  onOpenMaterials,
  onOpenNotulen,
  onOpenBimtek,
  onOpenCalendar,
  onOpenHomeroom,
  onOpenStudents,
  onOpenClassroom,
  onOpenStudentBehavior,
  onOpenCounseling,
  onOpenTeacherBoard,
  onOpenChallenge,
  onOpenLeaderboard,
  onOpenSurveyAnalytics,
  onOpenRfidKiosk,
  onOpenGamePid,
  onOpenSarpras,
  onOpenEmergency,
}) => {
  const teachingItems: AdminHubActionItem[] = [
    {
      id: 'administrasi',
      title: 'Pusat Administrasi KBM',
      subtitle: 'Arsip berkas ajar & perangkat tahun ajaran',
      tileClass: 'bg-amber-50 border-amber-200 text-[#B45309]',
      icon: <SagaAdminHubIcon className="w-6 h-6" />,
      onClick: onOpenAdministration,
    },
    {
      id: 'oral_exam',
      title: 'Penilaian Ujian Lisan',
      subtitle: oralExamSubtitle,
      badge: oralExamBadgeText,
      tileClass: 'bg-teal-50 border-teal-200 text-[#0F766E]',
      icon: <SagaOralExamIcon className="w-6 h-6" />,
      onClick: onOpenOralExam,
    },
    {
      id: 'buat_soal_ai',
      title: 'Pembuat Soal & Kisi-Kisi',
      subtitle: 'Susun naskah soal dan kunci jawaban',
      tileClass: 'bg-sky-50 border-sky-200 text-[#0369A1]',
      icon: <SagaCreateExamIcon className="w-6 h-6" />,
      onClick: onOpenExamCreator,
    },
    {
      id: 'koreksi_soal',
      title: 'Koreksi Soal & Nilai',
      subtitle: 'Input nilai & pemeriksaan lembar ujian',
      tileClass: 'bg-amber-50 border-amber-200 text-[#B45309]',
      icon: <SagaGradingIcon className="w-6 h-6" />,
      onClick: onOpenQuestionCorrection,
    },
    {
      id: 'exam_card',
      title: 'Cetak Kartu Ujian',
      subtitle: 'Kartu peserta ujian barcode format A4',
      tileClass: 'bg-emerald-50 border-emerald-200 text-[#0F766E]',
      icon: <SagaExamCardIcon className="w-6 h-6" />,
      onClick: onOpenExamCard,
    },
    {
      id: 'jadwal',
      title: 'Jadwal Mengajar',
      subtitle: 'Jadwal mingguan mapel dan ruang kelas',
      tileClass: 'bg-emerald-50 border-emerald-200 text-[#0F766E]',
      icon: <SagaScheduleIcon className="w-6 h-6" />,
      onClick: onOpenSchedule,
    },
    {
      id: 'materials',
      title: 'Modul & Bahan Ajar',
      subtitle: 'Bank materi pelajaran dan referensi KBM',
      tileClass: 'bg-blue-50 border-blue-200 text-[#1D4ED8]',
      icon: <SagaBookMaterialIcon className="w-6 h-6" />,
      onClick: onOpenMaterials,
    },
    {
      id: 'notulen',
      title: 'Notulen Rapat',
      subtitle: 'Risalah dan arsip rapat resmi sekolah',
      tileClass: 'bg-blue-50 border-blue-200 text-[#1D4ED8]',
      icon: <SagaNotulenIcon className="w-6 h-6" />,
      onClick: onOpenNotulen,
    },
    {
      id: 'bimtek',
      title: 'Bimtek & Diklat',
      subtitle: 'Catat pelatihan, JP, dan sertifikat guru',
      tileClass: 'bg-amber-50 border-amber-200 text-[#B45309]',
      icon: <SagaBimtekIcon className="w-6 h-6" />,
      onClick: onOpenBimtek,
    },
    {
      id: 'kalender',
      title: 'Kalender Agenda',
      subtitle: 'Hari libur, rapat dinas, dan ujian',
      tileClass: 'bg-slate-100 border-slate-200 text-[#334155]',
      icon: <SagaCalendarAgendaIcon className="w-6 h-6" />,
      onClick: onOpenCalendar,
    },
  ];

  const studentAndSchoolItems: AdminHubActionItem[] = [
    {
      id: 'homeroom_plan',
      title: 'Ruang Wali Kelas',
      subtitle: 'Pendataan rencana studi siswa kelas 9',
      tileClass: 'bg-teal-50 border-teal-200 text-[#0F766E]',
      icon: <SagaHomeroomIcon className="w-6 h-6" />,
      onClick: onOpenHomeroom,
    },
    {
      id: 'direktori_siswa',
      title: 'Direktori Siswa',
      subtitle: 'Data siswa, rombel, dan kontak wali',
      tileClass: 'bg-blue-50 border-blue-200 text-[#1D4ED8]',
      icon: <SagaStudentsIcon className="w-6 h-6" />,
      onClick: onOpenStudents,
    },
    {
      id: 'classroom',
      title: 'Ruang Kelas & Rombel',
      subtitle: 'Daftar rombel dan wali kelas sekolah',
      tileClass: 'bg-sky-50 border-sky-200 text-[#0369A1]',
      icon: <SagaClassroomIcon className="w-6 h-6" />,
      onClick: onOpenClassroom,
    },
    {
      id: 'student_good',
      title: 'Poin Kebaikan Siswa',
      subtitle: 'Apresiasi sikap baik dan prestasi murid',
      tileClass: 'bg-emerald-50 border-emerald-200 text-[#0F766E]',
      icon: <SagaChallengeTrophyIcon className="w-6 h-6" />,
      onClick: () => onOpenStudentBehavior('KEBAIKAN'),
    },
    {
      id: 'student_discipline',
      title: 'Catatan Disiplin Siswa',
      subtitle: 'Pencatatan pelanggaran tata tertib murid',
      tileClass: 'bg-rose-50 border-rose-200 text-[#9F1239]',
      icon: <SagaEmergencySosIcon className="w-6 h-6" />,
      onClick: () => onOpenStudentBehavior('KEDISIPLINAN'),
    },
    {
      id: 'counseling_bk',
      title: 'Catatan Konseling (BK)',
      subtitle: 'Bimbingan konseling terpadu Nawasena',
      tileClass: 'bg-emerald-50 border-emerald-200 text-[#0F766E]',
      icon: <SagaCounselingIcon className="w-6 h-6" />,
      onClick: onOpenCounseling,
    },
    {
      id: 'teacher_board',
      title: 'Papan Presensi Guru',
      subtitle: 'Lihat kehadiran rekan guru hari ini',
      tileClass: 'bg-teal-50 border-teal-200 text-[#0F766E]',
      icon: <SagaHistoryIcon className="w-6 h-6" />,
      onClick: onOpenTeacherBoard,
    },
    {
      id: 'challenge',
      title: 'Tantangan & Peringkat',
      subtitle: `${streakDays} hari beruntun, peringkat #${userRank} (${userPoints} poin)`,
      tileClass: 'bg-amber-50 border-amber-200 text-[#B45309]',
      icon: <SagaChallengeTrophyIcon className="w-6 h-6" />,
      onClick: onOpenChallenge,
    },
    {
      id: 'leaderboard',
      title: 'Lencana Kepsek',
      subtitle: 'Rekap poin kedisiplinan guru bulanan',
      tileClass: 'bg-amber-50 border-amber-200 text-[#B45309]',
      icon: <SagaBimtekIcon className="w-6 h-6" />,
      onClick: onOpenLeaderboard,
    },
    {
      id: 'survey_analytics',
      title: 'Suara Guru & Survei',
      subtitle: 'Hasil evaluasi anonim & solusi sekolah',
      tileClass: 'bg-sky-50 border-sky-200 text-[#0369A1]',
      icon: <SagaAspirationIcon className="w-6 h-6" />,
      onClick: onOpenSurveyAnalytics,
    },
    {
      id: 'student_kiosk',
      title: 'Terminal RFID Siswa',
      subtitle: 'Pemindaian kartu hadir siswa piket',
      tileClass: 'bg-slate-100 border-slate-200 text-[#334155]',
      icon: <SagaRfidKioskIcon className="w-6 h-6" />,
      onClick: onOpenRfidKiosk,
    },
    {
      id: 'game_pid',
      title: 'Wahana Game PID',
      subtitle: 'Portal game edukasi kelas interaktif 3D',
      tileClass: 'bg-blue-50 border-blue-200 text-[#1D4ED8]',
      icon: <SagaGamePidIcon className="w-6 h-6" />,
      onClick: onOpenGamePid,
    },
    ...(isSarprasOfficer
      ? [
          {
            id: 'sarpras_inventory',
            title: 'Inventaris Sarpras',
            subtitle: 'Pencatatan aset dan pengadaan sekolah',
            tileClass: 'bg-slate-100 border-slate-200 text-[#334155]',
            icon: <SagaSarprasIcon className="w-6 h-6" />,
            onClick: onOpenSarpras,
          },
        ]
      : []),
    {
      id: 'emergency',
      title: 'Panggilan Darurat (SOS)',
      subtitle: 'Bantuan cepat guru piket dan tim UKS',
      badge: activeEmergenciesCount > 0 ? `${activeEmergenciesCount} Aktif` : undefined,
      tileClass: 'bg-rose-50 border-rose-200 text-[#9F1239]',
      icon: <SagaEmergencySosIcon className="w-6 h-6" />,
      onClick: onOpenEmergency,
    },
  ];

  const renderGroup = (title: string, items: AdminHubActionItem[]) => (
    <div className="space-y-2.5">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider px-0.5">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="w-full min-h-14 p-3 rounded-2xl saga-card-interactive border border-slate-200 text-left flex items-center gap-3 transition-colors cursor-pointer"
          >
            <div
              className="w-11 h-11 rounded-xl border border-slate-200 bg-[#F8FAFC] flex items-center justify-center shrink-0"
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#0F172A] truncate">
                  {item.title}
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {item.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section aria-label="Administrasi Guru" className="space-y-5">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200">
        <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
          Administrasi Guru
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Pusat perangkat mengajar, jadwal, asesmen ujian, wali kelas, dan administrasi kesiswaan Anda.
        </p>
      </div>

      {activeAssignmentSection}

      {renderGroup('Perangkat KBM & Asesmen', teachingItems)}
      {renderGroup('Wali Kelas, Kesiswaan & Layanan Sekolah', studentAndSchoolItems)}
    </section>
  );
};
