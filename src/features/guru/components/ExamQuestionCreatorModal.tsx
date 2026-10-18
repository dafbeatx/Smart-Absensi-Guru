import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  FileText,
  Key,
  ClipboardList,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import type { UserProfile, ExamSessionRecord } from '../../../types/database.types';
import { OFFICIAL_SCHOOL_SUBJECTS } from '../../../config/school-subjects.config';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { useToastStore } from '../../../store/useToastStore';
import {
  ExamAiCreatorService,
  type ExamGenerationParams,
} from '../../../services/exam-ai-creator.service';
import {
  ExamPaperDocxService,
  type ExamPaperData,
} from '../../../services/exam-paper-docx.service';

interface ExamQuestionCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onOpenCorrectionWithSession?: (session: ExamSessionRecord) => void;
}

type WizardStep = 'PARAMS' | 'INPUT_CONTENT' | 'PREVIEW_AND_ACTION';
type PreviewTab = 'PAPER' | 'KEYS' | 'KISI_KISI';

const PREDEFINED_CLASSES = ['7', '8A', '8B', '9A', '9B', 'SMA'];

export const ExamQuestionCreatorModal: React.FC<ExamQuestionCreatorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenCorrectionWithSession,
}) => {
  const { showToast } = useToastStore();

  const [step, setStep] = useState<WizardStep>('PARAMS');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('PAPER');

  // Form State: Ditanyakan sebelum dibuat sesuai instruksi
  const [subject, setSubject] = useState<string>('Matematika');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [examType, setExamType] = useState<'ASTS' | 'ASAS' | 'ULANGAN_HARIAN'>('ASTS');
  const [academicYear, setAcademicYear] = useState<string>(() =>
    AdministrationRepository.getActiveAcademicYear() || '2026/2027'
  );
  const [semester, setSemester] = useState<'GANJIL' | 'GENAP'>('GANJIL');
  const [gradeClass, setGradeClass] = useState<string>('8A');
  const [category, setCategory] = useState<'EKSAK' | 'NON_EKSAK'>('EKSAK');
  const [mcqCount, setMcqCount] = useState<number>(25);
  const [essayCount, setEssayCount] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<number>(90);

  // Content Input State
  const [inputMode, setInputMode] = useState<'FROM_TOPIC' | 'PARSE_RAW_QUESTIONS'>('FROM_TOPIC');
  const [contentPrompt, setContentPrompt] = useState<string>('');

  // Result State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedData, setGeneratedData] = useState<ExamPaperData | null>(null);
  const [isSavingToCorrection, setIsSavingToCorrection] = useState<boolean>(false);
  // Lock body scroll saat modal aktif di mobile
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const effectiveSubject = subject === 'LAINNYA' ? (customSubject.trim() || 'Mata Pelajaran') : subject;

  // Handler auto-detect eksak vs non-eksak berdasarkan mapel
  const handleSubjectChange = (val: string) => {
    setSubject(val);
    const low = val.toLowerCase();
    if (low.includes('matematika') || low.includes('ipa') || low.includes('fisika') || low.includes('kimia') || low.includes('biologi')) {
      setCategory('EKSAK');
    } else {
      setCategory('NON_EKSAK');
    }
  };

  // Generate Action
  const handleStartGeneration = async () => {
    setIsGenerating(true);
    try {
      const params: ExamGenerationParams = {
        subject: effectiveSubject,
        examType,
        academicYear,
        semester,
        gradeClass,
        category,
        mcqCount,
        essayCount,
        durationMinutes,
        inputMode,
        contentPrompt: contentPrompt.trim(),
        teacherName: currentUser.full_name,
      };

      const result = await ExamAiCreatorService.generateExamPaper(params);
      setGeneratedData(result);
      setStep('PREVIEW_AND_ACTION');
      setPreviewTab('PAPER');
      showToast('success', 'Naskah Soal Berhasil Dibuat!', `${result.mcqQuestions.length} Soal PG & ${result.essayQuestions.length} Soal Essay siap ditinjau.`);
    } catch (err: any) {
      showToast('error', 'Gagal Membuat Soal', err?.message || 'Terjadi kesalahan saat memproses AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Word Naskah Soal
  const handleDownloadPaperDocx = () => {
    if (!generatedData) return;
    const filename = `NASKAH_SOAL_${generatedData.examType}_${generatedData.subject}_KELAS_${generatedData.gradeClass}_${generatedData.academicYear.replace('/', '-')}`;
    const html = ExamPaperDocxService.generateExamPaperWordHtml(generatedData);
    ExamPaperDocxService.downloadAsWordFile(filename, html);
    showToast('success', 'File Word Terunduh', 'Naskah soal resmi format .doc berhasil disimpan.');
  };

  // Download Word Kunci & Kisi-Kisi
  const handleDownloadKeyAndKisiKisiDocx = () => {
    if (!generatedData) return;
    const filename = `KUNCI_DAN_KISIKISI_${generatedData.examType}_${generatedData.subject}_KELAS_${generatedData.gradeClass}_${generatedData.academicYear.replace('/', '-')}`;
    const html = ExamPaperDocxService.generateAnswerKeyAndKisiKisiWordHtml(generatedData);
    ExamPaperDocxService.downloadAsWordFile(filename, html);
    showToast('success', 'Kunci & Kisi-Kisi Terunduh', 'File kunci jawaban & kisi-kisi format .doc berhasil disimpan.');
  };

  // Simpan ke Koreksi Soal
  const handleSaveAndOpenCorrection = async () => {
    if (!generatedData) return;
    setIsSavingToCorrection(true);
    try {
      // Ambil daftar siswa kelas terkait
      let studentList: string[] = [];
      try {
        const students = await StudentRepository.getStudentsByClass(gradeClass);
        if (Array.isArray(students) && students.length > 0) {
          studentList = students.map((s) => s.fullName);
        }
      } catch {
        studentList = [];
      }

      // Kunci jawaban PG otomatis dari naskah
      const answerKey = generatedData.mcqQuestions.map((q) => q.correctAnswer);

      const sessionName = `${generatedData.examType} ${generatedData.subject} Kelas ${generatedData.gradeClass} (${generatedData.academicYear})`;

      const newSession = await ExamCorrectionRepository.saveSession({
        session_name: sessionName,
        teacher: currentUser.full_name,
        subject: generatedData.subject,
        class_name: generatedData.gradeClass,
        school_level: 'SMP',
        answer_key: answerKey,
        student_list: studentList,
        scoring_config: {
          pgWeight: generatedData.category === 'EKSAK' ? 0.6 : 0.7,
          essayWeight: generatedData.category === 'EKSAK' ? 0.4 : 0.3,
          essayMaxScore: Math.round(100 / Math.max(1, generatedData.essayQuestions.length)),
          essayCount: generatedData.essayQuestions.length,
        },
        exam_type: generatedData.examType,
        academic_year: generatedData.academicYear,
        semester: generatedData.semester,
        kkm: 75,
      });

      showToast(
        'success',
        'Tersimpan di Koreksi Soal!',
        `Sesi "${sessionName}" berhasil dibuat dengan ${answerKey.length} kunci jawaban otomatis.`
      );

      onClose();

      if (typeof onOpenCorrectionWithSession === 'function') {
        onOpenCorrectionWithSession(newSession);
      }
    } catch (err: any) {
      showToast('error', 'Gagal Menyimpan Sesi', err?.message || 'Tidak dapat menyimpan sesi ke koreksi soal.');
    } finally {
      setIsSavingToCorrection(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-creator-title"
      className="fixed inset-0 z-[100] w-screen h-screen bg-[#F8FAFC] flex flex-col overflow-hidden font-sans select-none sm:select-auto"
    >
      {/* Full-width Workspace Top Navigation */}
      <header className="bg-[#023246] text-white px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between shrink-0 shadow-md border-b border-teal-900/50 pt-[max(10px,env(safe-area-inset-top))] z-30">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/15 shrink-0"
            title="Kembali ke Dashboard / Administrasi"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-5 w-px bg-white/20 hidden sm:block" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-teal-400 to-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-sm sm:text-base lg:text-lg tracking-tight leading-tight truncate">
                  Pembuat Soal &amp; Kisi-Kisi AI
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-teal-400/25 text-teal-200 border border-teal-300/30 text-[9.5px] font-black uppercase tracking-wider hidden sm:inline-block">
                  KOP SMPT Al-Ittihadiyah
                </span>
              </div>
              <p className="text-[11px] text-cyan-100/80 mt-0.5 truncate hidden sm:block">
                Otomatis naskah soal resmi, kunci jawaban &amp; kisi-kisi terintegrasi koreksi lembar ujian
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-transparent hover:border-white/15"
            title="Tutup Workspace"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </header>

      {/* Step Progress Tracker */}
      <div className="bg-white border-b border-slate-200/90 px-3.5 sm:px-6 lg:px-8 py-2.5 shrink-0 shadow-2xs">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === 'PARAMS' ? 'bg-[#023246] text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              1
            </span>
            <span className={`font-bold ${step === 'PARAMS' ? 'text-slate-900' : 'text-slate-500'}`}>
              Parameter Ujian
            </span>
          </div>
          <div className="h-0.5 w-10 sm:w-16 bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === 'INPUT_CONTENT'
                  ? 'bg-[#023246] text-white'
                  : step === 'PREVIEW_AND_ACTION'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              2
            </span>
            <span className={`font-bold ${step === 'INPUT_CONTENT' ? 'text-slate-900' : 'text-slate-500'}`}>
              Input Materi / Draft Soal
            </span>
          </div>
          <div className="h-0.5 w-10 sm:w-16 bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === 'PREVIEW_AND_ACTION' ? 'bg-[#023246] text-white' : 'bg-slate-300 text-slate-700'
              }`}
            >
              3
            </span>
            <span className={`font-bold ${step === 'PREVIEW_AND_ACTION' ? 'text-slate-900' : 'text-slate-500'}`}>
              Preview &amp; Koreksi
            </span>
          </div>
        </div>
      </div>

      {/* Full-width Workspace Scroll Canvas */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-6 lg:p-8 bg-[#F1F5F9] custom-scrollbar space-y-6">
        <div className="max-w-4xl mx-auto w-full space-y-5 pb-8">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* LANGKAH 1: PARAMETER UJIAN                                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'PARAMS' && (
            <div className="space-y-4 max-w-2xl mx-auto animate-fadeIn">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    1. Konfigurasi Dokumen &amp; Mata Pelajaran
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tentukan identitas naskah soal sesuai standar fisik SMP Terpadu Al-Ittihadiyah.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Mata Pelajaran */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    >
                      {OFFICIAL_SCHOOL_SUBJECTS.map((s) => (
                        <option key={s.code} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                      <option value="LAINNYA">+ Mata Pelajaran Lainnya...</option>
                    </select>
                  </div>

                  {/* Kategori Mapel */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kategori Bidang Studi <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCategory('EKSAK')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          category === 'EKSAK'
                            ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📐 Eksak (60:40)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategory('NON_EKSAK')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          category === 'NON_EKSAK'
                            ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        📖 Non-Eksak (70:30)
                      </button>
                    </div>
                  </div>

                  {subject === 'LAINNYA' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Ketik Nama Mata Pelajaran
                      </label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Contoh: Tahfidz Al-Qur'an, Robotika, dll."
                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>
                  )}

                  {/* Jenis Asesmen / Ujian */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Jenis Asesmen Ujian <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setExamType('ASTS')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          examType === 'ASTS'
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ASTS (Tengah Sem.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamType('ASAS')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          examType === 'ASAS'
                            ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ASAS (Akhir Sem.)
                      </button>
                    </div>
                  </div>

                  {/* Tingkat & Rombel Kelas */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tingkat &amp; Kelas <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={gradeClass}
                      onChange={(e) => setGradeClass(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    >
                      {PREDEFINED_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          Kelas {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tahun Ajaran */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tahun Ajaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                    >
                      <option value="2026/2027">2026/2027 (Tahun Aktif)</option>
                      <option value="2025/2026">2025/2026 (Arsip)</option>
                      <option value="2027/2028">2027/2028</option>
                    </select>
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Semester <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSemester('GANJIL')}
                        className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          semester === 'GANJIL'
                            ? 'bg-[#023246] text-white border-[#023246]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Semester Ganjil
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
                        Semester Genap
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Komposisi Butir Soal */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    2. Komposisi Butir Soal &amp; Alokasi Waktu
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tentukan jumlah butir soal pilihan ganda dan uraian yang akan digenerate.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Jumlah Pilihan Ganda (PG)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[15, 20, 25, 30].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMcqCount(num)}
                          className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            mcqCount === num
                              ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Jumlah Soal Uraian (Essay)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setEssayCount(num)}
                          className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            essayCount === num
                              ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num} Soal
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Alokasi Waktu Ujian
                    </label>
                    <select
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                    >
                      <option value={60}>60 Menit</option>
                      <option value={90}>90 Menit (Standar)</option>
                      <option value={120}>120 Menit</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* LANGKAH 2: INPUT KONTEN MATERI / DRAFT SOAL                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'INPUT_CONTENT' && (
            <div className="space-y-4 max-w-2xl mx-auto animate-fadeIn">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    Pilih Metode Pembuatan Soal
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Anda dapat menempelkan draft soal mentah Anda, atau biarkan AI membuat soal dari materi/bab KBM.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setInputMode('FROM_TOPIC')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      inputMode === 'FROM_TOPIC'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">✨</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Generate dari Materi / Bab KBM
                      </strong>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Cukup ketik topik atau ringkasan materi, AI menyusun butir soal PG, essay, kunci, dan kisi-kisi.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setInputMode('PARSE_RAW_QUESTIONS')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      inputMode === 'PARSE_RAW_QUESTIONS'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">📋</span>
                    <div className="min-w-0">
                      <strong className="text-xs font-black text-slate-900 block">
                        Kirim Draft Soal Mentah Saya
                      </strong>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Tempelkan teks soal mentah dari Word/catatan. AI merapikan format KOP, membuat kunci dan kisi-kisi.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {inputMode === 'FROM_TOPIC'
                      ? 'Tuliskan Materi Pokok / Capaian Pembelajaran (CP):'
                      : 'Tempelkan Teks Soal Mentah Pilihan Ganda & Essay:'}
                  </label>
                  <textarea
                    rows={8}
                    value={contentPrompt}
                    onChange={(e) => setContentPrompt(e.target.value)}
                    placeholder={
                      inputMode === 'FROM_TOPIC'
                        ? `Contoh:\nMateri Pembelajaran ${effectiveSubject} Kelas ${gradeClass}:\n1. Bab 1: Konsep dasar dan definisi penting...\n2. Bab 2: Rumus perhitungan dan penerapannya...\n3. Bab 3: Studi kasus dan pemecahan masalah kontekstual...`
                        : `Contoh Format Soal Mentah:\n1. Pertanyaan soal nomor satu...\nA. Pilihan satu\nB. Pilihan dua\nC. Pilihan tiga\nD. Pilihan empat\n\nEssay:\n1. Jelaskan secara lengkap...`
                    }
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#023246]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Tip: Semakin jelas materi atau teks soal yang Anda masukkan, semakin presisi kunci jawaban dan kisi-kisi yang dihasilkan AI.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* LANGKAH 3: PREVIEW HASIL GENERATE & DOWNLOAD / KOREKSI     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === 'PREVIEW_AND_ACTION' && generatedData && (
            <div className="space-y-4 animate-fadeIn">
              {/* Tab Selector */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('PAPER')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewTab === 'PAPER'
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>1. Naskah Soal Resmi (KOP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('KEYS')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewTab === 'KEYS'
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>2. Kunci Jawaban &amp; Rubrik</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('KISI_KISI')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewTab === 'KISI_KISI'
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>3. Matriks Kisi-Kisi</span>
                  </button>
                </div>

                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{generatedData.mcqQuestions.length} PG + {generatedData.essayQuestions.length} Essay Siap</span>
                </span>
              </div>

              {/* Preview Content Area */}
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs max-h-[55vh] overflow-y-auto">
                {/* 1. PREVIEW NASKAH SOAL */}
                {previewTab === 'PAPER' && (
                  <div className="space-y-4 font-serif text-slate-900 leading-normal">
                    {/* Header KOP Resmi */}
                    <div className="text-center border-b-2 border-slate-900 pb-3">
                      <p className="text-xs font-bold tracking-wider uppercase text-slate-700">
                        {generatedData.foundationName}
                      </p>
                      <h3 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950 mt-0.5">
                        {generatedData.institutionName}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Jl. Raya Cibungbulang - Ciampea, Kab. Bogor, Jawa Barat • Telp: (0251) 8624123
                      </p>
                      <div className="border-t-2 border-b border-slate-900 my-2 h-1"></div>
                      <h4 className="text-xs sm:text-sm font-bold uppercase text-slate-900">
                        {generatedData.examTypeLabel}
                      </h4>
                      <p className="text-xs font-bold uppercase text-slate-800">
                        SEMESTER {generatedData.semester} • TAHUN AJARAN {generatedData.academicYear}
                      </p>
                    </div>

                    {/* Meta Table */}
                    <div className="grid grid-cols-2 text-xs border border-slate-300 p-2.5 rounded-lg bg-slate-50/50 gap-2 font-sans">
                      <div>
                        <span className="text-slate-500">Mata Pelajaran:</span>{' '}
                        <strong>{generatedData.subject}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Kelas:</span>{' '}
                        <strong>{generatedData.gradeClass}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Alokasi Waktu:</span>{' '}
                        <strong>{generatedData.durationMinutes} Menit</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Kategori:</span>{' '}
                        <strong>{generatedData.category === 'EKSAK' ? 'Eksak (60:40)' : 'Non-Eksak (70:30)'}</strong>
                      </div>
                    </div>

                    {/* Bagian A: Pilihan Ganda */}
                    <div className="pt-2">
                      <h5 className="font-sans text-xs font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-3">
                        A. Soal Pilihan Ganda ({generatedData.mcqQuestions.length} Butir)
                      </h5>
                      <div className="space-y-3.5">
                        {generatedData.mcqQuestions.map((q) => (
                          <div key={q.number} className="text-xs leading-relaxed">
                            <p className="font-semibold text-slate-900">
                              {q.number}. {q.question}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1 pl-4 text-slate-700">
                              <span><strong>A.</strong> {q.options.A}</span>
                              <span><strong>B.</strong> {q.options.B}</span>
                              <span><strong>C.</strong> {q.options.C}</span>
                              <span><strong>D.</strong> {q.options.D}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bagian B: Essay */}
                    {generatedData.essayQuestions.length > 0 && (
                      <div className="pt-4 border-t border-slate-200">
                        <h5 className="font-sans text-xs font-black uppercase text-slate-900 border-b border-slate-200 pb-1 mb-3">
                          B. Soal Uraian / Essay ({generatedData.essayQuestions.length} Butir)
                        </h5>
                        <div className="space-y-3">
                          {generatedData.essayQuestions.map((eq) => (
                            <div key={eq.number} className="text-xs leading-relaxed">
                              <p className="font-semibold text-slate-900">
                                {eq.number}. {eq.question}
                                <span className="text-[10.5px] text-slate-400 font-sans ml-1 italic">
                                  (Skor Maks: {eq.maxScore})
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. PREVIEW KUNCI JAWABAN & RUBRIK */}
                {previewTab === 'KEYS' && (
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-black text-slate-900 uppercase mb-2">
                        Kunci Jawaban Pilihan Ganda ({generatedData.mcqQuestions.length} Soal)
                      </h5>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {generatedData.mcqQuestions.map((q) => (
                          <div
                            key={q.number}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center"
                          >
                            <span className="text-[10px] text-slate-400 font-bold block">{q.number}</span>
                            <span className="text-sm font-black text-teal-800">{q.correctAnswer}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {generatedData.essayQuestions.length > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <h5 className="text-xs font-black text-slate-900 uppercase mb-2">
                          Rubrik Penskoran Soal Uraian / Essay
                        </h5>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="divide-y divide-slate-100">
                            {generatedData.essayQuestions.map((eq) => (
                              <div key={eq.number} className="p-3 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-slate-900">Nomor {eq.number}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold text-[10px]">
                                    Maks {eq.maxScore} Poin
                                  </span>
                                </div>
                                <p className="text-slate-600 font-serif">{eq.question}</p>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 mt-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Kriteria Jawaban Diharapkan:</span>
                                  <p className="text-[11px] text-slate-800 mt-0.5 leading-relaxed">{eq.expectedAnswer}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. PREVIEW KISI-KISI ASESMEN */}
                {previewTab === 'KISI_KISI' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                          <th className="p-2 text-center w-10">No</th>
                          <th className="p-2">Materi Pokok</th>
                          <th className="p-2">Indikator Pencapaian Kompetensi</th>
                          <th className="p-2 text-center">Bentuk</th>
                          <th className="p-2 text-center">Level</th>
                          <th className="p-2 text-center">Kunci</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {generatedData.mcqQuestions.map((q) => (
                          <tr key={`kisi-mcq-${q.number}`} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-bold">{q.number}</td>
                            <td className="p-2 font-medium text-slate-800">{q.topic || generatedData.subject}</td>
                            <td className="p-2 text-slate-600">{q.indicator}</td>
                            <td className="p-2 text-center font-semibold text-teal-700">PG</td>
                            <td className="p-2 text-center text-slate-500">{q.cognitiveLevel || 'L2 (C3)'}</td>
                            <td className="p-2 text-center font-black text-slate-900">{q.correctAnswer}</td>
                          </tr>
                        ))}
                        {generatedData.essayQuestions.map((eq) => (
                          <tr key={`kisi-essay-${eq.number}`} className="hover:bg-slate-50 bg-teal-50/20">
                            <td className="p-2 text-center font-bold">U-{eq.number}</td>
                            <td className="p-2 font-medium text-slate-800">{eq.topic || generatedData.subject}</td>
                            <td className="p-2 text-slate-600">{eq.indicator}</td>
                            <td className="p-2 text-center font-semibold text-blue-700">Essay</td>
                            <td className="p-2 text-center text-slate-500">{eq.cognitiveLevel || 'L3 (C4)'}</td>
                            <td className="p-2 text-center font-bold text-slate-700">{eq.maxScore} pts</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="w-full shrink-0 bg-white border-t border-slate-200 px-3.5 sm:px-6 lg:px-8 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-lg z-30">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-3 flex-wrap">
          {step === 'PARAMS' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep('INPUT_CONTENT')}
                className="h-10 px-5 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Lanjut ke Input Konten</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'INPUT_CONTENT' && (
            <>
              <button
                type="button"
                onClick={() => setStep('PARAMS')}
                className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ubah Parameter</span>
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleStartGeneration}
                className="h-10 px-5 rounded-xl bg-linear-to-r from-teal-600 to-emerald-600 hover:brightness-105 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>AI Sedang Menyusun Soal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>🚀 Buat Soal &amp; Kunci Sekarang</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'PREVIEW_AND_ACTION' && (
            <>
              <button
                type="button"
                onClick={() => setStep('INPUT_CONTENT')}
                className="h-10 px-3.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Buat Ulang</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadPaperDocx}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download File Word (.doc) Naskah Soal"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>Word Soal</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadKeyAndKisiKisiDocx}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download File Word (.doc) Kunci & Kisi-Kisi"
                >
                  <Download className="w-3.5 h-3.5 text-amber-700" />
                  <span>Word Kunci &amp; Kisi-Kisi</span>
                </button>

                {/* Sesuai Instruksi User: Otomatis tersimpan dan langsung muncul di koreksi soal */}
                <button
                  type="button"
                  disabled={isSavingToCorrection}
                  onClick={handleSaveAndOpenCorrection}
                  className="h-10 px-4.5 rounded-xl bg-linear-to-r from-[#023246] to-[#18536B] hover:brightness-110 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-60"
                >
                  {isSavingToCorrection ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan ke Koreksi...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4 text-emerald-400" />
                      <span>Simpan &amp; Buka di Koreksi Soal</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
};
