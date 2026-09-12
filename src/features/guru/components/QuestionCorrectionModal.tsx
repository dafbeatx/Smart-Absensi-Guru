import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  GraduationCap,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Undo2,
  RotateCcw,
  Save,
  User,
  Plus,
  ArrowLeft,
  Search,
  BookOpen,
  Layers,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Trash2,
  AlertOctagon,
  ChevronRight,
  AlertCircle,
  Key,
  Filter,
  RefreshCw,
  WifiOff,
  ShieldAlert,
  Database,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  UserProfile,
  StudentItem,
} from '../../../types/database.types';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { parseAnswerKey, calculateStudentResult, getScoreLabel, getCsiLabel } from '../../../utils/scoring.utils';
import { normalizeClassCode, areClassCodesEqual } from '../../../utils/class.utils';
import { logger } from '../../../utils/logger.utils';

export type ModalLoadState =
  | 'IDLE'
  | 'LOADING_SESSIONS'
  | 'READY'
  | 'EMPTY'
  | 'OFFLINE_CACHE'
  | 'MIGRATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'RETRYING';

interface QuestionCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

const PREDEFINED_CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', 'SMA'];
const PREDEFINED_SUBJECTS = [
  'Informatika',
  'Matematika',
  'IPA',
  'IPS',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Bahasa Arab',
  'PAI',
  'PJOK',
  'Seni Budaya',
  'PKn',
  'SBPK',
];
const PREDEFINED_EXAM_TYPES = ['Harian', 'PTS / UTS', 'PAS / UAS', 'ASTS', 'ASAJ', 'Simulasi'];

export const QuestionCorrectionModal: React.FC<QuestionCorrectionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const userRole = (currentUser?.role || 'GURU').toUpperCase();
  const isAuthorizedRole = ['GURU', 'ADMIN', 'OPERATOR', 'KEPSEK'].includes(userRole);
  const isReadOnly = userRole === 'KEPSEK';

  // Navigation active tab: 'sessions' | 'grading' | 'recap'
  const [activeTab, setActiveTab] = useState<'sessions' | 'grading' | 'recap'>('sessions');

  // Load state machine
  const [loadState, setLoadState] = useState<ModalLoadState>('LOADING_SESSIONS');
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');

  // Sessions list
  const [sessions, setSessions] = useState<ExamSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<ExamSessionRecord | null>(null);

  // New Session Form State
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [teacherName, setTeacherName] = useState(currentUser?.full_name || '');
  const [selectedSubject, setSelectedSubject] = useState('Informatika');
  const [customSubject, setCustomSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('8A');
  const [examType, setExamType] = useState('PTS / UTS');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('Ganjil');
  const [kkm, setKkm] = useState(75);
  const [keyInput, setKeyInput] = useState('1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D 9.A 10.B');

  // Active Session Data (Students from directory & graded records)
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [gradedStudents, setGradedStudents] = useState<GradedStudentScoreRecord[]>([]);

  // Active Grading Sheet State
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [essayScores, setEssayScores] = useState<number[]>([0, 0, 0, 0, 0]);
  const [manualScore, setManualScore] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Session Search & Filtering State
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionClassFilter, setSessionClassFilter] = useState<string>('ALL');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'WITH_KEY' | 'WITHOUT_KEY'>('ALL');

  // Key Editor Modal State
  const [isKeyEditorModalOpen, setIsKeyEditorModalOpen] = useState(false);
  const [editingSessionTarget, setEditingSessionTarget] = useState<ExamSessionRecord | null>(null);
  const [quickKeyInput, setQuickKeyInput] = useState('');

  const undoStack = useRef<{ qNum: number; prev: string | undefined }[]>([]);
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto toast timer
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Load sessions with state machine
  const loadSessions = useCallback(async (isRetry = false) => {
    setLoadState(isRetry ? 'RETRYING' : 'LOADING_SESSIONS');
    try {
      const res = await ExamCorrectionRepository.getSessionsWithStatus();
      if (res.status === 'ok') {
        setSessions(res.data);
        if (res.data.length === 0) {
          setLoadState('EMPTY');
        } else {
          setLoadState('READY');
        }
      } else if (res.status === 'offline_cache') {
        setSessions(res.data);
        setLoadState('OFFLINE_CACHE');
        setLoadErrorMessage(res.error || 'Memuat draft lokal (offline).');
      } else {
        const errMsg = res.error || '';
        setLoadErrorMessage(errMsg);
        if (/permission|row-level security|401|403|unauthorized/i.test(errMsg)) {
          setLoadState('PERMISSION_DENIED');
        } else if (/relation .* does not exist|column .* does not exist|42P01|42703/i.test(errMsg)) {
          setLoadState('MIGRATION_REQUIRED');
        } else {
          setLoadState('NETWORK_ERROR');
        }
      }
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to load sessions:', err);
      const errMsg = err?.message || 'Gagal memuat sesi';
      setLoadErrorMessage(errMsg);
      setLoadState('NETWORK_ERROR');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
      setTeacherName(currentUser?.full_name || '');
    }
  }, [isOpen, currentUser, loadSessions]);

  // Escape key & Android Back Button integration
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isKeyEditorModalOpen) {
          setIsKeyEditorModalOpen(false);
        } else if (isCreatingSession) {
          setIsCreatingSession(false);
        } else {
          onClose();
        }
      }
    };

    window.history.pushState({ modal: 'question_correction' }, '');
    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isKeyEditorModalOpen, isCreatingSession, onClose]);

  // Load students of class when active session is chosen
  const loadSessionData = useCallback(async (session: ExamSessionRecord) => {
    try {
      const classIdentifier = session.class_code || session.class_name;
      const [students, grades] = await Promise.all([
        StudentRepository.getStudentsByClass(classIdentifier),
        ExamCorrectionRepository.getGradedStudents(session.id),
      ]);
      setClassStudents(students);
      setGradedStudents(grades);
    } catch (err) {
      logger.error('QuestionCorrectionModal', 'Failed to load session details:', err);
    }
  }, []);

  const handleSelectSession = async (session: ExamSessionRecord) => {
    setActiveSession(session);
    await loadSessionData(session);
    setActiveTab('grading');
    resetGradingForm();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const previewNewKeys = useMemo(() => parseAnswerKey(keyInput), [keyInput]);

  // Options: A, B, C, D (and E if SMA)
  const isSMA = (activeSession?.school_level === 'SMA') || selectedClass === 'SMA';
  const availableOptions = isSMA ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

  // Calculate live score
  const calculation = useMemo(() => {
    if (!activeSession) return null;
    return calculateStudentResult(
      activeSession.answer_key || [],
      userAnswers,
      essayScores,
      activeSession.scoring_config
    );
  }, [activeSession, userAnswers, essayScores]);

  const effectiveFinalScore = manualScore !== null ? manualScore : (calculation?.finalScore || 0);

  // Open Key Editor for a specific session
  const handleOpenKeyEditor = (session: ExamSessionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionTarget(session);
    const existing = Array.isArray(session.answer_key) ? session.answer_key : [];
    if (existing.length > 0) {
      setQuickKeyInput(existing.map((k, i) => `${i + 1}.${k}`).join(' '));
    } else {
      setQuickKeyInput('1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D 9.A 10.B');
    }
    setIsKeyEditorModalOpen(true);
  };

  // Save answer key from editor or quick inline input
  const handleSaveKeyEditor = async (targetSession?: ExamSessionRecord, customKeyStr?: string) => {
    const sessionToUpdate = targetSession || editingSessionTarget || activeSession;
    if (!sessionToUpdate) return;

    const rawStr = customKeyStr !== undefined ? customKeyStr : quickKeyInput;
    const parsedKeys = parseAnswerKey(rawStr);
    if (parsedKeys.length === 0) {
      setToastMessage({ text: 'Kunci jawaban belum valid! Masukkan minimal 1 butir soal.', type: 'error' });
      return;
    }

    try {
      const updated = await ExamCorrectionRepository.saveSession({
        id: sessionToUpdate.id,
        session_name: sessionToUpdate.session_name,
        teacher: sessionToUpdate.teacher,
        subject: sessionToUpdate.subject,
        class_name: sessionToUpdate.class_name,
        class_code: sessionToUpdate.class_code || normalizeClassCode(sessionToUpdate.class_name),
        owner_user_id: sessionToUpdate.owner_user_id || currentUser.id,
        school_level: sessionToUpdate.school_level,
        answer_key: parsedKeys,
        student_list: sessionToUpdate.student_list || [],
        kkm: sessionToUpdate.kkm,
        academic_year: sessionToUpdate.academic_year,
        semester: sessionToUpdate.semester,
        exam_type: sessionToUpdate.exam_type,
        scoring_config: sessionToUpdate.scoring_config,
      });

      // Update in sessions list
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      // If active session is updated, refresh activeSession
      if (activeSession?.id === updated.id) {
        setActiveSession(updated);
      }

      setIsKeyEditorModalOpen(false);
      setEditingSessionTarget(null);
      setToastMessage({
        text: `Kunci jawaban berhasil disimpan (${parsedKeys.length} Soal PG)!`,
        type: 'success',
      });
    } catch (err) {
      logger.error('QuestionCorrectionModal', 'Failed to save answer key:', err);
      setToastMessage({ text: 'Gagal memperbarui kunci jawaban.', type: 'error' });
    }
  };

  // Filtered sessions for Tab 1
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const q = sessionSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.session_name.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.teacher.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q) ||
        (s.class_code && s.class_code.toLowerCase().includes(q));

      const matchesClass =
        sessionClassFilter === 'ALL' ||
        areClassCodesEqual(s.class_code || s.class_name, sessionClassFilter);

      const hasKey = Array.isArray(s.answer_key) && s.answer_key.length > 0;
      const matchesStatus =
        sessionStatusFilter === 'ALL' ||
        (sessionStatusFilter === 'WITH_KEY' && hasKey) ||
        (sessionStatusFilter === 'WITHOUT_KEY' && !hasKey);

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [sessions, sessionSearchQuery, sessionClassFilter, sessionStatusFilter]);

  const sessionsWithKeyCount = useMemo(
    () => sessions.filter((s) => Array.isArray(s.answer_key) && s.answer_key.length > 0).length,
    [sessions]
  );
  const sessionsWithoutKeyCount = sessions.length - sessionsWithKeyCount;

  // Filtered students for dropdown
  const filteredStudents = useMemo(() => {
    // Collect all candidate student names
    const names = new Set<string>();
    classStudents.forEach((s) => {
      if (s.fullName) names.add(s.fullName.trim());
    });
    if (activeSession?.student_list) {
      activeSession.student_list.forEach((n) => {
        if (n) names.add(n.trim());
      });
    }
    // Also ALWAYS include any student who already has grades in this session!
    gradedStudents.forEach((g) => {
      if (g.name) names.add(g.name.trim());
    });

    const gradedSet = new Set(gradedStudents.map((g) => g.name.toLowerCase().trim()));

    const list = Array.from(names).map((name) => ({
      name,
      isGraded: gradedSet.has(name.toLowerCase().trim()),
    }));

    // Sort: un-graded first, then graded
    list.sort((a, b) => {
      if (a.isGraded === b.isGraded) return a.name.localeCompare(b.name);
      return a.isGraded ? 1 : -1;
    });

    if (!studentSearchQuery.trim()) return list;
    return list.filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()));
  }, [classStudents, activeSession, gradedStudents, studentSearchQuery]);

  const handleAnswerSelect = (questionNum: number, opt: string) => {
    undoStack.current.push({ qNum: questionNum, prev: userAnswers[questionNum] });
    setUserAnswers((prev) => ({ ...prev, [questionNum]: opt }));

    // Smooth auto-scroll to next question
    const totalQ = activeSession?.answer_key.length || 0;
    const nextQ = questionNum + 1;
    if (nextQ <= totalQ) {
      const nextEl = questionRefs.current.get(nextQ);
      if (nextEl) {
        setTimeout(() => {
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
    }
  };

  const handleUndo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    setUserAnswers((prev) => {
      const updated = { ...prev };
      if (last.prev === undefined) {
        delete updated[last.qNum];
      } else {
        updated[last.qNum] = last.prev;
      }
      return updated;
    });
  };

  const resetGradingForm = () => {
    setUserAnswers({});
    setEssayScores([0, 0, 0, 0, 0]);
    setManualScore(null);
    undoStack.current = [];
  };

  const handleSelectStudent = (name: string) => {
    setSelectedStudentName(name);
    setStudentSearchQuery(name);
    setIsStudentDropdownOpen(false);

    // If student already has recorded grade in this session, prefill
    const existing = gradedStudents.find((g) => g.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (existing) {
      setUserAnswers(existing.mcq_answers || {});
      setEssayScores(existing.essay_scores || [0, 0, 0, 0, 0]);
      setManualScore(null);
      setToastMessage({ text: `Memuat data nilai tersimpan: ${name}`, type: 'success' });
    } else {
      resetGradingForm();
    }
  };

  const handleSaveStudent = async () => {
    if (!activeSession) return;
    if (!selectedStudentName.trim()) {
      setToastMessage({ text: 'Pilih atau ketik nama siswa terlebih dahulu!', type: 'error' });
      return;
    }

    if (!calculation) return;

    const matchedStudent = classStudents.find(
      (cs) => cs.fullName?.toLowerCase().trim() === selectedStudentName.toLowerCase().trim()
    );

    try {
      const saved = await ExamCorrectionRepository.saveGradedStudent({
        session_id: activeSession.id,
        name: selectedStudentName.trim(),
        student_user_id: matchedStudent?.id,
        mcq_answers: userAnswers,
        essay_scores: essayScores,
        mcq_score: manualScore !== null ? manualScore : Math.round(calculation.score),
        essay_score: manualScore !== null ? manualScore : Math.round(calculation.essayScore),
        final_score: effectiveFinalScore,
        csi: calculation.csi,
        lps: calculation.lps,
        correct: calculation.correct,
        wrong: calculation.wrong,
        answer_key: activeSession.answer_key,
      });

      // Update local state list
      setGradedStudents((prev) => {
        const index = prev.findIndex((s) => s.name.toLowerCase().trim() === saved.name.toLowerCase().trim());
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = saved;
          return clone;
        }
        return [...prev, saved];
      });

      setToastMessage({ text: `Nilai ${saved.name} (${effectiveFinalScore}) berhasil disimpan!`, type: 'success' });

      // Auto-advance to next ungraded student
      const remainingUngraded = filteredStudents.filter(
        (s) => !s.isGraded && s.name.toLowerCase().trim() !== selectedStudentName.toLowerCase().trim()
      );
      if (remainingUngraded.length > 0) {
        handleSelectStudent(remainingUngraded[0].name);
      } else {
        resetGradingForm();
        setSelectedStudentName('');
        setStudentSearchQuery('');
      }
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to save student score:', err);
      const errMsg = err?.message ? `Gagal menyimpan nilai: ${err.message}` : 'Gagal menyimpan nilai siswa. Periksa koneksi!';
      setToastMessage({ text: errMsg, type: 'error' });
    }
  };

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = selectedSubject === 'CUSTOM' ? customSubject.trim() : selectedSubject;

    if (!finalSubject) {
      setToastMessage({ text: 'Mata pelajaran wajib diisi!', type: 'error' });
      return;
    }

    if (previewNewKeys.length === 0) {
      setToastMessage({ text: 'Kunci jawaban belum valid! Masukkan minimal 1 butir soal.', type: 'error' });
      return;
    }

    const defaultSessionName = sessionName.trim()
      ? sessionName.trim()
      : `${examType} - ${finalSubject} - ${selectedClass} (${academicYear})`;

    try {
      const created = await ExamCorrectionRepository.saveSession({
        session_name: defaultSessionName,
        teacher: teacherName.trim() || currentUser?.full_name || 'Guru Pengampu',
        subject: finalSubject,
        class_name: selectedClass,
        class_code: normalizeClassCode(selectedClass),
        owner_user_id: currentUser?.id,
        school_level: selectedClass === 'SMA' ? 'SMA' : 'SMP',
        answer_key: previewNewKeys,
        student_list: [],
        kkm: Number(kkm) || 75,
        academic_year: academicYear,
        semester: semester,
        exam_type: examType,
        scoring_config: {
          pgWeight: 0.7,
          essayWeight: 0.3,
          essayMaxScore: 20,
          essayCount: 5,
        },
      });

      setSessions((prev) => [created, ...prev]);
      setIsCreatingSession(false);
      setToastMessage({ text: 'Sesi ujian berhasil dibuat!', type: 'success' });
      await handleSelectSession(created);
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to create session:', err);
      const errMsg = err?.message ? `Gagal membuat sesi: ${err.message}` : 'Gagal membuat sesi ujian!';
      setToastMessage({ text: errMsg, type: 'error' });
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Yakin ingin menghapus sesi ujian ini beserta seluruh nilai siswa di dalamnya?')) {
      return;
    }
    try {
      await ExamCorrectionRepository.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setActiveTab('sessions');
      }
      setToastMessage({ text: 'Sesi ujian berhasil dihapus!', type: 'success' });
    } catch (err) {
      logger.error('QuestionCorrectionModal', 'Failed to delete session:', err);
      setToastMessage({ text: 'Gagal menghapus sesi ujian.', type: 'error' });
    }
  };

  const handleDeleteStudentGrade = async (studentId: string) => {
    if (!window.confirm('Hapus nilai siswa ini?')) return;
    try {
      await ExamCorrectionRepository.deleteGradedStudent(studentId);
      setGradedStudents((prev) => prev.filter((s) => s.id !== studentId));
      setToastMessage({ text: 'Nilai siswa berhasil dihapus.', type: 'success' });
    } catch {
      setToastMessage({ text: 'Gagal menghapus nilai siswa.', type: 'error' });
    }
  };

  // Class Summary for Recap
  const classSummary = useMemo(() => {
    const totalCount = Math.max(classStudents.length, gradedStudents.length);
    return ExamCorrectionRepository.computeClassSummary(
      gradedStudents,
      Number(activeSession?.kkm) || 75,
      totalCount
    );
  }, [classStudents.length, gradedStudents, activeSession?.kkm]);

  if (!isOpen) return null;

  // Role Guard Check
  if (!isAuthorizedRole) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Akses Fitur Terbatas</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Fitur Koreksi Soal & Nilai tersedia untuk Guru Pengampu dan petugas Akademik.
              Peran akun Anda saat ini ({userRole}) tidak memiliki otorisasi untuk membuka modul ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-correction-title"
      className="fixed inset-0 z-50 flex sm:items-center sm:justify-center bg-slate-950 sm:bg-slate-950/80 sm:backdrop-blur-md animate-fadeIn"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-100 px-4 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 border animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-500/50'
              : 'bg-rose-900 text-rose-100 border-rose-500/50'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertOctagon className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Modal Card: Full screen on mobile (<640px), Centered card on desktop (>=640px) */}
      <div className="bg-slate-900 text-slate-100 w-full h-dvh sm:h-auto sm:max-w-5xl sm:max-h-[94vh] sm:rounded-2xl sm:border sm:border-slate-700/60 shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* Top Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-md shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="question-correction-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Koreksi Soal & Input Nilai
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full shrink-0">
                  GradeMaster In-App
                </span>
                {isReadOnly && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full shrink-0">
                    Peninjauan (Read-Only)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeSession
                  ? `${activeSession.subject} • Kelas ${activeSession.class_name} • KKM: ${activeSession.kkm}`
                  : 'Pemeriksaan lembar jawaban ujian & kalkulasi nilai otomatis'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-4 sm:px-6 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                activeTab === 'sessions'
                  ? 'bg-[#18536B] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Daftar Sesi</span>
            </button>

            {activeSession && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('grading')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                    activeTab === 'grading'
                      ? 'bg-[#18536B] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Lembar Koreksi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('recap')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                    activeTab === 'recap'
                      ? 'bg-[#18536B] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Rekap Nilai ({gradedStudents.length})</span>
                </button>
              </>
            )}
          </div>

          {activeTab === 'sessions' && !isCreatingSession && !isReadOnly && (
            <button
              type="button"
              onClick={() => setIsCreatingSession(true)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 min-h-9"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Sesi Ujian</span>
            </button>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60">
          {/* ========================================================================= */}
          {/* TAB 1: SESSIONS LIST & NEW SESSION FORM */}
          {/* ========================================================================= */}
          {activeTab === 'sessions' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {isCreatingSession ? (
                <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div>
                      <h3 className="text-base font-bold text-white">Buat Sesi Koreksi Ujian Baru</h3>
                      <p className="text-xs text-slate-400">
                        Isi data mata pelajaran, rombel, dan kunci jawaban soal pilihan ganda
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSession(false)}
                      className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Batal
                    </button>
                  </div>

                  <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Mata Pelajaran</label>
                        <select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                        >
                          {PREDEFINED_SUBJECTS.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                          <option value="CUSTOM">+ Ketik Mapel Lain...</option>
                        </select>
                      </div>

                      {selectedSubject === 'CUSTOM' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Nama Mata Pelajaran</label>
                          <input
                            type="text"
                            value={customSubject}
                            onChange={(e) => setCustomSubject(e.target.value)}
                            placeholder="Contoh: Geografi, Fisika..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Kelas / Rombel</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                        >
                          {PREDEFINED_CLASSES.map((cls) => (
                            <option key={cls} value={cls}>
                              Kelas {cls}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Jenis Ujian</label>
                        <select
                          value={examType}
                          onChange={(e) => setExamType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                        >
                          {PREDEFINED_EXAM_TYPES.map((et) => (
                            <option key={et} value={et}>
                              {et}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Nilai KKM (Standar Kelulusan)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={kkm}
                          onChange={(e) => setKkm(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Tahun Ajaran</label>
                        <select
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                        >
                          <option value="2024/2025">2024/2025</option>
                          <option value="2025/2026">2025/2026</option>
                          <option value="2026/2027">2026/2027</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Semester</label>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                        >
                          <option value="Ganjil">Ganjil</option>
                          <option value="Genap">Genap</option>
                        </select>
                      </div>
                    </div>

                    {/* Answer Key Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-300">
                          Kunci Jawaban Soal Pilihan Ganda (PG)
                        </label>
                        <span className="text-[11px] font-bold text-teal-400">
                          {previewNewKeys.length} Soal Terdeteksi
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A atau ABCDABCD"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50 font-mono"
                        required
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Format fleksibel: Mendukung format bernomor (<code>1.A 2.B 3.C</code>) maupun urutan huruf berspasi (<code>A B C D</code>).
                      </p>

                      {/* Preview Key Pills */}
                      {previewNewKeys.length > 0 && (
                        <div className="mt-2.5 p-2.5 bg-slate-900/80 rounded-xl border border-slate-700/80 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {previewNewKeys.map((ans, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-teal-500/15 border border-teal-500/30 rounded text-[10px] font-black text-teal-300 font-mono"
                            >
                              {idx + 1}.{ans}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Optional Custom Session Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Nama Sesi / Judul Lembar (Opsional)
                      </label>
                      <input
                        type="text"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="Otomatis digenerate jika dikosongkan..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingSession(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-900/30 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan & Mulai Koreksi</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Sesi Koreksi Terdaftar di Supabase</h3>
                      <p className="text-xs text-slate-400">
                        {sessions.length} total sesi • {sessionsWithKeyCount} siap koreksi • {sessionsWithoutKeyCount} perlu kunci
                      </p>
                    </div>

                    {/* Status Filter Badges */}
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSessionStatusFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          sessionStatusFilter === 'ALL'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Semua ({sessions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSessionStatusFilter('WITH_KEY')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                          sessionStatusFilter === 'WITH_KEY'
                            ? 'bg-emerald-600 text-white'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Siap ({sessionsWithKeyCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSessionStatusFilter('WITHOUT_KEY')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                          sessionStatusFilter === 'WITHOUT_KEY'
                            ? 'bg-amber-600 text-slate-950'
                            : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        <AlertCircle className="w-3 h-3" />
                        Perlu Kunci ({sessionsWithoutKeyCount})
                      </button>
                    </div>
                  </div>

                  {/* Search Bar & Class Filter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative grow">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={sessionSearchQuery}
                        onChange={(e) => setSessionSearchQuery(e.target.value)}
                        placeholder="Cari sesi ujian, mapel, atau guru..."
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-9 pr-8 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                      />
                      {sessionSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSessionSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                      <button
                        type="button"
                        onClick={() => setSessionClassFilter('ALL')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                          sessionClassFilter === 'ALL'
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Semua Kelas
                      </button>
                      {PREDEFINED_CLASSES.map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setSessionClassFilter(cls)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                            sessionClassFilter === cls
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Offline Cache Banner */}
                  {loadState === 'OFFLINE_CACHE' && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Mode Offline: Menampilkan {sessions.length} sesi dari cache draft lokal (belum tersinkron dengan cloud).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadSessions(true)}
                        className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                      >
                        <RefreshCw className="w-3 h-3" /> Coba Sinkron
                      </button>
                    </div>
                  )}

                  {/* Loading / Retrying Skeleton */}
                  {(loadState === 'LOADING_SESSIONS' || loadState === 'RETRYING') ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 animate-pulse space-y-3">
                          <div className="flex justify-between">
                            <div className="h-4 bg-slate-700 rounded w-20"></div>
                            <div className="h-4 bg-slate-700 rounded w-12"></div>
                          </div>
                          <div className="h-5 bg-slate-700 rounded w-3/4"></div>
                          <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                          <div className="pt-2 border-t border-slate-700/40 flex justify-between">
                            <div className="h-3 bg-slate-700 rounded w-24"></div>
                            <div className="h-4 bg-slate-700 rounded w-16"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : loadState === 'NETWORK_ERROR' ? (
                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-8 text-center space-y-3">
                      <WifiOff className="w-10 h-10 text-rose-400 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Gagal Terhubung ke Database Cloud</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        {loadErrorMessage || 'Koneksi jaringan terputus atau backend Supabase tidak merespons.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => loadSessions(true)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                      </button>
                    </div>
                  ) : loadState === 'PERMISSION_DENIED' ? (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-8 text-center space-y-3">
                      <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Akses Data Dibatasi (RLS)</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Kebijakan Row Level Security hanya mengizinkan guru melihat sesi miliknya sendiri, atau akun Anda belum memiliki hak akses penuh.
                      </p>
                      <button
                        type="button"
                        onClick={() => loadSessions(true)}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Segarkan Sesi
                      </button>
                    </div>
                  ) : loadState === 'MIGRATION_REQUIRED' ? (
                    <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-8 text-center space-y-3">
                      <Database className="w-10 h-10 text-indigo-400 mx-auto" />
                      <h4 className="text-sm font-bold text-white">Perlu Sinkronisasi Skema Database</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Kolom baru (owner_user_id / class_code) belum terpasang di PostgreSQL. Silakan jalankan berkas migration <code className="bg-slate-800 px-1 py-0.5 rounded text-teal-300">sql/26_exam_correction_rls_overhaul.sql</code> pada Supabase SQL Editor.
                      </p>
                      <button
                        type="button"
                        onClick={() => loadSessions(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Periksa Ulang
                      </button>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="bg-slate-800/60 rounded-2xl p-8 text-center border border-slate-800">
                      <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-slate-300 mb-1">Belum Ada Sesi Ujian</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                        {isReadOnly
                          ? 'Belum ada sesi ujian yang dibuat oleh guru pengampu.'
                          : 'Buat sesi ujian baru dengan kunci jawaban untuk memulai proses koreksi lembar siswa secara instan.'}
                      </p>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingSession(true)}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Buat Sesi Baru
                        </button>
                      )}
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="bg-slate-800/40 rounded-2xl p-8 text-center border border-slate-800/80">
                      <Filter className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-slate-300 mb-1">Tidak Ada Sesi yang Sesuai Filter</h4>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Coba ubah kata kunci pencarian atau reset filter status / kelas.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionSearchQuery('');
                          setSessionClassFilter('ALL');
                          setSessionStatusFilter('ALL');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                      >
                        Reset Filter
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {filteredSessions.map((sess) => {
                        const keyCount = Array.isArray(sess.answer_key) ? sess.answer_key.length : 0;
                        const hasKey = keyCount > 0;

                        return (
                          <div
                            key={sess.id}
                            onClick={() => handleSelectSession(sess)}
                            className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/50 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between shadow-sm hover:shadow-md"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-700 text-slate-300 rounded-md">
                                  Kelas {sess.class_name} • {sess.school_level}
                                </span>
                                <span className="text-[10px] font-bold text-teal-400">
                                  KKM {sess.kkm}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-2">
                                {sess.session_name}
                              </h4>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-slate-400 font-medium">
                                  {sess.subject}
                                </span>
                                <span className="text-slate-600">•</span>
                                {hasKey ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    {keyCount} Soal PG
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Kunci Belum Diisi
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="truncate max-w-35">Guru: {sess.teacher}</span>
                              <div className="flex items-center gap-1.5">
                                {!isReadOnly && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenKeyEditor(sess, e)}
                                      className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 flex items-center gap-1 transition-colors"
                                      title="Atur Kunci Jawaban"
                                    >
                                      <Key className="w-3 h-3 text-teal-400" />
                                      <span>{hasKey ? 'Edit Kunci' : 'Atur Kunci'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteSession(sess.id, e)}
                                      className="p-1 rounded hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                      title="Hapus Sesi"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <span className="text-teal-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform ml-1">
                                  Buka <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INTERACTIVE GRADING LAYER */}
          {/* ========================================================================= */}
          {activeTab === 'grading' && activeSession && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start max-w-5xl mx-auto">
              {/* Left Column: Student Selector & Answer Sheet */}
              <div className="lg:col-span-8 space-y-4">
                {/* Class Mapping Warning if no students found in master */}
                {classStudents.length === 0 && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Informasi Master Siswa:</span> Belum ada data siswa untuk kelas{' '}
                      <span className="font-bold underline">{activeSession.class_name}</span> (kode: {activeSession.class_code || normalizeClassCode(activeSession.class_name)}) pada direktori sekolah.
                      Anda tetap dapat mengetik nama siswa secara manual pada input pencarian di bawah.
                    </div>
                  </div>
                )}

                {/* Student Selector Card */}
                <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 relative z-30 shadow-sm" ref={dropdownRef}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-400" />
                      Pilih Siswa (Kelas {activeSession.class_name})
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {gradedStudents.length} / {classStudents.length || filteredStudents.length} Sudah Dinilai
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setIsStudentDropdownOpen(true);
                      }}
                      onFocus={() => setIsStudentDropdownOpen(true)}
                      placeholder="Ketik atau pilih nama siswa..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50 min-h-11"
                    />
                  </div>

                  {/* Dropdown Menu */}
                  {isStudentDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-50 p-1.5">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((stu) => (
                          <button
                            key={stu.name}
                            type="button"
                            onClick={() => handleSelectStudent(stu.name)}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center justify-between transition-colors min-h-10"
                          >
                            <span>{stu.name}</span>
                            {stu.isGraded ? (
                              <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Dinilai
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-semibold">Belum</span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          Siswa tidak ditemukan. Ketik nama untuk menambahkan siswa baru.
                          <button
                            type="button"
                            onClick={() => handleSelectStudent(studentSearchQuery.trim())}
                            className="mt-2 w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold"
                          >
                            Gunakan &quot;{studentSearchQuery.trim()}&quot;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Keypad Sheet */}
                <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Lembar Jawaban Siswa</span>
                      <span className="text-[11px] text-slate-400">
                        ({Object.keys(userAnswers).length} / {activeSession.answer_key?.length || 0} Terjawab)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenKeyEditor(activeSession)}
                        className="px-2 py-0.5 rounded-md bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors ml-1"
                        title="Edit Kunci Jawaban Sesi Ini"
                      >
                        <Key className="w-3 h-3" />
                        <span>{activeSession.answer_key && activeSession.answer_key.length > 0 ? `Kunci (${activeSession.answer_key.length})` : 'Atur Kunci'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={undoStack.current.length === 0}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-all"
                        title="Urungkan Pilihan Terakhir"
                      >
                        <Undo2 className="w-3 h-3" /> Undo
                      </button>
                      <button
                        type="button"
                        onClick={resetGradingForm}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-slate-200 flex items-center gap-1 transition-all"
                        title="Reset Lembar Jawaban Siswa"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    </div>
                  </div>

                  {/* Inline Warning & Quick Setup if No Answer Key */}
                  {(!activeSession.answer_key || activeSession.answer_key.length === 0) ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 my-2">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Sesi ini belum memiliki Kunci Jawaban PG</h4>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">
                            Kunci jawaban diperlukan untuk menampilkan butir soal dan menghitung nilai otomatis. Masukkan kunci jawaban di bawah ini:
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={quickKeyInput}
                          onChange={(e) => setQuickKeyInput(e.target.value)}
                          placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A 6.B ... atau ABCDABCD"
                          className="grow bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveKeyEditor(activeSession, quickKeyInput)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 shadow-md transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4 text-slate-950" />
                          <span>Simpan Kunci</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* List of Questions with Keypad Buttons */
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {activeSession.answer_key.map((correctKey, index) => {
                        const qNum = index + 1;
                        const studentAns = userAnswers[qNum];
                        const isAnswered = !!studentAns;
                        const isCorrect = isAnswered && studentAns.toUpperCase() === correctKey.toUpperCase();

                        return (
                          <div
                            key={qNum}
                            ref={(el) => {
                              if (el) questionRefs.current.set(qNum, el);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                              isAnswered
                                ? isCorrect
                                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                                : 'bg-slate-900/60 border-slate-700/70 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs text-slate-300">
                                {qNum}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {availableOptions.map((opt) => {
                                  const isSelected = studentAns === opt;
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => handleAnswerSelect(qNum, opt)}
                                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs font-black transition-all flex items-center justify-center min-h-9 ${
                                        isSelected
                                          ? isCorrect
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/50 scale-105 ring-2 ring-emerald-300'
                                            : 'bg-rose-500 text-white shadow-md shadow-rose-900/50 scale-105 ring-2 ring-rose-300'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60 active:scale-95'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pr-1">
                              {isAnswered && (
                                isCorrect ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                ) : (
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                    <XCircle className="w-4 h-4" />
                                    <span className="text-[10px] text-slate-400 font-normal">Kunci: {correctKey}</span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Score Summary & Actions (Sticky Desktop) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-800/95 rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-lg space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Skor Akhir Siswa
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-5xl font-black text-white leading-none">
                        {effectiveFinalScore}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">/ 100</span>
                    </div>

                    {effectiveFinalScore >= (Number(activeSession.kkm) || 75) ? (
                      <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ✓ TUNTAS KKM ({getScoreLabel(effectiveFinalScore)})
                      </span>
                    ) : (
                      <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                        ⚠️ BELUM TUNTAS (REMEDIAL)
                      </span>
                    )}
                  </div>

                  {/* Manual Score Override */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Koreksi Nilai Manual (Opsional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualScore === null ? '' : manualScore}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setManualScore(val);
                        }}
                        placeholder="Ketik nilai langsung..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                      />
                      {manualScore !== null && (
                        <button
                          type="button"
                          onClick={() => setManualScore(null)}
                          className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-slate-300"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Correct vs Wrong Stats */}
                  {calculation && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-400 block">Benar</span>
                        <span className="text-xl font-black text-emerald-300">{calculation.correct}</span>
                      </div>
                      <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-rose-400 block">Salah</span>
                        <span className="text-xl font-black text-rose-300">{calculation.wrong}</span>
                      </div>
                    </div>
                  )}

                  {/* CSI & LPS Metrics */}
                  {calculation && (
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-black text-teal-400 uppercase tracking-wider block">CSI (Kognitif)</span>
                        <span className="text-sm font-bold text-white">{calculation.csi}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{getCsiLabel(calculation.csi)}</span>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider block">LPS (Performa)</span>
                        <span className="text-sm font-bold text-white">{calculation.lps}</span>
                      </div>
                    </div>
                  )}

                  {/* Optional Essay Inputs (Scale 0 - 4 each) */}
                  <div className="pt-2 border-t border-slate-700/70">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Nilai Essay (5 Soal, maks 4/soal)
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {essayScores.map((score, idx) => (
                        <div key={idx} className="text-center">
                          <span className="text-[9px] text-slate-400 block mb-0.5">#{idx + 1}</span>
                          <input
                            type="number"
                            min="0"
                            max="4"
                            value={score}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(4, parseInt(e.target.value, 10) || 0));
                              setEssayScores((prev) => {
                                const next = [...prev];
                                next[idx] = val;
                                return next;
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-black text-teal-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save Button / Read-only Notice */}
                  <div className="pt-2">
                    {isReadOnly ? (
                      <div className="w-full py-3 px-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-center text-xs text-amber-300 font-semibold min-h-12 flex items-center justify-center">
                        Mode Peninjauan: Kepala Sekolah tidak dapat mengubah nilai siswa secara langsung.
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveStudent}
                        disabled={!selectedStudentName.trim()}
                        className="w-full py-3 bg-linear-to-r from-teal-600 to-[#18536B] hover:from-teal-500 hover:to-[#023246] disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-950/50 flex items-center justify-center gap-2 transition-all min-h-12 active:scale-[0.98]"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan & Siswa Berikutnya</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CLASS RECAP & EXCEL EXPORT */}
          {/* ========================================================================= */}
          {activeTab === 'recap' && activeSession && (
            <div className="space-y-5 max-w-5xl mx-auto">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Nilai</span>
                  <span className="text-2xl font-black text-teal-300 mt-1 block">{classSummary.averageScore}</span>
                </div>
                <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tertinggi / Terendah</span>
                  <span className="text-2xl font-black text-white mt-1 block">
                    {classSummary.highestScore} <span className="text-xs text-slate-400 font-normal">/ {classSummary.lowestScore}</span>
                  </span>
                </div>
                <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tuntas KKM</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">
                    {classSummary.passedCount} <span className="text-xs text-slate-400 font-normal">({classSummary.passRate}%)</span>
                  </span>
                </div>
                <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remedial</span>
                  <span className="text-2xl font-black text-rose-400 mt-1 block">{classSummary.remedialCount}</span>
                </div>
              </div>

              {/* Action Bar: Export Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <div className="text-xs text-slate-300 font-semibold">
                  Total Nilai Terekam: <span className="text-white font-bold">{gradedStudents.length} Siswa</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ExamCorrectionRepository.exportToExcel(activeSession, gradedStudents)}
                    disabled={gradedStudents.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all min-h-10"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Ekspor Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => ExamCorrectionRepository.exportToCSV(activeSession, gradedStudents)}
                    disabled={gradedStudents.length === 0}
                    className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all min-h-10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV</span>
                  </button>
                </div>
              </div>

              {/* Recap Table */}
              <div className="bg-slate-800/90 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-3.5 text-center w-12">No</th>
                        <th className="py-3 px-3.5">Nama Siswa</th>
                        <th className="py-3 px-3 text-center">Benar</th>
                        <th className="py-3 px-3 text-center">Salah</th>
                        <th className="py-3 px-3 text-center">Nilai PG</th>
                        <th className="py-3 px-3 text-center">Essay</th>
                        <th className="py-3 px-3.5 text-center">Skor Akhir</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                        <th className="py-3 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                      {gradedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            Belum ada siswa yang dinilai pada sesi ini. Buka tab Lembar Koreksi untuk memulai.
                          </td>
                        </tr>
                      ) : (
                        gradedStudents.map((s, idx) => {
                          const score = Number(s.final_score) || 0;
                          const isPassed = score >= (Number(activeSession.kkm) || 75);
                          return (
                            <tr key={s.id} className="hover:bg-slate-750/50 transition-colors">
                              <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3.5 font-bold text-white">{s.name}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{s.correct}</td>
                              <td className="py-2.5 px-3 text-center text-rose-400 font-bold">{s.wrong}</td>
                              <td className="py-2.5 px-3 text-center font-mono">{s.mcq_score}</td>
                              <td className="py-2.5 px-3 text-center font-mono">{s.essay_score}</td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span className="text-sm font-black text-white">{score}</span>
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                {isPassed ? (
                                  <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                                    Tuntas
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                                    Remedial
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectStudent(s.name);
                                      setActiveTab('grading');
                                    }}
                                    className="p-1 rounded text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                                    title="Edit Lembar Koreksi"
                                  >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                  </button>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStudentGrade(s.id)}
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                      title="Hapus Nilai Siswa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UNIVERSAL ANSWER KEY EDITOR MODAL */}
      {/* ========================================================================= */}
      {isKeyEditorModalOpen && (
        <div className="fixed inset-0 z-60 flex sm:items-center sm:justify-center bg-slate-950 sm:bg-slate-950/80 sm:backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 w-full h-dvh sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-700 p-4 sm:p-5 shadow-2xl flex flex-col justify-between sm:justify-start space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pengaturan Kunci Jawaban
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {editingSessionTarget?.session_name || activeSession?.session_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyEditorModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 sm:flex-initial">
              <label className="text-xs font-semibold text-slate-300">
                Kunci Jawaban PG (Bisa paste format 1.A 2.B atau ABCD...)
              </label>
              <textarea
                rows={5}
                value={quickKeyInput}
                onChange={(e) => setQuickKeyInput(e.target.value)}
                placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D atau ABCDABCD"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:ring-2 focus:ring-teal-500/50 focus:outline-hidden min-h-32"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Terdeteksi: <strong className="text-teal-400">{parseAnswerKey(quickKeyInput).length}</strong> butir soal PG</span>
                <span className="text-[10px] text-slate-500">Mendukung A, B, C, D, E</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsKeyEditorModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold min-h-11"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveKeyEditor()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-900/30 flex items-center gap-1.5 min-h-11"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Kunci</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
