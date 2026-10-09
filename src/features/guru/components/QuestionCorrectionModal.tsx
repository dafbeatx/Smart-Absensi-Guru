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
  Calendar,
  Edit3,
  Sliders,
  Check,
  Sparkles,
  CheckCheck,
  CloudLightning,
  Info,
} from 'lucide-react';
import type {
  ExamSessionRecord,
  GradedStudentScoreRecord,
  SaveGradedStudentDTO,
  UserProfile,
  StudentItem,
  BulkSyncSessionsResult,
} from '../../../types/database.types';
import { ExamCorrectionRepository } from '../../../repositories/ExamCorrectionRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { AdministrationRepository, AVAILABLE_ACADEMIC_YEARS } from '../../../repositories/AdministrationRepository';
import { parseAnswerKey, calculateStudentResult, getScoreLabel, getCsiLabel, generateAutoPgAnswers, generateAutoEssayScores } from '../../../utils/scoring.utils';
import { normalizeClassCode, resolveSchoolLevel } from '../../../utils/class.utils';
import { logger } from '../../../utils/logger.utils';
import {
  OFFICIAL_SCHOOL_SUBJECTS,
  normalizeSubjectName,
  isSameSubject,
} from '../../../config/school-subjects.config';
import {
  resolveSessionAcademicYear,
  normalizeAcademicYearString,
  isAcademicYearMatch,
  isClassMatch,
  isSessionSearchMatch,
} from '../../../utils/academic-year.utils';
import { isSemesterMatch } from '../../../services/grademaster-sync.service';
import { SemesterGradingExcelService } from '../../../services/semester-grading-excel.service';
import { DownloadOfficialGradingModal } from './DownloadOfficialGradingModal';
import { UniversalExcelImportModal } from './UniversalExcelImportModal';

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

const PREDEFINED_CLASSES = ['7', '7A', '7B', '8A', '8B', '9A', '9B', 'SMA'];
const PREDEFINED_SUBJECTS = [
  ...OFFICIAL_SCHOOL_SUBJECTS.map((s) => s.label),
  'Bahasa Arab',
  'PJOK',
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
  const [allDirectoryStudents, setAllDirectoryStudents] = useState<StudentItem[]>([]);
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
  const [selectedStudentUserId, setSelectedStudentUserId] = useState('');
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
  const [sessionYearFilter, setSessionYearFilter] = useState<string>('ALL');
  const [sessionSubjectFilter, setSessionSubjectFilter] = useState<string>('ALL');

  // Key Editor Modal State
  const [isKeyEditorModalOpen, setIsKeyEditorModalOpen] = useState(false);
  const [editingSessionTarget, setEditingSessionTarget] = useState<ExamSessionRecord | null>(null);
  const [quickKeyInput, setQuickKeyInput] = useState('');
  const [editingSessionFormat, setEditingSessionFormat] = useState<'PG_ONLY' | 'PG_AND_ESSAY'>('PG_AND_ESSAY');

  // Edit Session Configuration Modal State
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSessionRecord | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editSubject, setEditSubject] = useState('Informatika');
  const [editCustomSubject, setEditCustomSubject] = useState('');
  const [editClass, setEditClass] = useState('8A');
  const [editCustomClass, setEditCustomClass] = useState('');
  const [editExamType, setEditExamType] = useState('PTS / UTS');
  const [editExamFormat, setEditExamFormat] = useState<'PG_ONLY' | 'PG_AND_ESSAY'>('PG_AND_ESSAY');
  const [editEssayCount, setEditEssayCount] = useState(5);
  const [editEssayMaxScore, setEditEssayMaxScore] = useState(20);
  const [editPgWeight, setEditPgWeight] = useState(70);
  const [editEssayWeight, setEditEssayWeight] = useState(30);
  const [editKkm, setEditKkm] = useState(75);
  const [editAcademicYear, setEditAcademicYear] = useState('2026/2027');
  const [editSemester, setEditSemester] = useState('Ganjil');
  const [editKeyInput, setEditKeyInput] = useState('');
  const [isSavingEditSession, setIsSavingEditSession] = useState(false);

  // Quick Essay Batch & Inline Edit State
  const [isEditingFromRecap, setIsEditingFromRecap] = useState(false);
  const [isBatchEssayModalOpen, setIsBatchEssayModalOpen] = useState(false);
  const [batchScores, setBatchScores] = useState<Record<string, number>>({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSyncingGradeMaster, setIsSyncingGradeMaster] = useState(false);

  // Bulk Sync to GradeMaster OS Cloud Modal State
  const [isBulkSyncModalOpen, setIsBulkSyncModalOpen] = useState(false);
  const [bulkSyncYear, setBulkSyncYear] = useState(() => AdministrationRepository.getActiveAcademicYear() || '2026/2027');
  const [bulkSyncSemester, setBulkSyncSemester] = useState(() => {
    const s = AdministrationRepository.getActiveSemester();
    return s === 'GENAP' ? 'Genap' : 'Ganjil';
  });
  const [bulkSyncClass, setBulkSyncClass] = useState<string>('ALL');
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{
    current: number;
    total: number;
    currentSubject: string;
    currentClass: string;
    status: 'IN_PROGRESS' | 'DONE';
  } | null>(null);
  const [bulkSyncResult, setBulkSyncResult] = useState<BulkSyncSessionsResult | null>(null);

  const undoStack = useRef<{ qNum: number; prev: string | undefined }[]>([]);
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const originalStudentAnswersRef = useRef<Record<number, string>>({});
  const originalStudentEssayScoresRef = useRef<number[]>([]);

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
        .then(async (stus) => {
          let list = stus;
          if (!list || list.length === 0) {
            await StudentRepository.syncFromGradeMaster('2026/2027');
            list = await StudentRepository.getStudents();
          }
          if (Array.isArray(list) && list.length > 0) {
            setAllDirectoryStudents(list);
            const set = new Set<string>(PREDEFINED_CLASSES);
            list.forEach((s) => {
              const norm = normalizeClassCode(s.className);
              if (norm) set.add(norm);
            });
            setAvailableClasses(Array.from(set));
          }
        })
        .catch(() => {});

      // Auto-prepopulate subject from teacher's teaching assignment if available
      if (currentUser?.teaching_assignment) {
        const rawMapel = Array.isArray(currentUser.teaching_assignment)
          ? currentUser.teaching_assignment[0]
          : currentUser.teaching_assignment.split(',')[0].trim();

        if (rawMapel) {
          const normalized = normalizeSubjectName(rawMapel);
          const matched = PREDEFINED_SUBJECTS.find(
            (sub) =>
              sub.toLowerCase() === rawMapel.toLowerCase() ||
              sub.toLowerCase() === normalized.toLowerCase() ||
              sub.toLowerCase().includes(rawMapel.toLowerCase()) ||
              rawMapel.toLowerCase().includes(sub.toLowerCase())
          );
          if (matched) {
            setSelectedSubject(matched);
            setCustomSubject('');
          } else {
            setSelectedSubject('CUSTOM');
            setCustomSubject(rawMapel);
          }
        }
      }
    }
  }, [isOpen, currentUser?.id, currentUser?.full_name, currentUser?.teaching_assignment, loadSessions]);

  // Escape key handler & prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditSessionModalOpen) {
          setIsEditSessionModalOpen(false);
        } else if (isKeyEditorModalOpen) {
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
  }, [isOpen, isKeyEditorModalOpen, isEditSessionModalOpen, isCreatingSession, onClose]);

  const handleOpenCreateSession = () => {
    if (currentUser?.teaching_assignment) {
      const rawMapel = Array.isArray(currentUser.teaching_assignment)
        ? currentUser.teaching_assignment[0]
        : currentUser.teaching_assignment.split(',')[0].trim();

      if (rawMapel) {
        const normalized = normalizeSubjectName(rawMapel);
        const matched = PREDEFINED_SUBJECTS.find(
          (sub) =>
            sub.toLowerCase() === rawMapel.toLowerCase() ||
            sub.toLowerCase() === normalized.toLowerCase() ||
            sub.toLowerCase().includes(rawMapel.toLowerCase()) ||
            rawMapel.toLowerCase().includes(sub.toLowerCase())
        );
        if (matched) {
          setSelectedSubject(matched);
          setCustomSubject('');
        } else {
          setSelectedSubject('CUSTOM');
          setCustomSubject(rawMapel);
        }
      }
    }
    setIsCreatingSession(true);
  };

  // Load students of class when active session is chosen
  const loadSessionData = useCallback(async (session: ExamSessionRecord) => {
    try {
      const classIdentifier = session.class_code || session.class_name;
      let [students, grades] = await Promise.all([
        StudentRepository.getStudentsByClass(classIdentifier),
        ExamCorrectionRepository.getGradedStudents(session.id),
      ]);
      if (!students || students.length === 0) {
        const targetYear = resolveSessionAcademicYear(session.academic_year, session.session_name, session.created_at);
        await StudentRepository.syncFromGradeMaster(targetYear);
        students = await StudentRepository.getStudentsByClass(classIdentifier);
      }
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
    } catch (err: any) {
      logger.warn('QuestionCorrectionModal', 'Failed to fetch detailed session, using preview', err);
    }

    try {
      await loadSessionData(fullSession);
      setActiveSession(fullSession);
      setActiveTab('grading');
      resetGradingForm();
    } catch (loadErr: any) {
      logger.error('QuestionCorrectionModal', 'Failed to load session details/students:', loadErr);
      setToastMessage({
        text: `Gagal memuat detail sesi "${session.session_name}": ${loadErr?.message || 'Koneksi error'}. Silakan coba lagi.`,
        type: 'error',
      });
    }
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
    const isPgOnly = (session.scoring_config?.essayCount ?? 0) === 0 || (session.scoring_config?.essayWeight ?? 0) === 0;
    setEditingSessionFormat(isPgOnly ? 'PG_ONLY' : 'PG_AND_ESSAY');

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

    const parsedScoringConfig = editingSessionFormat === 'PG_ONLY'
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
        };

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
        scoring_config: parsedScoringConfig,
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

  // Open Edit Session Modal (Format PG/Essay, KKM, Title, Mapel, Kelas)
  const handleOpenEditSession = async (session: ExamSessionRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSession(session);

    const isPgOnly =
      (session.scoring_config?.essayCount ?? 0) === 0 ||
      (session.scoring_config?.essayWeight ?? 0) === 0;

    setEditSessionName(session.session_name || '');
    setEditTeacherName(session.teacher || currentUser?.full_name || '');

    // Match subject
    const officialSub = PREDEFINED_SUBJECTS.find(
      (s) => s.toLowerCase() === (session.subject || '').toLowerCase()
    );
    if (officialSub) {
      setEditSubject(officialSub);
      setEditCustomSubject('');
    } else {
      setEditSubject('CUSTOM');
      setEditCustomSubject(session.subject || '');
    }

    // Match class
    const matchedCls = availableClasses.find(
      (c) => c.toUpperCase() === (session.class_name || '').toUpperCase()
    );
    if (matchedCls) {
      setEditClass(matchedCls);
      setEditCustomClass('');
    } else {
      setEditClass('CUSTOM');
      setEditCustomClass(session.class_name || '');
    }

    setEditExamType(session.exam_type || 'PTS / UTS');
    setEditExamFormat(isPgOnly ? 'PG_ONLY' : 'PG_AND_ESSAY');
    setEditEssayCount(session.scoring_config?.essayCount || 5);
    setEditEssayMaxScore(session.scoring_config?.essayMaxScore || 20);
    setEditPgWeight(Math.round((session.scoring_config?.pgWeight ?? 0.7) * 100));
    setEditEssayWeight(Math.round((session.scoring_config?.essayWeight ?? 0.3) * 100));
    setEditKkm(Number(session.kkm) || 75);
    setEditAcademicYear(session.academic_year || '2026/2027');
    setEditSemester(session.semester || 'Ganjil');

    // Answer keys
    let keys = Array.isArray(session.answer_key) ? session.answer_key : [];
    if (keys.length === 0 && session.id) {
      try {
        const detailed = await ExamCorrectionRepository.getSessionById(session.id);
        if (detailed && Array.isArray(detailed.answer_key) && detailed.answer_key.length > 0) {
          keys = detailed.answer_key;
        }
      } catch {}
    }
    if (keys.length > 0) {
      setEditKeyInput(keys.map((k, i) => `${i + 1}.${k}`).join(' '));
    } else {
      setEditKeyInput('1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D 9.A 10.B');
    }

    setIsEditSessionModalOpen(true);
  };

  // Save edited session configuration
  const handleSaveEditSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingSession) return;

    const finalSubject = editSubject === 'CUSTOM' ? editCustomSubject.trim() : editSubject;
    const finalClass = editClass === 'CUSTOM' ? editCustomClass.trim().toUpperCase() : editClass;

    if (!finalSubject) {
      setToastMessage({ text: 'Mata pelajaran wajib diisi!', type: 'error' });
      return;
    }
    if (!finalClass) {
      setToastMessage({ text: 'Kelas / rombel wajib diisi!', type: 'error' });
      return;
    }

    const parsedKeys = parseAnswerKey(editKeyInput);
    if (parsedKeys.length === 0) {
      setToastMessage({ text: 'Kunci jawaban belum valid! Masukkan minimal 1 butir soal.', type: 'error' });
      return;
    }

    const isPgOnly = editExamFormat === 'PG_ONLY';
    const newScoringConfig = isPgOnly
      ? {
          pgWeight: 1.0,
          essayWeight: 0,
          essayMaxScore: 0,
          essayCount: 0,
        }
      : {
          pgWeight: Number(editPgWeight) / 100 || 0.7,
          essayWeight: Number(editEssayWeight) / 100 || 0.3,
          essayMaxScore: Number(editEssayMaxScore) || 20,
          essayCount: Number(editEssayCount) || 5,
        };

    const finalYear = normalizeAcademicYearString(editAcademicYear) || '2026/2027';

    setIsSavingEditSession(true);
    try {
      const updated = await ExamCorrectionRepository.saveSession({
        id: editingSession.id,
        session_name: editSessionName.trim() || `${editExamType} - ${finalSubject} - ${finalClass} (${finalYear})`,
        teacher: editTeacherName.trim() || currentUser?.full_name || 'Guru Pengampu',
        subject: finalSubject,
        class_name: finalClass,
        class_code: normalizeClassCode(finalClass),
        owner_user_id: editingSession.owner_user_id || currentUser?.id,
        school_level: resolveSchoolLevel(finalClass, editingSession.school_level),
        answer_key: parsedKeys,
        student_list: editingSession.student_list || [],
        kkm: Number(editKkm) || 75,
        academic_year: finalYear,
        semester: editSemester,
        exam_type: editExamType,
        scoring_config: newScoringConfig,
      });

      // Update in sessions list
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      // If active session is updated, refresh activeSession and recalculate students
      if (activeSession?.id === updated.id) {
        setActiveSession(updated);

        // Recalculate graded students if any exist
        if (gradedStudents.length > 0) {
          const pgW = newScoringConfig.pgWeight;
          const essayW = newScoringConfig.essayWeight;
          const hasEssay = (newScoringConfig.essayCount > 0) && (newScoringConfig.essayMaxScore > 0);

          const updatedGraded = gradedStudents.map((st) => {
            const mcq = Number(st.mcq_score) || 0;
            const essay = Number(st.essay_score) || 0;
            const newFinal = hasEssay
              ? Math.round(mcq * pgW + essay * essayW)
              : Math.round(mcq);
            const newLps = Math.round(mcq * 0.6 + essay * 0.4);
            return {
              ...st,
              final_score: newFinal,
              original_score: newFinal,
              lps: newLps,
            };
          });

          setGradedStudents(updatedGraded);

          // Background update records to cloud / repository so data stays consistent
          for (const s of updatedGraded) {
            ExamCorrectionRepository.saveGradedStudent({
              id: s.id,
              session_id: updated.id,
              name: s.name,
              student_user_id: s.student_user_id,
              mcq_answers: s.mcq_answers,
              essay_scores: s.essay_scores,
              mcq_score: s.mcq_score,
              essay_score: s.essay_score,
              final_score: s.final_score,
              original_score: s.final_score,
              is_deleted: false,
              csi: s.csi,
              lps: s.lps,
              correct: s.correct,
              wrong: s.wrong,
              answer_key: updated.answer_key,
              source: 'SESSION_CONFIG_EDIT',
            }).catch(() => {});
          }
        }
      }

      setIsEditSessionModalOpen(false);
      setEditingSession(null);
      setToastMessage({
        text: isPgOnly
          ? 'Sesi berhasil diperbarui (Format: Pilihan Ganda Saja).'
          : `Sesi berhasil diperbarui! Format kini mendukung Essay (${newScoringConfig.essayCount} soal, bobot ${Math.round(newScoringConfig.essayWeight * 100)}%).`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to update session:', err);
      setToastMessage({
        text: `Gagal memperbarui sesi: ${err?.message || 'Error'}`,
        type: 'error',
      });
    } finally {
      setIsSavingEditSession(false);
    }
  };

  // Academic year distribution for quick filtering with smart detection
  const sessionYearCounts = useMemo(() => {
    const counts: Record<string, number> = { '2026/2027': 0, '2025/2026': 0 };
    sessions.forEach((s) => {
      const yr = resolveSessionAcademicYear(s.academic_year, s.session_name, s.created_at);
      counts[yr] = (counts[yr] || 0) + 1;
    });
    return counts;
  }, [sessions]);

  // Unique subjects extracted from loaded sessions for subject filtering
  const { availableSessionSubjects, sessionSubjectCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const subjectDisplayNames: Record<string, string> = {};

    sessions.forEach((s) => {
      const raw = (s.subject || '').trim();
      if (!raw) return;

      const official = OFFICIAL_SCHOOL_SUBJECTS.find((sub) => isSameSubject(sub.name, raw));
      const canonicalKey = official ? official.name.toLowerCase() : raw.toLowerCase();
      const displayName = official ? official.name : raw;

      if (!subjectDisplayNames[canonicalKey]) {
        subjectDisplayNames[canonicalKey] = displayName;
      }

      counts[canonicalKey] = (counts[canonicalKey] || 0) + 1;
    });

    const uniqueSubjects = Object.keys(subjectDisplayNames)
      .map((key) => subjectDisplayNames[key])
      .sort((a, b) => a.localeCompare(b));

    const finalCounts: Record<string, number> = {};
    Object.keys(subjectDisplayNames).forEach((key) => {
      finalCounts[subjectDisplayNames[key]] = counts[key];
    });

    return { availableSessionSubjects: uniqueSubjects, sessionSubjectCounts: finalCounts };
  }, [sessions]);

  // Filtered sessions for Tab 1 with smart search, year detection, and class aliasing
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch = isSessionSearchMatch(s, sessionSearchQuery);
      const matchesClass = isClassMatch(s.class_code || s.class_name, sessionClassFilter);

      const hasKey = Array.isArray(s.answer_key) && s.answer_key.length > 0;
      const matchesStatus =
        sessionStatusFilter === 'ALL' ||
        (sessionStatusFilter === 'WITH_KEY' && hasKey) ||
        (sessionStatusFilter === 'WITHOUT_KEY' && !hasKey);

      const matchesYear = isAcademicYearMatch(s, sessionYearFilter);

      const matchesSubject =
        sessionSubjectFilter === 'ALL' ||
        isSameSubject(s.subject, sessionSubjectFilter) ||
        normalizeSubjectName(s.subject).toLowerCase() === normalizeSubjectName(sessionSubjectFilter).toLowerCase() ||
        s.subject.toLowerCase().trim() === sessionSubjectFilter.toLowerCase().trim();

      return matchesSearch && matchesClass && matchesStatus && matchesYear && matchesSubject;
    });
  }, [sessions, sessionSearchQuery, sessionClassFilter, sessionStatusFilter, sessionYearFilter, sessionSubjectFilter]);

  const sessionsWithKeyCount = useMemo(
    () => sessions.filter((s) => Array.isArray(s.answer_key) && s.answer_key.length > 0).length,
    [sessions]
  );
  const sessionsWithoutKeyCount = sessions.length - sessionsWithKeyCount;

  // Filtered students for dropdown
  const filteredStudents = useMemo(() => {
    const studentMap = new Map<string, { id: string; name: string }>();

    classStudents.forEach((s) => {
      if (s.fullName?.trim() && s.id) {
        studentMap.set(s.id, { id: s.id, name: s.fullName.trim() });
      }
    });

    if (activeSession?.student_list) {
      activeSession.student_list.forEach((n, idx) => {
        if (n?.trim()) {
          const trimmed = n.trim();
          const existingKey = Array.from(studentMap.keys()).find((k) => studentMap.get(k)?.name.toLowerCase() === trimmed.toLowerCase());
          if (!existingKey) {
            const tempId = `std_list_${idx}_${trimmed.replace(/\s+/g, '_').toLowerCase()}`;
            studentMap.set(tempId, { id: tempId, name: trimmed });
          }
        }
      });
    }

    gradedStudents.forEach((g) => {
      if (g.name?.trim()) {
        const id = g.student_user_id || g.id;
        if (!studentMap.has(id)) {
          studentMap.set(id, { id, name: g.name.trim() });
        }
      }
    });

    const gradedIdSet = new Set(gradedStudents.map((g) => g.student_user_id || g.id));
    const gradedNameSet = new Set(gradedStudents.map((g) => g.name.toLowerCase().trim()));

    const list = Array.from(studentMap.values()).map((st) => ({
      id: st.id,
      name: st.name,
      isGraded: gradedIdSet.has(st.id) || gradedNameSet.has(st.name.toLowerCase().trim()),
    }));

    // Sort: un-graded first, then graded
    list.sort((a, b) => {
      if (a.isGraded === b.isGraded) return a.name.localeCompare(b.name);
      return a.isGraded ? 1 : -1;
    });

    if (!studentSearchQuery.trim()) return list;
    return list.filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()));
  }, [classStudents, activeSession, gradedStudents, studentSearchQuery]);

  // Full, complete roster of students in the class with unique IDs for auto-advancement
  const allClassStudents = useMemo(() => {
    const studentMap = new Map<string, { id: string; name: string }>();
    classStudents.forEach((s) => {
      if (s.fullName?.trim() && s.id) {
        studentMap.set(s.id, { id: s.id, name: s.fullName.trim() });
      }
    });
    if (activeSession?.student_list) {
      activeSession.student_list.forEach((n, idx) => {
        if (n?.trim()) {
          const trimmed = n.trim();
          const existingKey = Array.from(studentMap.keys()).find((k) => studentMap.get(k)?.name.toLowerCase() === trimmed.toLowerCase());
          if (!existingKey) {
            const tempId = `std_list_${idx}_${trimmed.replace(/\s+/g, '_').toLowerCase()}`;
            studentMap.set(tempId, { id: tempId, name: trimmed });
          }
        }
      });
    }
    gradedStudents.forEach((g) => {
      if (g.name?.trim()) {
        const id = g.student_user_id || g.id;
        if (!studentMap.has(id)) {
          studentMap.set(id, { id, name: g.name.trim() });
        }
      }
    });
    return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
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

    if (manualScore !== null) {
      setManualScore(null);
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
    originalStudentAnswersRef.current = {};
    originalStudentEssayScoresRef.current = [];
    setEssayScores([0, 0, 0, 0, 0]);
    setManualScore(null);
    undoStack.current = [];
  };

  const handleSelectStudent = (name: string, studentUserId?: string) => {
    setSelectedStudentName(name);
    setSelectedStudentUserId(studentUserId || '');
    setStudentSearchQuery(name);
    setIsStudentDropdownOpen(false);

    const count = activeSession?.scoring_config?.essayCount || 5;

    // If student already has recorded grade in this session, prefill
    const existing = gradedStudents.find((g) =>
      (studentUserId && (g.student_user_id === studentUserId || g.id === studentUserId)) ||
      g.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (existing) {
      originalStudentAnswersRef.current = existing.mcq_answers || {};
      setUserAnswers(existing.mcq_answers || {});
      const initialScores =
        Array.isArray(existing.essay_scores) && existing.essay_scores.length > 0
          ? (existing.essay_scores.length === count
              ? existing.essay_scores
              : [...existing.essay_scores, ...Array(Math.max(0, count - existing.essay_scores.length)).fill(0)].slice(0, count))
          : Array(count).fill(0);
      originalStudentEssayScoresRef.current = initialScores;
      setEssayScores(initialScores);
      
      // If student previously had a manual override, restore it
      const calcForExisting = calculateStudentResult(
        activeSession?.answer_key || [],
        existing.mcq_answers || {},
        initialScores,
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

  const handleManualScoreChange = (rawVal: string) => {
    const count = activeSession?.scoring_config?.essayCount ?? 5;
    const maxScore = activeSession?.scoring_config?.essayMaxScore ?? 20;

    if (rawVal === '') {
      setManualScore(null);
      setUserAnswers(originalStudentAnswersRef.current || {});
      setEssayScores(
        originalStudentEssayScoresRef.current.length > 0
          ? originalStudentEssayScoresRef.current
          : Array(count).fill(0)
      );
      return;
    }
    const val = Math.min(100, Math.max(0, parseInt(rawVal, 10) || 0));
    setManualScore(val);

    if (activeSession?.answer_key && activeSession.answer_key.length > 0) {
      const autoAnswers = generateAutoPgAnswers(
        activeSession.answer_key,
        val,
        availableOptions
      );
      setUserAnswers(autoAnswers);
      undoStack.current = [];
    }

    if (count > 0 && maxScore > 0) {
      const autoEssay = generateAutoEssayScores(val, count, maxScore);
      setEssayScores(autoEssay);
    }
  };

  const handleCancelManualScore = () => {
    const count = activeSession?.scoring_config?.essayCount ?? 5;
    setManualScore(null);
    setUserAnswers(originalStudentAnswersRef.current || {});
    setEssayScores(
      originalStudentEssayScoresRef.current.length > 0
        ? originalStudentEssayScoresRef.current
        : Array(count).fill(0)
    );
    undoStack.current = [];
    setToastMessage({ text: 'Koreksi nilai manual dibatalkan.', type: 'success' });
  };

  const handleSaveStudent = async () => {
    if (!activeSession) return;
    if (!selectedStudentName.trim()) {
      setToastMessage({ text: 'Pilih atau ketik nama siswa terlebih dahulu!', type: 'error' });
      return;
    }

    if (!calculation) return;

    const matchedStudent = classStudents.find(
      (cs) => (selectedStudentUserId && cs.id === selectedStudentUserId) || cs.fullName?.toLowerCase().trim() === selectedStudentName.toLowerCase().trim()
    );

    const existingGraded = gradedStudents.find(
      (g) => (selectedStudentUserId && (g.student_user_id === selectedStudentUserId || g.id === selectedStudentUserId)) || g.name.toLowerCase().trim() === selectedStudentName.toLowerCase().trim()
    );

    const hasEssay =
      (activeSession.scoring_config?.essayCount ?? 0) > 0 &&
      (activeSession.scoring_config?.essayMaxScore ?? 0) > 0;

    const studentUserId = selectedStudentUserId || matchedStudent?.id || existingGraded?.student_user_id || `std_${Date.now()}`;

    try {
      const saved = await ExamCorrectionRepository.saveGradedStudent({
        id: existingGraded?.id,
        session_id: activeSession.id,
        name: selectedStudentName.trim(),
        student_user_id: studentUserId,
        mcq_answers: userAnswers,
        essay_scores: essayScores,
        mcq_score: (hasEssay && calculation.score > 0) ? Math.round(calculation.score) : effectiveFinalScore,
        essay_score: Math.round(calculation.essayScore),
        final_score: effectiveFinalScore,
        original_score: effectiveFinalScore,
        is_deleted: false,
        csi: calculation.csi,
        lps: calculation.lps,
        correct: calculation.correct,
        wrong: calculation.wrong,
        answer_key: activeSession.answer_key,
        expected_revision: existingGraded?.revision,
        actor_user_id: currentUser?.id,
        actor_name: currentUser?.full_name,
        actor_role: userRole,
        source: 'MANUAL_ENTRY',
      });

      // Update local state list
      setGradedStudents((prev) => {
        const index = prev.findIndex(
          (s) => (saved.student_user_id && s.student_user_id === saved.student_user_id) || s.id === saved.id || s.name.toLowerCase().trim() === saved.name.toLowerCase().trim()
        );
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = saved;
          return clone;
        }
        return [saved, ...prev];
      });

      // If editing from recap table, cleanly navigate back to recap
      if (isEditingFromRecap) {
        setIsEditingFromRecap(false);
        setActiveTab('recap');
        setToastMessage({
          text: `Nilai ${saved.name} (Skor Akhir: ${effectiveFinalScore}) berhasil diperbarui!`,
          type: 'success',
        });
        return;
      }

      // Reliable auto-advance to next ungraded student from full class list by ID & Name
      const updatedGradedIds = new Set([
        ...gradedStudents.map((g) => g.student_user_id || g.id),
        saved.student_user_id || saved.id,
      ]);
      const updatedGradedNames = new Set([
        ...gradedStudents.map((g) => g.name.toLowerCase().trim()),
        saved.name.toLowerCase().trim(),
      ]);

      const remainingUngraded = allClassStudents.filter(
        (st) => !updatedGradedIds.has(st.id) && !updatedGradedNames.has(st.name.toLowerCase().trim())
      );

      if (remainingUngraded.length > 0) {
        const nextStudent = remainingUngraded[0];
        handleSelectStudent(nextStudent.name, nextStudent.id);
        setToastMessage({
          text: `Nilai ${saved.name} (${effectiveFinalScore}) disimpan! Lanjut ke: ${nextStudent.name}`,
          type: 'success',
        });
      } else {
        resetGradingForm();
        setSelectedStudentName('');
        setSelectedStudentUserId('');
        setStudentSearchQuery('');
        setToastMessage({
          text: `Nilai ${saved.name} (${effectiveFinalScore}) disimpan! Seluruh siswa (${allClassStudents.length || gradedStudents.length + 1}) telah dinilai! 🎉`,
          type: 'success',
        });
      }
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to save student score:', err);
      const errMsg = err?.message ? `Gagal menyimpan nilai: ${err.message}` : 'Gagal menyimpan nilai siswa. Periksa koneksi!';
      setToastMessage({ text: errMsg, type: 'error' });
    }
  };

  // Quick Inline Essay Edit handler from Recap Table
  const handleTableEssayBlur = async (student: GradedStudentScoreRecord, rawVal: string) => {
    if (!activeSession) return;
    const newScore = Math.max(0, Math.min(100, parseInt(rawVal, 10) || 0));
    if (newScore === Number(student.essay_score)) return;

    const count = activeSession.scoring_config?.essayCount || 5;
    const maxScore = activeSession.scoring_config?.essayMaxScore || 20;
    const maxPerItem = Math.max(1, Math.round(maxScore / count));
    const rawTotal = Math.round((newScore / 100) * maxScore);

    let remaining = rawTotal;
    const newEssayScores: number[] = [];
    for (let i = 0; i < count; i++) {
      const itm = Math.min(maxPerItem, remaining);
      newEssayScores.push(itm);
      remaining -= itm;
    }

    const pgWeight = activeSession.scoring_config?.pgWeight ?? 0.7;
    const essayWeight = activeSession.scoring_config?.essayWeight ?? 0.3;
    const newFinalScore = Math.round(Number(student.mcq_score) * pgWeight + newScore * essayWeight);
    const newLps = Math.round(Number(student.mcq_score) * 0.6 + newScore * 0.4);

    // Optimistic UI update
    setGradedStudents((prev) =>
      prev.map((item) =>
        item.id === student.id
          ? {
              ...item,
              essay_score: newScore,
              essay_scores: newEssayScores,
              final_score: newFinalScore,
              lps: newLps,
            }
          : item
      )
    );

    try {
      await ExamCorrectionRepository.saveGradedStudent({
        id: student.id,
        session_id: activeSession.id,
        name: student.name,
        student_user_id: student.student_user_id,
        mcq_answers: student.mcq_answers,
        essay_scores: newEssayScores,
        mcq_score: student.mcq_score,
        essay_score: newScore,
        final_score: newFinalScore,
        original_score: newFinalScore,
        is_deleted: false,
        csi: student.csi,
        lps: newLps,
        correct: student.correct,
        wrong: student.wrong,
        answer_key: activeSession.answer_key,
        expected_revision: student.revision,
        actor_user_id: currentUser?.id,
        actor_name: currentUser?.full_name,
        actor_role: userRole,
        source: 'MANUAL_ENTRY',
      });
      setToastMessage({
        text: `Nilai essay ${student.name} berhasil disimpan: ${newScore} (Skor Akhir: ${newFinalScore})`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to update inline essay:', err);
      setToastMessage({ text: 'Gagal menyimpan nilai essay ke server.', type: 'error' });
      const reloaded = await ExamCorrectionRepository.getGradedStudents(activeSession.id);
      setGradedStudents(reloaded);
    }
  };

  // Quick Inline PG / Score Edit handler from Recap Table
  const handleTableMcqBlur = async (student: GradedStudentScoreRecord, rawVal: string) => {
    if (!activeSession) return;
    const newScore = Math.max(0, Math.min(100, parseInt(rawVal, 10) || 0));
    if (newScore === Number(student.mcq_score)) return;

    // Automatically generate new PG answers matching the given score
    const newAnswers = generateAutoPgAnswers(
      activeSession.answer_key || [],
      newScore,
      availableOptions
    );

    const calc = calculateStudentResult(
      activeSession.answer_key || [],
      newAnswers,
      student.essay_scores || [],
      activeSession.scoring_config
    );

    const hasEssay =
      (activeSession.scoring_config?.essayCount ?? 0) > 0 &&
      (activeSession.scoring_config?.essayMaxScore ?? 0) > 0;
    const pgWeight = hasEssay ? (activeSession.scoring_config?.pgWeight ?? 0.7) : 1.0;
    const essayWeight = hasEssay ? (activeSession.scoring_config?.essayWeight ?? 0.3) : 0;
    const newFinalScore = Math.round(newScore * pgWeight + (Number(student.essay_score) || 0) * essayWeight);
    const newLps = hasEssay ? Math.round(newScore * 0.6 + (Number(student.essay_score) || 0) * 0.4) : newScore;

    // Optimistic UI update
    setGradedStudents((prev) =>
      prev.map((item) =>
        item.id === student.id
          ? {
              ...item,
              mcq_score: newScore,
              mcq_answers: newAnswers,
              correct: calc.correct,
              wrong: calc.wrong,
              final_score: newFinalScore,
              csi: calc.csi,
              lps: newLps,
            }
          : item
      )
    );

    try {
      await ExamCorrectionRepository.saveGradedStudent({
        id: student.id,
        session_id: activeSession.id,
        name: student.name,
        student_user_id: student.student_user_id,
        mcq_answers: newAnswers,
        essay_scores: student.essay_scores || [],
        mcq_score: newScore,
        essay_score: student.essay_score || 0,
        final_score: newFinalScore,
        original_score: newFinalScore,
        is_deleted: false,
        csi: calc.csi,
        lps: newLps,
        correct: calc.correct,
        wrong: calc.wrong,
        answer_key: activeSession.answer_key,
        expected_revision: student.revision,
        actor_user_id: currentUser?.id,
        actor_name: currentUser?.full_name,
        actor_role: userRole,
        source: 'MANUAL_ENTRY',
      });
      setToastMessage({
        text: `Nilai PG ${student.name} disimpan: ${newScore} (PG otomatis terisi: ${calc.correct} Benar, ${calc.wrong} Salah)`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed to update inline PG score:', err);
      setToastMessage({ text: 'Gagal menyimpan nilai PG ke server.', type: 'error' });
      const reloaded = await ExamCorrectionRepository.getGradedStudents(activeSession.id);
      setGradedStudents(reloaded);
    }
  };

  // Open Batch Essay Modal
  const handleOpenBatchEssayModal = () => {
    const initialScores: Record<string, number> = {};
    gradedStudents.forEach((s) => {
      initialScores[s.id] = Number(s.essay_score) || 0;
    });
    setBatchScores(initialScores);
    setIsBatchEssayModalOpen(true);
  };

  // Apply mass score to all students who still have 0 essay score
  const handleApplyMassEssayScore = (val: number) => {
    setBatchScores((prev) => {
      const updated = { ...prev };
      gradedStudents.forEach((s) => {
        if (!updated[s.id] || updated[s.id] === 0) {
          updated[s.id] = val;
        }
      });
      return updated;
    });
    setToastMessage({ text: `Nilai ${val} disiapkan untuk siswa yang essay-nya masih 0`, type: 'success' });
  };

  // Save all modified essay scores in batch
  const handleSaveAllBatchEssay = async () => {
    if (!activeSession) return;
    setIsSavingBatch(true);
    try {
      const count = activeSession.scoring_config?.essayCount || 5;
      const maxScore = activeSession.scoring_config?.essayMaxScore || 20;
      const maxPerItem = Math.max(1, Math.round(maxScore / count));
      const pgWeight = activeSession.scoring_config?.pgWeight ?? 0.7;
      const essayWeight = activeSession.scoring_config?.essayWeight ?? 0.3;

      const batchItems: SaveGradedStudentDTO[] = [];
      for (const st of gradedStudents) {
        const newScore = batchScores[st.id] !== undefined ? batchScores[st.id] : Number(st.essay_score) || 0;
        if (newScore === Number(st.essay_score)) continue;

        const rawTotal = Math.round((newScore / 100) * maxScore);
        let remaining = rawTotal;
        const newEssayScores: number[] = [];
        for (let i = 0; i < count; i++) {
          const itm = Math.min(maxPerItem, remaining);
          newEssayScores.push(itm);
          remaining -= itm;
        }

        const newFinalScore = Math.round(Number(st.mcq_score) * pgWeight + newScore * essayWeight);
        const newLps = Math.round(Number(st.mcq_score) * 0.6 + newScore * 0.4);

        batchItems.push({
          id: st.id,
          session_id: activeSession.id,
          name: st.name,
          student_user_id: st.student_user_id || st.id,
          mcq_answers: st.mcq_answers || {},
          essay_scores: newEssayScores,
          mcq_score: st.mcq_score,
          essay_score: newScore,
          final_score: newFinalScore,
          original_score: newFinalScore,
          is_deleted: false,
          csi: st.csi,
          lps: newLps,
          correct: st.correct,
          wrong: st.wrong,
          answer_key: activeSession.answer_key,
          expected_revision: st.revision,
          actor_user_id: currentUser?.id,
          actor_name: currentUser?.full_name,
          actor_role: userRole,
          source: 'BATCH_ESSAY',
        });
      }

      if (batchItems.length > 0) {
        const batchRes = await ExamCorrectionRepository.batchSaveGradedStudents({
          session_id: activeSession.id,
          items: batchItems,
          source: 'BATCH_ESSAY',
        });

        if (batchRes && batchRes.results) {
          setGradedStudents(batchRes.results);
        } else {
          const refreshed = await ExamCorrectionRepository.getGradedStudents(activeSession.id);
          setGradedStudents(refreshed);
        }
      }

      setIsBatchEssayModalOpen(false);
      setToastMessage({
        text: `Berhasil memperbarui nilai essay untuk ${batchItems.length} siswa secara atomik!`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed batch saving essay scores:', err);
      setToastMessage({ text: 'Gagal menyimpan nilai essay batch: ' + (err?.message || 'Error'), type: 'error' });
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Sync current active session scores directly to GradeMaster OS Portal
  const handleSyncToGradeMaster = async () => {
    if (!activeSession) return;
    if (gradedStudents.length === 0) {
      setToastMessage({
        text: 'Belum ada nilai siswa yang tersimpan pada sesi ini untuk disinkronkan.',
        type: 'error',
      });
      return;
    }
    setIsSyncingGradeMaster(true);
    try {
      const res = await ExamCorrectionRepository.syncSessionToGradeMaster(activeSession.id);
      setToastMessage({
        text: `Berhasil menyinkronkan ${res.count} nilai siswa ke Portal Siswa GradeMaster!`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Failed syncing to GradeMaster:', err);
      setToastMessage({
        text: `Gagal sinkronisasi ke GradeMaster: ${err?.message || 'Error'}`,
        type: 'error',
      });
    } finally {
      setIsSyncingGradeMaster(false);
    }
  };

  // Filter sesi yang cocok untuk pratinjau Sinkronisasi Massal
  const previewEligibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (bulkSyncYear !== 'ALL') {
        if (!isAcademicYearMatch(s, bulkSyncYear)) return false;
      }
      if (bulkSyncSemester !== 'ALL') {
        if (!isSemesterMatch(s, bulkSyncSemester)) return false;
      }
      if (bulkSyncClass !== 'ALL') {
        if (!isClassMatch(s.class_name, bulkSyncClass)) return false;
      }
      return true;
    });
  }, [sessions, bulkSyncYear, bulkSyncSemester, bulkSyncClass]);

  const handleOpenBulkSyncModal = () => {
    setBulkSyncYear(AdministrationRepository.getActiveAcademicYear() || '2026/2027');
    setBulkSyncSemester(AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil');
    setBulkSyncClass('ALL');
    setBulkSyncProgress(null);
    setBulkSyncResult(null);
    setIsBulkSyncModalOpen(true);
  };

  const handleExecuteBulkSync = async () => {
    setIsBulkSyncing(true);
    setBulkSyncProgress(null);
    setBulkSyncResult(null);

    try {
      const res = await ExamCorrectionRepository.syncAllSessionsToGradeMaster({
        academicYear: bulkSyncYear,
        semester: bulkSyncSemester,
        className: bulkSyncClass,
        teacherName: currentUser?.full_name || 'Guru Pengampu',
        onProgress: (info) => {
          setBulkSyncProgress(info);
        },
      });

      setBulkSyncResult(res);
      if (res.totalProcessed > 0) {
        setToastMessage({
          text: `Berhasil menyinkronkan ${res.totalProcessed} sesi (${res.totalScoresSynced} nilai siswa) ke GradeMaster!`,
          type: 'success',
        });
      } else if (res.totalSkipped > 0 && res.totalProcessed === 0) {
        setToastMessage({
          text: 'Semua sesi yang cocok belum memiliki nilai siswa (dilewati otomatis).',
          type: 'error',
        });
      } else {
        setToastMessage({
          text: res.message || 'Sinkronisasi selesai.',
          type: 'success',
        });
      }
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Bulk sync failed:', err);
      setToastMessage({
        text: `Gagal sinkronisasi massal: ${err?.message || 'Error jaringan'}`,
        type: 'error',
      });
    } finally {
      setIsBulkSyncing(false);
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
      : `${examType} - ${finalSubject} - ${finalClass} (${normalizeAcademicYearString(academicYear) || academicYear || '2025/2026'})`;

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
        student_list: allClassStudents.map((s) => s.name.trim()),
        kkm: Number(kkm) || 75,
        academic_year: normalizeAcademicYearString(academicYear) || academicYear || '2025/2026',
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

    const [isDownloadFormatModalOpen, setIsDownloadFormatModalOpen] = useState(false);
  const [isUniversalExcelModalOpen, setIsUniversalExcelModalOpen] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const handleUniversalExcelSuccess = async (newSession: ExamSessionRecord, msg: string) => {
    await loadSessions();
    await handleSelectSession(newSession);
    setActiveTab('recap');
    setToastMessage({ text: msg, type: 'success' });
  };

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;
    e.target.value = '';
    setIsImportingExcel(true);
    try {
      const parsedSheets = await SemesterGradingExcelService.importScoresFromExcel(file);
      const targetNorm = SemesterGradingExcelService.normalizeSheetClassName(activeSession.class_name);
      const matchingSheet = parsedSheets.find(
        (s) => SemesterGradingExcelService.normalizeSheetClassName(s.className) === targetNorm
      );

      if (!matchingSheet || matchingSheet.students.length === 0) {
        setToastMessage({
          text: `Sheet kelas "${activeSession.class_name}" tidak ditemukan atau belum ada data di file Excel.`,
          type: 'error',
        });
        return;
      }

      // Pre-validate all rows before any write: prevents partial writes
      const prepared = SemesterGradingExcelService.prepareBatchImport(
        matchingSheet,
        activeSession,
        classStudents.map((s) => ({ id: s.id, fullName: s.fullName }))
      );

      if (!prepared.isValid) {
        const errorDetails = prepared.errors.slice(0, 3).map((err) => `Baris ${err.row} (${err.studentName || 'Anon'}): ${err.reason}`).join('; ');
        const extra = prepared.errors.length > 3 ? ` ...dan ${prepared.errors.length - 3} kesalahan lainnya.` : '';
        setToastMessage({
          text: `Validasi Excel gagal: ${errorDetails}${extra} Tidak ada nilai yang disimpan ke database.`,
          type: 'error',
        });
        return;
      }

      // Single atomic batch save request
      const batchRes = await ExamCorrectionRepository.batchSaveGradedStudents({
        session_id: activeSession.id,
        items: prepared.items.map((it) => ({
          ...it,
          actor_user_id: currentUser?.id,
          actor_name: currentUser?.full_name,
          actor_role: userRole,
        })),
        source: 'IMPORT_EXCEL',
      });

      if (batchRes && batchRes.results) {
        setGradedStudents(batchRes.results);
      } else {
        const updated = await ExamCorrectionRepository.getGradedStudents(activeSession.id);
        setGradedStudents(updated);
      }

      setToastMessage({
        text: `Berhasil mengimpor ${prepared.items.length} nilai siswa secara atomik dari file Excel kelas ${matchingSheet.className}!`,
        type: 'success',
      });
    } catch (err: any) {
      logger.error('QuestionCorrectionModal', 'Import error:', err);
      setToastMessage({
        text: 'Gagal mengimpor file Excel: ' + (err?.message || 'Format tidak valid'),
        type: 'error',
      });
    } finally {
      setIsImportingExcel(false);
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-correction-restricted-title"
        className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] text-slate-800 font-sans animate-fadeIn"
      >
        <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer min-h-11"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="question-correction-restricted-title" className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Koreksi Soal & Input Nilai
              </h2>
              <p className="text-[11px] text-slate-500">Otorisasi Hak Akses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-xs">
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
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-11 flex items-center justify-center"
            >
              Kembali ke Dashboard
            </button>
          </div>
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
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer min-h-11"
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
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-medium transition-colors shadow-2xs min-h-11"
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
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center"
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenBulkSyncModal}
              className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition-all border border-teal-300 shadow-2xs shrink-0 min-h-9 cursor-pointer"
              title="Sinkronkan seluruh nilai siswa di semua mata pelajaran & kelas ke GradeMaster OS Cloud sekaligus (Anti-Duplikasi)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
              <span>Sinkron Semua Nilai</span>
              <span className="hidden sm:inline px-1 py-0.5 rounded text-[9px] bg-teal-200/70 text-teal-900 font-extrabold uppercase tracking-wider">
                Cloud
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsUniversalExcelModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all border border-emerald-300 shadow-2xs shrink-0 min-h-9 cursor-pointer"
              title="Import berkas Excel untuk deteksi & pencocokan nama siswa, kelas, dan nilai PG & Essay secara otomatis"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Nilai Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDownloadFormatModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs shrink-0 min-h-9"
              title="Unduh Berkas Blanko Format Penilaian ASTS & ASAS Resmi (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Format Penilaian</span>
              <span>Blanko (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateSession}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 min-h-9"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Sesi Ujian</span>
            </button>
          </div>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">Mata Pelajaran</label>
                        {currentUser?.teaching_assignment && (
                          <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                            📖 Mapel Guru
                          </span>
                        )}
                      </div>
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

                {/* Filter Tahun Ajaran Tab Bar (2026/2027 vs 2025/2026 & Tahun Dinamis) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      Tahun Ajaran:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSessionYearFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                        sessionYearFilter === 'ALL'
                          ? 'bg-[#023246] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      Semua Tahun ({sessions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionYearFilter('2026/2027')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                        sessionYearFilter === '2026/2027'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-teal-700 hover:bg-teal-50 hover:text-teal-900'
                      }`}
                    >
                      <span>2026/2027 (Aktif)</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        sessionYearFilter === '2026/2027' ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {sessionYearCounts['2026/2027'] || 0}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionYearFilter('2025/2026')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                        sessionYearFilter === '2025/2026'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900'
                      }`}
                    >
                      <span>2025/2026 (GradeMaster)</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        sessionYearFilter === '2025/2026' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {sessionYearCounts['2025/2026'] || 0}
                      </span>
                    </button>
                    {/* Render any additional academic years detected dynamically */}
                    {Object.keys(sessionYearCounts)
                      .filter((yr) => yr !== '2026/2027' && yr !== '2025/2026' && sessionYearCounts[yr] > 0)
                      .sort((a, b) => b.localeCompare(a))
                      .map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSessionYearFilter(yr)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                            sessionYearFilter === yr
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{yr}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            sessionYearFilter === yr ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {sessionYearCounts[yr]}
                          </span>
                        </button>
                      ))}
                  </div>

                  {sessionYearFilter !== 'ALL' && (
                    <span className="text-[11px] font-medium text-slate-500 hidden md:inline-block">
                      Menampilkan filter tahun: <strong className="text-slate-800">{sessionYearFilter}</strong>
                    </span>
                  )}
                </div>

                {/* Filter Mata Pelajaran Tab Bar */}
                <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Mata Pelajaran:
                      </span>
                      {sessionSubjectFilter !== 'ALL' && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold">
                          Aktif: {sessionSubjectFilter}
                        </span>
                      )}
                    </div>
                    {sessionSubjectFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSessionSubjectFilter('ALL')}
                        className="text-[11px] font-semibold text-slate-500 hover:text-teal-700 flex items-center gap-1 self-start sm:self-auto transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Mapel
                      </button>
                    )}
                  </div>

                  {/* Horizontal Scrollable Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setSessionSubjectFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                        sessionSubjectFilter === 'ALL'
                          ? 'bg-[#023246] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      <span>Semua Mapel</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        sessionSubjectFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {sessions.length}
                      </span>
                    </button>

                    {availableSessionSubjects.map((subj) => {
                      const count = sessionSubjectCounts[subj] || 0;
                      const isSelected = sessionSubjectFilter === subj || isSameSubject(sessionSubjectFilter, subj);
                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => setSessionSubjectFilter(isSelected ? 'ALL' : subj)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-900 border border-transparent hover:border-teal-200'
                          }`}
                        >
                          <span>{subj}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                              isSelected ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search Bar, Quick Mapel Select & Class Filter */}
                <div className="flex flex-col lg:flex-row gap-2">
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

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    {/* Quick Subject Select Dropdown */}
                    <div className="relative shrink-0 w-full sm:w-auto">
                      <select
                        value={sessionSubjectFilter}
                        onChange={(e) => setSessionSubjectFilter(e.target.value)}
                        aria-label="Filter Mata Pelajaran"
                        className="w-full sm:w-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
                      >
                        <option value="ALL">Semua Mapel ({sessions.length})</option>
                        {availableSessionSubjects.map((subj) => (
                          <option key={subj} value={subj}>
                            {subj} ({sessionSubjectCounts[subj] || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
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
                      {availableClasses.map((cls) => (
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
                      Skema PostgreSQL atau tabel koreksi ujian belum lengkap. Silakan jalankan berkas migration <code className="bg-indigo-100 text-indigo-800 px-1 py-0.5 rounded font-mono">sql/58_exam_correction_and_grade_audit_overhaul.sql</code> pada Supabase SQL Editor.
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
                        onClick={handleOpenCreateSession}
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
                    <p className="text-[11px] text-slate-500 mb-3 max-w-md mx-auto">
                      {sessionYearFilter === '2026/2027'
                        ? 'Tidak ada sesi ujian yang cocok dengan kriteria filter pada Tahun Ajaran 2026/2027. Buat sesi baru atau tampilkan semua tahun.'
                        : 'Coba ubah kata kunci pencarian atau reset filter tahun ajaran, mata pelajaran, atau kelas.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {sessionYearFilter === '2026/2027' && !isReadOnly && (
                        <button
                          type="button"
                          onClick={handleOpenCreateSession}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Buat Sesi 2026/2027
                        </button>
                      )}
                      {sessionYearFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setSessionYearFilter('ALL')}
                          className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 inline-flex items-center gap-1 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Tampilkan Semua Tahun ({sessions.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSessionSearchQuery('');
                          setSessionClassFilter('ALL');
                          setSessionStatusFilter('ALL');
                          setSessionYearFilter('ALL');
                          setSessionSubjectFilter('ALL');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Reset Semua Filter
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {filteredSessions.map((sess) => {
                      const keyCount = Array.isArray(sess.answer_key) ? sess.answer_key.length : 0;
                      const hasKey = keyCount > 0;
                      const sessYear = resolveSessionAcademicYear(sess.academic_year, sess.session_name, sess.created_at);
                      const isYearActive = sessYear === '2026/2027';

                      return (
                        <div
                          key={sess.id}
                          onClick={() => handleSelectSession(sess)}
                          className="group bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-teal-500/40 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                                  Kelas {sess.class_name} • {resolveSchoolLevel(sess.class_name, sess.school_level)}
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 ${
                                  isYearActive
                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>{sessYear} • {sess.semester || 'Ganjil'}</span>
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-teal-700 shrink-0">
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
                                  {keyCount} PG
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Kunci Kosong
                                </span>
                              )}
                              <span className="text-slate-300">•</span>
                              {((sess.scoring_config?.essayCount ?? 0) > 0 && (sess.scoring_config?.essayWeight ?? 0) > 0) ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                                  PG + Essay ({sess.scoring_config?.essayCount || 5})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-full">
                                  Hanya PG
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
                                    onClick={(e) => handleOpenEditSession(sess, e)}
                                    className="px-2 py-1 rounded-md text-[10px] font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Edit Format Sesi (Ubah PG / Essay), KKM, Mapel, dll"
                                  >
                                    <Edit3 className="w-3 h-3 text-teal-600" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenKeyEditor(sess, e)}
                                    className="px-2 py-1 rounded-md text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Atur Kunci Jawaban"
                                  >
                                    <Key className="w-3 h-3 text-slate-600" />
                                    <span>{hasKey ? 'Kunci' : 'Atur Kunci'}</span>
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
              {/* Return to Recap Banner if Editing Student */}
              {isEditingFromRecap && (
                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-teal-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>
                      Mode Edit Nilai Siswa: <strong className="text-teal-950 font-bold">{selectedStudentName}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingFromRecap(false);
                      setActiveTab('recap');
                    }}
                    className="px-3 py-1 bg-white hover:bg-teal-100 border border-teal-300 rounded-xl text-xs font-bold text-teal-800 transition-colors shadow-2xs"
                  >
                    Kembali ke Rekap
                  </button>
                </div>
              )}
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
                          key={stu.id}
                          type="button"
                          onClick={() => handleSelectStudent(stu.name, stu.id)}
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

              {/* Alert & Quick Converter if Session is PG ONLY */}
              {((activeSession.scoring_config?.essayCount ?? 0) === 0 || (activeSession.scoring_config?.essayWeight ?? 0) === 0) && !isReadOnly && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">
                      Format sesi: <strong className="font-bold">Pilihan Ganda Saja (100% PG)</strong>. Ada soal essay di ujian ini?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditSession(activeSession)}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Ubah format sesi ini menjadi PG + Essay"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah ke PG + Essay</span>
                  </button>
                </div>
              )}

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
                      className="px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-bold flex items-center gap-1 transition-colors ml-1 cursor-pointer"
                      title="Edit Kunci Jawaban Sesi Ini"
                    >
                      <Key className="w-3 h-3" />
                      <span>{activeSession.answer_key && activeSession.answer_key.length > 0 ? `Kunci (${activeSession.answer_key.length})` : 'Atur Kunci'}</span>
                    </button>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditSession(activeSession)}
                        className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edit Konfigurasi Sesi (Ubah PG / Essay, KKM, dll)"
                      >
                        <Edit3 className="w-3 h-3 text-amber-600" />
                        <span>Edit Sesi</span>
                      </button>
                    )}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Koreksi Nilai Manual (Opsional)
                    </label>
                    {manualScore !== null && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        PG &amp; Essay Otomatis Terisi
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={manualScore === null ? '' : manualScore}
                      onChange={(e) => handleManualScoreChange(e.target.value)}
                      placeholder="Ketik nilai langsung (0-100)..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      title="Ketik nilai manual (0-100), butir soal PG dan nilai essay otomatis terisi"
                    />
                    {manualScore !== null && (
                      <button
                        type="button"
                        onClick={handleCancelManualScore}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0 cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                  {manualScore !== null && calculation && (
                    <div className="text-[10px] text-teal-700 font-medium mt-1.5 space-y-0.5">
                      <p className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>
                          Jawaban PG terisi: <strong>{calculation.correct} Benar</strong>, <strong>{calculation.wrong} Salah</strong> (Skor PG: {Math.round(calculation.score)})
                        </span>
                      </p>
                      {((activeSession.scoring_config?.essayCount ?? 5) > 0 &&
                        (activeSession.scoring_config?.essayMaxScore ?? 20) > 0) && (
                        <p className="flex items-center gap-1 pl-4.5 text-slate-600">
                          <span>
                            Nilai Essay terisi: <strong>{Math.round(calculation.essayScore)} / 100</strong> (Rincian butir: {essayScores.join(', ')})
                          </span>
                        </p>
                      )}
                    </div>
                  )}
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
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Nilai Essay ({activeSession.scoring_config?.essayCount || 5} Soal)
                      </span>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        Skor: {calculation ? Math.round(calculation.essayScore) : 0} / 100
                      </span>
                    </div>

                    {/* Mode A: Total Nilai Essay Langsung (0-100) */}
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">
                        Input Total Nilai Essay Langsung (0–100):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={calculation && calculation.essayScore > 0 ? Math.round(calculation.essayScore) : ''}
                        onChange={(e) => {
                          if (manualScore !== null) {
                            setManualScore(null);
                          }
                          const val = e.target.value === '' ? 0 : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                          const count = activeSession.scoring_config?.essayCount || 5;
                          const maxScore = activeSession.scoring_config?.essayMaxScore || 20;
                          const newScores = generateAutoEssayScores(val, count, maxScore);
                          setEssayScores(newScores);
                        }}
                        placeholder="Ketik total essay (misal: 80)..."
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </div>

                    {/* Mode B: Rincian Nilai per Soal */}
                    <div>
                      <span className="text-[9px] text-slate-500 block mb-1">
                        Atau Rincian Nilai per Butir (maks {Math.max(1, Math.round((activeSession.scoring_config?.essayMaxScore || 20) / (activeSession.scoring_config?.essayCount || 5)))}/soal):
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {essayScores.map((score, idx) => {
                          const maxPerItem = Math.max(1, Math.round((activeSession.scoring_config?.essayMaxScore || 20) / (activeSession.scoring_config?.essayCount || 5)));
                          return (
                            <div key={idx} className="text-center">
                              <span className="text-[9px] text-slate-500 block mb-0.5">#{idx + 1}</span>
                              <input
                                type="number"
                                min="0"
                                max={maxPerItem}
                                value={score === 0 ? '' : score}
                                placeholder="0"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  if (manualScore !== null) {
                                    setManualScore(null);
                                  }
                                  const val = e.target.value === '' ? 0 : Math.max(0, Math.min(maxPerItem, parseInt(e.target.value, 10) || 0));
                                  setEssayScores((prev) => {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  });
                                }}
                                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center text-xs font-black text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              />
                            </div>
                          );
                        })}
                      </div>
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
                      <span>{isEditingFromRecap ? 'Simpan Perubahan & Kembali ke Rekap' : 'Simpan & Siswa Berikutnya'}</span>
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

            {/* Alert & Quick Converter if Session is PG ONLY */}
            {((activeSession.scoring_config?.essayCount ?? 0) === 0 || (activeSession.scoring_config?.essayWeight ?? 0) === 0) && !isReadOnly && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate">
                    Format sesi saat ini: <strong className="font-bold">Pilihan Ganda Saja (100% PG)</strong>. Ada soal essay di ujian ini?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditSession(activeSession)}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  title="Ubah format sesi ini menjadi PG + Essay"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah ke PG + Essay</span>
                </button>
              </div>
            )}

            {/* Action Bar: Export Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
              <div className="text-xs text-slate-600 font-semibold">
                Total Nilai Terekam: <span className="text-slate-900 font-bold">{gradedStudents.length} Siswa</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Edit Konfigurasi Sesi Button */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditSession(activeSession)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-2xs transition-all min-h-10 cursor-pointer"
                    title="Edit Konfigurasi Sesi (Ubah format PG/Essay, Bobot, KKM, dll)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit Sesi</span>
                  </button>
                )}

                {/* 0. Input Cepat Essay Batch Button */}
                {((activeSession.scoring_config?.essayCount ?? 0) > 0 &&
                  (activeSession.scoring_config?.essayMaxScore ?? 0) > 0) && (
                  <button
                    type="button"
                    onClick={handleOpenBatchEssayModal}
                    className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 border border-indigo-200 shadow-2xs transition-all min-h-10"
                    title="Buka form input nilai essay cepat untuk seluruh siswa sekaligus"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Input Cepat Essay (Semua Siswa)</span>
                  </button>
                )}

                {/* 0.5. Sinkronkan ke Portal Siswa GradeMaster OS Cloud */}
                <button
                  type="button"
                  onClick={handleSyncToGradeMaster}
                  disabled={gradedStudents.length === 0 || isSyncingGradeMaster}
                  className="px-3.5 py-2 rounded-xl bg-linear-to-r from-teal-600 to-[#18536B] hover:from-teal-700 hover:to-[#023246] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all min-h-10 cursor-pointer"
                  title="Sinkronkan seluruh nilai siswa di sesi ini langsung ke Portal Siswa (GradeMaster OS Cloud)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-200 ${isSyncingGradeMaster ? 'animate-spin' : ''}`} />
                  <span>{isSyncingGradeMaster ? 'Menyinkronkan...' : 'Sinkron ke Portal Siswa'}</span>
                </button>

                {/* 0.6. Sinkronkan SEMUA Sesi Sekaligus (Bulk) */}
                <button
                  type="button"
                  onClick={handleOpenBulkSyncModal}
                  className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 border border-teal-300 shadow-2xs transition-all min-h-10 cursor-pointer"
                  title="Sinkronkan seluruh mata pelajaran dan rombel sekaligus ke GradeMaster Cloud (Anti-Duplikasi)"
                >
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Sinkron Semua Mapel (Massal)</span>
                </button>

                {/* 1. Primary Button: Download Excel Rekap Nilai (Full Table) */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeSession) return;
                    ExamCorrectionRepository.exportToExcel(activeSession, gradedStudents);
                    setToastMessage({ text: 'Tabel Rekap Nilai (.xlsx) berhasil diunduh!', type: 'success' });
                  }}
                  disabled={gradedStudents.length === 0}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all min-h-10 cursor-pointer"
                  title="Unduh file Excel Rekap Nilai lengkap dengan tabel nilai peserta didik, nilai akhir, predikat, dan statistik kelas"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span>Unduh Excel Rekap Nilai</span>
                </button>

                {/* 2. Secondary Button: Official ASTS & ASAS Multi-Sheet Excel */}
                <button
                  type="button"
                  onClick={() => setIsDownloadFormatModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition-all min-h-10 shadow-2xs cursor-pointer"
                  title="Unduh berkas Excel multi-sheet resmi ASTS & ASAS dengan validasi dan alokasi nilai"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                  <span>Format Penilaian Resmi (.xlsx)</span>
                </button>

                {/* 3. Download Blank Template */}
                <button
                  type="button"
                  onClick={() => setIsDownloadFormatModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all min-h-10 border border-slate-200 shadow-2xs cursor-pointer"
                  title="Unduh blanko format penilaian sekolah"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Blanko (.xlsx)</span>
                </button>

                {/* 4. Import from Excel ASTS/ASAS */}
                <label className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all min-h-10 shadow-2xs">
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isImportingExcel ? 'animate-spin' : ''}`} />
                  <span>{isImportingExcel ? 'Mengimpor...' : 'Import Excel'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={isImportingExcel}
                    className="hidden"
                    onChange={handleImportExcelFile}
                  />
                </label>

                {/* 5. CSV download */}
                <button
                  type="button"
                  onClick={() => ExamCorrectionRepository.exportToCSV(activeSession, gradedStudents)}
                  disabled={gradedStudents.length === 0}
                  className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-medium flex items-center gap-1.5 border border-slate-200 shadow-2xs transition-all min-h-10 cursor-pointer"
                  title="Unduh format CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>CSV</span>
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
                            <td className="py-2 px-2 text-center">
                              {activeSession.answer_key && activeSession.answer_key.length > 0 ? (
                                <div className="inline-flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    defaultValue={s.mcq_score || 0}
                                    key={`${s.id}_${s.mcq_score}`}
                                    onBlur={(e) => handleTableMcqBlur(s, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="w-16 h-8 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all hover:border-teal-400"
                                    title="Ketik nilai PG (0-100), butir soal PG otomatis terisi sesuai nilai"
                                  />
                                </div>
                              ) : (
                                <span className="font-mono text-slate-700">{s.mcq_score}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {((activeSession.scoring_config?.essayCount ?? 0) > 0 &&
                                (activeSession.scoring_config?.essayMaxScore ?? 0) > 0) ? (
                                <div className="inline-flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    defaultValue={s.essay_score || 0}
                                    key={`${s.id}_${s.essay_score}`}
                                    onBlur={(e) => handleTableEssayBlur(s, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="w-16 h-8 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                                    title="Ketik nilai essay (0-100), tekan Enter atau klik di luar untuk menyimpan"
                                  />
                                </div>
                              ) : (
                                <span className="font-mono text-slate-400">-</span>
                              )}
                            </td>
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
                                    handleSelectStudent(s.name, s.student_user_id || s.id);
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenBulkSyncModal}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 cursor-pointer"
                  title="Sinkronkan seluruh nilai siswa lokal ke database GradeMaster OS Cloud"
                >
                  <RefreshCw className="w-3 h-3 text-teal-200" />
                  <span>Sinkron Semua Nilai Lokal</span>
                </button>
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

            <div className="space-y-3 flex-1 sm:flex-initial">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Format Penilaian Sesi
                </label>
                <select
                  value={editingSessionFormat}
                  onChange={(e) => setEditingSessionFormat(e.target.value as 'PG_ONLY' | 'PG_AND_ESSAY')}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  <option value="PG_ONLY">Pilihan Ganda Saja (100% PG)</option>
                  <option value="PG_AND_ESSAY">Kombinasi PG (70%) + Essay (30%)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
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

      {/* ========================================================================= */}
      {/* EDIT SESSION CONFIGURATION MODAL (Format PG/Essay, Bobot, KKM, dll) */}
      {/* ========================================================================= */}
      {isEditSessionModalOpen && editingSession && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-fadeIn p-3 sm:p-4">
          <div className="bg-white w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Konfigurasi Sesi Ujian
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {editingSession.session_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditSessionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveEditSession} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* 1. Format Penilaian (PG Saja vs PG + Essay) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Format Lembar Soal &amp; Penilaian
                  </label>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Krusial
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditExamFormat('PG_ONLY')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editExamFormat === 'PG_ONLY'
                        ? 'bg-white border-teal-600 shadow-xs ring-2 ring-teal-500/20'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">100% Pilihan Ganda</span>
                      {editExamFormat === 'PG_ONLY' && (
                        <Check className="w-4 h-4 text-teal-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Hanya butir soal PG. Nilai akhir dihitung penuh dari jawaban PG.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditExamFormat('PG_AND_ESSAY')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editExamFormat === 'PG_AND_ESSAY'
                        ? 'bg-white border-teal-600 shadow-xs ring-2 ring-teal-500/20'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Kombinasi PG + Essay</span>
                      {editExamFormat === 'PG_AND_ESSAY' && (
                        <Check className="w-4 h-4 text-teal-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Aktifkan kolom nilai essay (skala 0–100) dan butir essay pada lembar koreksi.
                    </p>
                  </button>
                </div>

                {/* Essay Config Sub-section */}
                {editExamFormat === 'PG_AND_ESSAY' && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
                    <span className="text-xs font-bold text-indigo-950 block">
                      Pengaturan Bobot &amp; Butir Essay
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Bobot PG (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={editPgWeight}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 70));
                            setEditPgWeight(val);
                            setEditEssayWeight(100 - val);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Bobot Essay (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={editEssayWeight}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 30));
                            setEditEssayWeight(val);
                            setEditPgWeight(100 - val);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Jumlah Soal Essay
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={editEssayCount}
                          onChange={(e) => setEditEssayCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5)))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Skor Maks Essay
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={editEssayMaxScore}
                          onChange={(e) => setEditEssayMaxScore(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 20)))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-indigo-700">
                      Rumus Nilai Akhir: ({editPgWeight}% × Skor PG) + ({editEssayWeight}% × Nilai Essay).
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Kunci Jawaban Soal PG */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kunci Jawaban Soal PG
                </label>
                <textarea
                  rows={4}
                  value={editKeyInput}
                  onChange={(e) => setEditKeyInput(e.target.value)}
                  placeholder="Contoh: 1.A 2.B 3.C 4.D 5.A 6.B 7.C 8.D atau ABCDABCD"
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 min-h-24"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Terdeteksi: <strong className="text-teal-700">{parseAnswerKey(editKeyInput).length}</strong> butir soal PG</span>
                  <span className="text-[10px] text-slate-400">Mendukung A, B, C, D, E</span>
                </div>
              </div>

              {/* 3. Detail Identitas Sesi */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Judul / Nama Sesi Ujian
                  </label>
                  <input
                    type="text"
                    value={editSessionName}
                    onChange={(e) => setEditSessionName(e.target.value)}
                    placeholder="Contoh: PTS - Matematika - 9A (2026/2027)"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Mata Pelajaran</label>
                    <select
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                      {PREDEFINED_SUBJECTS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="CUSTOM">+ Ketik Mapel Lain...</option>
                    </select>
                  </div>

                  {editSubject === 'CUSTOM' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Nama Mapel Kustom</label>
                      <input
                        type="text"
                        value={editCustomSubject}
                        onChange={(e) => setEditCustomSubject(e.target.value)}
                        placeholder="Contoh: Geografi"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Kelas / Rombel</label>
                    <select
                      value={editClass}
                      onChange={(e) => setEditClass(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls === 'SMA' ? 'SMA (Umum)' : `Kelas ${cls}`} ({resolveSchoolLevel(cls)})
                        </option>
                      ))}
                      <option value="CUSTOM">+ Ketik Kelas Lain...</option>
                    </select>
                  </div>

                  {editClass === 'CUSTOM' && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Nama Kelas Kustom</label>
                      <input
                        type="text"
                        value={editCustomClass}
                        onChange={(e) => setEditCustomClass(e.target.value)}
                        placeholder="Contoh: 10A, 8C..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 uppercase font-mono"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Jenis Ujian</label>
                    <select
                      value={editExamType}
                      onChange={(e) => setEditExamType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    >
                      {PREDEFINED_EXAM_TYPES.map((et) => (
                        <option key={et} value={et}>
                          {et}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Nilai KKM</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editKkm}
                      onChange={(e) => setEditKkm(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditSessionModalOpen(false)}
                  disabled={isSavingEditSession}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold min-h-11 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditSession}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 min-h-11 transition-colors cursor-pointer"
                >
                  {isSavingEditSession ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isSavingEditSession ? 'Menyimpan...' : 'Simpan Perubahan Sesi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BATCH ESSAY GRADING MODAL */}
      {/* ========================================================================= */}
      {isBatchEssayModalOpen && activeSession && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-fadeIn p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xl flex flex-col space-y-3.5 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Input Cepat Nilai Essay — {activeSession.session_name}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    Ketik nilai essay (skala 0–100) per siswa atau terapkan nilai massal sekaligus.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchEssayModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mass Fill Bar */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-900">
                Isi Massal ke Siswa yang Masih 0:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Contoh: 75"
                  id="mass-essay-input"
                  className="w-24 bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('mass-essay-input') as HTMLInputElement;
                    const val = Math.max(0, Math.min(100, parseInt(el?.value || '0', 10) || 0));
                    if (val > 0) {
                      handleApplyMassEssayScore(val);
                    }
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                >
                  Terapkan
                </button>
              </div>
            </div>

            {/* Student List with Inputs */}
            <div className="flex-1 overflow-y-auto max-h-[52vh] divide-y divide-slate-100 pr-1">
              {gradedStudents.map((s, idx) => {
                const currentEssay = batchScores[s.id] !== undefined ? batchScores[s.id] : Number(s.essay_score) || 0;
                const pgWeight = activeSession.scoring_config?.pgWeight ?? 0.7;
                const essayWeight = activeSession.scoring_config?.essayWeight ?? 0.3;
                const liveFinal = Math.round(Number(s.mcq_score) * pgWeight + currentEssay * essayWeight);
                const isPass = liveFinal >= (Number(activeSession.kkm) || 75);

                return (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-center text-xs font-mono text-slate-400">{idx + 1}</span>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-900 block truncate">{s.name}</span>
                        <span className="text-[10px] text-slate-500">Nilai PG: <strong className="text-slate-700">{s.mcq_score}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-slate-500 font-semibold">Essay:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentEssay === 0 ? '' : currentEssay}
                          placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                            setBatchScores((prev) => ({ ...prev, [s.id]: val }));
                          }}
                          className="w-16 h-8 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <span className="text-[10px] text-slate-400">/100</span>
                      </div>

                      <div className="w-18 text-right">
                        <span className="text-xs font-black text-slate-900 block leading-tight">
                          Skor: {liveFinal}
                        </span>
                        <span className={`text-[9px] font-bold ${isPass ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {isPass ? 'Tuntas' : 'Remedial'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                {Object.keys(batchScores).length} nilai disiapkan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchEssayModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSavingBatch}
                  onClick={handleSaveAllBatchEssay}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBatch ? 'Menyimpan...' : 'Simpan Semua Nilai Essay'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SINKRONISASI MASSAL NILAI KE GRADEMASTER OS CLOUD */}
      {/* ========================================================================= */}
      {isBulkSyncModalOpen && (
        <div className="fixed inset-0 z-60 flex sm:items-center sm:justify-center bg-slate-900/50 sm:backdrop-blur-xs animate-fadeIn p-0 sm:p-4">
          <div className="bg-white w-full h-dvh sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-slate-200 p-4 sm:p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-linear-to-br from-teal-50 to-emerald-50 text-teal-700 rounded-xl border border-teal-200 shadow-2xs">
                  <CloudLightning className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Sinkronisasi Massal ke GradeMaster OS
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Cloud Bridge
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kirim nilai seluruh mata pelajaran langsung ke Portal Siswa secara tepat sasaran tanpa duplikasi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isBulkSyncing}
                onClick={() => {
                  if (!isBulkSyncing) {
                    setIsBulkSyncModalOpen(false);
                    setBulkSyncResult(null);
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Smart Engine Guarantee Banner */}
              <div className="bg-linear-to-r from-teal-50/80 via-emerald-50/50 to-teal-50/60 border border-teal-200/90 rounded-xl p-3.5 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-teal-950">
                      Sistem Anti-Duplikasi & Deteksi Cerdas Aktif
                    </p>
                    <ul className="text-slate-700 space-y-1 list-disc list-inside">
                      <li>
                        <strong className="text-slate-900">Anti-Duplikasi:</strong> Jika ada sesi mapel yang sama atau siswa ganda, sistem menggabungkannya otomatis dan hanya mengirim skor siswa terbaru.
                      </li>
                      <li>
                        <strong className="text-slate-900">Tepat Sasaran:</strong> Filter Tahun Ajaran dan Semester memastikan data tersimpan pada folder akademik yang tepat di akun siswa.
                      </li>
                      <li>
                        <strong className="text-slate-900">Auto-Skip Kosong:</strong> Sesi ujian tanpa data nilai siswa dilewati otomatis agar database portal siswa tetap bersih.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Target Filters Selection */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Target Sinkronisasi Akademik</span>
                  <span className="text-[11px] font-normal text-slate-500">Sesuaikan sasaran pengiriman</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tahun Ajaran */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Tahun Ajaran</label>
                    <select
                      value={bulkSyncYear}
                      disabled={isBulkSyncing}
                      onChange={(e) => {
                        setBulkSyncYear(e.target.value);
                        setBulkSyncResult(null);
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="2026/2027">2026/2027 (Aktif)</option>
                      <option value="2025/2026">2025/2026</option>
                      <option value="2024/2025">2024/2025</option>
                      <option value="ALL">Semua Tahun Ajaran</option>
                    </select>
                  </div>

                  {/* Semester */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Semester</label>
                    <select
                      value={bulkSyncSemester}
                      disabled={isBulkSyncing}
                      onChange={(e) => {
                        setBulkSyncSemester(e.target.value);
                        setBulkSyncResult(null);
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="Ganjil">Semester Ganjil (1)</option>
                      <option value="Genap">Semester Genap (2)</option>
                      <option value="ALL">Semua Semester</option>
                    </select>
                  </div>

                  {/* Filter Kelas */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Rombel / Kelas</label>
                    <select
                      value={bulkSyncClass}
                      disabled={isBulkSyncing}
                      onChange={(e) => {
                        setBulkSyncClass(e.target.value);
                        setBulkSyncResult(null);
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="ALL">Semua Kelas</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>Kelas {cls}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Realtime Progress Bar when Syncing */}
              {isBulkSyncing && (
                <div className="bg-teal-50/70 border border-teal-300 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                      Proses Sinkronisasi Massal Sedang Berjalan...
                    </span>
                    <span>
                      {bulkSyncProgress ? `${bulkSyncProgress.current} / ${bulkSyncProgress.total} Sesi` : 'Menyiapkan...'}
                    </span>
                  </div>
                  <div className="w-full bg-teal-200/50 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-linear-to-r from-teal-600 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          bulkSyncProgress && bulkSyncProgress.total > 0
                            ? Math.round((bulkSyncProgress.current / bulkSyncProgress.total) * 100)
                            : 8
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-teal-800 font-medium">
                    {bulkSyncProgress
                      ? `Sedang mengirim nilai: ${bulkSyncProgress.currentSubject} (Kelas ${bulkSyncProgress.currentClass})`
                      : 'Memvalidasi data sesi dan nilai siswa lokal...'}
                  </p>
                </div>
              )}

              {/* Sync Result Summary */}
              {bulkSyncResult && !isBulkSyncing && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCheck className="w-5 h-5 text-emerald-600" />
                    <span>Laporan Hasil Sinkronisasi Massal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/80 border border-emerald-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-500 block">Sesi Berhasil</span>
                      <span className="text-base font-black text-emerald-700">{bulkSyncResult.totalProcessed}</span>
                    </div>
                    <div className="bg-white/80 border border-emerald-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-500 block">Nilai Siswa Terkirim</span>
                      <span className="text-base font-black text-teal-700">{bulkSyncResult.totalScoresSynced}</span>
                    </div>
                    <div className="bg-white/80 border border-emerald-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-500 block">Sesi Kosong Dilewati</span>
                      <span className="text-base font-black text-slate-600">{bulkSyncResult.totalSkipped}</span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-800">
                    {bulkSyncResult.message || 'Nilai siswa telah berhasil diperbarui di Portal Siswa GradeMaster OS.'}
                  </p>

                  {/* Mini Detail Logs */}
                  {bulkSyncResult.details.length > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border-t border-emerald-200/60 pt-2 text-xs">
                      {bulkSyncResult.details.map((dtl, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1 px-2 rounded bg-white/60 text-[11px]"
                        >
                          <span className="font-semibold text-slate-800 truncate mr-2">
                            {dtl.subject} - Kelas {dtl.className} ({dtl.studentCount} siswa)
                          </span>
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              dtl.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : dtl.status === 'SKIPPED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {dtl.status === 'SUCCESS' ? 'Terkirim' : dtl.status === 'SKIPPED' ? 'Dilewati' : 'Gagal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Matching Sessions */}
              {!bulkSyncResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Pratinjau Sesi Penilaian ({previewEligibleSessions.length} sesi cocok)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Target: {bulkSyncYear} • {bulkSyncSemester}
                    </span>
                  </div>

                  {previewEligibleSessions.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 text-xs bg-slate-50/50">
                      <Info className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                      Tidak ditemukan sesi penilaian yang cocok dengan kriteria filter di atas.
                      <p className="text-[11px] text-slate-400 mt-1">
                        Coba ubah filter Tahun Ajaran atau Semester untuk melihat sesi lainnya.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                      {previewEligibleSessions.map((s) => (
                        <div
                          key={s.id}
                          className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-teal-300 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {s.subject}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Kelas {s.class_name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                {s.exam_type || 'HARIAN'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {s.session_name} • {s.academic_year || '2026/2027'} ({s.semester || 'Ganjil'})
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-[10px] font-semibold text-slate-600 block">
                              KKM: {s.kkm || 75}
                            </span>
                            <span className="text-[10px] font-bold text-teal-700">
                              Siap Sinkron
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3.5 border-t border-slate-200 shrink-0">
              <span className="text-xs text-slate-500">
                {bulkSyncResult
                  ? 'Sinkronisasi selesai'
                  : `${previewEligibleSessions.length} sesi siap diproses`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBulkSyncing}
                  onClick={() => {
                    setIsBulkSyncModalOpen(false);
                    setBulkSyncResult(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer min-h-10"
                >
                  {bulkSyncResult ? 'Tutup' : 'Batal'}
                </button>

                {bulkSyncResult ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkSyncModalOpen(false);
                      setBulkSyncResult(null);
                      setActiveTab('grademaster_web');
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-10"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Lihat di Portal GradeMaster</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={previewEligibleSessions.length === 0 || isBulkSyncing}
                    onClick={handleExecuteBulkSync}
                    className="px-4 py-2 bg-linear-to-r from-teal-600 to-[#18536B] hover:from-teal-700 hover:to-[#023246] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer min-h-10"
                  >
                    <CloudLightning className={`w-4 h-4 ${isBulkSyncing ? 'animate-pulse' : ''}`} />
                    <span>{isBulkSyncing ? 'Menyinkronkan Nilai...' : 'Sinkronkan Sekarang'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unduh & Validasi Format Penilaian Resmi */}
      <DownloadOfficialGradingModal
        isOpen={isDownloadFormatModalOpen}
        onClose={() => setIsDownloadFormatModalOpen(false)}
        activeSession={activeSession}
        gradedStudents={gradedStudents}
        availableSessions={sessions}
        currentUser={currentUser}
        defaultAcademicYear={academicYear}
        defaultSemester={semester}
        onSuccess={(msg) => setToastMessage({ text: msg, type: 'success' })}
      />

      {/* Modal Import Nilai Universal Excel */}
      <UniversalExcelImportModal
        isOpen={isUniversalExcelModalOpen}
        onClose={() => setIsUniversalExcelModalOpen(false)}
        availableSessions={sessions}
        allDirectoryStudents={allDirectoryStudents.length > 0 ? allDirectoryStudents : classStudents}
        currentUser={currentUser}
        onSuccess={handleUniversalExcelSuccess}
      />
    </div>,
    document.body
  );
};

export const QuestionCorrectionLayer = QuestionCorrectionModal;
