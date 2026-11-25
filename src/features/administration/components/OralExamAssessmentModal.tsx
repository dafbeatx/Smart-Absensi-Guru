/**
 * SMART ABSENSI GURU - MODAL PENILAIAN UJIAN LISAN
 * Modul Administrasi Ujian Lisan:
 * 1. Template BTQ & Hafalan (Nilai Langsung 0-100 & Predikat A/B/C/D)
 * 2. Template Bahasa Inggris & Bahasa Arab (Checklist 15 Butir Soal, Auto-Nilai & Predikat A/B/C/D)
 * Fitur:
 * - Reactive real-time calculation
 * - Cetak PDF A4 Resmi (Kop Sekolah SMP Terpadu Al-Ittihadiyah)
 * - Ekspor Excel (.xlsx)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  Save,
  BookOpen,
  Languages,
  Search,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useToastStore } from '../../../store/useToastStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { OralExamRepository } from '../../../repositories/OralExamRepository';
import type {
  OralExamSession,
  OralExamTemplateType,
  OralExamStudentRecord,
} from '../../../types/oral-exam.types';
import {
  calculateDirectScorePredicate,
  calculateChecklistScoreAndPredicate,
  getOralExamPredicateBadgeStyle,
  calculateOralExamSummaryStats,
  isChecklistTrackAssessed,
} from '../../../utils/oral-exam-scoring.utils';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface OralExamAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
}

const AVAILABLE_CLASSES = ['7', '8A', '8B', '9A', '9B', '10', '11', '12'];

export const OralExamAssessmentModal: React.FC<OralExamAssessmentModalProps> = ({
  isOpen,
  onClose,
  academicYear: propAcademicYear,
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const activeAcademicYear = useMemo(
    () => propAcademicYear || AdministrationRepository.getActiveAcademicYear(),
    [propAcademicYear]
  );
  const activeSemester = useMemo(() => AdministrationRepository.getActiveSemester(), []);

  // Sessions list & active session
  const [sessions, setSessions] = useState<OralExamSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Form New / Edit Session states
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [templateType, setTemplateType] = useState<OralExamTemplateType>('BTQ_HAFALAN');
  const [sessionTitle, setSessionTitle] = useState('');
  const [examinerName, setExaminerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('Ruang 01');
  const [selectedClass, setSelectedClass] = useState('7');
  const [sessionDate, setSessionDate] = useState(() => getTodayDateInJakarta());

  // Active editing session
  const [currentSession, setCurrentSession] = useState<OralExamSession | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone?: 'danger' | 'primary';
    onConfirm: () => void;
  } | null>(null);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [newStudentNameDraft, setNewStudentNameDraft] = useState('');

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Load all sessions from repository
  const loadSessions = useCallback(() => {
    const list = OralExamRepository.getAllSessions(activeAcademicYear);
    setSessions(list);
    if (list.length > 0 && !selectedSessionId) {
      setSelectedSessionId(list[0].id);
      setCurrentSession(list[0]);
    } else if (selectedSessionId) {
      const match = list.find((s) => s.id === selectedSessionId);
      if (match) setCurrentSession(match);
      else if (list.length > 0) {
        setSelectedSessionId(list[0].id);
        setCurrentSession(list[0]);
      } else {
        setSelectedSessionId(null);
        setCurrentSession(null);
      }
    }
  }, [activeAcademicYear, selectedSessionId]);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
      setExaminerName(user?.full_name || 'Guru Penguji');
    }
  }, [isOpen, loadSessions, user?.full_name]);

  const applySelectSession = (id: string) => {
    setSelectedSessionId(id);
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setCurrentSession(JSON.parse(JSON.stringify(found)));
      setIsDirty(false);
      setIsCreatingNew(false);
      setScoreDrafts({});
    }
  };

  // Handle switching active session
  const handleSelectSession = (id: string) => {
    if (isDirty) {
      setConfirmDialog({
        title: 'Perubahan Belum Disimpan',
        message: 'Ada perubahan nilai ujian lisan yang belum disimpan. Tetap beralih ke sesi lain?',
        confirmLabel: 'Ya, Beralih Sesi',
        tone: 'danger',
        onConfirm: () => {
          setConfirmDialog(null);
          applySelectSession(id);
        },
      });
      return;
    }
    applySelectSession(id);
  };

  // Create new session flow
  const handleCreateNewSession = async () => {
    const defaultTitle =
      templateType === 'BAHASA_INGGRIS_ARAB'
        ? `Ujian Lisan Bahasa Inggris & Arab - Kelas ${selectedClass}`
        : `Penilaian BTQ dan Hafalan - Kelas ${selectedClass}`;

    // Load registered students for selected class
    let classStudents: Array<{ studentId: string; studentName: string; nisn?: string; className?: string }> = [];
    try {
      const allStudents = await StudentRepository.getStudents();
      classStudents = allStudents
        .filter((st: any) => {
          const rawClass = ((st.className || st.class_name || '') as string).trim().toUpperCase();
          const targetClass = selectedClass.trim().toUpperCase();
          if (rawClass === targetClass) return true;
          if (targetClass === '7' && (rawClass === '7' || rawClass === '7A' || rawClass === '7B' || rawClass === 'VII')) {
            return true;
          }
          return false;
        })
        .map((st: any) => ({
          studentId: st.id,
          studentName: st.fullName || st.full_name || 'Siswa',
          nisn: st.nisn || undefined,
          className: st.className || st.class_name || selectedClass,
        }));
    } catch (err) {
      console.warn('Gagal memuat siswa dari master:', err);
    }

    // Fallback if no students found in DB
    if (classStudents.length === 0) {
      classStudents = [
        { studentId: 'sample_1', studentName: 'Muhammad Nabiel Alqarani', className: selectedClass },
        { studentId: 'sample_2', studentName: 'Sela Mutia Nur Azimah', className: selectedClass },
        { studentId: 'sample_3', studentName: 'Shirin Fatina Jasmin', className: selectedClass },
        { studentId: 'sample_4', studentName: 'Siti Nadipatul Mala', className: selectedClass },
        { studentId: 'sample_5', studentName: 'Sya\'datun Nisa', className: selectedClass },
        { studentId: 'sample_6', studentName: 'Tasya Nurasri Setiawan', className: selectedClass },
        { studentId: 'sample_7', studentName: 'Viodora Shakila Nur Zafira', className: selectedClass },
        { studentId: 'sample_8', studentName: 'Zahrofal Maula', className: selectedClass },
        { studentId: 'sample_9', studentName: 'Ratu Siti Maghfiroh', className: selectedClass },
        { studentId: 'sample_10', studentName: 'Siti Hana', className: selectedClass },
      ];
    }

    const created = OralExamRepository.createNewSession({
      templateType,
      title: sessionTitle.trim() || defaultTitle,
      academicYear: activeAcademicYear,
      semester: activeSemester,
      examinerName: examinerName.trim() || user?.full_name || 'Guru Penguji',
      examinerNpp: user?.nip || null,
      roomNumber: roomNumber.trim() || 'Ruang 01',
      className: selectedClass,
      date: sessionDate,
      students: classStudents,
    });

    setSessions((prev) => [created, ...prev]);
    setSelectedSessionId(created.id);
    setCurrentSession(created);
    setIsCreatingNew(false);
    setIsDirty(false);
    setScoreDrafts({});
    showToast('success', 'Sesi Berhasil Dibuat', `Daftar penilaian untuk kelas ${selectedClass} siap digunakan.`);
  };

  // Score direct input handler (BTQ & Hafalan) — dukung desimal koma (, -> .) & tolak NaN
  const handleDirectScoreChange = (
    studentIndex: number,
    field: 'btqScore' | 'hafalanScore',
    valStr: string
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const student = currentSession.students[studentIndex];
    const draftKey = `${student.studentId}:${field}`;
    const trimmed = valStr.trim();

    if (trimmed === '') {
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      const updatedStudents = [...currentSession.students];
      const target = { ...updatedStudents[studentIndex] };
      if (field === 'btqScore') {
        target.btqScore = null;
        target.btqPredicate = null;
      } else {
        target.hafalanScore = null;
        target.hafalanPredicate = null;
      }
      updatedStudents[studentIndex] = target;
      setCurrentSession({ ...currentSession, students: updatedStudents });
      setIsDirty(true);
      return;
    }

    const normalizedStr = trimmed.replace(/,/g, '.');
    // Hanya terima karakter angka positif dengan maksimal satu pemisah desimal
    if (!/^\d*(?:\.\d*)?$/.test(normalizedStr)) {
      return;
    }

    setScoreDrafts((prev) => ({ ...prev, [draftKey]: valStr }));

    // Jika sedang mengetik diakhiri koma/titik (misal "85,"), simpan draft sambil menunggu digit desimal
    if (normalizedStr === '.' || normalizedStr.endsWith('.')) {
      return;
    }

    const numeric = Number(normalizedStr);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
      return;
    }

    const clamped = Math.round(Math.max(0, Math.min(100, numeric)) * 100) / 100;
    const predicate = calculateDirectScorePredicate(clamped);

    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };

    if (field === 'btqScore') {
      target.btqScore = clamped;
      target.btqPredicate = predicate;
    } else {
      target.hafalanScore = clamped;
      target.hafalanPredicate = predicate;
    }

    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  const handleDirectScoreBlur = (studentId: string, field: 'btqScore' | 'hafalanScore') => {
    const draftKey = `${studentId}:${field}`;
    setScoreDrafts((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  // Toggle single question checkbox (Bahasa Inggris / Arab)
  const handleToggleChecklist = (
    studentIndex: number,
    subject: 'english' | 'arabic',
    qIndex: number
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };

    if (subject === 'english') {
      const arr = target.englishChecklist ? [...target.englishChecklist] : new Array(15).fill(false);
      arr[qIndex] = !arr[qIndex];
      const calc = calculateChecklistScoreAndPredicate(arr, 15);
      target.englishChecklist = arr;
      target.englishCorrectCount = calc.correctCount;
      target.englishScore = calc.score;
      target.englishPredicate = calc.predicate;
      target.englishAssessed = true;
    } else {
      const arr = target.arabicChecklist ? [...target.arabicChecklist] : new Array(15).fill(false);
      arr[qIndex] = !arr[qIndex];
      const calc = calculateChecklistScoreAndPredicate(arr, 15);
      target.arabicChecklist = arr;
      target.arabicCorrectCount = calc.correctCount;
      target.arabicScore = calc.score;
      target.arabicPredicate = calc.predicate;
      target.arabicAssessed = true;
    }

    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  // Bulk check all / reset all for a student
  const handleBulkChecklist = (
    studentIndex: number,
    subject: 'english' | 'arabic',
    state: boolean
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };
    const arr = new Array(15).fill(state);
    const calc = calculateChecklistScoreAndPredicate(arr, 15);

    if (subject === 'english') {
      target.englishChecklist = arr;
      target.englishCorrectCount = calc.correctCount;
      target.englishScore = calc.score;
      target.englishPredicate = calc.predicate;
      target.englishAssessed = true;
    } else {
      target.arabicChecklist = arr;
      target.arabicCorrectCount = calc.correctCount;
      target.arabicScore = calc.score;
      target.arabicPredicate = calc.predicate;
      target.arabicAssessed = true;
    }

    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  // Add new student row via React dialog
  const handleAddStudent = () => {
    if (!currentSession) return;
    setNewStudentNameDraft('');
    setAddStudentDialogOpen(true);
  };

  const handleConfirmAddStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSession) return;
    const trimmed = newStudentNameDraft.trim();
    if (!trimmed) {
      showToast('error', 'Nama Siswa Wajib Diisi', 'Masukkan nama siswa sebelum menambahkan.');
      return;
    }

    const isChecklist = currentSession.templateType === 'BAHASA_INGGRIS_ARAB';
    const newRecord: OralExamStudentRecord = {
      studentId: `manual_${Date.now()}`,
      studentName: trimmed,
      className: currentSession.className,
      ...(isChecklist
        ? {
            englishChecklist: new Array(15).fill(false),
            englishCorrectCount: null,
            englishScore: null,
            englishPredicate: null,
            englishAssessed: false,
            arabicChecklist: new Array(15).fill(false),
            arabicCorrectCount: null,
            arabicScore: null,
            arabicPredicate: null,
            arabicAssessed: false,
          }
        : {
            btqScore: null,
            btqPredicate: null,
            hafalanScore: null,
            hafalanPredicate: null,
          }),
    };

    const updated = [...currentSession.students, newRecord];
    setCurrentSession({ ...currentSession, students: updated });
    setIsDirty(true);
    setAddStudentDialogOpen(false);
    setNewStudentNameDraft('');
  };

  // Remove student row
  const handleRemoveStudent = (idx: number) => {
    if (!currentSession || idx < 0 || idx >= currentSession.students.length) return;
    const target = currentSession.students[idx];
    setConfirmDialog({
      title: 'Hapus Peserta Ujian Lisan?',
      message: `Hapus ${target.studentName} dari lembar penilaian ini?`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        setCurrentSession((prev) => {
          if (!prev) return prev;
          const updated = prev.students.filter((st, i) => st.studentId !== target.studentId && i !== idx);
          return { ...prev, students: updated };
        });
        setIsDirty(true);
      },
    });
  };

  // Save changes to repository
  const handleSaveSession = () => {
    if (!currentSession) return;
    OralExamRepository.saveSession(currentSession);
    setIsDirty(false);
    setScoreDrafts({});
    loadSessions();
    showToast('success', 'Nilai Tersimpan', 'Seluruh penilaian ujian lisan berhasil disimpan.');
  };

  // Delete active session
  const handleDeleteCurrentSession = () => {
    if (!currentSession) return;
    const sessionToDelete = currentSession;
    setConfirmDialog({
      title: 'Hapus Sesi Ujian Lisan?',
      message: `Hapus seluruh sesi ujian lisan "${sessionToDelete.title}" beserta seluruh nilainya?`,
      confirmLabel: 'Ya, Hapus Sesi',
      tone: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        OralExamRepository.deleteSession(sessionToDelete.id);
        setIsDirty(false);
        setScoreDrafts({});
        showToast('info', 'Sesi Dihapus', 'Sesi penilaian lisan berhasil dihapus.');
        loadSessions();
      },
    });
  };

  // Export PDF
  const handleExportPdf = async () => {
    if (!currentSession) return;
    try {
      setIsExporting(true);
      const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
      await OralExamExportService.exportToPdf(currentSession);
      showToast('success', 'PDF Siap!', 'Dokumen lembar penilaian resmi berhasil diunduh.');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('error', 'Gagal Cetak PDF', 'Terjadi kesalahan saat memproses dokumen PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (!currentSession) return;
    try {
      const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
      OralExamExportService.exportToExcel(currentSession);
      showToast('success', 'Excel Berhasil Diunduh!', 'File rekap penilaian .xlsx telah disimpan.');
    } catch (err) {
      console.error('Failed to export Excel:', err);
      showToast('error', 'Gagal Ekspor Excel', 'Terjadi kesalahan saat membuat file spreadsheet.');
    }
  };

  // Statistics
  const summaryStats = useMemo(() => {
    if (!currentSession) return null;
    const isChecklist = currentSession.templateType === 'BAHASA_INGGRIS_ARAB';
    return calculateOralExamSummaryStats(currentSession.students, isChecklist);
  }, [currentSession]);

  // Filtered students for search
  const filteredStudents = useMemo(() => {
    if (!currentSession) return [];
    if (!searchQuery.trim()) return currentSession.students;
    const q = searchQuery.toLowerCase();
    return currentSession.students.filter(
      (s) => s.studentName.toLowerCase().includes(q) || (s.nisn && s.nisn.includes(q))
    );
  }, [currentSession, searchQuery]);

  const isChecklistMode = currentSession?.templateType === 'BAHASA_INGGRIS_ARAB';

  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmDialog({
        title: 'Keluar Tanpa Menyimpan?',
        message: 'Ada perubahan nilai yang belum disimpan. Yakin ingin menutup lembar penilaian?',
        confirmLabel: 'Ya, Keluar',
        tone: 'danger',
        onConfirm: () => {
          setConfirmDialog(null);
          setIsDirty(false);
          onClose();
        },
      });
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (confirmDialog) {
          setConfirmDialog(null);
        } else if (addStudentDialogOpen) {
          setAddStudentDialogOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, confirmDialog, addStudentDialogOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oral-exam-title"
      className="fixed inset-0 z-100 w-full h-dvh flex flex-col bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans animate-fadeIn"
    >
      {/* Fullscreen Workspace Header */}
      <header className="px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer min-h-11"
            title="Kembali ke Administrasi"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs shrink-0">
            <span className="text-xl">🗣️</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="oral-exam-title" className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                Penilaian Ujian Lisan
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full shrink-0">
                Resmi A4 &amp; Excel
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {currentSession
                ? `${currentSession.title} • Penguji: ${currentSession.examinerName} • Kelas ${currentSession.className} • TA: ${currentSession.academicYear}`
                : 'Pencatatan & lembar rekapitulasi nilai lisan BTQ, Hafalan, Bahasa Inggris, dan Bahasa Arab'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Fullscreen Scrollable Body Container */}
      <div className="flex-1 overflow-y-auto p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-6 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto w-full space-y-4">
        {/* Top Header Controls: Sessions Bar & Add Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Sesi Ujian:
            </span>
            {sessions.length === 0 ? (
              <span className="text-xs text-slate-400 italic">Belum ada sesi ujian lisan.</span>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSession(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                    selectedSessionId === s.id && !isCreatingNew
                      ? 'bg-[#023246] text-white border-[#023246] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{s.templateType === 'BAHASA_INGGRIS_ARAB' ? '🇬🇧🇸🇦' : '📖'}</span>
                  <span>{s.className}</span>
                  <span className="opacity-75 text-[10px]">({s.templateType === 'BAHASA_INGGRIS_ARAB' ? 'Bahasa' : 'BTQ'})</span>
                </button>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setIsCreatingNew(true);
              setSessionTitle('');
            }}
            className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 min-h-9 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Buat Sesi Baru
          </Button>
        </div>

        {/* Form Modal / Collapsible: Buat Sesi Baru */}
        {isCreatingNew && (
          <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h4 className="text-sm font-black text-emerald-950">Buat Sesi Penilaian Ujian Lisan Baru</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕ Batal
              </button>
            </div>

            {/* Template Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Pilih Format Template Penilaian:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTemplateType('BTQ_HAFALAN')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    templateType === 'BTQ_HAFALAN'
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Format 1: BTQ &amp; Hafalan</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Model input skor langsung (0–100) untuk aspek BTQ dan Hafalan dengan auto-predikat A/B/C/D.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateType('BAHASA_INGGRIS_ARAB')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    templateType === 'BAHASA_INGGRIS_ARAB'
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                    <Languages className="w-4 h-4 text-blue-600" />
                    <span>Format 2: Bahasa Inggris &amp; Bahasa Arab</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Model interaktif checklist 15 butir soal lisan. Jumlah benar, nilai 0–100, dan predikat otomatis.
                  </p>
                </button>
              </div>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nama Penguji</label>
                <input
                  type="text"
                  value={examinerName}
                  onChange={(e) => setExaminerName(e.target.value)}
                  placeholder="Nama Penguji (misal: Ibu Mira Nurdianti, S.Pd)"
                  className="w-full min-h-11 sm:min-h-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Pilih Kelas</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full min-h-11 sm:min-h-0 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-base sm:text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {AVAILABLE_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Nomor Ruang</label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Contoh: Ruang 01"
                  className="w-full min-h-11 sm:min-h-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Tanggal Ujian</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full min-h-11 sm:min-h-0 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-base sm:text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setIsCreatingNew(false)} className="text-xs min-h-9">
                Batal
              </Button>
              <Button type="button" variant="primary" onClick={handleCreateNewSession} className="text-xs font-black min-h-9 bg-[#023246] hover:bg-[#0D7A5F]">
                Mulai Penilaian
              </Button>
            </div>
          </div>
        )}

        {/* Active Session Content */}
        {currentSession ? (
          <div className="space-y-3.5">
            {/* Active Session Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-3xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{isChecklistMode ? '🗣️' : '📖'}</span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">{currentSession.title}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {isChecklistMode ? 'Checklist 15 Soal' : 'Nilai Langsung'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Penguji: <strong>{currentSession.examinerName}</strong> • Kelas: <strong>{currentSession.className}</strong>
                  {currentSession.roomNumber && ` • Ruang: ${currentSession.roomNumber}`} • TA: <strong>{currentSession.academicYear}</strong>
                </p>
              </div>

              {/* Action Buttons: Save, PDF, Excel, Delete */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveSession}
                  disabled={!isDirty}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title="Simpan perubahan nilai ke sistem"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isDirty ? 'Simpan Perubahan' : 'Tersimpan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#023246] hover:bg-[#0D7A5F] text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Cetak lembar penilaian fisik format resmi A4"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Unduh format spreadsheet .xlsx"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteCurrentSession}
                  className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                  title="Hapus sesi ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rubric Criteria Legend Bar */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-black text-slate-700 uppercase tracking-wider">
                <span>📋 Kriteria Penilaian Resmi:</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {isChecklistMode ? 'Berdasarkan Total Jawaban Benar (15 Butir Soal)' : 'Berdasarkan Nilai Skala 0–100'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 font-bold text-emerald-900">
                  <span className="font-black text-sm">A</span>: {isChecklistMode ? '14 – 15 Benar' : '91 – 100'}
                  <span className="block text-[10px] font-normal text-emerald-700">Sangat Baik</span>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-300 font-bold text-blue-900">
                  <span className="font-black text-sm">B</span>: {isChecklistMode ? '11 – 13 Benar' : '81 – 90'}
                  <span className="block text-[10px] font-normal text-blue-700">Baik</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 font-bold text-amber-900">
                  <span className="font-black text-sm">C</span>: {isChecklistMode ? '6 – 10 Benar' : '61 – 80'}
                  <span className="block text-[10px] font-normal text-amber-700">Cukup</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-300 font-bold text-rose-900">
                  <span className="font-black text-sm">D</span>: {isChecklistMode ? '0 – 5 Benar' : '0 – 60'}
                  <span className="block text-[10px] font-normal text-rose-700">Perlu Bimbingan</span>
                </div>
              </div>
            </div>

            {/* Table Search & Add Student */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3.5 sm:top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa..."
                  className="w-full min-h-11 sm:min-h-0 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 sm:py-1.5 text-base sm:text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddStudent}
                className="min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Siswa
              </button>
            </div>

            {/* The Main Interactive Assessment Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto max-h-115 relative">
                {isChecklistMode ? (
                  /* ========================================================= */
                  /* TEMPLATE 2: CHECKLIST BAHASA INGGRIS & ARAB (15 SOAL)     */
                  /* ========================================================= */
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th rowSpan={2} className="p-2 text-center w-10 border-r border-slate-200">
                          No
                        </th>
                        <th rowSpan={2} className="p-2.5 min-w-37.5 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 shadow-xs">
                          Nama Peserta
                        </th>
                        <th colSpan={18} className="p-2 text-center font-black bg-blue-50/80 text-blue-950 border-r border-slate-200">
                          🇬🇧 BAHASA INGGRIS (15 SOAL)
                        </th>
                        <th colSpan={18} className="p-2 text-center font-black bg-emerald-50/80 text-emerald-950">
                          🇸🇦 BAHASA ARAB (15 SOAL)
                        </th>
                      </tr>
                      <tr className="text-[10px] bg-slate-100/70 border-t border-slate-200">
                        {/* 15 soal Inggris */}
                        {Array.from({ length: 15 }, (_, i) => (
                          <th key={`h_eng_${i}`} className="p-1 text-center w-6 font-bold text-slate-600">
                            {i + 1}
                          </th>
                        ))}
                        <th className="p-1 text-center font-black text-blue-900 bg-blue-100/70 w-8">Jml</th>
                        <th className="p-1 text-center font-black text-blue-900 bg-blue-100/70 w-10">Nilai</th>
                        <th className="p-1 text-center font-black text-blue-900 bg-blue-100/70 w-8 border-r border-slate-200">Pred</th>

                        {/* 15 soal Arab */}
                        {Array.from({ length: 15 }, (_, i) => (
                          <th key={`h_ara_${i}`} className="p-1 text-center w-6 font-bold text-slate-600">
                            {i + 1}
                          </th>
                        ))}
                        <th className="p-1 text-center font-black text-emerald-900 bg-emerald-100/70 w-8">Jml</th>
                        <th className="p-1 text-center font-black text-emerald-900 bg-emerald-100/70 w-10">Nilai</th>
                        <th className="p-1 text-center font-black text-emerald-900 bg-emerald-100/70 w-8">Pred</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((s, idx) => {
                        const originalIndex = currentSession.students.findIndex((st) => st.studentId === s.studentId);
                        if (originalIndex < 0) return null;
                        const engDone = isChecklistTrackAssessed(s.englishScore, s.englishChecklist, s.englishAssessed);
                        const araDone = isChecklistTrackAssessed(s.arabicScore, s.arabicChecklist, s.arabicAssessed);
                        const engP = getOralExamPredicateBadgeStyle(engDone ? s.englishPredicate : null);
                        const araP = getOralExamPredicateBadgeStyle(araDone ? s.arabicPredicate : null);

                        return (
                          <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors text-[11px]">
                            <td className="p-1.5 text-center font-semibold text-slate-400 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-bold text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10 shadow-xs truncate max-w-40">
                              <span>{s.studentName}</span>
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleBulkChecklist(originalIndex, 'english', true)}
                                  className="text-[9px] text-blue-600 hover:underline"
                                  title="Centang semua soal Bahasa Inggris"
                                >
                                  +Eng All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkChecklist(originalIndex, 'arabic', true)}
                                  className="text-[9px] text-emerald-600 hover:underline"
                                  title="Centang semua soal Bahasa Arab"
                                >
                                  +Arab All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudent(originalIndex)}
                                  className="text-[9px] text-rose-500 hover:underline ml-auto"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>

                            {/* Checkbox Soal 1-15 Inggris */}
                            {Array.from({ length: 15 }, (_, qI) => {
                              const checked = Boolean(s.englishChecklist?.[qI]);
                              return (
                                <td key={`q_eng_${qI}`} className="p-0.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleChecklist(originalIndex, 'english', qI)}
                                    className={`w-5 h-5 rounded cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold mx-auto ${
                                      checked
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-transparent border border-slate-300'
                                    }`}
                                    title={`Soal ${qI + 1} Bahasa Inggris: ${checked ? 'Benar' : 'Salah'}`}
                                  >
                                    ✓
                                  </button>
                                </td>
                              );
                            })}

                            <td className="p-1 text-center font-black text-blue-950 bg-blue-50/50">
                              {engDone ? (s.englishCorrectCount ?? 0) : '-'}
                            </td>
                            <td className="p-1 text-center font-black text-blue-900 bg-blue-50/50">
                              {engDone && s.englishScore !== null && s.englishScore !== undefined ? s.englishScore : '-'}
                            </td>
                            <td className="p-1 text-center border-r border-slate-200">
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black border ${engP.bgClass} ${engP.textClass} ${engP.borderClass}`}>
                                {engDone ? (s.englishPredicate || '-') : '-'}
                              </span>
                            </td>

                            {/* Checkbox Soal 1-15 Arab */}
                            {Array.from({ length: 15 }, (_, qI) => {
                              const checked = Boolean(s.arabicChecklist?.[qI]);
                              return (
                                <td key={`q_ara_${qI}`} className="p-0.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleChecklist(originalIndex, 'arabic', qI)}
                                    className={`w-5 h-5 rounded cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold mx-auto ${
                                      checked
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-transparent border border-slate-300'
                                    }`}
                                    title={`Soal ${qI + 1} Bahasa Arab: ${checked ? 'Benar' : 'Salah'}`}
                                  >
                                    ✓
                                  </button>
                                </td>
                              );
                            })}

                            <td className="p-1 text-center font-black text-emerald-950 bg-emerald-50/50">
                              {araDone ? (s.arabicCorrectCount ?? 0) : '-'}
                            </td>
                            <td className="p-1 text-center font-black text-emerald-900 bg-emerald-50/50">
                              {araDone && s.arabicScore !== null && s.arabicScore !== undefined ? s.arabicScore : '-'}
                            </td>
                            <td className="p-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black border ${araP.bgClass} ${araP.textClass} ${araP.borderClass}`}>
                                {araDone ? (s.arabicPredicate || '-') : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* ========================================================= */
                  /* TEMPLATE 1: NILAI LANGSUNG BTQ & HAFALAN (SKALA 0-100)    */
                  /* ========================================================= */
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th rowSpan={2} className="p-2.5 text-center w-12 border-r border-slate-200">
                          No
                        </th>
                        <th rowSpan={2} className="p-2.5 min-w-50 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 shadow-xs">
                          Nama Siswa
                        </th>
                        <th colSpan={2} className="p-2 text-center font-black bg-emerald-50/80 text-emerald-950 border-r border-slate-200">
                          📖 BTQ (BACA TULIS QUR'AN)
                        </th>
                        <th colSpan={2} className="p-2 text-center font-black bg-blue-50/80 text-blue-950 border-r border-slate-200">
                          📖 HAFALAN (TAHFIDZ)
                        </th>
                        <th rowSpan={2} className="p-2.5 text-center w-24">
                          Aksi
                        </th>
                      </tr>
                      <tr className="text-[10px] bg-slate-100/70 border-t border-slate-200">
                        <th className="p-1.5 text-center w-24 border-r border-slate-200">Nilai (0–100)</th>
                        <th className="p-1.5 text-center w-24 border-r border-slate-200">Predikat</th>
                        <th className="p-1.5 text-center w-24 border-r border-slate-200">Nilai (0–100)</th>
                        <th className="p-1.5 text-center w-24 border-r border-slate-200">Predikat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((s, idx) => {
                        const originalIndex = currentSession.students.findIndex((st) => st.studentId === s.studentId);
                        if (originalIndex < 0) return null;
                        const btqP = getOralExamPredicateBadgeStyle(s.btqPredicate);
                        const hafP = getOralExamPredicateBadgeStyle(s.hafalanPredicate);
                        const btqDraftKey = `${s.studentId}:btqScore`;
                        const hafDraftKey = `${s.studentId}:hafalanScore`;

                        return (
                          <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2 text-center font-semibold text-slate-400 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10 shadow-xs">
                              {s.studentName}
                            </td>

                            {/* BTQ Input & Predikat */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  btqDraftKey in scoreDrafts
                                    ? scoreDrafts[btqDraftKey]
                                    : (s.btqScore !== null && s.btqScore !== undefined ? String(s.btqScore) : '')
                                }
                                onChange={(e) => handleDirectScoreChange(originalIndex, 'btqScore', e.target.value)}
                                onBlur={() => handleDirectScoreBlur(s.studentId, 'btqScore')}
                                placeholder="0–100"
                                className="w-full min-h-10 sm:min-h-0 text-center font-black text-base sm:text-xs p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${btqP.bgClass} ${btqP.textClass} ${btqP.borderClass}`}>
                                {s.btqPredicate || '-'}
                              </span>
                            </td>

                            {/* Hafalan Input & Predikat */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  hafDraftKey in scoreDrafts
                                    ? scoreDrafts[hafDraftKey]
                                    : (s.hafalanScore !== null && s.hafalanScore !== undefined ? String(s.hafalanScore) : '')
                                }
                                onChange={(e) => handleDirectScoreChange(originalIndex, 'hafalanScore', e.target.value)}
                                onBlur={() => handleDirectScoreBlur(s.studentId, 'hafalanScore')}
                                placeholder="0–100"
                                className="w-full min-h-10 sm:min-h-0 text-center font-black text-base sm:text-xs p-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${hafP.bgClass} ${hafP.textClass} ${hafP.borderClass}`}>
                                {s.hafalanPredicate || '-'}
                              </span>
                            </td>

                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudent(originalIndex)}
                                className="min-h-10 min-w-10 sm:min-h-0 sm:min-w-0 text-xs text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
                                title="Hapus baris siswa"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Bottom Summary Footer */}
            {summaryStats && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-4 text-slate-700 font-semibold">
                  <span>
                    Total: <strong>{summaryStats.totalStudents} Siswa</strong>
                  </span>
                  <span>
                    Dinilai: <strong>{summaryStats.completedStudents} Siswa</strong>
                  </span>
                  <span>
                    Rata-rata 1: <strong>{summaryStats.averageScore1}</strong>
                  </span>
                  <span>
                    Rata-rata 2: <strong>{summaryStats.averageScore2}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Distribusi:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    A: {summaryStats.gradeDistribution.A}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                    B: {summaryStats.gradeDistribution.B}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    C: {summaryStats.gradeDistribution.C}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                    D: {summaryStats.gradeDistribution.D}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          !isCreatingNew && (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-3xl space-y-3">
              <span className="text-3xl">🗣️</span>
              <h4 className="text-sm font-black text-slate-800">Belum Ada Sesi Penilaian Lisan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Silakan buat sesi penilaian baru untuk memulai penginputan nilai lisan BTQ &amp; Hafalan atau Bahasa Inggris &amp; Arab.
              </p>
              <Button type="button" variant="primary" onClick={() => setIsCreatingNew(true)} className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 min-h-10">
                + Buat Sesi Ujian Lisan Baru
              </Button>
            </div>
          )
        )}
        </div>
      </div>

      {/* Dialog Tambah Siswa Baru (Pengganti window.prompt) */}
      {addStudentDialogOpen && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleConfirmAddStudent}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Tambah Siswa ke Sesi Ujian Lisan</h3>
              <p className="text-xs text-slate-500">Masukkan nama lengkap siswa yang akan ditambahkan ke daftar penilaian ini.</p>
            </div>
            <input
              type="text"
              autoFocus
              value={newStudentNameDraft}
              onChange={(e) => setNewStudentNameDraft(e.target.value)}
              placeholder="Contoh: Ahmad Fauzan"
              className="w-full min-h-11 bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAddStudentDialogOpen(false)}
                className="flex-1 min-h-11 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 min-h-11 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Tambah Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dialog Konfirmasi Aksi (Pengganti window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 min-h-11 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`flex-1 min-h-11 py-2.5 rounded-xl text-white text-xs font-bold transition-colors shadow-sm cursor-pointer ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#023246] hover:bg-[#0D7A5F]'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
