import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  X,
  Sparkles,
  FileText,
  Key,
  ClipboardList,
  Download,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
  Copy,
  Printer,
  TableProperties,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import { OFFICIAL_SCHOOL_SUBJECTS } from '../../../config/school-subjects.config';
import type { ExamPaperData } from '../../../services/exam-paper-docx.service';
import { KOP_LOGO_BASE64 } from '../../../assets/kop-logo.base64';

export type WizardStep = 'PARAMS' | 'INPUT_CONTENT' | 'PREVIEW_AND_ACTION';
export type PreviewTab = 'PAPER' | 'KEYS' | 'KISI_KISI' | 'LEMBAR_JAWABAN';

export interface ExamQuestionCreatorMobileViewProps {
  onClose: () => void;
  currentUser: UserProfile;
  viewMode: 'DESKTOP' | 'MOBILE';
  setViewMode: (mode: 'DESKTOP' | 'MOBILE') => void;

  // Wizard state
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  previewTab: PreviewTab;
  setPreviewTab: (tab: PreviewTab) => void;

  // Form State
  subject: string;
  setSubject: (s: string) => void;
  customSubject: string;
  setCustomSubject: (s: string) => void;
  examType: 'ASTS' | 'ASAS' | 'ULANGAN_HARIAN';
  setExamType: (t: 'ASTS' | 'ASAS' | 'ULANGAN_HARIAN') => void;
  academicYear: string;
  setAcademicYear: (y: string) => void;
  semester: 'GANJIL' | 'GENAP';
  setSemester: (s: 'GANJIL' | 'GENAP') => void;
  gradeClass: string;
  setGradeClass: (c: string) => void;
  category: 'EKSAK' | 'NON_EKSAK';
  setCategory: (c: 'EKSAK' | 'NON_EKSAK') => void;
  mcqCount: number;
  setMcqCount: (n: number) => void;
  essayCount: number;
  setEssayCount: (n: number) => void;
  durationMinutes: number;
  setDurationMinutes: (n: number) => void;

  // Input Content State
  inputMode: 'FROM_TOPIC' | 'PARSE_RAW_QUESTIONS';
  setInputMode: (m: 'FROM_TOPIC' | 'PARSE_RAW_QUESTIONS') => void;
  contentPrompt: string;
  setContentPrompt: (p: string) => void;

  // AI & Generation State
  isGenerating: boolean;
  generatedData: ExamPaperData | null;
  effectiveSubject: string;

  // 2 Opsi Kunci & Kisi-Kisi State (AI vs Manual)
  keyAndMatrixMode: 'AI' | 'MANUAL';
  setKeyAndMatrixMode: (m: 'AI' | 'MANUAL') => void;
  manualKeyText: string;
  setManualKeyText: (t: string) => void;
  manualMcqKeys: Record<number, 'A' | 'B' | 'C' | 'D'>;
  onSetManualMcqKey: (num: number, key: 'A' | 'B' | 'C' | 'D') => void;
  onFillQuickMcqPattern: () => void;
  onClearManualMcqKeys: () => void;
  manualEssayText: string;
  setManualEssayText: (t: string) => void;
  onLoadSampleManualEssayRubric: () => void;
  manualKisiKisiText: string;
  setManualKisiKisiText: (t: string) => void;
  onLoadSampleManualKisiKisi: () => void;

  // Actions
  onStartGeneration: () => Promise<void>;
  onCopyPlainTextPaper: () => Promise<void>;
  onCopyMcqExample: () => Promise<void>;
  onCopyEssayExample: () => Promise<void>;
  onCopyExampleTemplate: () => Promise<void>;
  onApplyExampleTemplate: () => void;
  onPrintExamPaper: () => void;
  onDownloadPaperDocx: () => void;
  onDownloadKeyAndKisiKisiDocx: () => void;
  onSaveAndOpenCorrection: () => Promise<void>;
  isSavingToCorrection: boolean;
}

const PREDEFINED_CLASSES = ['7', '8', '9', 'SMA'];

export const ExamQuestionCreatorMobileView: React.FC<ExamQuestionCreatorMobileViewProps> = ({
  onClose,
  viewMode,
  setViewMode,
  step,
  setStep,
  previewTab,
  setPreviewTab,
  subject,
  setSubject,
  customSubject,
  setCustomSubject,
  examType,
  setExamType,
  academicYear,
  setAcademicYear,
  semester,
  setSemester,
  gradeClass,
  setGradeClass,
  category,
  setCategory,
  mcqCount,
  setMcqCount,
  essayCount,
  setEssayCount,
  durationMinutes,
  setDurationMinutes,
  inputMode,
  setInputMode,
  contentPrompt,
  setContentPrompt,
  isGenerating,
  generatedData,
  effectiveSubject,
  keyAndMatrixMode,
  setKeyAndMatrixMode,
  manualKeyText,
  setManualKeyText,
  manualMcqKeys,
  onSetManualMcqKey,
  onFillQuickMcqPattern,
  onClearManualMcqKeys,
  manualEssayText,
  setManualEssayText,
  onLoadSampleManualEssayRubric,
  manualKisiKisiText,
  setManualKisiKisiText,
  onLoadSampleManualKisiKisi,
  onStartGeneration,
  onCopyPlainTextPaper,
  onCopyMcqExample,
  onCopyEssayExample,
  onCopyExampleTemplate,
  onApplyExampleTemplate,
  onPrintExamPaper,
  onDownloadPaperDocx,
  onDownloadKeyAndKisiKisiDocx,
  onSaveAndOpenCorrection,
  isSavingToCorrection,
}) => {
  // Mobile accordion state for format guide
  const [isFormatGuideOpen, setIsFormatGuideOpen] = useState(false);
  // Matrix view toggle: 'CARD' | 'TABLE'
  const [kisiKisiViewMode, setKisiKisiViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  // Manual sub-tab: 'KEYS' | 'ESSAY' | 'KISI_KISI'
  const [manualTab, setManualTab] = useState<'KEYS' | 'ESSAY' | 'KISI_KISI'>('KEYS');

  // Handle subject change with auto-detect category
  const handleSubjectChange = (val: string) => {
    setSubject(val);
    const low = val.toLowerCase();
    if (
      low.includes('matematika') ||
      low.includes('ipa') ||
      low.includes('fisika') ||
      low.includes('kimia') ||
      low.includes('biologi')
    ) {
      setCategory('EKSAK');
    } else {
      setCategory('NON_EKSAK');
    }
  };

  // Header back button behavior
  const handleHeaderBack = () => {
    if (step === 'PREVIEW_AND_ACTION') {
      setStep('INPUT_CONTENT');
    } else if (step === 'INPUT_CONTENT') {
      setStep('PARAMS');
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pembuat Soal & Kisi-Kisi AI Mobile"
      className="fixed inset-0 z-100 w-full h-dvh bg-[#F8FAFC] flex flex-col overflow-hidden font-sans select-none sm:select-auto"
    >
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 1: STICKY MOBILE HEADER (56px / h-14)                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <header className="h-14 bg-[#023246] text-white px-3 flex items-center justify-between shrink-0 shadow-md border-b border-teal-900/40 z-30 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleHeaderBack}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shrink-0"
            title={step === 'PARAMS' ? 'Tutup' : 'Kembali ke Langkah Sebelumnya'}
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="font-extrabold text-xs sm:text-sm tracking-tight truncate leading-tight flex items-center gap-1.5">
              <span>Pembuat Soal AI</span>
              <span className="px-1.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-300/30 text-[9px] font-black uppercase tracking-wider">
                SMPT
              </span>
            </h1>
            <p className="text-[10px] text-cyan-100/75 truncate mt-0.5">
              {step === 'PARAMS' && '1/3 • Konfigurasi Parameter'}
              {step === 'INPUT_CONTENT' && '2/3 • Materi & Draft Soal'}
              {step === 'PREVIEW_AND_ACTION' && '3/3 • Naskah, Kunci & Sesi'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher [ 📱 HP ] [ 💻 PC ] & Close Button */}
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
              title="Mode Mobile (Infinix Note 8 & Layar Sentuh HP)"
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
              title="Mode Desktop (Layar Lebar)"
            >
              <span>💻 PC</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-white/80 active:bg-white/15 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Tutup Workspace"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── STEP PROGRESS BAR (MOBILE ERGONOMIC) ───────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Segment 1 */}
          <button
            type="button"
            onClick={() => setStep('PARAMS')}
            className={`flex-1 flex flex-col items-start transition-all cursor-pointer ${
              step === 'PARAMS' ? 'opacity-100' : 'opacity-70'
            }`}
          >
            <div
              className={`w-full h-1.5 rounded-full transition-all ${
                step === 'PARAMS' || step === 'INPUT_CONTENT' || step === 'PREVIEW_AND_ACTION'
                  ? 'bg-[#023246]'
                  : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-[10px] mt-1 font-bold truncate ${
                step === 'PARAMS' ? 'text-teal-900' : 'text-slate-500'
              }`}
            >
              1. Parameter
            </span>
          </button>

          {/* Segment 2 */}
          <button
            type="button"
            onClick={() => {
              if (step === 'PREVIEW_AND_ACTION') setStep('INPUT_CONTENT');
            }}
            className={`flex-1 flex flex-col items-start transition-all cursor-pointer ${
              step === 'INPUT_CONTENT' ? 'opacity-100' : 'opacity-70'
            }`}
          >
            <div
              className={`w-full h-1.5 rounded-full transition-all ${
                step === 'INPUT_CONTENT' || step === 'PREVIEW_AND_ACTION'
                  ? 'bg-[#023246]'
                  : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-[10px] mt-1 font-bold truncate ${
                step === 'INPUT_CONTENT' ? 'text-teal-900' : 'text-slate-500'
              }`}
            >
              2. Materi
            </span>
          </button>

          {/* Segment 3 */}
          <div
            className={`flex-1 flex flex-col items-start ${
              step === 'PREVIEW_AND_ACTION' ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <div
              className={`w-full h-1.5 rounded-full transition-all ${
                step === 'PREVIEW_AND_ACTION' ? 'bg-[#023246]' : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-[10px] mt-1 font-bold truncate ${
                step === 'PREVIEW_AND_ACTION' ? 'text-teal-900' : 'text-slate-400'
              }`}
            >
              3. Hasil & Aksi
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 2: SCROLLABLE WORKSPACE (flex-1)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-4 bg-[#F1F5F9] custom-scrollbar space-y-4 pb-28">
        <div className="w-full max-w-lg mx-auto space-y-4">
          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 1: PARAMETER UJIAN                                       */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'PARAMS' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Card 1: Mapel & Asesmen */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-black text-xs">
                    1
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Mata Pelajaran & Kurikulum
                    </h2>
                    <p className="text-[11px] text-slate-500">Standar resmi SMP Terpadu Al-Ittihadiyah</p>
                  </div>
                </div>

                {/* Mata Pelajaran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  >
                    {OFFICIAL_SCHOOL_SUBJECTS.map((s) => (
                      <option key={s.code} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                    <option value="LAINNYA">+ Mata Pelajaran Lainnya...</option>
                  </select>
                </div>

                {subject === 'LAINNYA' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nama Mata Pelajaran Khusus <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Misal: Bahasa Sunda, Tahfidz, Robotika..."
                      className="w-full h-12 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    />
                  </div>
                )}

                {/* Kategori Bidang Studi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kategori Bidang Studi <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategory('EKSAK')}
                      className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        category === 'EKSAK'
                          ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>📐 Eksak (IPA/Matematika)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('NON_EKSAK')}
                      className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        category === 'NON_EKSAK'
                          ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>📚 Non-Eksak (Sosial/Bhs)</span>
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    Bobot nilai: {category === 'EKSAK' ? 'PG 60% • Essay 40%' : 'PG 70% • Essay 30%'}
                  </p>
                </div>

                {/* Jenis Asesmen */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenis Ujian / Asesmen <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExamType('ASTS')}
                      className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        examType === 'ASTS'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>ASTS (Tengah Semester)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamType('ASAS')}
                      className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        examType === 'ASAS'
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>ASAS (Akhir Semester)</span>
                    </button>
                  </div>
                </div>

                {/* Tingkat & Kelas (Satu Angkatan) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Tingkat &amp; Kelas <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Satu Angkatan
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PREDEFINED_CLASSES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setGradeClass(c)}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                          gradeClass === c
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Kelas {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tahun Ajaran & Semester */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tahun Ajaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full h-11 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    >
                      <option value="2026/2027">2026/2027 (Aktif)</option>
                      <option value="2025/2026">2025/2026 (Arsip)</option>
                      <option value="2027/2028">2027/2028</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Semester <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSemester('GANJIL')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          semester === 'GANJIL'
                            ? 'bg-[#023246] text-white border-[#023246]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Ganjil
                      </button>
                      <button
                        type="button"
                        onClick={() => setSemester('GENAP')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          semester === 'GENAP'
                            ? 'bg-[#023246] text-white border-[#023246]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Genap
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Butir Soal & Durasi */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Komposisi Butir & Durasi
                    </h2>
                    <p className="text-[11px] text-slate-500">Jumlah soal yang digenerate oleh AI</p>
                  </div>
                </div>

                {/* Jumlah Pilihan Ganda (PG) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilihan Ganda (PG)
                    </label>
                    <span className="text-[11px] font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      {mcqCount} Butir
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 20, 25, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMcqCount(num)}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          mcqCount === num
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Jumlah Soal Uraian (Essay) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Soal Uraian (Essay)
                    </label>
                    <span className="text-[11px] font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      {essayCount} Butir
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setEssayCount(num)}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          essayCount === num
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num} Soal
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alokasi Waktu */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Alokasi Waktu Pengerjaan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[60, 90, 120].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setDurationMinutes(min)}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          durationMinutes === min
                            ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {min} Menit
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 2: INPUT MATERI / DRAFT SOAL                             */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'INPUT_CONTENT' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div>
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    Pilih Metode Pembuatan Soal
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gunakan materi pokok CP, atau tempel draft soal mentah Anda.
                  </p>
                </div>

                {/* Mode Selector Cards */}
                <div className="space-y-2">
                  <div
                    onClick={() => setInputMode('FROM_TOPIC')}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      inputMode === 'FROM_TOPIC'
                        ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl shrink-0">✨</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Generate dari Materi / Bab KBM
                      </strong>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        Ketik materi pokok CP. AI menyusun soal PG, essay, kunci, dan kisi-kisi.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setInputMode('PARSE_RAW_QUESTIONS')}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      inputMode === 'PARSE_RAW_QUESTIONS'
                        ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl shrink-0">📋</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Kirim Draft Soal Mentah Saya
                      </strong>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        Tempelkan teks soal mentah. AI merapikan format KOP, membuat kunci dan kisi-kisi.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Example Actions for RAW Mode */}
                {inputMode === 'PARSE_RAW_QUESTIONS' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      Aksi Cepat Template:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                      <button
                        type="button"
                        onClick={onApplyExampleTemplate}
                        className="h-9 px-3 rounded-xl bg-teal-700 text-white text-[11px] font-black flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gunakan Contoh Langsung</span>
                      </button>
                      <button
                        type="button"
                        onClick={onCopyExampleTemplate}
                        className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0 border border-slate-200 active:scale-95 transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-teal-600" />
                        <span>Salin Contoh</span>
                      </button>
                      <button
                        type="button"
                        onClick={onCopyMcqExample}
                        className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 shrink-0 border border-slate-200 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Salin PG</span>
                      </button>
                      <button
                        type="button"
                        onClick={onCopyEssayExample}
                        className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 shrink-0 border border-slate-200 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Salin Essay</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Textarea Input (Font 16px to prevent iOS/Android zoom) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {inputMode === 'FROM_TOPIC'
                      ? 'Tuliskan Materi Pokok / Capaian Pembelajaran:'
                      : 'Tempelkan Teks Soal Mentah Pilihan Ganda & Essay:'}
                  </label>
                  <textarea
                    rows={8}
                    value={contentPrompt}
                    onChange={(e) => setContentPrompt(e.target.value)}
                    placeholder={
                      inputMode === 'FROM_TOPIC'
                        ? `Contoh:\nMateri ${effectiveSubject} Kelas ${gradeClass}:\n1. Bab 1: Konsep dasar dan rumus...\n2. Bab 2: Contoh soal dan penerapan...\n3. Bab 3: Soal cerita kontekstual...`
                        : `Contoh Format Soal Mentah:\n1. Pertanyaan nomor satu...\nA. Pilihan A\nB. Pilihan B\nC. Pilihan C\nD. Pilihan D\n\nEssay:\n1. Jelaskan secara lengkap...`
                    }
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  />
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 mt-1">
                    <span>
                      {contentPrompt.length > 0
                        ? `${contentPrompt.length} karakter • ${contentPrompt.split('\n').length} baris`
                        : 'Kotak isian masih kosong'}
                    </span>
                    {contentPrompt.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setContentPrompt('')}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Accordion for Format Guidelines */}
                {inputMode === 'PARSE_RAW_QUESTIONS' && (
                  <div className="border border-teal-200 rounded-xl overflow-hidden bg-teal-50/40">
                    <button
                      type="button"
                      onClick={() => setIsFormatGuideOpen(!isFormatGuideOpen)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-xs font-bold text-teal-900 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-teal-700" />
                        <span>Panduan Format Baku Soal Mentah</span>
                      </span>
                      {isFormatGuideOpen ? (
                        <ChevronUp className="w-4 h-4 text-teal-700" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-teal-700" />
                      )}
                    </button>

                    {isFormatGuideOpen && (
                      <div className="p-3 border-t border-teal-200 bg-white text-[11px] text-slate-700 space-y-2">
                        <p className="font-semibold text-slate-800">
                          Format penomoran standar yang dikenali otomatis:
                        </p>
                        <div className="font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5 text-[10.5px]">
                          <p className="text-teal-800 font-sans font-bold">// Soal Pilihan Ganda:</p>
                          <p>1. Soal nomor satu...</p>
                          <p className="pl-3">A. Opsi A</p>
                          <p className="pl-3">B. Opsi B</p>
                          <p className="pl-3">C. Opsi C</p>
                          <p className="pl-3">D. Opsi D</p>
                          <p className="text-blue-800 font-sans font-bold pt-1.5">// Soal Essay:</p>
                          <p>B. SOAL URAIAN (ESSAY)</p>
                          <p>1. Pertanyaan uraian pertama...</p>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          AI akan otomatis menata ulang ke font Times New Roman, 2 kolom, serta melengkapi kunci jawaban dan kisi-kisi resmi.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Konfigurasi Kunci Jawaban & Matriks Kisi-Kisi (2 Opsi: AI vs Manual) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-1">
                  <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                      <span>Kunci Jawaban &amp; Matriks Kisi-Kisi</span>
                      <span className="text-[9.5px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        2 Opsi
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih gunakan AI atau tentukan kunci &amp; kisi-kisi sendiri secara manual.
                    </p>
                  </div>
                </div>

                {/* Dua Opsi: AI vs Manual */}
                <div className="space-y-2">
                  <div
                    onClick={() => setKeyAndMatrixMode('AI')}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      keyAndMatrixMode === 'AI'
                        ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl shrink-0">✨</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Otomatis oleh AI (Tersedia)
                      </strong>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        AI menyusun kunci jawaban PG, rubrik essay, materi pokok, dan indikator kisi-kisi otomatis.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setKeyAndMatrixMode('MANUAL')}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      keyAndMatrixMode === 'MANUAL'
                        ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl shrink-0">✍️</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Tentukan Kunci &amp; Kisi-Kisi Sendiri (Manual)
                      </strong>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        Guru menginputkan kunci jawaban PG/Essay dan indikator kisi-kisi secara mandiri.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-Panel Input Manual jika Mode MANUAL Aktif */}
                {keyAndMatrixMode === 'MANUAL' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                    {/* Sub-Tab Selector */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setManualTab('KEYS')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          manualTab === 'KEYS'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        1. Kunci PG ({Object.keys(manualMcqKeys).length}/{mcqCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualTab('ESSAY')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          manualTab === 'ESSAY'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        2. Rubrik Essay ({essayCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualTab('KISI_KISI')}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          manualTab === 'KISI_KISI'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        3. Kisi-Kisi
                      </button>
                    </div>

                    {/* Sub-Tab 1: Kunci Jawaban PG */}
                    {manualTab === 'KEYS' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Input Teks Kunci Cepat (Contoh: 1.A 2.B 3.C atau A B C D):
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={onFillQuickMcqPattern}
                              className="px-2 py-0.8 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-bold cursor-pointer active:scale-95"
                              title="Isi Pola Acak A-B-C-D"
                            >
                              Pola A-B-C-D
                            </button>
                            <button
                              type="button"
                              onClick={onClearManualMcqKeys}
                              className="px-2 py-0.8 rounded-lg bg-slate-100 text-rose-700 border border-slate-200 text-[10.5px] font-bold cursor-pointer active:scale-95"
                              title="Bersihkan Kunci"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={manualKeyText}
                          onChange={(e) => setManualKeyText(e.target.value)}
                          placeholder={`1.A 2.B 3.C 4.D 5.A ... (sampai ${mcqCount})`}
                          className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />

                        {/* Visual Key Selector Buttons per Question */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-700">
                              Atau Ketuk Kunci Jawaban per Nomor:
                            </span>
                            <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {Object.keys(manualMcqKeys).length} dari {mcqCount} Kunci Terisi
                            </span>
                          </div>
                          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 divide-y divide-slate-200/80 custom-scrollbar">
                            {Array.from({ length: mcqCount }, (_, i) => i + 1).map((num) => {
                              const activeOpt = manualMcqKeys[num];
                              return (
                                <div
                                  key={`manual-key-row-${num}`}
                                  className="py-1.5 flex items-center justify-between"
                                >
                                  <span className="text-xs font-bold text-slate-700 w-12">
                                    No. {num}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                                      <button
                                        key={`btn-key-${num}-${opt}`}
                                        type="button"
                                        onClick={() => onSetManualMcqKey(num, opt)}
                                        className={`w-9 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                          activeOpt === opt
                                            ? 'bg-[#023246] text-white shadow-xs'
                                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sub-Tab 2: Rubrik Penskoran Essay */}
                    {manualTab === 'ESSAY' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Kriteria Jawaban Uraian &amp; Skor Maksimal:
                          </label>
                          <button
                            type="button"
                            onClick={onLoadSampleManualEssayRubric}
                            className="px-2 py-0.8 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-bold cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-teal-600" />
                            <span>Contoh Rubrik</span>
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={manualEssayText}
                          onChange={(e) => setManualEssayText(e.target.value)}
                          placeholder={`Format: Nomor. Kriteria Jawaban Diharapkan (Skor: Poin)\n1. Kriteria jawaban nomor 1 (Skor: 20)\n2. Kriteria jawaban nomor 2 (Skor: 20)\n3. Kriteria jawaban nomor 3 (Skor: 20)`}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                        <p className="text-[10px] text-slate-500 italic">
                          *Jika dikosongkan, AI akan menyusun rubrik penskoran standar sesuai butir soal uraian.
                        </p>
                      </div>
                    )}

                    {/* Sub-Tab 3: Matriks Kisi-Kisi Manual */}
                    {manualTab === 'KISI_KISI' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Materi Pokok &amp; Indikator Soal (Kisi-Kisi):
                          </label>
                          <button
                            type="button"
                            onClick={onLoadSampleManualKisiKisi}
                            className="px-2 py-0.8 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-bold cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-teal-600" />
                            <span>Contoh Kisi-Kisi</span>
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={manualKisiKisiText}
                          onChange={(e) => setManualKisiKisiText(e.target.value)}
                          placeholder={`Format: Nomor. Materi Pokok | Indikator Kompetensi | Level\n1. Aljabar | Menghitung persamaan linier | L2\n2. Geometri | Menghitung luas permukaan tabung | L2\n3. Statistika | Menganalisis diagram data | L3`}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                        <p className="text-[10px] text-slate-500 italic">
                          *Tiap baris otomatis dipetakan ke butir soal nomor 1, 2, dst. Format fleksibel dapat menggunakan tanda pipe (|) atau teks langsung.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 3: PREVIEW & TINDAKAN                                    */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'PREVIEW_AND_ACTION' && generatedData && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Summary Status Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xs font-black text-emerald-950 block truncate">
                      Naskah Soal Siap Digunakan!
                    </strong>
                    <p className="text-[10.5px] text-emerald-800 truncate">
                      {generatedData.subject} • Kelas {generatedData.gradeClass} ({generatedData.mcqQuestions.length} PG + {generatedData.essayQuestions.length} Essay)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCopyPlainTextPaper}
                  className="px-2.5 py-1.5 rounded-xl bg-white text-emerald-900 border border-emerald-300 text-[10.5px] font-bold flex items-center gap-1 shrink-0 shadow-2xs active:scale-95 cursor-pointer"
                  title="Salin Naskah Teks"
                >
                  <Copy className="w-3 h-3 text-emerald-700" />
                  <span>Salin</span>
                </button>
              </div>

              {/* Mobile Preview Tab Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('PAPER')}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    previewTab === 'PAPER'
                      ? 'bg-[#023246] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Naskah (KOP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('KEYS')}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    previewTab === 'KEYS'
                      ? 'bg-[#023246] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>2. Kunci & Rubrik</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('KISI_KISI')}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    previewTab === 'KISI_KISI'
                      ? 'bg-[#023246] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>3. Kisi-Kisi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('LEMBAR_JAWABAN')}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    previewTab === 'LEMBAR_JAWABAN'
                      ? 'bg-[#023246] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span>4. Lembar Jwb</span>
                </button>
              </div>

              {/* Preview Content Container */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs max-h-[50vh] overflow-y-auto custom-scrollbar">
                {/* ── TAB 1: NASKAH SOAL RESMI ──────────────────────────── */}
                {previewTab === 'PAPER' && (
                  <div
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                    className="exam-paper-times-new-roman space-y-3.5 text-black leading-normal"
                  >
                    {/* Header KOP Resmi */}
                    <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-black">
                      <img
                        src="/kop-soal-logo.jpeg"
                        alt="Logo Al-Ittihadiyah"
                        className="w-12 h-12 object-contain shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = KOP_LOGO_BASE64;
                        }}
                      />
                      <div className="text-center flex-1 min-w-0">
                        <h3 className="text-[11px] font-bold uppercase leading-tight text-black">
                          {generatedData.examType === 'ASTS'
                            ? `ASESMEN SUMATIF TENGAH SEMESTER (${generatedData.semester})`
                            : `ASESMEN SUMATIF AKHIR SEMESTER (${generatedData.semester})`}
                        </h3>
                        <h2 className="text-xs font-bold uppercase leading-tight text-black mt-0.5">
                          {generatedData.institutionName}
                        </h2>
                        <h4 className="text-[10px] font-bold uppercase text-black mt-0.5">
                          TAHUN {generatedData.academicYear}
                        </h4>
                      </div>
                    </div>

                    {/* Metadata Table */}
                    <div className="border border-black p-2 text-[11px] bg-slate-50/40 space-y-0.5">
                      <div className="flex justify-between">
                        <span><strong>Mapel:</strong> {generatedData.subject}</span>
                        <span><strong>Kelas:</strong> {generatedData.gradeClass} ({generatedData.semester})</span>
                      </div>
                      <div className="flex justify-between">
                        <span><strong>Waktu:</strong> {generatedData.durationMinutes} Menit</span>
                        <span><strong>Nama:</strong> ..........................</span>
                      </div>
                    </div>

                    {/* Bagian A: Pilihan Ganda */}
                    <div className="pt-2">
                      <div className="border-b border-black pb-1 mb-2">
                        <h4 className="text-xs font-bold uppercase text-black">
                          A. Pilihan Ganda ({generatedData.mcqQuestions.length} Butir Soal)
                        </h4>
                      </div>
                      <p className="text-[10.5px] italic text-slate-700 mb-2.5">
                        Pilihlah salah satu jawaban yang paling tepat (A, B, C, atau D)!
                      </p>

                      <div className="space-y-3">
                        {generatedData.mcqQuestions.map((q) => (
                          <div key={q.number} className="text-xs leading-relaxed">
                            <p className="font-bold text-black">
                              {q.number}. {q.question}
                            </p>
                            <div className="mt-1 pl-3 space-y-0.5 text-black">
                              <div><span className="font-bold">A.</span> {q.options.A}</div>
                              <div><span className="font-bold">B.</span> {q.options.B}</div>
                              <div><span className="font-bold">C.</span> {q.options.C}</div>
                              <div><span className="font-bold">D.</span> {q.options.D}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bagian B: Essay */}
                    <div className="pt-3 border-t-2 border-black">
                      <h4 className="text-xs font-bold uppercase text-black border-b border-black pb-1 mb-2">
                        B. Soal Uraian ({generatedData.essayQuestions.length} Butir Soal)
                      </h4>
                      <div className="space-y-2.5">
                        {generatedData.essayQuestions.map((eq) => (
                          <div key={eq.number} className="text-xs leading-relaxed">
                            <p className="font-bold text-black">
                              {eq.number}. {eq.question}
                              <span className="text-[10.5px] text-slate-600 ml-1 italic font-normal">
                                (Skor: {eq.maxScore})
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: KUNCI JAWABAN & RUBRIK ─────────────────────── */}
                {previewTab === 'KEYS' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase mb-2">
                        Kunci Jawaban PG ({generatedData.mcqQuestions.length} Soal)
                      </h3>
                      <div className="grid grid-cols-5 gap-1.5">
                        {generatedData.mcqQuestions.map((q) => (
                          <div
                            key={q.number}
                            className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center"
                          >
                            <span className="text-[9.5px] text-slate-400 font-bold block">{q.number}</span>
                            <span className="text-xs font-black text-teal-800">{q.correctAnswer}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {generatedData.essayQuestions.length > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <h3 className="text-xs font-black text-slate-900 uppercase mb-2">
                          Rubrik Penskoran Essay
                        </h3>
                        <div className="space-y-2">
                          {generatedData.essayQuestions.map((eq) => (
                            <div
                              key={eq.number}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-black text-slate-900">Nomor {eq.number}</span>
                                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold text-[10px]">
                                  Maks {eq.maxScore} Poin
                                </span>
                              </div>
                              <p className="text-slate-600 font-serif">{eq.question}</p>
                              <div className="bg-white p-2 rounded-lg border border-slate-200/80 mt-1">
                                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                                  Kriteria Jawaban:
                                </span>
                                <p className="text-[11px] text-slate-800 mt-0.5 leading-relaxed">
                                  {eq.expectedAnswer}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 3: MATRIKS KISI-KISI ──────────────────────────── */}
                {previewTab === 'KISI_KISI' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-900 uppercase">
                        Matriks Kisi-Kisi Ujian
                      </span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setKisiKisiViewMode('CARD')}
                          className={`px-2 py-0.5 rounded-md transition-all ${
                            kisiKisiViewMode === 'CARD'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Kartu
                        </button>
                        <button
                          type="button"
                          onClick={() => setKisiKisiViewMode('TABLE')}
                          className={`px-2 py-0.5 rounded-md transition-all ${
                            kisiKisiViewMode === 'TABLE'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Tabel
                        </button>
                      </div>
                    </div>

                    {kisiKisiViewMode === 'CARD' ? (
                      <div className="space-y-2">
                        {generatedData.mcqQuestions.map((q) => (
                          <div
                            key={`kisi-card-mcq-${q.number}`}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900">
                                Soal No. {q.number}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-bold text-[9.5px]">
                                  PG
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold text-[9.5px]">
                                  {q.cognitiveLevel || 'L2 (C3)'}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-black text-[9.5px]">
                                  Kunci: {q.correctAnswer}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-800">
                              Materi: {q.topic || generatedData.subject}
                            </p>
                            <p className="text-[10.5px] text-slate-600 leading-snug">
                              Indikator: {q.indicator}
                            </p>
                          </div>
                        ))}

                        {generatedData.essayQuestions.map((eq) => (
                          <div
                            key={`kisi-card-essay-${eq.number}`}
                            className="p-2.5 rounded-xl bg-teal-50/40 border border-teal-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900">
                                Uraian No. {eq.number}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold text-[9.5px]">
                                  Essay
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold text-[9.5px]">
                                  {eq.cognitiveLevel || 'L3 (C4)'}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9.5px]">
                                  Maks: {eq.maxScore}
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-800">
                              Materi: {eq.topic || generatedData.subject}
                            </p>
                            <p className="text-[10.5px] text-slate-600 leading-snug">
                              Indikator: {eq.indicator}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-[11px] border-collapse min-w-125">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <th className="p-2 text-center w-8">No</th>
                              <th className="p-2">Materi</th>
                              <th className="p-2">Indikator</th>
                              <th className="p-2 text-center">Bentuk</th>
                              <th className="p-2 text-center">Kunci</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {generatedData.mcqQuestions.map((q) => (
                              <tr key={`kisi-table-mcq-${q.number}`}>
                                <td className="p-2 text-center font-bold">{q.number}</td>
                                <td className="p-2">{q.topic || generatedData.subject}</td>
                                <td className="p-2 text-slate-600">{q.indicator}</td>
                                <td className="p-2 text-center font-bold text-teal-700">PG</td>
                                <td className="p-2 text-center font-black">{q.correctAnswer}</td>
                              </tr>
                            ))}
                            {generatedData.essayQuestions.map((eq) => (
                              <tr key={`kisi-table-essay-${eq.number}`} className="bg-teal-50/20">
                                <td className="p-2 text-center font-bold">U-{eq.number}</td>
                                <td className="p-2">{eq.topic || generatedData.subject}</td>
                                <td className="p-2 text-slate-600">{eq.indicator}</td>
                                <td className="p-2 text-center font-bold text-blue-700">Essay</td>
                                <td className="p-2 text-center font-bold text-slate-700">
                                  {eq.maxScore} pts
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 4: LEMBAR JAWABAN SISWA ───────────────────────── */}
                {previewTab === 'LEMBAR_JAWABAN' && (
                  <div
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                    className="exam-paper-times-new-roman space-y-3 text-black leading-normal"
                  >
                    <div className="text-center border-b border-black pb-1.5">
                      <h4 className="text-xs font-bold uppercase text-black">
                        Lembar Jawaban Siswa — {generatedData.subject}
                      </h4>
                      <p className="text-[10px] text-slate-600">
                        Kelas {generatedData.gradeClass} • {generatedData.academicYear}
                      </p>
                    </div>

                    <div className="border border-black p-1.5 text-[10.5px]">
                      Nama: ............................................................................
                    </div>

                    {/* Grid Pilihan Ganda */}
                    <div className="border border-black overflow-x-auto">
                      <table className="w-full text-[10.5px] border-collapse">
                        <tbody className="divide-y divide-black">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => {
                            const cols = [r, r + 10, r + 20];
                            return (
                              <tr key={`lj-row-${r}`}>
                                {cols.map((num, colIdx) => (
                                  <React.Fragment key={`lj-col-${num}`}>
                                    <td className="w-[8%] text-center font-bold bg-slate-100 border-r border-black p-0.5">
                                      {num}
                                    </td>
                                    <td className="w-[8%] text-center border-r border-black p-0.5">A</td>
                                    <td className="w-[8%] text-center border-r border-black p-0.5">B</td>
                                    <td className="w-[8%] text-center border-r border-black p-0.5">C</td>
                                    <td
                                      className={`w-[8%] text-center border-black p-0.5 ${
                                        colIdx === cols.length - 1 ? '' : 'border-r'
                                      }`}
                                    >
                                      D
                                    </td>
                                  </React.Fragment>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ZONE 3: STICKY MOBILE ACTION BAR (THUMB ZONE)                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer className="w-full shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg z-30">
        <div className="w-full max-w-lg mx-auto">
          {/* STEP 1 ACTIONS */}
          {step === 'PARAMS' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="h-12 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep('INPUT_CONTENT')}
                className="flex-1 h-12 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#023246]/20"
              >
                <span>Lanjut ke Input Konten</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2 ACTIONS */}
          {step === 'INPUT_CONTENT' && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep('PARAMS')}
                className="h-12 px-3.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Parameter</span>
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={onStartGeneration}
                className="flex-1 h-12 px-4 rounded-xl bg-linear-to-r from-teal-600 to-emerald-600 hover:brightness-105 active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-teal-700/25 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {keyAndMatrixMode === 'MANUAL'
                        ? 'Menyusun & Terapkan Kunci...'
                        : 'AI Menyusun Soal...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {keyAndMatrixMode === 'MANUAL'
                        ? '🚀 Buat Soal (Kunci & Kisi Manual)'
                        : '🚀 Buat Soal & Kunci AI'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 3 ACTIONS: QUICK TOOLBAR + PRIMARY SAVE CTA */}
          {step === 'PREVIEW_AND_ACTION' && (
            <div className="space-y-2">
              {/* Secondary Download & Print Toolbar */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={onDownloadPaperDocx}
                  className="h-10 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10.5px] font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                  title="Unduh File Word Naskah Soal"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span className="truncate">Word Soal</span>
                </button>

                <button
                  type="button"
                  onClick={onDownloadKeyAndKisiKisiDocx}
                  className="h-10 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10.5px] font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                  title="Unduh File Word Kunci & Kisi-Kisi"
                >
                  <Download className="w-3.5 h-3.5 text-amber-700" />
                  <span className="truncate">Word Kunci</span>
                </button>

                <button
                  type="button"
                  onClick={onPrintExamPaper}
                  className="h-10 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10.5px] font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                  title="Cetak Naskah Soal"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span className="truncate">Cetak</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('INPUT_CONTENT')}
                  className="h-10 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[10.5px] font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                  title="Buat Ulang Soal"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-teal-700" />
                  <span className="truncate">Ulang</span>
                </button>
              </div>

              {/* Primary CTA: Simpan ke Koreksi Soal */}
              <button
                type="button"
                disabled={isSavingToCorrection}
                onClick={onSaveAndOpenCorrection}
                className="w-full h-12 px-4 rounded-xl bg-linear-to-r from-[#023246] to-[#18536B] hover:brightness-110 active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#023246]/25 disabled:opacity-60"
              >
                {isSavingToCorrection ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan ke Koreksi Soal...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>Simpan &amp; Buka di Koreksi Soal</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
