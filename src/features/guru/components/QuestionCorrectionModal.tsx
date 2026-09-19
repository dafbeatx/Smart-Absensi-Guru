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
  Globe,
  ExternalLink,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  UserProfile,
  StudentItem,
} from '../../../types/database.types';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { AdministrationRepository, AVAILABLE_ACADEMIC_YEARS } from '../../../repositories/AdministrationRepository';
import { parseAnswerKey, calculateStudentResult, getScoreLabel, getCsiLabel } from '../../../utils/scoring.utils';
import { normalizeClassCode, areClassCodesEqual, resolveSchoolLevel } from '../../../utils/class.utils';
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

  // Navigation active tab: 'sessions' | 'grading' | 'recap' | 'grademaster_web'
  const [activeTab, setActiveTab] = useState<'sessions' | 'grading' | 'recap' | 'grademaster_web'>('sessions');

  const gradeMasterUrl = useMemo(() => {
    const teacher = encodeURIComponent(currentUser?.full_name || 'Guru');
    return `https://web-input-nilai.vercel.app/?embed=true&teacher=${teacher}#setup`;
  }, [currentUser?.full_name]);

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
  const [customClass, setCustomClass] = useState('');
  const [availableClasses, setAvailableClasses] = useState<string[]>(PREDEFINED_CLASSES);
  const [examType, setExamType] = useState('PTS / UTS');
  const [examFormat, setExamFormat] = useState<'PG_ONLY' | 'PG_AND_ESSAY'>('PG_ONLY');
  const [academicYear, setAcademicYear] = useState(() => AdministrationRepository.getActiveAcademicYear());
  const [semester, setSemester] = useState(() => {
    const s = AdministrationRepository.getActiveSemester();
    return s === 'GENAP' ? 'Genap' : 'Ganjil';
  });
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
      setAcademicYear(AdministrationRepository.getActiveAcademicYear());
      setSemester(AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil');

      // Populate classes dynamically from student directory
      StudentRepository.getStudents()
        .then((stus) => {
          if (Array.isArray(stus) && stus.length > 0) {
            const set = new Set<string>(PREDEFINED_CLASSES);
            stus.forEach((s) => {
              const norm = normalizeClassCode(s.className);
              if (norm) set.add(norm);
            });
            setAvailableClasses(Array.from(set));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentUser?.id, currentUser?.full_name, loadSessions]);

  // Escape key handler & prevent body scroll
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

    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
    let fullSession = session;
    try {
      const detailed = await ExamCorrectionRepository.getSessionById(session.id);
      if (detailed) {
        fullSession = detailed;
      }
    } catch (err) {
      logger.warn('QuestionCorrectionModal', 'Failed to fetch detailed session, using preview', err);
    }
    setActiveSession(fullSession);
    await loadSessionData(fullSession);
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
  const currentLevel = activeSession
    ? resolveSchoolLevel(activeSession.class_name, activeSession.school_level)
    : resolveSchoolLevel(selectedClass);
  const isSMA = currentLevel === 'SMA';
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
  const handleOpenKeyEditor = async (session: ExamSessionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionTarget(session);
    let keys = Array.isArray(session.answer_key) ? session.answer_key : [];
    if (keys.length === 0 && session.id) {
      try {
        const detailed = await ExamCorrectionRepository.getSessionById(session.id);
        if (detailed && Array.isArray(detailed.answer_key) && detailed.answer_key.length > 0) {
          keys = detailed.answer_key;
          setSessions((prev) => prev.map((s) => (s.id === session.id ? detailed : s)));
          if (activeSession?.id === session.id) {
            setActiveSession(detailed);
          }
        }
      } catch (err) {
        logger.warn('QuestionCorrectionModal', 'Failed to fetch detailed session for key editor', err);
      }
    }
    if (keys.length > 0) {
      setQuickKeyInput(keys.map((k, i) => `${i + 1}.${k}`).join(' '));
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
        school_level: resolveSchoolLevel(sessionToUpdate.class_name, sessionToUpdate.school_level),
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

  // Full, complete roster of students in the class (unfiltered by search query for reliable auto-advancement)
  const allClassStudentNames = useMemo(() => {
    const names = new Set<string>();
    classStudents.forEach((s) => {
      if (s.fullName?.trim()) names.add(s.fullName.trim());
    });
    if (activeSession?.student_list) {
      activeSession.student_list.forEach((n) => {
        if (n?.trim()) names.add(n.trim());
      });
    }
    gradedStudents.forEach((g) => {
      if (g.name?.trim()) names.add(g.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [classStudents, activeSession, gradedStudents]);

  const handleAnswerSelect = (questionNum: number, opt: string) => {
    const currentAns = userAnswers[questionNum];
    undoStack.current.push({ qNum: questionNum, prev: currentAns });

    // Toggle off if already selected
    if (currentAns === opt) {
      setUserAnswers((prev) => {
        const updated = { ...prev };
        delete updated[questionNum];
        return updated;
      });
      return;
    }

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
      
      // If student previously had a manual override, restore it
      const calcForExisting = calculateStudentResult(
        activeSession?.answer_key || [],
        existing.mcq_answers || {},
        existing.essay_scores || [0, 0, 0, 0, 0],
        activeSession?.scoring_config
      );
      if (Number(existing.final_score) !== calcForExisting.finalScore) {
        setManualScore(Number(existing.final_score) || 0);
      } else {
        setManualScore(null);
      }
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
        mcq_score: Math.round(calculation.score),
        essay_score: Math.round(calculation.essayScore),
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

      // Reliable auto-advance to next ungraded student from full class list
      const savedNameNorm = saved.name.toLowerCase().trim();
      const updatedGradedSet = new Set([
        ...gradedStudents.map((g) => g.name.toLowerCase().trim()),
        savedNameNorm,
      ]);

      const remainingUngraded = allClassStudentNames.filter(
        (name) => !updatedGradedSet.has(name.toLowerCase().trim())
      );

      if (remainingUngraded.length > 0) {
        const nextStudent = remainingUngraded[0];
        handleSelectStudent(nextStudent);
        setToastMessage({
          text: `Nilai ${saved.name} (${effectiveFinalScore}) disimpan! Lanjut ke: ${nextStudent}`,
          type: 'success',
        });
      } else {
        resetGradingForm();
        setSelectedStudentName('');
        setStudentSearchQuery('');
        setToastMessage({
          text: `Nilai ${saved.name} (${effectiveFinalScore}) disimpan! Seluruh siswa (${allClassStudentNames.length || gradedStudents.length + 1}) telah dinilai! 🎉`,
          type: 'success',
        });
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
    const finalClass = selectedClass === 'CUSTOM' ? customClass.trim().toUpperCase() : selectedClass;

    if (!finalSubject) {
      setToastMessage({ text: 'Mata pelajaran wajib diisi!', type: 'error' });
      return;
    }

    if (!finalClass) {
      setToastMessage({ text: 'Kelas / rombel wajib diisi!', type: 'error' });
      return;
    }

    if (previewNewKeys.length === 0) {
      setToastMessage({ text: 'Kunci jawaban belum valid! Masukkan minimal 1 butir soal.', type: 'error' });
      return;
    }

    const defaultSessionName = sessionName.trim()
      ? sessionName.trim()
      : `${examType} - ${finalSubject} - ${finalClass} (${academicYear})`;

    const isPgOnly = examFormat === 'PG_ONLY';

    try {
      const created = await ExamCorrectionRepository.saveSession({
        session_name: defaultSessionName,
        teacher: teacherName.trim() || currentUser?.full_name || 'Guru Pengampu',
        subject: finalSubject,
        class_name: finalClass,
        class_code: normalizeClassCode(finalClass),
        owner_user_id: currentUser?.id,
        school_level: resolveSchoolLevel(finalClass),
        answer_key: previewNewKeys,
        student_list: [],
        kkm: Number(kkm) || 75,
        academic_year: academicYear,
        semester: semester,
        exam_type: examType,
        scoring_config: isPgOnly
          ? {
              pgWeight: 1.0,
              essayWeight: 0,
              essayMaxScore: 0,
              essayCount: 0,
            }
          : {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Akses Fitur Terbatas</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Fitur Koreksi Soal & Nilai tersedia untuk Guru Pengampu dan petugas Akademik.
              Peran akun Anda saat ini ({userRole}) tidak memiliki otorisasi untuk membuka modul ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
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
      className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans animate-fadeIn"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-100 px-4 py-2.5 rounded-xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertOctagon className="w-4 h-4 text-rose-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Fullscreen Workspace Header */}
      <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="question-correction-title" className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                Koreksi Soal & Input Nilai
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 rounded-full shrink-0">
                GradeMaster In-App
              </span>
              {isReadOnly && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full shrink-0">
                  Peninjauan (Read-Only)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {activeSession
                ? `${activeSession.subject} • Kelas ${activeSession.class_name} • KKM: ${activeSession.kkm}`
                : 'Pemeriksaan lembar jawaban ujian & kalkulasi nilai otomatis'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <a
            href={gradeMasterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-medium transition-colors shadow-2xs"
            title="Buka Web Input Nilai (GradeMaster Cloud) di Tab Baru"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>Web Cloud</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Tab Navigation Bar */}
      <div className="px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
              activeTab === 'sessions'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                    ? 'bg-[#023246] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Rekap Nilai ({gradedStudents.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('grademaster_web')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
              activeTab === 'grademaster_web'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>GradeMaster Web</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${
              activeTab === 'grademaster_web'
                ? 'bg-teal-500/20 text-teal-200 border-teal-400/30'
                : 'bg-teal-50 text-teal-700 border-teal-200'
            }`}>
              Cloud
            </span>
          </button>
        </div>

        {activeTab === 'sessions' && !isCreatingSession && !isReadOnly && (
          <button
            type="button"
            onClick={() => setIsCreatingSession(true)}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 min-h-9"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Sesi Ujian</span>
          </button>
        )}
      </div>

      {/* Modal Body Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F8FAFC]">
        {/* ========================================================================= */}
        {/* TAB 1: SESSIONS LIST & NEW SESSION FORM */}
        {/* ========================================================================= */}
        {activeTab === 'sessions' && (
          <div className="space-y-6 max-w-6xl mx-auto w-full">
            {isCreatingSession ? (
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Buat Sesi Koreksi Ujian Baru</h3>
                    <p className="text-xs text-slate-500">
                      Isi data mata pelajaran, rombel, dan kunci jawaban soal pilihan ganda
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingSession(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Batal
                  </button>
                </div>

                <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
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
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                        <input
                          type="text"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="Contoh: Geografi, Fisika..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Kelas / Rombel</label>
                      <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      >
                        {availableClasses.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls === 'SMA' ? 'SMA (Umum)' : `Kelas ${cls}`} ({resolveSchoolLevel(cls)})
                          </option>
                        ))}
                        <option value="CUSTOM">+ Ketik Kelas Lain...</option>
                      </select>
                    </div>

                    {selectedClass === 'CUSTOM' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kelas Kustom</label>
                        <input
                          type="text"
                          value={customClass}
                          onChange={(e) => setCustomClass(e.target.value)}
                          placeholder="Contoh: 10A, 11-IPA, 8C, XII-1..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 uppercase font-mono"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Format Lembar Soal</label>
                      <select
                        value={examFormat}
                        onChange={(e) => setExamFormat(e.target.value as 'PG_ONLY' | 'PG_AND_ESSAY')}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-semibold"
                      >
                        <option value="PG_ONLY">Pilihan Ganda Saja (100% PG)</option>
                        <option value="PG_AND_ESSAY">Kombinasi PG (70%) + Essay (30%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Ujian</label>
                      <select
                        value={examType}
                        onChange={(e) => setExamType(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      >
                        {PREDEFINED_EXAM_TYPES.map((et) => (
                          <option key={et} value={et}>
                            {et}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nilai KKM (Standar Kelulusan)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={kkm}
                        onChange={(e) => setKkm(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                      <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      >
                        {AVAILABLE_ACADEMIC_YEARS.map((ay) => (
                          <option key={ay.year} value={ay.year}>
                            {ay.label || ay.year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </div>
                  </div>

                  {/* Answer Key Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Kunci Jawaban Soal Pilihan Ganda (PG)
                      </label>
                      <span className="text-[11px] font-bold text-teal-700">
                        {previewNewKeys.length} Soal Terdeteksi
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A atau ABCDABCD"
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Format fleksibel: Mendukung format bernomor (<code>1.A 2.B 3.C</code>) maupun urutan huruf berspasi (<code>A B C D</code>).
                    </p>

                    {/* Preview Key Pills */}
                    {previewNewKeys.length > 0 && (
                      <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {previewNewKeys.map((ans, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-teal-50 border border-teal-200 rounded text-[10px] font-black text-teal-700 font-mono"
                          >
                            {idx + 1}.{ans}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Optional Custom Session Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Sesi / Judul Lembar (Opsional)
                    </label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="Otomatis digenerate jika dikosongkan..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSession(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
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
                    <h3 className="text-sm font-bold text-slate-900">Sesi Koreksi Terdaftar di Supabase</h3>
                    <p className="text-xs text-slate-500">
                      {sessions.length} total sesi • {sessionsWithKeyCount} siap koreksi • {sessionsWithoutKeyCount} perlu kunci
                    </p>
                  </div>

                  {/* Status Filter Badges */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setSessionStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        sessionStatusFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({sessions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionStatusFilter('WITH_KEY')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                        sessionStatusFilter === 'WITH_KEY'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-emerald-700 hover:text-emerald-800'
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
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-amber-700 hover:text-amber-800'
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
                      className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                    {sessionSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSessionSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
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
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offline Cache Banner */}
                {loadState === 'OFFLINE_CACHE' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Mode Offline: Menampilkan {sessions.length} sesi dari cache draft lokal (belum tersinkron dengan cloud).</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadSessions(true)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold flex items-center gap-1 transition-colors text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" /> Coba Sinkron
                    </button>
                  </div>
                )}

                {/* Loading / Retrying Skeleton */}
                {(loadState === 'LOADING_SESSIONS' || loadState === 'RETRYING') ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs animate-pulse space-y-3">
                        <div className="flex justify-between">
                          <div className="h-4 bg-slate-200 rounded w-20"></div>
                          <div className="h-4 bg-slate-200 rounded w-12"></div>
                        </div>
                        <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        <div className="pt-2 border-t border-slate-100 flex justify-between">
                          <div className="h-3 bg-slate-200 rounded w-24"></div>
                          <div className="h-4 bg-slate-200 rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loadState === 'NETWORK_ERROR' ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
                    <WifiOff className="w-10 h-10 text-rose-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">Gagal Terhubung ke Database Cloud</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      {loadErrorMessage || 'Koneksi jaringan terputus atau backend Supabase tidak merespons.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => loadSessions(true)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                    </button>
                  </div>
                ) : loadState === 'PERMISSION_DENIED' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                    <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">Akses Data Dibatasi (RLS)</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Kebijakan Row Level Security hanya mengizinkan guru melihat sesi miliknya sendiri, atau akun Anda belum memiliki hak akses penuh.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadSessions(true)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Segarkan Sesi
                    </button>
                  </div>
                ) : loadState === 'MIGRATION_REQUIRED' ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-8 text-center space-y-3">
                    <Database className="w-10 h-10 text-indigo-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900">Perlu Sinkronisasi Skema Database</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Kolom baru (owner_user_id / class_code) belum terpasang di PostgreSQL. Silakan jalankan berkas migration <code className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded font-mono">sql/26_exam_correction_rls_overhaul.sql</code> pada Supabase SQL Editor.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadSessions(true)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Periksa Ulang
                    </button>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 shadow-xs">
                    <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Belum Ada Sesi Ujian</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                      {isReadOnly
                        ? 'Belum ada sesi ujian yang dibuat oleh guru pengampu.'
                        : 'Buat sesi ujian baru dengan kunci jawaban untuk memulai proses koreksi lembar siswa secara instan.'}
                    </p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingSession(true)}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Buat Sesi Baru
                      </button>
                    )}
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/90 shadow-xs">
                    <Filter className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-800 mb-1">Tidak Ada Sesi yang Sesuai Filter</h4>
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
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
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
                          className="group bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-teal-500/40 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                                Kelas {sess.class_name} • {resolveSchoolLevel(sess.class_name, sess.school_level)}
                              </span>
                              <span className="text-[10px] font-bold text-teal-700">
                                KKM {sess.kkm}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-2">
                              {sess.session_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs text-slate-600 font-medium">
                                {sess.subject}
                              </span>
                              <span className="text-slate-300">•</span>
                              {hasKey ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  {keyCount} Soal PG
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Kunci Belum Diisi
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="truncate max-w-35">Guru: {sess.teacher}</span>
                            <div className="flex items-center gap-1.5">
                              {!isReadOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenKeyEditor(sess, e)}
                                    className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-colors"
                                    title="Atur Kunci Jawaban"
                                  >
                                    <Key className="w-3 h-3 text-teal-600" />
                                    <span>{hasKey ? 'Edit Kunci' : 'Atur Kunci'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSession(sess.id, e)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Hapus Sesi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <span className="text-teal-700 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform ml-1">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start max-w-7xl mx-auto w-full">
            {/* Left Column: Student Selector & Answer Sheet */}
            <div className="lg:col-span-8 space-y-4">
              {/* Class Mapping Warning if no students found in master */}
              {classStudents.length === 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Informasi Master Siswa:</span> Belum ada data siswa untuk kelas{' '}
                    <span className="font-bold underline">{activeSession.class_name}</span> (kode: {activeSession.class_code || normalizeClassCode(activeSession.class_name)}) pada direktori sekolah.
                    Anda tetap dapat mengetik nama siswa secara manual pada input pencarian di bawah.
                  </div>
                </div>
              )}

              {/* Student Selector Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 relative z-30 shadow-xs" ref={dropdownRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    Pilih Siswa (Kelas {activeSession.class_name})
                  </label>
                  <span className="text-[11px] text-slate-500">
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
                    className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 min-h-11 transition-colors"
                  />
                </div>

                {/* Dropdown Menu */}
                {isStudentDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 p-1.5">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((stu) => (
                        <button
                          key={stu.name}
                          type="button"
                          onClick={() => handleSelectStudent(stu.name)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-between transition-colors min-h-10"
                        >
                          <span>{stu.name}</span>
                          {stu.isGraded ? (
                            <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Dinilai
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">Belum</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-500">
                        Siswa tidak ditemukan. Ketik nama untuk menambahkan siswa baru.
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(studentSearchQuery.trim())}
                          className="mt-2 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          Gunakan &quot;{studentSearchQuery.trim()}&quot;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Question Keypad Sheet */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Lembar Jawaban Siswa</span>
                    <span className="text-[11px] text-slate-500">
                      ({Object.keys(userAnswers).length} / {activeSession.answer_key?.length || 0} Terjawab)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenKeyEditor(activeSession)}
                      className="px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-bold flex items-center gap-1 transition-colors ml-1"
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
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-[11px] font-bold text-slate-700 border border-slate-200 flex items-center gap-1 transition-all"
                      title="Urungkan Pilihan Terakhir"
                    >
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                    <button
                      type="button"
                      onClick={resetGradingForm}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 border border-slate-200 flex items-center gap-1 transition-all"
                      title="Reset Lembar Jawaban Siswa"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                </div>

                {/* Inline Warning & Quick Setup if No Answer Key */}
                {(!activeSession.answer_key || activeSession.answer_key.length === 0) ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 my-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Sesi ini belum memiliki Kunci Jawaban PG</h4>
                        <p className="text-[11px] text-amber-800 mt-0.5">
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
                        className="grow bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveKeyEditor(activeSession, quickKeyInput)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
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
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50/80 border-rose-200 text-rose-900'
                              : 'bg-slate-50/80 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shadow-2xs">
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
                                          ? 'bg-emerald-600 text-white shadow-xs scale-105 ring-2 ring-emerald-300'
                                          : 'bg-rose-600 text-white shadow-xs scale-105 ring-2 ring-rose-300'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs active:scale-95'
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
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                  <XCircle className="w-4 h-4" />
                                  <span className="text-[10px] text-slate-500 font-normal">Kunci: {correctKey}</span>
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
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Skor Akhir Siswa
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black text-slate-900 leading-none">
                      {effectiveFinalScore}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">/ 100</span>
                  </div>

                  {effectiveFinalScore >= (Number(activeSession.kkm) || 75) ? (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ TUNTAS KKM ({getScoreLabel(effectiveFinalScore)})
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                      ⚠️ BELUM TUNTAS (REMEDIAL)
                    </span>
                  )}
                </div>

                {/* Manual Score Override */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
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
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                    {manualScore !== null && (
                      <button
                        type="button"
                        onClick={() => setManualScore(null)}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 border border-slate-200"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>

                {/* Correct vs Wrong Stats */}
                {calculation && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-emerald-700 block">Benar</span>
                      <span className="text-xl font-black text-emerald-800">{calculation.correct}</span>
                    </div>
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-rose-700 block">Salah</span>
                      <span className="text-xl font-black text-rose-800">{calculation.wrong}</span>
                    </div>
                  </div>
                )}

                {/* CSI & LPS Metrics */}
                {calculation && (
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-black text-teal-700 uppercase tracking-wider block">CSI (Kognitif)</span>
                      <span className="text-sm font-bold text-slate-900">{calculation.csi}</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">{getCsiLabel(calculation.csi)}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider block">LPS (Performa)</span>
                      <span className="text-sm font-bold text-slate-900">{calculation.lps}</span>
                    </div>
                  </div>
                )}

                {/* Essay Inputs (Only if Session has essay questions configured) */}
                {((activeSession.scoring_config?.essayCount ?? 0) > 0 &&
                  (activeSession.scoring_config?.essayMaxScore ?? 0) > 0) ? (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                      Nilai Essay ({activeSession.scoring_config?.essayCount || 5} Soal, maks 4/soal)
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {essayScores.map((score, idx) => (
                        <div key={idx} className="text-center">
                          <span className="text-[9px] text-slate-500 block mb-0.5">#{idx + 1}</span>
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
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center text-xs font-black text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="px-3 py-2 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-[11px]">
                      <span className="font-bold text-teal-800">Format Ujian:</span>
                      <span className="text-teal-700 font-semibold">Pilihan Ganda Murni (100% PG)</span>
                    </div>
                  </div>
                )}

                {/* Save Button / Read-only Notice */}
                <div className="pt-2">
                  {isReadOnly ? (
                    <div className="w-full py-3 px-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-semibold min-h-12 flex items-center justify-center">
                      Mode Peninjauan: Kepala Sekolah tidak dapat mengubah nilai siswa secara langsung.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveStudent}
                      disabled={!selectedStudentName.trim()}
                      className="w-full py-3 bg-linear-to-r from-teal-600 to-[#18536B] hover:from-teal-700 hover:to-[#023246] disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs flex items-center justify-center gap-2 transition-all min-h-12 active:scale-[0.98]"
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
          <div className="space-y-5 max-w-7xl mx-auto w-full">
            {/* Summary Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Rata-rata Nilai</span>
                <span className="text-2xl font-black text-teal-700 mt-1 block">{classSummary.averageScore}</span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tertinggi / Terendah</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {classSummary.highestScore} <span className="text-xs text-slate-400 font-normal">/ {classSummary.lowestScore}</span>
                </span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tuntas KKM</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {classSummary.passedCount} <span className="text-xs text-slate-400 font-normal">({classSummary.passRate}%)</span>
                </span>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remedial</span>
                <span className="text-2xl font-black text-rose-600 mt-1 block">{classSummary.remedialCount}</span>
              </div>
            </div>

            {/* Action Bar: Export Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
              <div className="text-xs text-slate-600 font-semibold">
                Total Nilai Terekam: <span className="text-slate-900 font-bold">{gradedStudents.length} Siswa</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ExamCorrectionRepository.exportToExcel(activeSession, gradedStudents)}
                  disabled={gradedStudents.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all min-h-10"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Ekspor Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => ExamCorrectionRepository.exportToCSV(activeSession, gradedStudents)}
                  disabled={gradedStudents.length === 0}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all min-h-10 border border-slate-200 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Recap Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-100">
                    {gradedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Belum ada siswa yang dinilai pada sesi ini. Buka tab Lembar Koreksi untuk memulai.
                        </td>
                      </tr>
                    ) : (
                      gradedStudents.map((s, idx) => {
                        const score = Number(s.final_score) || 0;
                        const isPassed = score >= (Number(activeSession.kkm) || 75);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900">{s.name}</td>
                            <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">{s.correct}</td>
                            <td className="py-2.5 px-3 text-center text-rose-600 font-bold">{s.wrong}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-700">{s.mcq_score}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-700">{s.essay_score}</td>
                            <td className="py-2.5 px-3.5 text-center">
                              <span className="text-sm font-black text-slate-900">{score}</span>
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              {isPassed ? (
                                <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                  Tuntas
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
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
                                  className="p-1 rounded text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                                  title="Edit Lembar Koreksi"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </button>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStudentGrade(s.id)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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

        {/* ========================================================================= */}
        {/* TAB 4: GRADEMASTER WEB EMBED (CLOUD) */}
        {/* ========================================================================= */}
        {activeTab === 'grademaster_web' && (
          <div className="space-y-3 h-full flex flex-col max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-medium text-slate-600 truncate">
                  Web Input Nilai (GradeMaster Cloud) tersambung via frame resmi.
                </span>
              </div>
              <a
                href={gradeMasterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Buka Layar Penuh</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex-1 w-full min-h-145 sm:min-h-160 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs">
              <iframe
                src={gradeMasterUrl}
                title="GradeMaster Web Input Nilai"
                className="w-full h-full min-h-145 sm:min-h-160 border-0"
                allow="clipboard-write; clipboard-read"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* UNIVERSAL ANSWER KEY EDITOR MODAL */}
      {/* ========================================================================= */}
      {isKeyEditorModalOpen && (
        <div className="fixed inset-0 z-60 flex sm:items-center sm:justify-center bg-slate-900/40 sm:backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full h-dvh sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-200 p-4 sm:p-5 shadow-2xl flex flex-col justify-between sm:justify-start space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pengaturan Kunci Jawaban
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {editingSessionTarget?.session_name || activeSession?.session_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyEditorModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 sm:flex-initial">
              <label className="text-xs font-semibold text-slate-700">
                Kunci Jawaban PG (Bisa paste format 1.A 2.B atau ABCD...)
              </label>
              <textarea
                rows={5}
                value={quickKeyInput}
                onChange={(e) => setQuickKeyInput(e.target.value)}
                placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D atau ABCDABCD"
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 min-h-32"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Terdeteksi: <strong className="text-teal-700">{parseAnswerKey(quickKeyInput).length}</strong> butir soal PG</span>
                <span className="text-[10px] text-slate-400">Mendukung A, B, C, D, E</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setIsKeyEditorModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-11 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveKeyEditor()}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 min-h-11 transition-colors"
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
