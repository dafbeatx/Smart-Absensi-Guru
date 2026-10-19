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
  Copy,
  Printer,
  TableProperties,
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
import { KOP_LOGO_BASE64 } from '../../../assets/kop-logo.base64';

import {
  ExamQuestionCreatorMobileView,
  type WizardStep,
  type PreviewTab,
} from './ExamQuestionCreatorMobileView';

interface ExamQuestionCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onOpenCorrectionWithSession?: (session: ExamSessionRecord) => void;
}

export const EXAMPLE_MCQ_TEMPLATE = `A. SOAL PILIHAN GANDA
1. Hasil dari operasi hitung 24 + 16 × 2 adalah...
A. 80
B. 56
C. 48
D. 40

2. Suatu zat memiliki massa jenis 2,5 g/cm³ dan volume 40 cm³. Berapakah massa total zat tersebut?
A. 100 gram
B. 80 gram
C. 60 gram
D. 50 gram

3. Salah satu ciri makhluk hidup adalah peka terhadap rangsang yang disebut dengan istilah...
A. Iritabilitas
B. Adaptasi
C. Respirasi
D. Ekskresi

4. Perhatikan pernyataan berikut: "Mempertahankan integritas dan kejujuran dalam menuntut ilmu." Contoh penerapan nilai tersebut di sekolah adalah...
A. Mencontek saat ujian berlangsung
B. Mengakui kesalahan dan mengerjakan tugas secara mandiri
C. Datang terlambat setiap hari
D. Tidak mematuhi tata tertib kelas

5. Organ pernapasan manusia yang berfungsi sebagai tempat pertukaran oksigen dan karbondioksida adalah...
A. Trakea
B. Bronkus
C. Alveolus
D. Laring`;

export const EXAMPLE_ESSAY_TEMPLATE = `B. SOAL URAIAN (ESSAY)
1. Jelaskan perbedaan mendasar antara perubahan fisika dan perubahan kimia, serta sebutkan masing-masing 2 contoh peristiwanya dalam kehidupan sehari-hari!
2. Hitunglah luas permukaan sebuah tabung yang memiliki jari-jari alas 7 cm dan tinggi 20 cm! (Gunakan π = 22/7)`;

export const EXAMPLE_RAW_QUESTIONS_TEMPLATE = `${EXAMPLE_MCQ_TEMPLATE}\n\n${EXAMPLE_ESSAY_TEMPLATE}`;

const PREDEFINED_CLASSES = ['7', '8', '9', 'SMA'];

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
  const [gradeClass, setGradeClass] = useState<string>('8');
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
  // View mode state with localStorage persistence & responsive auto-detect (default MOBILE for screen < 1024px / Infinix Note 8)
  const [viewMode, setViewMode] = useState<'DESKTOP' | 'MOBILE'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smart_absensi_ai_creator_view_mode');
      if (saved === 'DESKTOP' || saved === 'MOBILE') return saved;
      return window.innerWidth < 1024 ? 'MOBILE' : 'DESKTOP';
    }
    return 'DESKTOP';
  });

  const handleSetViewMode = (mode: 'DESKTOP' | 'MOBILE') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_absensi_ai_creator_view_mode', mode);
    }
  };

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

  // Salin Naskah Teks Lengkap ke Clipboard
  const handleCopyPlainTextPaper = async () => {
    if (!generatedData) return;
    try {
      const text = ExamPaperDocxService.generatePlainTextExamPaper(generatedData);
      await navigator.clipboard.writeText(text);
      showToast('success', 'Naskah Soal Berhasil Disalin!', 'Format tersusun rapi dengan penomoran otomatis siap ditempel ke Microsoft Word atau Google Docs.');
    } catch {
      showToast('error', 'Gagal Menyalin', 'Tidak dapat menyalin naskah soal ke clipboard.');
    }
  };

  // Salin Contoh Format Soal Pilihan Ganda (PG)
  const handleCopyMcqExample = async () => {
    try {
      await navigator.clipboard.writeText(EXAMPLE_MCQ_TEMPLATE);
      showToast('success', 'Format Soal PG Disalin!', 'Contoh format soal pilihan ganda (PG) berhasil disalin ke clipboard.');
    } catch {
      showToast('error', 'Gagal Menyalin', 'Tidak dapat menyalin format contoh PG ke clipboard.');
    }
  };

  // Salin Contoh Format Soal Uraian (Essay)
  const handleCopyEssayExample = async () => {
    try {
      await navigator.clipboard.writeText(EXAMPLE_ESSAY_TEMPLATE);
      showToast('success', 'Format Soal Essay Disalin!', 'Contoh format soal uraian (essay) berhasil disalin ke clipboard.');
    } catch {
      showToast('error', 'Gagal Menyalin', 'Tidak dapat menyalin format contoh Essay ke clipboard.');
    }
  };

  // Salin Contoh Format Soal Mentah Lengkap (PG + Essay)
  const handleCopyExampleTemplate = async () => {
    try {
      await navigator.clipboard.writeText(EXAMPLE_RAW_QUESTIONS_TEMPLATE);
      showToast('success', 'Format Lengkap Disalin!', 'Contoh format soal PG dan Essay berhasil disalin ke clipboard.');
    } catch {
      showToast('error', 'Gagal Menyalin', 'Tidak dapat menyalin format contoh ke clipboard.');
    }
  };

  // Terapkan Contoh Format Soal Mentah ke Textarea
  const handleApplyExampleTemplate = () => {
    setContentPrompt(EXAMPLE_RAW_QUESTIONS_TEMPLATE);
    showToast('success', 'Format Contoh Diterapkan!', 'Format acuan soal PG dan Essay telah dimuat ke kotak isian.');
  };

  // Cetak Naskah Soal Langsung
  const handlePrintExamPaper = () => {
    if (!generatedData) return;
    ExamPaperDocxService.printExamPaper(generatedData);
    showToast('info', 'Membuka Jendela Cetak', 'Format 2 kolom Times New Roman siap dicetak.');
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

  // Render Mobile View dedicated for Infinix Note 8 & Smartphones
  if (viewMode === 'MOBILE') {
    return createPortal(
      <ExamQuestionCreatorMobileView
        onClose={onClose}
        currentUser={currentUser}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        step={step}
        setStep={setStep}
        previewTab={previewTab}
        setPreviewTab={setPreviewTab}
        subject={subject}
        setSubject={setSubject}
        customSubject={customSubject}
        setCustomSubject={setCustomSubject}
        examType={examType}
        setExamType={setExamType}
        academicYear={academicYear}
        setAcademicYear={setAcademicYear}
        semester={semester}
        setSemester={setSemester}
        gradeClass={gradeClass}
        setGradeClass={setGradeClass}
        category={category}
        setCategory={setCategory}
        mcqCount={mcqCount}
        setMcqCount={setMcqCount}
        essayCount={essayCount}
        setEssayCount={setEssayCount}
        durationMinutes={durationMinutes}
        setDurationMinutes={setDurationMinutes}
        inputMode={inputMode}
        setInputMode={setInputMode}
        contentPrompt={contentPrompt}
        setContentPrompt={setContentPrompt}
        isGenerating={isGenerating}
        generatedData={generatedData}
        effectiveSubject={effectiveSubject}
        onStartGeneration={handleStartGeneration}
        onCopyPlainTextPaper={handleCopyPlainTextPaper}
        onCopyMcqExample={handleCopyMcqExample}
        onCopyEssayExample={handleCopyEssayExample}
        onCopyExampleTemplate={handleCopyExampleTemplate}
        onApplyExampleTemplate={handleApplyExampleTemplate}
        onPrintExamPaper={handlePrintExamPaper}
        onDownloadPaperDocx={handleDownloadPaperDocx}
        onDownloadKeyAndKisiKisiDocx={handleDownloadKeyAndKisiKisiDocx}
        onSaveAndOpenCorrection={handleSaveAndOpenCorrection}
        isSavingToCorrection={isSavingToCorrection}
      />,
      document.body
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-creator-title"
      className="fixed inset-0 z-100 w-screen h-screen bg-[#F8FAFC] flex flex-col overflow-hidden font-sans select-none sm:select-auto"
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
          {/* View Mode Switcher [ 📱 HP ] [ 💻 PC ] */}
          <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => handleSetViewMode('MOBILE')}
              className="px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer text-white/70 hover:text-white"
              title="Mode Mobile (Layar Sentuh HP & Infinix Note 8)"
            >
              <span>📱 HP</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('DESKTOP')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer bg-white text-slate-950 shadow-xs"
              title="Mode Desktop (Layar Lebar)"
            >
              <span>💻 PC</span>
            </button>
          </div>

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

                  {/* Tingkat & Kelas (Satu Angkatan) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Tingkat &amp; Kelas <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        Satu Angkatan
                      </span>
                    </div>
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
                    <p className="text-[10px] text-slate-500 mt-1">
                      Soal, kunci jawaban, dan kisi-kisi mencakup satu angkatan. Rombel dipisah saat koreksi &amp; input nilai.
                    </p>
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
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <label className="block text-xs font-bold text-slate-700">
                      {inputMode === 'FROM_TOPIC'
                        ? 'Tuliskan Materi Pokok / Capaian Pembelajaran (CP):'
                        : 'Tempelkan Teks Soal Mentah Pilihan Ganda & Essay:'}
                    </label>

                    {inputMode === 'PARSE_RAW_QUESTIONS' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleCopyExampleTemplate}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                          title="Salin contoh lengkap soal PG & Essay ke clipboard"
                        >
                          <Copy className="w-3.5 h-3.5 text-teal-600" />
                          <span>Salin Contoh</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyMcqExample}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                          title="Salin contoh format soal Pilihan Ganda (PG) saja"
                        >
                          <Copy className="w-3 h-3 text-emerald-600" />
                          <span>Salin PG</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyEssayExample}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                          title="Salin contoh format soal Uraian / Essay saja"
                        >
                          <Copy className="w-3 h-3 text-amber-600" />
                          <span>Salin Essay</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyExampleTemplate}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-800 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-teal-200 shadow-2xs"
                          title="Gunakan format contoh ini langsung ke kotak isian"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          <span>Gunakan Contoh</span>
                        </button>
                      </div>
                    )}
                  </div>

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

                  {inputMode === 'PARSE_RAW_QUESTIONS' && (
                    <div className="mt-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 text-xs text-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-bold text-teal-900 text-[11.5px] flex items-center gap-1">
                          <span>💡 Acuan Format Baku (Otomatis Dikenali AI &amp; Parser):</span>
                        </span>
                        <span className="text-[10.5px] text-teal-700 font-semibold bg-white px-2 py-0.5 rounded border border-teal-200">
                          Times New Roman • 2 Kolom
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700 leading-relaxed font-mono bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-sans italic mb-1 flex-wrap gap-1">
                          <span>// Soal Pilihan Ganda (Penomoran 1, 2, 3... Opsi A, B, C, D):</span>
                          <button
                            type="button"
                            onClick={handleCopyMcqExample}
                            className="text-[10px] not-italic font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Copy className="w-2.5 h-2.5" /> Salin Format PG
                          </button>
                        </div>
                        <p>1. Pertanyaan soal nomor satu...</p>
                        <p className="pl-3">A. Pilihan jawaban A</p>
                        <p className="pl-3">B. Pilihan jawaban B</p>
                        <p className="pl-3">C. Pilihan jawaban C</p>
                        <p className="pl-3">D. Pilihan jawaban D</p>
                        <div className="flex items-center justify-between text-slate-400 font-sans italic my-1 pt-1.5 border-t border-slate-100 flex-wrap gap-1">
                          <span>// Soal Uraian / Essay (Penomoran 1, 2, 3...):</span>
                          <button
                            type="button"
                            onClick={handleCopyEssayExample}
                            className="text-[10px] not-italic font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Copy className="w-2.5 h-2.5" /> Salin Format Essay
                          </button>
                        </div>
                        <p>B. SOAL URAIAN (ESSAY)</p>
                        <p>1. Pertanyaan uraian nomor satu...</p>
                      </div>
                      <p className="text-[10.5px] text-slate-500">
                        *AI akan otomatis merapikan format ke font <strong>Times New Roman</strong> dua kolom, menata penomoran otomatis seperti Microsoft Word, serta membuat kunci jawaban &amp; kisi-kisi resmi.
                      </p>
                    </div>
                  )}

                  {inputMode === 'FROM_TOPIC' && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tip: Semakin jelas materi atau teks soal yang Anda masukkan, semakin presisi kunci jawaban dan kisi-kisi yang dihasilkan AI.
                    </p>
                  )}
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('PAPER')}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
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
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewTab === 'KISI_KISI'
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>3. Matriks Kisi-Kisi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('LEMBAR_JAWABAN')}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewTab === 'LEMBAR_JAWABAN'
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>4. Lembar Jawaban Siswa</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{generatedData.mcqQuestions.length} PG + {generatedData.essayQuestions.length} Essay Siap</span>
                  </span>

                  {(previewTab === 'PAPER' || previewTab === 'LEMBAR_JAWABAN') && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyPlainTextPaper}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Salin teks naskah soal lengkap ke clipboard"
                      >
                        <Copy className="w-3 h-3 text-teal-600" />
                        <span>Salin Naskah</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintExamPaper}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Cetak Naskah Soal & Lembar Jawaban (Format Times New Roman)"
                      >
                        <Printer className="w-3 h-3 text-slate-700" />
                        <span>Cetak</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Content Area */}
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs max-h-[55vh] overflow-y-auto">
                {/* 1. PREVIEW NASKAH SOAL */}
                {previewTab === 'PAPER' && (
                  <div
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                    className="exam-paper-times-new-roman space-y-4 text-black leading-normal"
                  >
                    {/* Header KOP Resmi Persis Berkas Word Docx */}
                    <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                      <div className="shrink-0 w-16 sm:w-20">
                        <img
                          src="/kop-soal-logo.jpeg"
                          alt="Logo Al-Ittihadiyah"
                          className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = KOP_LOGO_BASE64;
                          }}
                        />
                      </div>
                      <div className="flex-1 text-center px-2">
                        <h3 className="text-xs sm:text-sm md:text-base font-bold tracking-normal uppercase text-black leading-tight">
                          {generatedData.examType === 'ASTS'
                            ? `ASESMEN SUMATIF TENGAH SEMESTER (ASTS) ${generatedData.semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`
                            : `ASESMEN SUMATIF AKHIR SEMESTER (ASAS) ${generatedData.semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`}
                        </h3>
                        <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-normal uppercase text-black mt-0.5 leading-tight">
                          {generatedData.institutionName}
                        </h2>
                        <h4 className="text-xs sm:text-sm md:text-base font-bold uppercase text-black mt-0.5 leading-tight">
                          TAHUN {generatedData.academicYear}
                        </h4>
                      </div>
                      <div className="shrink-0 w-16 sm:w-20 hidden sm:block"></div>
                    </div>

                    {/* Tabel Metadata Persis Sesuai Berkas Docx */}
                    <table className="w-full text-xs font-serif text-black border-collapse my-2">
                      <tbody>
                        <tr>
                          <td className="w-[18%] font-bold py-1">Mata Pelajaran</td>
                          <td className="w-[32%] font-bold py-1">: {generatedData.subject}</td>
                          <td className="w-[18%] font-bold py-1">Nama Siswa</td>
                          <td className="w-[32%] py-1">: ........................................</td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1">Kelas/ Semester</td>
                          <td className="font-bold py-1">: Kelas {generatedData.gradeClass}/{generatedData.semester === 'GANJIL' ? 'Semester I' : 'Semester II'}</td>
                          <td className="font-bold py-1">Hari/ Tanggal</td>
                          <td className="py-1">: ........................................</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Petunjuk Umum */}
                    <div className="border border-black p-2 text-[11px] leading-relaxed bg-slate-50/40">
                      <strong>PETUNJUK UMUM:</strong>
                      <ol className="list-decimal pl-4 mt-0.5 space-y-0.5">
                        <li>Berdoalah sebelum mengerjakan soal!</li>
                        <li>Tuliskan nama lengkap dan kelas pada lembar jawaban yang tersedia!</li>
                        <li>Dahulukan menjawab soal-soal yang Anda anggap lebih mudah!</li>
                        <li>Periksalah kembali seluruh pekerjaan Anda sebelum diserahkan kepada pengawas ujian!</li>
                      </ol>
                    </div>

                    {/* Bagian A: Pilihan Ganda (TATA LETAK DUA KOLOM TIMES NEW ROMAN) */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between border-b border-black pb-1 mb-3">
                        <h4 className="text-xs sm:text-sm font-bold uppercase text-black">
                          Pilihan Ganda ({generatedData.mcqQuestions.length} Butir Soal)
                        </h4>
                        <span className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-sans">
                          Format 2 Kolom Times New Roman
                        </span>
                      </div>
                      <p className="text-[10.5px] italic text-slate-700 mb-3">
                        Pilihlah salah satu jawaban yang paling tepat dengan memberi tanda silang (X) pada huruf A, B, C, atau D pada lembar jawaban!
                      </p>

                      {/* Kontainer Dua Kolom Berdampingan */}
                      <div className="columns-1 md:columns-2 gap-6 [column-rule:1px_solid_#cbd5e1] text-justify">
                        {generatedData.mcqQuestions.map((q) => (
                          <div
                            key={q.number}
                            className="break-inside-avoid mb-4 text-xs leading-relaxed"
                          >
                            <p className="font-bold text-black">
                              {q.number}. {q.question}
                            </p>
                            <div className="mt-1 pl-4 space-y-0.5 text-black">
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
                    <div className="pt-4 border-t-2 border-black">
                      <h4 className="text-xs sm:text-sm font-bold uppercase text-black border-b border-black pb-1 mb-2">
                        Essay ({generatedData.essayQuestions.length} Butir Soal)
                      </h4>
                      <p className="text-[10.5px] italic text-slate-700 mb-3">
                        Jawablah pertanyaan-pertanyaan berikut dengan jelas, lengkap, runtut, dan benar!
                      </p>
                      <div className="space-y-3">
                        {generatedData.essayQuestions.map((eq) => (
                          <div
                            key={eq.number}
                            className="text-xs leading-relaxed"
                          >
                            <p className="font-bold text-black">
                              {eq.number}. {eq.question}
                              <span className="text-[10.5px] text-slate-600 ml-1 italic font-normal">
                                (Skor Maks: {eq.maxScore})
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Naskah */}
                    <div className="pt-4 border-t border-dashed border-slate-400 text-center text-[10px] italic text-slate-600">
                      *** Selamat Mengerjakan &amp; Semoga Sukses — Kejujuran Adalah Kunci Keberkahan ***
                    </div>
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

                {/* 4. PREVIEW LEMBAR JAWABAN SISWA (PERSIS BERKAS DOCX) */}
                {previewTab === 'LEMBAR_JAWABAN' && (
                  <div
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                    className="exam-paper-times-new-roman space-y-4 text-black leading-normal"
                  >
                    {/* Header Lembar Jawaban */}
                    <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                      <div className="shrink-0 w-14 sm:w-16">
                        <img
                          src="/kop-soal-logo.jpeg"
                          alt="Logo Al-Ittihadiyah"
                          className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = KOP_LOGO_BASE64;
                          }}
                        />
                      </div>
                      <div className="flex-1 text-center px-2">
                        <h3 className="text-xs sm:text-sm md:text-base font-bold tracking-normal uppercase text-black leading-tight">
                          {generatedData.examType === 'ASTS'
                            ? `ASESMEN SUMATIF TENGAH SEMESTER (ASTS) ${generatedData.semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`
                            : `ASESMEN SUMATIF AKHIR SEMESTER (ASAS) ${generatedData.semester === 'GANJIL' ? 'GANJIL' : 'GENAP'}`} — LEMBAR JAWABAN
                        </h3>
                        <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-normal uppercase text-black mt-0.5 leading-tight">
                          {generatedData.institutionName} • TAHUN {generatedData.academicYear}
                        </h2>
                      </div>
                      <div className="shrink-0 w-14 sm:w-16 hidden sm:block"></div>
                    </div>

                    {/* Metadata */}
                    <table className="w-full text-xs font-serif text-black border-collapse my-2">
                      <tbody>
                        <tr>
                          <td className="w-[18%] font-bold py-1">Mata Pelajaran</td>
                          <td className="w-[32%] py-1">: {generatedData.subject}</td>
                          <td className="w-[18%] font-bold py-1">Nama Siswa</td>
                          <td className="w-[32%] py-1">: ........................................</td>
                        </tr>
                        <tr>
                          <td className="font-bold py-1">Kelas/ Semester</td>
                          <td className="py-1">: Kelas {generatedData.gradeClass}/{generatedData.semester === 'GANJIL' ? 'Semester I' : 'Semester II'}</td>
                          <td className="font-bold py-1">Hari/ Tanggal</td>
                          <td className="py-1">: ........................................</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Section Pilihan Ganda */}
                    <div className="pt-2">
                      <h4 className="text-xs sm:text-sm font-bold text-black mb-2">
                        Pilihan Ganda
                      </h4>

                      <div className="border border-black overflow-x-auto">
                        <div className="p-1.5 bg-slate-100 border-b border-black text-xs font-bold">
                          Nama : ............................................................................
                        </div>
                        <table className="w-full text-xs border-collapse">
                        <tbody className="divide-y divide-black">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => {
                            const cols = [r, r + 10, r + 20, r + 30];
                            return (
                              <tr key={`lj-row-${r}`}>
                                {cols.map((num, colIdx) => (
                                  <React.Fragment key={`lj-col-${num}`}>
                                    <td className="w-[4%] text-center font-bold bg-slate-50 border-r border-black p-1">
                                      {num}
                                    </td>
                                    <td className="w-[5.25%] text-center border-r border-black p-1">A</td>
                                    <td className="w-[5.25%] text-center border-r border-black p-1">B</td>
                                    <td className="w-[5.25%] text-center border-r border-black p-1">C</td>
                                    <td
                                      className={`w-[5.25%] text-center border-black p-1 ${
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

                    {/* Section Essay */}
                    <div className="pt-3">
                      <h4 className="text-xs sm:text-sm font-bold text-black mb-2">
                        Essay
                      </h4>
                      <div className="space-y-2">
                        {Array.from({ length: Math.max(5, generatedData.essayQuestions.length) }).map((_, idx) => (
                          <div key={`essay-box-${idx + 1}`} className="border border-black flex">
                            <div className="w-8 shrink-0 bg-slate-100 border-r border-black text-xs font-bold flex items-center justify-center p-2">
                              {idx + 1}
                            </div>
                            <div className="flex-1 h-14 p-2 text-[11px] text-slate-400 italic">
                              Tempat menulis jawaban uraian nomor {idx + 1}...
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
                  onClick={handleCopyPlainTextPaper}
                  className="h-10 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Salin seluruh naskah soal lengkap ke clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-teal-600" />
                  <span>Salin Naskah</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPaperDocx}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download File Word (.doc) Naskah Soal 2 Kolom"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>Word Soal (2 Kolom)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintExamPaper}
                  className="h-10 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Cetak Naskah Soal Langsung (Format 2 Kolom Times New Roman)"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Cetak Soal</span>
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
