import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  StudentBehaviorRecord,
  StudentBehaviorLog,
  GradeMasterBehaviorCategory,
} from '../../../types/database.types';
import {
  StudentBehaviorRepository,
  BEHAVIORS_UPDATED_EVENT,
  GRADEMASTER_KEBAIKAN_PRESETS,
  GRADEMASTER_PELANGGARAN_PRESETS,
} from '../../../repositories/StudentBehaviorRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  Sparkles,
  AlertTriangle,
  History,
  Search,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  RotateCcw,
  Star,
  Award,
  Calendar,
  Undo2,
  ArrowLeft,
  GraduationCap,
} from 'lucide-react';
import {
  toJakartaIsoString,
  formatJakartaDateTime,
  getTodayDateInJakarta,
} from '../../../utils/time.utils';

export type BehaviorViewTab = 'KEBAIKAN' | 'KEDISIPLINAN' | 'RIWAYAT';

export interface StudentBehaviorViewProps {
  onBack?: () => void;
  backLabel?: string;
  initialTab?: BehaviorViewTab;
  currentTeacherName?: string;
  className?: string;
}

const getLocalDateTimeForInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const StudentBehaviorView: React.FC<StudentBehaviorViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Beranda',
  initialTab = 'KEBAIKAN',
  currentTeacherName = 'Guru',
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<BehaviorViewTab>(initialTab);
  const [academicYear, setAcademicYear] = useState<string>('2026/2027');
  const [violationDate, setViolationDate] = useState<string>(getLocalDateTimeForInput());
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'GOOD' | 'BAD'>('ALL');

  const [students, setStudents] = useState<StudentBehaviorRecord[]>([]);
  const [categories, setCategories] = useState<{
    kebaikan: GradeMasterBehaviorCategory[];
    pelanggaran: GradeMasterBehaviorCategory[];
  }>({
    kebaikan: GRADEMASTER_KEBAIKAN_PRESETS,
    pelanggaran: GRADEMASTER_PELANGGARAN_PRESETS,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentBehaviorRecord | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [pointsAmount, setPointsAmount] = useState<number>(5);
  const [customPointsInput, setCustomPointsInput] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<'SYNCED' | 'PENDING_SYNC' | 'FAILED_SYNC' | 'LOCAL_DRAFT' | null>(null);

  // Void/Pembatalan State
  const [voidTargetLog, setVoidTargetLog] = useState<{ id: string; studentName: string; reason: string; points: number } | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  const isCloud = useMemo(() => {
    try {
      const p = ProviderFactory.getProvider();
      return p.constructor.name === 'SupabaseProvider' || Boolean((p as any).isSupabase);
    } catch {
      return false;
    }
  }, []);

  // Load official GradeMaster OS categories
  const loadCategories = useCallback(async () => {
    try {
      const cats = await StudentBehaviorRepository.getCategories();
      if (cats?.kebaikan && cats?.pelanggaran) {
        setCategories(cats);
      }
    } catch (err) {
      console.warn('Gagal memuat kategori resmi GradeMaster OS:', err);
    }
  }, []);

  // Load student behaviors based on academicYear
  const loadBehaviors = useCallback(async (targetYear = academicYear) => {
    setIsLoading(true);
    try {
      const data = await StudentBehaviorRepository.getBehaviors('ALL', targetYear);
      setStudents(data || []);
      setSelectedStudent((prev) => {
        if (!prev) return null;
        const targetId = prev.student_id || prev.id;
        const found = (data || []).find((s) => (s.student_id || s.id) === targetId);
        return found || prev;
      });
    } catch (err) {
      console.warn('Gagal memuat data perilaku siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    loadBehaviors(academicYear);
    loadCategories();
    setActiveTab(initialTab);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSelectedStudent(null);
    setSelectedReason('');
    setCustomReason('');
    setPointsAmount(5);
    setCustomPointsInput('');
    setViolationDate(getLocalDateTimeForInput());
    setLastSyncStatus(null);
    setVoidTargetLog(null);
    setVoidReasonText('');
  }, [initialTab, academicYear, loadBehaviors, loadCategories]);

  useEffect(() => {
    const handleUpdated = () => {
      loadBehaviors(academicYear);
    };

    window.addEventListener(BEHAVIORS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      window.removeEventListener(BEHAVIORS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [academicYear, loadBehaviors]);

  // Handle Tab Switch
  const handleTabChange = (tab: BehaviorViewTab) => {
    setActiveTab(tab);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSelectedReason('');
    setCustomReason('');
    setPointsAmount(5);
    setCustomPointsInput('');
  };

  // Derive unique classes
  const classOptions = useMemo(() => {
    const classes = Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))).sort();
    return ['ALL', ...classes];
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'ALL' || s.class_name === selectedClass;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.student_name.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, selectedClass, searchQuery]);

  // All behavior logs across students for History Tab
  const allLogs = useMemo(() => {
    const logs: Array<StudentBehaviorLog & { student_name: string; class_name: string; academic_year: string }> = [];
    students.forEach((s) => {
      if (Array.isArray(s.behavior_logs)) {
        s.behavior_logs.forEach((log) => {
          logs.push({
            ...log,
            id: log.id,
            student_id: s.student_id || s.id,
            student_name: s.student_name,
            class_name: s.class_name,
            academic_year: s.academic_year || academicYear,
          });
        });
      }
    });

    const sorted = logs.sort(
      (a, b) =>
        new Date(b.occurred_at || b.violation_date || b.timestamp || 0).getTime() -
        new Date(a.occurred_at || a.violation_date || a.timestamp || 0).getTime()
    );

    if (historyFilter === 'GOOD') {
      return sorted.filter((l) => l.type === 'GOOD');
    }
    if (historyFilter === 'BAD') {
      return sorted.filter((l) => l.type === 'BAD');
    }
    return sorted;
  }, [students, academicYear, historyFilter]);

  // Submit Behavior Point
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setErrorMessage('Pilih siswa terlebih dahulu.');
      return;
    }

    const finalReason = selectedReason === 'CUSTOM' ? customReason.trim() : selectedReason.trim();
    if (!finalReason) {
      setErrorMessage('Tentukan alasan pemberian poin atau ketik alasan kustom.');
      return;
    }

    let finalPoints = Math.abs(pointsAmount);
    if (customPointsInput.trim() !== '') {
      const parsed = parseInt(customPointsInput, 10);
      if (!isNaN(parsed) && parsed > 0) {
        finalPoints = parsed;
      }
    }

    if (finalPoints === 0) {
      setErrorMessage('Jumlah bobot poin tidak boleh 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isoViolationDate = toJakartaIsoString(violationDate);
    const idempotencyKey = 'beh_req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const authUser = useAuthStore.getState().user;

    try {
      const result = await StudentBehaviorRepository.recordBehavior({
        studentId: selectedStudent.student_id || selectedStudent.id,
        studentName: selectedStudent.student_name,
        className: selectedStudent.class_name,
        type: activeTab === 'KEBAIKAN' ? 'GOOD' : 'BAD',
        points: finalPoints,
        reason: finalReason,
        teacherName: currentTeacherName,
        recordedByUserId: authUser?.id,
        academicYear: selectedStudent.academic_year || academicYear,
        violationDate: isoViolationDate,
        timezone: 'Asia/Jakarta',
        idempotencyKey,
      });

      setLastSyncStatus(result.syncStatus || (result.success ? 'SYNCED' : 'FAILED_SYNC'));

      if (result.success) {
        // Award +5 Engagement Points for Teacher Daily Quest ONLY IF not claimed today
        const currentToken = useAuthStore.getState().token;
        const todayStr = getTodayDateInJakarta();
        const isKebaikan = activeTab === 'KEBAIKAN';
        const questStorageKey = isKebaikan
          ? `smart_absensi_quest_merit_${authUser?.id}_${todayStr}`
          : `smart_absensi_quest_demerit_${authUser?.id}_${todayStr}`;
        const alreadyClaimed = typeof localStorage !== 'undefined' && localStorage.getItem(questStorageKey) === '1';

        let teacherAwardMsg = '';
        if (authUser?.id && !alreadyClaimed) {
          try {
            const prov = ProviderFactory.getProvider();
            await prov.recordTeacherPoint(
              {
                user_id: authUser.id,
                teacher_name: currentTeacherName,
                date: todayStr,
                points: 5,
                activity_type: isKebaikan ? 'STUDENT_MERIT' : 'STUDENT_DEMERIT',
                title: isKebaikan ? 'Misi Apresiasi: Poin Kebaikan Siswa' : 'Misi Pembinaan: Karakter Siswa',
                description: isKebaikan
                  ? `Mencatat apresiasi kebaikan siswa (${selectedStudent.student_name}) (+5 Poin)`
                  : `Mencatat kedisiplinan & evaluasi karakter siswa (${selectedStudent.student_name}) (+5 Poin)`,
              },
              currentToken || undefined
            );
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(questStorageKey, '1');
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('smart_absensi_points_updated'));
            }
            teacherAwardMsg = ' (Anda meraih +5 Poin Pendidik ✨)';
          } catch (ptErr) {
            console.warn('Student behavior teacher point award note:', ptErr);
          }
        }

        const syncNotice = result.syncStatus === 'SYNCED'
          ? 'Tersinkron ke GradeMaster OS'
          : 'Tersimpan lokal (offline)';

        if (activeTab === 'KEBAIKAN') {
          setSuccessMessage(
            `Sukses! +${finalPoints} Poin Kebaikan dicatat untuk ${selectedStudent.student_name}.${teacherAwardMsg} [${syncNotice}]`
          );
        } else {
          setSuccessMessage(
            `Sukses! Catatan pelanggaran (-${finalPoints} Pts) dicatat untuk ${selectedStudent.student_name}.${teacherAwardMsg} [${syncNotice}]`
          );
        }

        // Voice notification feedback
        try {
          if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(
              `Poin ${activeTab === 'KEBAIKAN' ? 'kebaikan' : 'kedisiplinan'} berhasil dicatat untuk ${selectedStudent.student_name}`
            );
            speech.lang = 'id-ID';
            speech.rate = 1.05;
            window.speechSynthesis.speak(speech);
          }
        } catch {
          // ignore
        }

        // Update selected student point balance in local view
        setSelectedStudent((prev) => {
          if (!prev) return null;
          const newMerits = activeTab === 'KEBAIKAN' ? (prev.merits_points || 0) + finalPoints : (prev.merits_points || 0);
          const newDemerits = activeTab === 'KEDISIPLINAN' ? (prev.demerits_points || 0) + finalPoints : (prev.demerits_points || 0);
          return {
            ...prev,
            total_points: newMerits - newDemerits,
            merits_points: newMerits,
            demerits_points: newDemerits,
            net_points: newMerits - newDemerits,
          };
        });

        // Reset inputs
        setSelectedReason('');
        setCustomReason('');
        setCustomPointsInput('');
        await loadBehaviors(academicYear);
      } else {
        setErrorMessage(result.message || 'Gagal menyimpan poin siswa.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Void/Pembatalan Log Handler
  const handleConfirmVoid = async () => {
    if (!voidTargetLog) return;
    if (!voidReasonText || voidReasonText.trim().length < 3) {
      setErrorMessage('Alasan pembatalan minimal 3 karakter.');
      return;
    }
    setIsVoiding(true);
    setErrorMessage(null);
    try {
      const result = await StudentBehaviorRepository.voidBehavior(
        voidTargetLog.id,
        voidReasonText.trim(),
        academicYear
      );
      if (result.success) {
        setSuccessMessage('Catatan berhasil dibatalkan dan saldo poin siswa telah direkalkulasi.');
        setVoidTargetLog(null);
        setVoidReasonText('');
        await loadBehaviors(academicYear);
      } else {
        setErrorMessage(result.message || 'Gagal membatalkan catatan.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal membatalkan catatan.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <section className={`space-y-3.5 pb-16 animate-fadeIn max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto ${className}`}>
      {/* ── TOP BAR NAVIGATION ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer min-h-10"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#023246]" />
            <span>{backLabel}</span>
          </button>
        ) : (
          <div />
        )}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider">
          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
          <span>Poin Karakter Siswa</span>
        </div>
      </div>

      {/* ── HERO BANNER CARD ──────────────────────────────────────────────── */}
      <div className="bg-linear-to-r from-[#023246] via-[#03425c] to-[#0D7A5F] text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-md border border-[#023246]/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0 ${
              activeTab === 'KEBAIKAN'
                ? 'bg-emerald-600 ring-2 ring-emerald-300/40'
                : activeTab === 'KEDISIPLINAN'
                ? 'bg-rose-600 ring-2 ring-rose-300/40'
                : 'bg-cyan-700 ring-2 ring-cyan-300/40'
            }`}
          >
            {activeTab === 'KEBAIKAN' ? (
              <Sparkles className="w-6 h-6 text-amber-300" />
            ) : activeTab === 'KEDISIPLINAN' ? (
              <AlertTriangle className="w-6 h-6 text-amber-200" />
            ) : (
              <History className="w-6 h-6 text-cyan-200" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight truncate">
              {activeTab === 'KEBAIKAN'
                ? 'Poin Kebaikan Siswa'
                : activeTab === 'KEDISIPLINAN'
                ? 'Poin Kedisiplinan Siswa'
                : 'Riwayat Log Poin Siswa'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className={`w-2 h-2 rounded-full ${
                  isCloud ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              ></span>
              <p className="text-[11px] sm:text-xs text-cyan-200/90 font-medium">
                {isCloud
                  ? 'Sinkron Relasional GradeMaster OS & Supabase Cloud'
                  : 'Mode Offline / Lokal (Belum Tersinkron ke Cloud)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB SWITCHER (SEGMENTED CONTROL) ─────────────────────────────── */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleTabChange('KEBAIKAN')}
            className={`py-2.5 px-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11 ${
              activeTab === 'KEBAIKAN'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Kebaikan</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('KEDISIPLINAN')}
            className={`py-2.5 px-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11 ${
              activeTab === 'KEDISIPLINAN'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-200" />
            <span>Kedisiplinan</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('RIWAYAT')}
            className={`py-2.5 px-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11 ${
              activeTab === 'RIWAYAT'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#023246] hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat</span>
          </button>
        </div>
      </div>

      {/* ── NOTIFICATION ALERTS ──────────────────────────────────────────── */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="leading-relaxed">{successMessage}</p>
            {lastSyncStatus === 'SYNCED' ? (
              <a
                href="https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 font-bold underline mt-1 text-[11px] hover:text-emerald-900"
              >
                Lihat pembaruan di GradeMaster OS <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-[11px] text-amber-800 font-medium mt-1">
                Catatan tersimpan di memori lokal (offline).
              </p>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-fadeIn shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* ── TAB 1 & 2: FORM PEMBERIAN POIN ──────────────────────────────── */}
      {activeTab !== 'RIWAYAT' && (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. PENGATURAN PERIODE & WAKTU KEJADIAN */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#023246]" />
                1. Periode &amp; Waktu Kejadian
              </label>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                GradeMaster OS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tahun Ajaran */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={academicYear}
                  onChange={(e) => {
                    const yr = e.target.value;
                    setAcademicYear(yr);
                    setSelectedStudent(null);
                    loadBehaviors(yr);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#023246]/20 cursor-pointer min-h-10"
                >
                  <option value="2026/2027">Tahun Ajaran 2026/2027</option>
                  <option value="2025/2026">Tahun Ajaran 2025/2026</option>
                </select>
              </div>

              {/* Tanggal & Waktu Kejadian */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Tanggal &amp; Waktu Kejadian
                </label>
                <input
                  type="datetime-local"
                  value={violationDate}
                  onChange={(e) => setViolationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#023246]/20 cursor-pointer min-h-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. SELEKSI SISWA TARGET */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#023246]" />
                2. Pilih Siswa Target
              </label>
              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ganti Siswa
                </button>
              )}
            </div>

            {/* Selected Student Active Card */}
            {selectedStudent ? (
              <div className="bg-slate-50 rounded-2xl p-3.5 border-2 border-[#023246]/20 space-y-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#023246] text-white rounded-md">
                      Kelas {selectedStudent.class_name}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                      {selectedStudent.student_name}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Tahun Ajaran: {selectedStudent.academic_year || academicYear}
                  </p>
                </div>

                {/* Saldo Poin Terpisah */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/80">
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      activeTab === 'KEBAIKAN'
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-[9px] font-bold text-emerald-800 uppercase block">
                      🟢 Poin Kebaikan
                    </span>
                    <span className="text-sm font-black text-emerald-700 block mt-0.5">
                      +{selectedStudent.merits_points ?? 0} Poin
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      activeTab === 'KEDISIPLINAN'
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-[9px] font-bold text-rose-800 uppercase block">
                      🔴 Catatan Pelanggaran
                    </span>
                    <span className="text-sm font-black text-rose-700 block mt-0.5">
                      {selectedStudent.demerits_points ?? 0} Pts
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Class Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {classOptions.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer min-h-9 ${
                        selectedClass === cls
                          ? 'bg-[#023246] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {cls === 'ALL' ? 'Semua Kelas' : `Kelas ${cls}`}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa atau NISN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                  />
                </div>

                {/* Student List Picker */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 bg-slate-50 rounded-2xl border border-slate-200 p-2">
                  {isLoading ? (
                    <div className="p-6 text-center text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#023246] border-t-transparent rounded-full animate-spin" />
                      <span>Memuat daftar siswa dari database...</span>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Tidak ditemukan siswa pada filter ini.
                    </div>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s);
                          setSuccessMessage(null);
                        }}
                        className="w-full p-2.5 bg-white hover:bg-emerald-50 active:scale-[0.99] border border-slate-200/80 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer group shadow-2xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 group-hover:text-[#023246] truncate">
                            {s.student_name}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Kelas {s.class_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            🟢 +{s.merits_points ?? 0}
                          </span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            🔴 {s.demerits_points ?? 0}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. PILIHAN KATEGORI ALASAN */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#023246]" />
                {activeTab === 'KEBAIKAN'
                  ? '3. Pilihan Kebaikan & Apresiasi'
                  : '3. Pilihan Pelanggaran Standar'}
              </label>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Otomatis Berbobot
              </span>
            </div>

            {/* Preset Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(activeTab === 'KEBAIKAN' ? categories.kebaikan : categories.pelanggaran).map((p) => {
                const isSelected = selectedReason === p.text;
                return (
                  <button
                    key={p.text}
                    type="button"
                    onClick={() => {
                      setSelectedReason(p.text);
                      setPointsAmount(p.weight);
                      setCustomPointsInput('');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer min-h-12 ${
                      isSelected
                        ? activeTab === 'KEBAIKAN'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-2xs'
                          : 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="text-base shrink-0">{p.icon || (p.isGood ? '✨' : '⚠️')}</span>
                      <span className="text-xs font-bold text-slate-800 leading-snug">
                        {p.text}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                        p.isGood
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      +{p.weight} Pts
                    </span>
                  </button>
                );
              })}

              {/* Custom Reason Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedReason('CUSTOM');
                  if (!pointsAmount || pointsAmount === 0) {
                    setPointsAmount(5);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer min-h-12 col-span-1 sm:col-span-2 ${
                  selectedReason === 'CUSTOM'
                    ? 'bg-cyan-50 border-cyan-600 ring-2 ring-cyan-600/20 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">✍️</span>
                  <span className="text-xs font-bold text-slate-800">
                    {activeTab === 'KEBAIKAN'
                      ? 'Tulis Kebaikan Khusus (Manual)'
                      : 'Tulis Pelanggaran Khusus (Manual)'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200/80 px-2 py-0.5 rounded-md">
                  Khusus
                </span>
              </button>
            </div>

            {/* Custom Reason Text Input */}
            {selectedReason === 'CUSTOM' && (
              <div className="space-y-1.5 pt-1 animate-fadeIn">
                <input
                  type="text"
                  placeholder={
                    activeTab === 'KEBAIKAN'
                      ? 'Tulis rincian kebaikan khusus siswa...'
                      : 'Tulis rincian pelanggaran khusus siswa...'
                  }
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
                  required
                />
              </div>
            )}
          </div>

          {/* 4. PENYESUAIAN JUMLAH BOBOT POIN */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-[#023246]" />
                  4. Nilai Bobot Poin
                </label>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {selectedReason && selectedReason !== 'CUSTOM'
                    ? 'Terkunci otomatis sesuai standar GradeMaster OS'
                    : 'Poin kebaikan & kedisiplinan tersimpan terpisah'}
                </span>
              </div>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-2xs ${
                  activeTab === 'KEBAIKAN'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                +{pointsAmount} Pts
              </span>
            </div>

            {/* Tombol Cepat Sesuai Bobot Standar */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {(activeTab === 'KEBAIKAN' ? [5, 10, 15, 20, 25] : [5, 10, 15, 25, 30]).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setPointsAmount(num);
                    setCustomPointsInput('');
                  }}
                  className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer min-h-10 ${
                    pointsAmount === num && customPointsInput === ''
                      ? activeTab === 'KEBAIKAN'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>

            {/* Custom Point Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-600 shrink-0">
                Bobot Lain:
              </span>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Ketik angka poin..."
                value={customPointsInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomPointsInput(val);
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setPointsAmount(parsed);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedStudent}
            className={`w-full h-12 rounded-2xl text-xs sm:text-sm font-extrabold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
              isSubmitting || !selectedStudent
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer active:scale-[0.98]'
            } ${
              activeTab === 'KEBAIKAN'
                ? 'bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-700/20'
                : 'bg-linear-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 shadow-rose-700/20'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Menyimpan ke GradeMaster OS...</span>
              </div>
            ) : (
              <>
                {activeTab === 'KEBAIKAN' ? (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                )}
                <span>
                  {activeTab === 'KEBAIKAN'
                    ? `+ Catat Poin Kebaikan (+${pointsAmount} Poin)`
                    : `+ Catat Pelanggaran (+${pointsAmount} Pts)`}
                </span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ── TAB 3: RIWAYAT LOG POIN ───────────────────────────────────────── */}
      {activeTab === 'RIWAYAT' && (
        <div className="space-y-3">
          {/* Header Riwayat & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-extrabold text-slate-800">
              Total {allLogs.length} Catatan Log ({academicYear})
            </span>

            {/* Filter Log Type */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  historyFilter === 'ALL'
                    ? 'bg-[#023246] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('GOOD')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  historyFilter === 'GOOD'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                🟢 Kebaikan
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('BAD')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  historyFilter === 'BAD'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                🔴 Pelanggaran
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
              <div className="w-4 h-4 border-2 border-[#023246] border-t-transparent rounded-full animate-spin" />
              <span>Memuat riwayat log poin siswa dari database...</span>
            </div>
          ) : allLogs.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <p className="text-xs font-bold text-slate-700">Belum ada riwayat poin siswa pada filter ini.</p>
              <p className="text-[11px] text-slate-400">
                Poin kebaikan atau kedisiplinan yang diberikan akan tercatat otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allLogs.map((log, idx) => {
                const isGood = log.type === 'GOOD';
                const targetDate = log.occurred_at || log.violation_date || log.timestamp;
                const dateFormatted = formatJakartaDateTime(targetDate);
                const isVoided = Boolean(log.voided_at);

                return (
                  <div
                    key={log.id || `${log.student_name}-${log.timestamp}-${idx}`}
                    className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-colors shadow-2xs ${
                      isVoided
                        ? 'bg-slate-100/70 border-slate-200 opacity-60'
                        : 'bg-white hover:bg-slate-50 border-slate-200/90'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black rounded-md ${
                            isVoided
                              ? 'bg-slate-200 text-slate-600'
                              : isGood
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isVoided ? 'DIBATALKAN' : isGood ? 'KEBAIKAN' : 'PELANGGARAN'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Kelas {log.class_name}
                        </span>
                        <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                          {log.academic_year}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1 truncate">
                        {log.student_name}
                      </h4>
                      <p className={`text-xs font-medium mt-1 leading-snug ${isVoided ? 'line-through text-slate-500' : 'text-slate-700'}`}>
                        {log.reason}
                      </p>
                      {isVoided && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          Alasan dibatalkan: {log.void_reason || 'Dibatalkan oleh staf'}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium flex-wrap">
                        <span>Waktu: {dateFormatted}</span>
                        {log.recordedBy && <span>• Oleh: {log.recordedBy}</span>}
                        {!isVoided && log.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setVoidTargetLog({
                                id: log.id!,
                                studentName: log.student_name,
                                reason: log.reason,
                                points: log.points,
                              })
                            }
                            className="text-rose-600 hover:text-rose-800 font-bold ml-auto flex items-center gap-1 cursor-pointer hover:underline"
                          >
                            <Undo2 className="w-3 h-3" />
                            Batalkan Catatan
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl block ${
                          isVoided
                            ? 'line-through text-slate-400 bg-slate-200/50 border border-slate-300'
                            : isGood
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-500/10 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {isVoided
                          ? '0 Pts'
                          : isGood
                          ? `+${Math.abs(log.points)} Pts`
                          : `-${Math.abs(log.points)} Pts`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL KONFIRMASI PEMBATALAN (VOID) ────────────────────────────── */}
      {voidTargetLog && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4 text-rose-600" />
                Batalkan Catatan Poin
              </h3>
              <button
                type="button"
                onClick={() => {
                  setVoidTargetLog(null);
                  setVoidReasonText('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Anda akan membatalkan catatan untuk <strong>{voidTargetLog.studentName}</strong> ({voidTargetLog.reason}, {voidTargetLog.points} poin). Saldo poin siswa akan otomatis direkalkulasi.
            </p>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">
                Alasan Pembatalan (Wajib Audit):
              </label>
              <input
                type="text"
                placeholder="Contoh: Salah pilih nama siswa / kekeliruan guru"
                value={voidReasonText}
                onChange={(e) => setVoidReasonText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#023246]/20"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setVoidTargetLog(null);
                  setVoidReasonText('');
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isVoiding || voidReasonText.trim().length < 3}
                onClick={handleConfirmVoid}
                className={`px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs ${
                  isVoiding || voidReasonText.trim().length < 3
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                {isVoiding ? 'Memproses...' : 'Konfirmasi Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM RETURN BUTTON (THUMB REACH) ────────────────────────────── */}
      {onBack && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onBack}
            className="w-full max-w-sm mx-auto h-11 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 text-xs font-extrabold text-[#023246] shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
        </div>
      )}
    </section>
  );
};
