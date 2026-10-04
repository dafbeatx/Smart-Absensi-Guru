import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  StudentItem,
  UserProfile,
} from '../../../types/database.types';
import {
  SemesterGradingExcelService,
  type GradingTargetColumn,
} from '../../../services/semester-grading-excel.service';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { resolveSessionAcademicYear } from '../../../utils/academic-year.utils';
import { OFFICIAL_STUDENTS_2026_2027 } from '../../../data/official-students-2026-2027';

export interface DownloadOfficialGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession?: ExamSessionRecord | null;
  gradedStudents?: GradedStudentScoreRecord[];
  availableSessions?: ExamSessionRecord[];
  currentUser?: UserProfile | null;
  defaultAcademicYear?: string;
  defaultSemester?: string;
  onSuccess?: (msg: string) => void;
}

export const DownloadOfficialGradingModal: React.FC<DownloadOfficialGradingModalProps> = ({
  isOpen,
  onClose,
  activeSession = null,
  gradedStudents = [],
  availableSessions = [],
  currentUser = null,
  defaultAcademicYear = '2026/2027',
  defaultSemester = 'Ganjil',
  onSuccess,
}) => {
  // Mode: 'SESSION' (isi nilai dari sesi) | 'BLANK' (blanko murni sekolah)
  const [mode, setMode] = useState<'SESSION' | 'BLANK'>(() => (activeSession || availableSessions.length > 0 ? 'SESSION' : 'BLANK'));
  
  // Sesi yang dipilih
  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeSession?.id || (availableSessions[0]?.id ?? ''));

  // Target kolom nilai di Excel
  const [targetColumn, setTargetColumn] = useState<GradingTargetColumn>('ASTS');

  // Sertakan Sheet 1 REKAP NILAI
  const [includeRecapSheet, setIncludeRecapSheet] = useState(true);

  // Parameter umum
  const [kkm, setKkm] = useState<number>(75);
  const [showMissingStudents, setShowMissingStudents] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data siswa & nilai yang dimuat dinamis
  const [sessionGradedStudents, setSessionGradedStudents] = useState<GradedStudentScoreRecord[]>(gradedStudents);
  const [classRoster, setClassRoster] = useState<StudentItem[]>([]);
  const [isLoadingSessionData, setIsLoadingSessionData] = useState(false);

  // Tentukan sesi yang sedang aktif di dialog
  const currentSession = useMemo(() => {
    if (activeSession && activeSession.id === selectedSessionId) {
      return activeSession;
    }
    return availableSessions.find((s) => s.id === selectedSessionId) || activeSession || null;
  }, [activeSession, availableSessions, selectedSessionId]);

  // Inisialisasi awal saat modal dibuka atau activeSession berubah
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (activeSession) {
        setSelectedSessionId(activeSession.id);
        setMode('SESSION');
        setKkm(Number(activeSession.kkm) || 75);
        // Tebak target kolom dari tipe ujian secara cerdas
        const isAsas = /ASAS|PAS|UAS|AKHIR/i.test(activeSession.exam_type || '');
        setTargetColumn(isAsas ? 'ASAS' : 'ASTS');
      } else if (availableSessions.length > 0) {
        setSelectedSessionId(availableSessions[0].id);
        setMode('SESSION');
        setKkm(Number(availableSessions[0].kkm) || 75);
        const isAsas = /ASAS|PAS|UAS|AKHIR/i.test(availableSessions[0].exam_type || '');
        setTargetColumn(isAsas ? 'ASAS' : 'ASTS');
      } else {
        setMode('BLANK');
      }
    }
  }, [isOpen, activeSession, availableSessions]);

  // Sinkronisasi data nilai & roster saat currentSession berubah
  useEffect(() => {
    if (!isOpen || mode !== 'SESSION' || !currentSession) return;

    let isMounted = true;

    const loadData = async () => {
      setIsLoadingSessionData(true);
      try {
        // 1. Dapatkan graded students
        let grades: GradedStudentScoreRecord[] = [];
        if (activeSession && activeSession.id === currentSession.id && gradedStudents.length > 0) {
          grades = gradedStudents;
        } else {
          grades = await ExamCorrectionRepository.getGradedStudents(currentSession.id);
        }

        // 2. Dapatkan roster siswa untuk kelas sesi
        let roster: StudentItem[] = [];
        try {
          roster = await StudentRepository.getStudentsByClass(currentSession.class_name);
        } catch {
          // Fallback ke master data 2026/2027
          const normCls = SemesterGradingExcelService.normalizeSheetClassName(currentSession.class_name);
          roster = OFFICIAL_STUDENTS_2026_2027.filter((st) => {
            const stCls = SemesterGradingExcelService.normalizeSheetClassName(st.className);
            return stCls === normCls;
          });
        }

        if (isMounted) {
          setSessionGradedStudents(grades);
          setClassRoster(roster);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage('Gagal memuat detail nilai sesi: ' + (err?.message || 'Error'));
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessionData(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, currentSession, activeSession, gradedStudents]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDownloading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDownloading, onClose]);

  // Perhitungan statistik & validasi
  const validationSummary = useMemo(() => {
    const totalRoster = classRoster.length > 0 
      ? classRoster.length 
      : (currentSession?.student_list?.length || sessionGradedStudents.length || 0);

    const gradedCount = sessionGradedStudents.length;
    const ungradedCount = Math.max(0, totalRoster - gradedCount);

    const gradedNames = new Set(sessionGradedStudents.map((s) => s.name.trim().toUpperCase()));
    const missingStudents = classRoster.filter((st) => !gradedNames.has(st.fullName.trim().toUpperCase()));

    const scores = sessionGradedStudents.map((s) => Number(s.final_score) || 0);
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passedCount = scores.filter((s) => s >= kkm).length;

    return {
      totalRoster,
      gradedCount,
      ungradedCount,
      missingStudents,
      avgScore,
      maxScore,
      minScore,
      passedCount,
    };
  }, [classRoster, currentSession?.student_list, sessionGradedStudents, kkm]);

  // Tangani unduh Excel
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setErrorMessage(null);

    try {
      if (mode === 'BLANK' || targetColumn === 'NONE') {
        // Mode unduh template resmi blanko
        await SemesterGradingExcelService.exportOfficialFormatExcel({
          subject: currentSession?.subject || (currentUser?.full_name ? `${currentUser?.full_name} (Mapel)` : 'Mata Pelajaran'),
          teacher: currentSession?.teacher || currentUser?.full_name || 'Guru Pengampu',
          academicYear: currentSession ? resolveSessionAcademicYear(currentSession.academic_year, currentSession.session_name, currentSession.created_at, defaultAcademicYear) : defaultAcademicYear,
          semester: currentSession?.semester || defaultSemester,
          kkm,
          className: currentSession?.class_name || '8A',
          session: currentSession || undefined,
          gradedStudents: [],
          targetColumn: 'NONE',
          includeRecapSheet: false,
        });

        onSuccess?.('Format Penilaian blanko resmi (.xlsx) berhasil diunduh!');
        onClose();
      } else {
        // Mode dengan nilai sesi
        if (!currentSession) {
          throw new Error('Pilih sesi ujian terlebih dahulu.');
        }

        const resolvedYear = resolveSessionAcademicYear(
          currentSession.academic_year,
          currentSession.session_name,
          currentSession.created_at,
          defaultAcademicYear
        );

        await SemesterGradingExcelService.exportOfficialFormatExcel({
          session: currentSession,
          gradedStudents: sessionGradedStudents,
          subject: currentSession.subject,
          teacher: currentSession.teacher,
          kkm,
          academicYear: resolvedYear,
          semester: currentSession.semester || defaultSemester,
          className: currentSession.class_name,
          targetColumn,
          includeRecapSheet,
        });

        const targetLabel = targetColumn === 'ASTS' 
          ? 'Kolom ASTS (Tengah Semester)' 
          : targetColumn === 'ASAS' 
            ? 'Kolom ASAS (Akhir Semester)' 
            : 'Kedua Kolom (ASTS & ASAS)';

        onSuccess?.(`Format Penilaian ASTS & ASAS berhasil diunduh dengan alokasi nilai ke ${targetLabel}!`);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses dan mengunduh berkas Format Penilaian.');
    } finally {
      setIsDownloading(false);
    }
  }, [mode, targetColumn, currentSession, currentUser, defaultAcademicYear, defaultSemester, kkm, sessionGradedStudents, includeRecapSheet, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-format-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-auto overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="download-format-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Unduh Format Penilaian
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Pilih dan validasi alokasi nilai ke berkas resmi Excel ASTS & ASAS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center -mr-1"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Selector (Jika dibuka di luar sesi aktif dan ada sesi yang tersedia) */}
          {!activeSession && availableSessions.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('SESSION')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-11 cursor-pointer ${
                  mode === 'SESSION'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Dari Sesi Ujian</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('BLANK');
                  setTargetColumn('NONE');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-11 cursor-pointer ${
                  mode === 'BLANK'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Blanko Kosong Sekolah</span>
              </button>
            </div>
          )}

          {/* Section 1: Pemilihan Sesi Ujian */}
          {mode === 'SESSION' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Sesi Ujian Target
              </label>

              {activeSession ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 font-bold text-[11px] rounded-md">
                        Kelas {activeSession.class_name}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-medium text-[11px] rounded-md">
                        {activeSession.subject}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        TA {resolveSessionAcademicYear(activeSession.academic_year, activeSession.session_name, activeSession.created_at, defaultAcademicYear)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-1.5">
                      {activeSession.session_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Pengampu: {activeSession.teacher || 'Guru'} • KKM: {kkm}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    disabled={availableSessions.length === 0}
                    className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-3 py-2.5 pr-8 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                  >
                    {availableSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Kelas {s.class_name} — {s.session_name} ({s.subject})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* Section 2: Pertanyaan Inti — Alokasi Kolom Nilai */}
          {mode === 'SESSION' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 block">
                  Nilai Mana yang Akan Dimasukkan ke Excel?
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Template Resmi ASTS & ASAS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Opsi 1: ASTS */}
                <button
                  type="button"
                  onClick={() => setTargetColumn('ASTS')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                    targetColumn === 'ASTS'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        targetColumn === 'ASTS' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}>
                        {targetColumn === 'ASTS' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">Kolom ASTS</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Tengah Semester
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Nilai dialokasikan ke <strong>Kolom ASTS</strong> (UTS/PTS). Kolom ASAS dibiarkan kosong.
                  </p>
                </button>

                {/* Opsi 2: ASAS */}
                <button
                  type="button"
                  onClick={() => setTargetColumn('ASAS')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                    targetColumn === 'ASAS'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        targetColumn === 'ASAS' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}>
                        {targetColumn === 'ASAS' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">Kolom ASAS</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                      Akhir Semester
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Nilai dialokasikan ke <strong>Kolom ASAS</strong> (UAS/PAS). Kolom ASTS dibiarkan kosong.
                  </p>
                </button>

                {/* Opsi 3: Kedua Kolom (ASTS & ASAS) */}
                <button
                  type="button"
                  onClick={() => setTargetColumn('BOTH')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                    targetColumn === 'BOTH'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        targetColumn === 'BOTH' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}>
                        {targetColumn === 'BOTH' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">Kedua Kolom</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      ASTS & ASAS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Salin nilai sesi ini ke <strong>ASTS & ASAS</strong> untuk kalkulasi nilai akhir penuh (100%).
                  </p>
                </button>

                {/* Opsi 4: Blanko Kosong */}
                <button
                  type="button"
                  onClick={() => setTargetColumn('NONE')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-24 ${
                    targetColumn === 'NONE'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        targetColumn === 'NONE' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                      }`}>
                        {targetColumn === 'NONE' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold text-slate-900">Blanko Kosong</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      Tanpa Nilai
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Sertakan nama peserta didik resmi, namun <strong>kosongkan nilai</strong> untuk input manual.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Validasi Interaktif Nilai */}
          {mode === 'SESSION' && targetColumn !== 'NONE' && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Validasi Data Nilai Peserta Didik
                </span>
                {isLoadingSessionData && (
                  <span className="text-[11px] text-slate-500 animate-pulse">
                    Memeriksa data...
                  </span>
                )}
              </div>

              {/* Stat Tiles */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Siswa</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {validationSummary.totalRoster}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <p className="text-[10px] text-emerald-700 uppercase font-semibold">Sudah Dinilai</p>
                  <p className="text-base font-extrabold text-emerald-800 mt-0.5">
                    {validationSummary.gradedCount}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  validationSummary.ungradedCount > 0
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <p className="text-[10px] uppercase font-semibold">Belum Dinilai</p>
                  <p className={`text-base font-extrabold mt-0.5 ${
                    validationSummary.ungradedCount > 0 ? 'text-amber-800' : 'text-slate-600'
                  }`}>
                    {validationSummary.ungradedCount}
                  </p>
                </div>
              </div>

              {/* Validation Status Box */}
              {validationSummary.ungradedCount > 0 ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-900">
                        Perhatian: {validationSummary.ungradedCount} peserta didik belum memiliki nilai
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Siswa yang belum dinilai akan tercatat kosong pada kolom {targetColumn} di berkas Excel.
                      </p>
                    </div>
                  </div>

                  {validationSummary.missingStudents.length > 0 && (
                    <div className="pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={() => setShowMissingStudents(!showMissingStudents)}
                        className="text-[11px] font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showMissingStudents ? 'Sembunyikan nama siswa' : `Lihat daftar ${validationSummary.missingStudents.length} siswa belum dinilai`}</span>
                        {showMissingStudents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showMissingStudents && (
                        <div className="mt-2 max-h-28 overflow-y-auto bg-white/80 p-2 rounded-lg border border-amber-200 text-[11px] space-y-1">
                          {validationSummary.missingStudents.map((st, i) => (
                            <div key={st.id || i} className="flex justify-between items-center text-slate-700">
                              <span>{i + 1}. {st.fullName}</span>
                              <span className="text-[10px] text-amber-700 font-medium">Belum dinilai</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : validationSummary.gradedCount > 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-emerald-900">
                    Validasi Sempurna: Seluruh {validationSummary.gradedCount} peserta didik telah memiliki nilai yang tervalidasi.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500 shrink-0" />
                  <p className="text-xs text-slate-700">
                    Belum ada nilai yang tersimpan pada sesi ini. Berkas akan diekspor sebagai blanko nama siswa.
                  </p>
                </div>
              )}

              {/* Sample Live Preview */}
              {sessionGradedStudents.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Pratinjau Alokasi Nilai ke Excel (Contoh 3 Siswa Teratas)
                  </span>
                  <div className="space-y-1">
                    {sessionGradedStudents.slice(0, 3).map((st, i) => {
                      const score = Number(st.final_score) || 0;
                      return (
                        <div
                          key={st.id || i}
                          className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70"
                        >
                          <span className="font-medium text-slate-800 truncate max-w-50">
                            {i + 1}. {st.name}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-500">Nilai: <strong>{score}</strong></span>
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                              {targetColumn === 'ASTS' && `ASTS: ${score} | ASAS: —`}
                              {targetColumn === 'ASAS' && `ASTS: — | ASAS: ${score}`}
                              {targetColumn === 'BOTH' && `ASTS: ${score} | ASAS: ${score}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Konfigurasi Tambahan */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kriteria Ketuntasan Minimal (KKM)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={kkm}
                  onChange={(e) => setKkm(Math.min(100, Math.max(1, Number(e.target.value) || 75)))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-11"
                />
              </div>

              {mode === 'SESSION' && (
                <div className="flex items-center sm:items-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer min-h-11 select-none">
                    <input
                      type="checkbox"
                      checked={includeRecapSheet}
                      onChange={(e) => setIncludeRecapSheet(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>Sertakan Lembar REKAP NILAI (Sheet 1)</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all min-h-11 min-w-20 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all min-h-11 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span>{isDownloading ? 'Memproses Berkas...' : 'Unduh Format Penilaian (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
