import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Layers,
  ClipboardList,
  TrendingUp,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  RefreshCw,
  Edit3,
  User,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  StudentItem,
} from '../../../types/database.types';
import { getScoreLabel } from '../../../utils/scoring.utils';

export interface QuestionCorrectionMobileViewProps {
  activeTab: 'sessions' | 'grading' | 'recap' | 'grademaster_web';
  setActiveTab: (tab: 'sessions' | 'grading' | 'recap' | 'grademaster_web') => void;
  sessions: ExamSessionRecord[];
  activeSession: ExamSessionRecord | null;
  onSelectSession: (session: ExamSessionRecord) => void;
  onClose: () => void;
  viewMode: 'DESKTOP' | 'MOBILE';
  setViewMode: (mode: 'DESKTOP' | 'MOBILE') => void;

  // Search & Filters
  sessionSearchQuery: string;
  setSessionSearchQuery: (q: string) => void;
  sessionClassFilter: string;
  setSessionClassFilter: (cls: string) => void;
  availableClasses: string[];

  // Grading Data
  classStudents: StudentItem[];
  allClassStudents: { id: string; name: string }[];
  gradedStudents: GradedStudentScoreRecord[];
  selectedStudentName: string;
  selectedStudentUserId: string;
  onSelectStudent: (name: string, studentUserId?: string) => void;
  userAnswers: Record<number, string>;
  onAnswerSelect: (questionNum: number, opt: string) => void;
  essayScores: number[];
  setEssayScores: React.Dispatch<React.SetStateAction<number[]>>;
  manualScore: number | null;
  onManualScoreChange: (val: string) => void;
  onCancelManualScore: () => void;
  calculation: {
    score: number;
    essayScore: number;
    finalScore: number;
    correct: number;
    wrong: number;
    unanswered: number;
    csi: number;
    lps: number;
  } | null;
  effectiveFinalScore: number;
  availableOptions: string[];

  // Actions
  onSaveStudent: () => Promise<void>;
  onDeleteGradedStudent?: (studentId: string) => void;
  onEditStudentScoreFromRecap: (student: GradedStudentScoreRecord) => void;
  onSyncToGradeMaster: () => Promise<void>;
  isSyncingGradeMaster: boolean;
  onOpenCreateSession: () => void;
  onOpenEditSessionModal: (session: ExamSessionRecord) => void;
  onOpenKeyEditorModal: (session: ExamSessionRecord) => void;
  onOpenAiCreator: () => void;
  onOpenUniversalExcel?: () => void;
  onOpenDownloadFormat: () => void;
  onOpenBulkSync?: () => void;

  // Quick grading helpers
  onAutoPg100?: () => void;
  onResetGrading: () => void;

  isReadOnly?: boolean;
  toastMessage?: { text: string; type: 'success' | 'error' } | null;
}

export const QuestionCorrectionMobileView: React.FC<QuestionCorrectionMobileViewProps> = ({
  activeTab,
  setActiveTab,
  sessions,
  activeSession,
  onSelectSession,
  onClose,
  viewMode,
  setViewMode,
  sessionSearchQuery,
  setSessionSearchQuery,
  sessionClassFilter,
  setSessionClassFilter,
  availableClasses,
  allClassStudents,
  gradedStudents,
  selectedStudentName,
  selectedStudentUserId,
  onSelectStudent,
  userAnswers,
  onAnswerSelect,
  essayScores,
  setEssayScores,
  manualScore,
  onManualScoreChange,
  onCancelManualScore,
  calculation,
  effectiveFinalScore,
  availableOptions,
  onSaveStudent,
  onDeleteGradedStudent,
  onEditStudentScoreFromRecap,
  onSyncToGradeMaster,
  isSyncingGradeMaster,
  onOpenCreateSession,
  onOpenEditSessionModal,
  onOpenKeyEditorModal,
  onOpenAiCreator,
  onOpenUniversalExcel,
  onOpenDownloadFormat,
  onOpenBulkSync,
  onAutoPg100,
  onResetGrading,
  isReadOnly = false,
  toastMessage,
}) => {
  // Mobile Student Picker Bottom Sheet Modal State
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [recapSearch, setRecapSearch] = useState('');
  const [recapFilter, setRecapFilter] = useState<'ALL' | 'PASSED' | 'REMEDIAL'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [isManualOverrideOpen, setIsManualOverrideOpen] = useState(false);

  // Student navigator helpers
  const currentStudentIndex = useMemo(() => {
    if (!selectedStudentName) return -1;
    return allClassStudents.findIndex(
      (s) =>
        (selectedStudentUserId && s.id === selectedStudentUserId) ||
        s.name.toLowerCase().trim() === selectedStudentName.toLowerCase().trim()
    );
  }, [allClassStudents, selectedStudentName, selectedStudentUserId]);

  const hasPrevStudent = currentStudentIndex > 0;
  const hasNextStudent = currentStudentIndex >= 0 && currentStudentIndex < allClassStudents.length - 1;

  const handlePrevStudent = () => {
    if (hasPrevStudent) {
      const prev = allClassStudents[currentStudentIndex - 1];
      onSelectStudent(prev.name, prev.id);
    }
  };

  const handleNextStudent = () => {
    if (hasNextStudent) {
      const next = allClassStudents[currentStudentIndex + 1];
      onSelectStudent(next.name, next.id);
    }
  };

  // Check if current selected student is already graded
  const currentGradedRecord = useMemo(() => {
    if (!selectedStudentName) return null;
    return (
      gradedStudents.find(
        (g) =>
          (selectedStudentUserId && (g.student_user_id === selectedStudentUserId || g.id === selectedStudentUserId)) ||
          g.name.toLowerCase().trim() === selectedStudentName.toLowerCase().trim()
      ) || null
    );
  }, [gradedStudents, selectedStudentName, selectedStudentUserId]);

  // Filtered students for picker
  const filteredPickerStudents = useMemo(() => {
    if (!studentPickerSearch.trim()) return allClassStudents;
    const low = studentPickerSearch.toLowerCase().trim();
    return allClassStudents.filter((s) => s.name.toLowerCase().includes(low));
  }, [allClassStudents, studentPickerSearch]);

  // Filtered recap list
  const filteredRecapStudents = useMemo(() => {
    return gradedStudents.filter((st) => {
      const matchSearch =
        !recapSearch.trim() || st.name.toLowerCase().includes(recapSearch.toLowerCase().trim());
      const kkm = activeSession?.kkm || 75;
      const isPassed = Number(st.final_score) >= kkm;
      if (recapFilter === 'PASSED') return matchSearch && isPassed;
      if (recapFilter === 'REMEDIAL') return matchSearch && !isPassed;
      return matchSearch;
    });
  }, [gradedStudents, recapSearch, recapFilter, activeSession?.kkm]);

  // Recap statistics
  const recapStats = useMemo(() => {
    if (gradedStudents.length === 0) {
      return { avg: 0, highest: 0, lowest: 0, passedCount: 0, remedialCount: 0 };
    }
    const scores = gradedStudents.map((s) => Number(s.final_score) || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / scores.length) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const kkm = activeSession?.kkm || 75;
    const passedCount = scores.filter((s) => s >= kkm).length;
    const remedialCount = scores.length - passedCount;
    return { avg, highest, lowest, passedCount, remedialCount };
  }, [gradedStudents, activeSession?.kkm]);

  // Handle Save with loading
  const handleSaveWrapper = async () => {
    setIsSaving(true);
    try {
      await onSaveStudent();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 w-full h-dvh bg-[#F8FAFC] flex flex-col overflow-hidden font-sans select-none sm:select-auto">
      {/* ── TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-4 right-4 z-110 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : 'bg-rose-500 text-white border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-white" />
          )}
          <span className="truncate">{toastMessage.text}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 1: STICKY MOBILE HEADER (h-14 / 56px)                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <header className="h-14 bg-[#023246] text-white px-3 flex items-center justify-between shrink-0 shadow-md border-b border-teal-900/40 z-30 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 active:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shrink-0"
            title="Kembali ke Dashboard"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="font-extrabold text-xs sm:text-sm tracking-tight truncate leading-tight flex items-center gap-1.5">
              <span>Koreksi &amp; Nilai</span>
              <span className="px-1.5 py-0.2 rounded-full bg-teal-400/20 text-teal-200 text-[9px] font-black uppercase">
                HP
              </span>
            </h1>
            <p className="text-[10px] text-cyan-100/75 truncate mt-0.5">
              {activeSession
                ? `${activeSession.subject} • Kelas ${activeSession.class_name}`
                : 'Pilih Sesi Ujian'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher [ 💻 Desktop ] [ 📱 Mobile ] & Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => setViewMode('MOBILE')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'MOBILE'
                  ? 'bg-teal-400 text-slate-950 shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
              title="Mode Mobile (Layar Sentuh HP & Infinix Note 8)"
            >
              <span>📱 HP</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DESKTOP')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'DESKTOP'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
              title="Mode Desktop (Layar Lebar & Tabel Lengkap)"
            >
              <span>💻 PC</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-white/80 active:bg-white/15 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Tutup"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 2: SCROLLABLE WORKSPACE (flex-1)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-[#F1F5F9] custom-scrollbar space-y-3.5 pb-20">
        {/* ── TAB 1: SESSIONS LIST (MOBILE) ─────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-3.5 max-w-lg mx-auto w-full">
            {/* Quick Actions Header */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCreateSession}
                className="flex-1 h-11 px-3.5 rounded-xl bg-teal-600 active:bg-teal-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Sesi Ujian</span>
              </button>
              <button
                type="button"
                onClick={onOpenAiCreator}
                className="h-11 px-3.5 rounded-xl bg-linear-to-r from-[#023246] to-[#18536B] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                title="Pembuat Soal &amp; Kisi-Kisi AI"
              >
                <Sparkles className="w-4 h-4 text-teal-300" />
                <span className="hidden xs:inline">Buat Soal</span> AI
              </button>
              {typeof onOpenUniversalExcel === 'function' && (
                <button
                  type="button"
                  onClick={onOpenUniversalExcel}
                  className="h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  title="Import Nilai dari Berkas Excel"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden xs:inline">Excel</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sessionSearchQuery}
                onChange={(e) => setSessionSearchQuery(e.target.value)}
                placeholder="Cari mapel, kelas, atau nama ujian..."
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Class Filter Chips Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSessionClassFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  sessionClassFilter === 'ALL'
                    ? 'bg-[#023246] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Semua Kelas
              </button>
              {availableClasses.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSessionClassFilter(cls)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    sessionClassFilter === cls
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Kelas {cls}
                </button>
              ))}
            </div>

            {/* Cloud Bulk Sync Banner (if provided) */}
            {typeof onOpenBulkSync === 'function' && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw className="w-4 h-4 text-teal-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-teal-900 truncate">Sinkronisasi Cloud Massal</p>
                    <p className="text-[10px] text-teal-700 truncate">Kirim seluruh nilai ke GradeMaster OS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenBulkSync}
                  className="px-3 py-1.5 rounded-xl bg-teal-700 text-white text-[11px] font-black shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Sinkron Semua
                </button>
              </div>
            )}

            {/* Session Cards List */}
            {sessions.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-2xs">
                <span className="text-3xl">📋</span>
                <h3 className="text-sm font-black text-slate-800">Belum Ada Sesi Ujian</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Buat sesi ujian pertama Anda untuk mulai mengoreksi jawaban siswa secara otomatis.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreateSession}
                  className="h-10 px-4 rounded-xl bg-teal-600 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Sesi Ujian Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((sess) => {
                  const isSelected = activeSession?.id === sess.id;
                  const keyCount = Array.isArray(sess.answer_key) ? sess.answer_key.length : 0;
                  const essayCount = sess.scoring_config?.essayCount || 0;

                  return (
                    <div
                      key={sess.id}
                      className={`bg-white rounded-2xl p-4 border transition-all shadow-2xs space-y-3 ${
                        isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black uppercase">
                            {sess.subject}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-black">
                            Kelas {sess.class_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            KKM: {sess.kkm || 75}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-semibold">
                          {sess.exam_type || 'Ujian'} • {sess.academic_year || '2026/2027'}
                        </span>
                      </div>

                      {/* Title & Info */}
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-snug">
                          {sess.session_name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Format: <strong>{keyCount} PG</strong>
                          {essayCount > 0 ? ` + ${essayCount} Essay` : ' (PG Saja)'} • Pengampu:{' '}
                          {sess.teacher}
                        </p>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(sess);
                            setActiveTab('grading');
                          }}
                          className="h-10 rounded-xl bg-teal-600 active:bg-teal-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Koreksi Siswa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(sess);
                            setActiveTab('recap');
                          }}
                          className="h-10 rounded-xl bg-[#023246] active:bg-[#034560] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Rekap Nilai</span>
                        </button>
                      </div>

                      {/* Quick Edit Footer */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenKeyEditorModal(sess)}
                          className="text-teal-700 hover:underline font-bold flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Kunci Jawaban ({keyCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEditSessionModal(sess)}
                          className="text-slate-600 hover:text-slate-900 font-semibold"
                        >
                          ⚙️ Konfigurasi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LEMBAR KOREKSI SISWA (MOBILE) ───────────────────────── */}
        {activeTab === 'grading' && activeSession && (
          <div className="space-y-3.5 max-w-lg mx-auto w-full">
            {/* Student Navigator Card */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Siswa Aktif ({allClassStudents.length > 0 ? `${currentStudentIndex + 1} dari ${allClassStudents.length}` : '0'})
                </span>
                {currentGradedRecord ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Sudah Dinilai: {currentGradedRecord.final_score}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                    ⏳ Belum Dinilai
                  </span>
                )}
              </div>

              {/* Prev / Current Student Name / Next */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrevStudent}
                  onClick={handlePrevStudent}
                  className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-700 shrink-0 cursor-pointer"
                  title="Siswa Sebelumnya"
                  aria-label="Siswa Sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div
                  onClick={() => setIsStudentPickerOpen(true)}
                  className="flex-1 min-h-11 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-teal-500 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {selectedStudentName || 'Pilih Nama Siswa...'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      Kelas {activeSession.class_name} • Ketuk untuk ganti
                    </p>
                  </div>
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <button
                  type="button"
                  disabled={!hasNextStudent}
                  onClick={handleNextStudent}
                  className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-slate-700 shrink-0 cursor-pointer"
                  title="Siswa Berikutnya"
                  aria-label="Siswa Berikutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Live Score Preview Card (Mobile Sticky Indicator) */}
            <div className="bg-linear-to-br from-[#023246] to-[#18536B] text-white p-4 rounded-2xl shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-teal-200 font-bold uppercase tracking-wider block">
                    Total Nilai Siswa
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black tracking-tight">{effectiveFinalScore}</span>
                    <span className="text-xs text-cyan-200 font-semibold">/ 100</span>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        effectiveFinalScore >= (activeSession.kkm || 75)
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-rose-400 text-slate-950'
                      }`}
                    >
                      {effectiveFinalScore >= (activeSession.kkm || 75) ? 'TUNTAS' : 'REMEDIAL'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-teal-200 font-bold uppercase block">Predikat</span>
                  <span className="text-xl font-black text-amber-300 mt-0.5 block">
                    {getScoreLabel(effectiveFinalScore)}
                  </span>
                </div>
              </div>

              {/* Breakdown PG & Essay */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/15 text-xs text-cyan-100/90 font-medium">
                <div>
                  <span className="text-[10px] text-cyan-200/70 block">Pilihan Ganda:</span>
                  <strong>{Math.round(calculation?.score || 0)}</strong>{' '}
                  <span className="text-[10px]">
                    ({calculation?.correct || 0} Benar, {calculation?.wrong || 0} Salah)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-cyan-200/70 block">Uraian / Essay:</span>
                  <strong>{Math.round(calculation?.essayScore || 0)}</strong> Poin
                </div>
              </div>
            </div>

            {/* Quick Fill & Manual Score Toolbar */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {typeof onAutoPg100 === 'function' && (
                <button
                  type="button"
                  onClick={onAutoPg100}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Auto PG Benar</span>
                </button>
              )}
              <button
                type="button"
                onClick={onResetGrading}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Jawaban</span>
              </button>
              <button
                type="button"
                onClick={() => setIsManualOverrideOpen(!isManualOverrideOpen)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all border ${
                  manualScore !== null
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                <span>Override Manual {manualScore !== null ? `(${manualScore})` : ''}</span>
              </button>
            </div>

            {/* Manual Score Override Box (if expanded) */}
            {isManualOverrideOpen && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                  <span>Input Skor Akhir Langsung (0 - 100):</span>
                  {manualScore !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        onCancelManualScore();
                        setIsManualOverrideOpen(false);
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline"
                    >
                      Batal Override
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={manualScore !== null ? manualScore : ''}
                    onChange={(e) => onManualScoreChange(e.target.value)}
                    placeholder="Contoh: 85"
                    className="flex-1 h-11 px-3 bg-white border border-amber-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex items-center gap-1">
                    {[75, 80, 85, 90, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onManualScoreChange(String(num))}
                        className="px-2 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-bold text-amber-900"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pilihan Ganda (PG) Questions Touch Grid */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                  <span>Lembar Jawaban PG ({activeSession.answer_key.length} Soal)</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {Object.keys(userAnswers).length} / {activeSession.answer_key.length} Terisi
                </span>
              </div>

              {/* Questions List */}
              <div className="space-y-2.5">
                {activeSession.answer_key.map((keyOpt, idx) => {
                  const qNum = idx + 1;
                  const selectedOpt = userAnswers[qNum];
                  const isAnswered = Boolean(selectedOpt);
                  const isCorrect = selectedOpt === keyOpt;

                  return (
                    <div
                      key={qNum}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        !isAnswered
                          ? 'bg-slate-50/60 border-slate-200'
                          : isCorrect
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      {/* Question Number & Status */}
                      <div className="flex items-center gap-2 min-w-16">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 text-xs font-black flex items-center justify-center shrink-0">
                          {qNum}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Kunci: <strong className="text-slate-900">{keyOpt}</strong>
                        </span>
                      </div>

                      {/* Touch Options (A, B, C, D) */}
                      <div className="flex items-center gap-1.5">
                        {availableOptions.map((opt) => {
                          const isOptionSelected = selectedOpt === opt;
                          const isKeyMatch = opt === keyOpt;

                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => onAnswerSelect(qNum, opt)}
                              className={`w-10 h-10 rounded-xl text-xs font-black flex items-center justify-center transition-all cursor-pointer border active:scale-90 ${
                                isOptionSelected
                                  ? isKeyMatch
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                    : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Essay Scoring (if enabled) */}
            {(activeSession.scoring_config?.essayCount || 0) > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✍️</span>
                    <span>Nilai Soal Uraian / Essay ({activeSession.scoring_config?.essayCount} Butir)</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Maks {activeSession.scoring_config?.essayMaxScore || 20} Poin
                  </span>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: activeSession.scoring_config?.essayCount || 5 }).map((_, idx) => {
                    const currentVal = essayScores[idx] || 0;
                    const maxScorePerItem = Math.round(
                      (activeSession.scoring_config?.essayMaxScore || 20) /
                        (activeSession.scoring_config?.essayCount || 5)
                    );

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">Soal Essay {idx + 1}</span>
                          <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                            {currentVal} Poin
                          </span>
                        </div>

                        {/* Quick score pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {[0, Math.round(maxScorePerItem * 0.25), Math.round(maxScorePerItem * 0.5), Math.round(maxScorePerItem * 0.75), maxScorePerItem].map(
                            (pt) => (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => {
                                  const updated = [...essayScores];
                                  updated[idx] = pt;
                                  setEssayScores(updated);
                                }}
                                className={`flex-1 h-9 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  currentVal === pt
                                    ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {pt}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: REKAP NILAI SISWA (MOBILE) ──────────────────────────── */}
        {activeTab === 'recap' && activeSession && (
          <div className="space-y-3.5 max-w-lg mx-auto w-full">
            {/* Summary Statistics Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  <span>Statistik Nilai Kelas {activeSession.class_name}</span>
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {gradedStudents.length} Siswa Dinilai
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-semibold">Rata-Rata</span>
                  <span className="text-sm font-black text-slate-900">{recapStats.avg}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block font-semibold">Tertinggi</span>
                  <span className="text-sm font-black text-emerald-800">{recapStats.highest}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-700 block font-semibold">Terendah</span>
                  <span className="text-sm font-black text-amber-800">{recapStats.lowest}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
                  <span className="text-[10px] text-teal-700 block font-semibold">Tuntas</span>
                  <span className="text-sm font-black text-teal-800">
                    {recapStats.passedCount}/{gradedStudents.length}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Export & Sync */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onOpenDownloadFormat}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unduh Excel</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingGradeMaster}
                  onClick={onSyncToGradeMaster}
                  className="h-10 rounded-xl bg-teal-600 active:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSyncingGradeMaster ? 'animate-spin' : ''}`}
                  />
                  <span>Sinkron Cloud</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recapSearch}
                  onChange={(e) => setRecapSearch(e.target.value)}
                  placeholder="Cari siswa dalam rekap..."
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(['ALL', 'PASSED', 'REMEDIAL'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRecapFilter(f)}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      recapFilter === f
                        ? 'bg-[#023246] text-white border-[#023246]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {f === 'ALL' ? 'Semua' : f === 'PASSED' ? 'Tuntas' : 'Remedial'}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Cards List */}
            {filteredRecapStudents.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Tidak ada data nilai siswa yang sesuai.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRecapStudents.map((st, idx) => {
                  const score = Number(st.final_score) || 0;
                  const isPassed = score >= (activeSession.kkm || 75);

                  return (
                    <div
                      key={st.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs hover:border-teal-500 transition-all flex items-center justify-between gap-3"
                    >
                      <div
                        onClick={() => onEditStudentScoreFromRecap(st)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{st.name}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            PG: {st.mcq_score} • Essay: {st.essay_score || 0} • {st.correct} Benar
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          onClick={() => onEditStudentScoreFromRecap(st)}
                          className="text-right cursor-pointer"
                        >
                          <span className="text-base font-black text-slate-900 block leading-tight">
                            {score}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase inline-block mt-0.5 ${
                              isPassed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isPassed ? 'TUNTAS' : 'REMEDI'}
                          </span>
                        </div>

                        {!isReadOnly && typeof onDeleteGradedStudent === 'function' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteGradedStudent(st.id);
                            }}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                            title="Hapus Nilai Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3: STICKY BOTTOM ACTION BAR (Thumb Zone)                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-white border-t border-slate-200 shrink-0 shadow-lg z-30 pb-[env(safe-area-inset-bottom)]">
        {/* Save button when in grading tab */}
        {activeTab === 'grading' && activeSession && (
          <div className="p-3 border-b border-slate-100 bg-white">
            <button
              type="button"
              disabled={isSaving || !selectedStudentName.trim()}
              onClick={handleSaveWrapper}
              className="w-full h-12 rounded-xl bg-linear-to-r from-teal-600 to-emerald-600 hover:brightness-105 active:scale-98 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Menyimpan Nilai...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    Simpan Nilai &amp; Lanjut Siswa Berikutnya
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* 3-Tab Thumb Navigation Bar */}
        <div className="h-14 grid grid-cols-3 divide-x divide-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'sessions' ? 'text-teal-700 bg-teal-50/50' : 'text-slate-500'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px] font-bold">Daftar Sesi</span>
          </button>

          <button
            type="button"
            disabled={!activeSession}
            onClick={() => setActiveTab('grading')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
              activeTab === 'grading' ? 'text-teal-700 bg-teal-50/50' : 'text-slate-500'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span className="text-[10px] font-bold">
              Koreksi {selectedStudentName ? `(${selectedStudentName.split(' ')[0]})` : ''}
            </span>
          </button>

          <button
            type="button"
            disabled={!activeSession}
            onClick={() => setActiveTab('recap')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 ${
              activeTab === 'recap' ? 'text-teal-700 bg-teal-50/50' : 'text-slate-500'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-bold">
              Rekap ({gradedStudents.length})
            </span>
          </button>
        </div>
      </footer>

      {/* ── STUDENT PICKER BOTTOM SHEET MODAL (MOBILE) ─────────────────── */}
      {isStudentPickerOpen && (
        <div className="fixed inset-0 z-110 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setIsStudentPickerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-4 max-h-[80dvh] flex flex-col space-y-3 z-10 animate-in slide-in-from-bottom duration-200">
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Pilih Siswa Kelas {activeSession?.class_name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {gradedStudents.length} / {allClassStudents.length} Siswa Sudah Dinilai
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentPickerSearch}
                onChange={(e) => setStudentPickerSearch(e.target.value)}
                placeholder="Ketik nama siswa..."
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 max-h-80 divide-y divide-slate-100 custom-scrollbar">
              {filteredPickerStudents.map((st) => {
                const isGraded = gradedStudents.some(
                  (g) =>
                    (st.id && (g.student_user_id === st.id || g.id === st.id)) ||
                    g.name.toLowerCase().trim() === st.name.toLowerCase().trim()
                );
                const isSelected =
                  selectedStudentName.toLowerCase().trim() === st.name.toLowerCase().trim();

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onSelectStudent(st.name, st.id);
                      setIsStudentPickerOpen(false);
                    }}
                    className={`w-full p-3 text-left flex items-center justify-between gap-2 transition-colors ${
                      isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="text-xs font-semibold truncate">{st.name}</span>
                    {isGraded ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black shrink-0">
                        ✓ Dinilai
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">Belum</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
