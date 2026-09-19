import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Settings2,
  FolderCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type {
  AdministrationModuleItem,
  AdministrationCategory,
  SemesterType,
} from '../../../types/administration.types';
import {
  AVAILABLE_ACADEMIC_YEARS,
} from '../../../types/administration.types';
import {
  AdministrationRepository,
  ADMIN_YEAR_CHANGED_EVENT,
  ADMIN_MODULES_CHANGED_EVENT,
} from '../../../repositories/AdministrationRepository';
import { CustomizeAdministrationModal } from './CustomizeAdministrationModal';

export interface AdministrationHubViewProps {
  userId?: string;
  userRole?: string;
  userName?: string;
  onOpenModule: (actionId: string, item: AdministrationModuleItem, academicYear: string) => void;
  onBackToDashboard?: () => void;
  isModalMode?: boolean;
}

export const AdministrationHubView: React.FC<AdministrationHubViewProps> = ({
  userId = 'default_user',
  userRole: _userRole = 'GURU',
  userName: _userName = 'Pendidik',
  onOpenModule,
  onBackToDashboard: _onBackToDashboard,
  isModalMode = false,
}) => {
  const [academicYear, setAcademicYear] = useState<string>(() =>
    AdministrationRepository.getActiveAcademicYear()
  );
  const [semester, setSemester] = useState<SemesterType>(() =>
    AdministrationRepository.getActiveSemester()
  );
  const [modules, setModules] = useState<AdministrationModuleItem[]>(() =>
    AdministrationRepository.getModules(userId, academicYear)
  );
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Sync state when academic year or modules change
  useEffect(() => {
    const handleYearEvent = () => {
      const yr = AdministrationRepository.getActiveAcademicYear();
      const sem = AdministrationRepository.getActiveSemester();
      setAcademicYear(yr);
      setSemester(sem);
      setModules(AdministrationRepository.getModules(userId, yr));
    };

    const handleModulesEvent = () => {
      setModules(AdministrationRepository.getModules(userId, academicYear));
    };

    window.addEventListener(ADMIN_YEAR_CHANGED_EVENT, handleYearEvent);
    window.addEventListener(ADMIN_MODULES_CHANGED_EVENT, handleModulesEvent);
    window.addEventListener('storage', handleYearEvent);

    return () => {
      window.removeEventListener(ADMIN_YEAR_CHANGED_EVENT, handleYearEvent);
      window.removeEventListener(ADMIN_MODULES_CHANGED_EVENT, handleModulesEvent);
      window.removeEventListener('storage', handleYearEvent);
    };
  }, [userId, academicYear]);

  const handleYearChange = (newYear: string) => {
    setAcademicYear(newYear);
    AdministrationRepository.setActiveAcademicYear(newYear);
    setModules(AdministrationRepository.getModules(userId, newYear));
  };

  const handleSemesterChange = (newSem: SemesterType) => {
    setSemester(newSem);
    AdministrationRepository.setActiveSemester(newSem);
  };

  const enabledModules = useMemo(() => {
    return modules.filter((m) => m.isEnabled).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [modules]);

  const categories: Array<{ id: AdministrationCategory; title: string; subtitle: string; icon: string }> = [
    {
      id: 'UJIAN',
      title: 'Ujian & Penilaian',
      subtitle: 'Koreksi lembar jawaban, cetak kartu peserta, dan rekap asesmen',
      icon: '📝',
    },
    {
      id: 'PERANGKAT_AJAR',
      title: 'Perangkat Pembelajaran & KBM',
      subtitle: 'Modul ajar, RPP, bank materi, dan distribusi jadwal mengajar',
      icon: '📚',
    },
    {
      id: 'KESISWAAN',
      title: 'Kesiswaan & Rombel',
      subtitle: 'Ruang kelas, direktori siswa, kartu RFID, dan pendataan studi lanjut',
      icon: '🎓',
    },
    {
      id: 'AGENDA_REKAP',
      title: 'Agenda & Laporan Presensi',
      subtitle: 'Kalender tahun ajaran dan rekapitulasi kehadiran berkala',
      icon: '📅',
    },
    {
      id: 'CUSTOM',
      title: 'Pintasan Kustom Guru & Admin',
      subtitle: 'Modul dan tautan tambahan yang dikonfigurasi secara mandiri',
      icon: '✨',
    },
  ];

  return (
    <div className={`space-y-4 sm:space-y-6 ${isModalMode ? 'p-3 sm:p-5' : ''}`}>
      {/* ── TOP CONTROL BANNER (TAHUN AJARAN + SEMESTER + ATUR MODUL) ── */}
      <div className="bg-linear-to-r from-[#023246] via-[#18536B] to-[#287094] rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl border border-white/10 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-white/15 text-white backdrop-blur-xs border border-white/20">
                <FolderCheck className="w-5 h-5 text-cyan-300" />
              </span>
              <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-cyan-200">
                Administrasi Sekolah &amp; KBM
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Pusat Administrasi &amp; Ujian
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100/90 max-w-xl font-medium">
              Akses cepat berkas modul, kartu ujian, koreksi soal, dan kalender kegiatan
              berbasis tahun ajaran aktif.
            </p>
          </div>

          {/* Academic Year & Semester Selector Widget */}
          <div className="bg-black/25 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-white/15 shrink-0 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-300" />
                <span className="text-[11px] font-bold text-cyan-100 uppercase tracking-wide">
                  Tahun Ajaran:
                </span>
              </div>
              {/* Year Dropdown */}
              <select
                value={academicYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-white text-[#023246] border border-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 cursor-pointer shadow-xs"
              >
                {AVAILABLE_ACADEMIC_YEARS.map((opt) => (
                  <option key={opt.year} value={opt.year}>
                    {opt.year} {opt.isActive ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Pill Switcher */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <span className="text-[10px] font-bold text-cyan-200">Semester:</span>
              <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15">
                <button
                  type="button"
                  onClick={() => handleSemesterChange('GANJIL')}
                  className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
                    semester === 'GANJIL'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-cyan-100 hover:text-white'
                  }`}
                >
                  Ganjil
                </button>
                <button
                  type="button"
                  onClick={() => handleSemesterChange('GENAP')}
                  className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
                    semester === 'GENAP'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-cyan-100 hover:text-white'
                  }`}
                >
                  Genap
                </button>
              </div>
            </div>

            {/* Customize Module Button */}
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(true)}
              className="w-full py-1.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-[#023246] text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Atur Modul Administrasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SUMMARY STATS BAR ── */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Aktif untuk <strong>Tahun Ajaran {academicYear}</strong> (Semester {semester === 'GANJIL' ? '1 / Ganjil' : '2 / Genap'})
          </span>
        </div>
        <span className="font-semibold text-slate-400">
          {enabledModules.length} dari {modules.length} modul aktif
        </span>
      </div>

      {/* ── CATEGORIZED MODULE GRIDS ── */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catModules = enabledModules.filter((m) => m.category === cat.id);
          if (catModules.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-2.5">
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {catModules.length} Layanan
                </span>
              </div>

              {/* Module Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {catModules.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.actionId === 'custom_link' && item.customUrl) {
                        window.open(item.customUrl, '_blank', 'noopener,noreferrer');
                        return;
                      }
                      onOpenModule(item.actionId, item, academicYear);
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50/90 active:scale-[0.98] border border-slate-200/90 hover:border-[#023246]/40 shadow-xs hover:shadow-md transition-all flex items-start justify-between gap-3 text-left cursor-pointer group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Icon */}
                      <div
                        className={`w-11 h-11 rounded-2xl bg-linear-to-b ${item.colorClass} text-white flex items-center justify-center text-xl shrink-0 shadow-xs group-hover:scale-105 transition-transform`}
                      >
                        {item.icon}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-[#023246] transition-colors truncate">
                            {item.title}
                          </h4>
                          {item.badge && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-md">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Arrow / External indicator */}
                    <div className="text-slate-400 group-hover:text-[#023246] group-hover:translate-x-0.5 transition-all shrink-0 self-center">
                      {item.actionId === 'custom_link' && item.customUrl ? (
                        <ExternalLink className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Kustomisasi Modul */}
      <CustomizeAdministrationModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        userId={userId}
        academicYear={academicYear}
        modules={modules}
        onModulesUpdated={(updated) => setModules(updated)}
      />
    </div>
  );
};
