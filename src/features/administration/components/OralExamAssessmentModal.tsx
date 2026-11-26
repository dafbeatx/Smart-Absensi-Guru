/**
 * SMART ABSENSI GURU - MODAL PENILAIAN UJIAN LISAN (MOBILE-FIRST & RAMAH GURU)
 * Memisahkan secara tegas 2 jalur penilaian:
 * 1. Ujian Bahasa (Checklist 15 Soal Bahasa Inggris / Bahasa Arab)
 * 2. Ujian BTQ & Hafalan (Skala Angka 0–100 + Tombol Nilai Cepat)
 *
 * Pemisahan Wewenang:
 * - Mode ADMIN (`roleMode === 'ADMIN'`): Mengatur siapa penguji, ruang, mata uji, dan daftar siswa via OralExamAdminSetupModal + monitoring sesi.
 * - Mode GURU (`roleMode === 'GURU'`): Tinggal siap pakai langsung menilai siswa yang telah ditempatkan oleh Admin tanpa setup manual.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Languages,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useToastStore } from '../../../store/useToastStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { AdministrationRepository } from '../../../repositories/AdministrationRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { OralExamRepository } from '../../../repositories/OralExamRepository';
import {
  OralExamAssignmentRepository,
  ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT,
} from '../../../repositories/OralExamAssignmentRepository';
import {
  findAssignmentsForTeacher,
  findMatchingOfficialOralGroup,
} from '../../../data/oral-exam-groups';
import {
  getEffectiveSubjectScope,
  getOralExamSessionTrack,
  type OralExamAssignment,
  type OralExamSession,
  type OralExamStudentRecord,
  type OralExamSubjectScope,
  type OralExamTemplateType,
  type OralExamTrack,
} from '../../../types/oral-exam.types';
import {
  calculateDirectScorePredicate,
  calculateChecklistScoreAndPredicate,
  getOralExamPredicateBadgeStyle,
  calculateOralExamSummaryStats,
  isChecklistTrackAssessed,
  isStudentOralExamCompleted,
} from '../../../utils/oral-exam-scoring.utils';
import { areClassCodesEqual, normalizeClassCode } from '../../../utils/class.utils';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import type { StudentItem } from '../../../types/database.types';
import { OralExamAdminSetupModal } from './OralExamAdminSetupModal';

export interface OralExamAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
  roleMode?: 'GURU' | 'ADMIN';
}

type ModalScreen = 'LIST' | 'CREATE' | 'ASSESS';
type AssessViewMode = 'FOCUS' | 'ALL';
type RosterSourceMode = 'OFFICIAL_GROUP' | 'CLASS_FULL';

const AVAILABLE_CLASSES = ['7', '8A', '8B', '9A', '9B', 'SMA', '10', '11', '12'];
const QUICK_BTQ_SCORES = [60, 70, 75, 80, 85, 90, 95, 100];

const getScopeLabel = (templateType: OralExamTemplateType, scope: OralExamSubjectScope): string => {
  if (templateType === 'BAHASA_INGGRIS_ARAB') {
    if (scope === 'ENGLISH_ONLY') return 'Bahasa Inggris (15 Soal)';
    if (scope === 'ARABIC_ONLY') return 'Bahasa Arab (15 Soal)';
    return 'Bahasa Inggris & Arab';
  }
  if (scope === 'BTQ_ONLY') return 'BTQ Saja (0–100)';
  if (scope === 'HAFALAN_ONLY') return 'Hafalan Saja (0–100)';
  return 'BTQ & Hafalan';
};

export const OralExamAssessmentModal: React.FC<OralExamAssessmentModalProps> = ({
  isOpen,
  onClose,
  academicYear: propAcademicYear,
  roleMode = 'GURU',
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const isAdminControl = roleMode === 'ADMIN';
  const activeAcademicYear = useMemo(
    () => propAcademicYear || AdministrationRepository.getActiveAcademicYear(),
    [propAcademicYear]
  );
  const activeSemester = useMemo(() => AdministrationRepository.getActiveSemester(), []);

  // Navigation & track separation
  const [activeTrack, setActiveTrack] = useState<OralExamTrack>('BAHASA');
  const [screen, setScreen] = useState<ModalScreen>('LIST');
  const [assessViewMode, setAssessViewMode] = useState<AssessViewMode>('FOCUS');

  // Admin-configured Examiner Assignments (Cloud Synced)
  const [allAssignments, setAllAssignments] = useState<OralExamAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState<boolean>(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [isAdminSetupOpen, setIsAdminSetupOpen] = useState<boolean>(false);

  // Sessions & editing state
  const [sessions, setSessions] = useState<OralExamSession[]>([]);
  const [currentSession, setCurrentSession] = useState<OralExamSession | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Create session wizard state (Admin Only)
  const [subjectScopeDraft, setSubjectScopeDraft] = useState<OralExamSubjectScope>('ENGLISH_ONLY');
  const [rosterSourceMode, setRosterSourceMode] = useState<RosterSourceMode>('OFFICIAL_GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('7');
  const [examinerName, setExaminerName] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('Ruang 01');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(() => getTodayDateInJakarta());
  const [isCreatingLoading, setIsCreatingLoading] = useState<boolean>(false);

  // Assess screen controls
  const [activeStudentIndex, setActiveStudentIndex] = useState<number>(0);
  const [activeLanguageTab, setActiveLanguageTab] = useState<'english' | 'arabic'>('english');
  const [showRubricGuide, setShowRubricGuide] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNASSESSED' | 'ASSESSED'>('ALL');
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Mobile bottom-sheet dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone?: 'danger' | 'primary';
    onConfirm: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
  } | null>(null);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState<boolean>(false);
  const [newStudentNameDraft, setNewStudentNameDraft] = useState<string>('');

  // Lock background scroll on open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const loadSessions = useCallback(() => {
    const list = OralExamRepository.getAllSessions(activeAcademicYear);
    setSessions(list);
    return list;
  }, [activeAcademicYear]);

  const loadAssignments = useCallback(async () => {
    setIsLoadingAssignments(true);
    try {
      const list = await OralExamAssignmentRepository.getAssignments(activeAcademicYear);
      setAllAssignments(list);
      return list;
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [activeAcademicYear]);

  // Reset modal entry state cleanly when opened + listen for Admin assignment updates
  useEffect(() => {
    if (!isOpen) return;
    loadSessions();
    loadAssignments();
    setScreen('LIST');
    setIsDirty(false);
    setScoreDrafts({});
    setIsAdminSetupOpen(false);

    const handleAssignmentsChanged = () => {
      loadAssignments();
    };
    window.addEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
    return () => {
      window.removeEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
    };
  }, [isOpen, loadSessions, loadAssignments]);

  const guruAssignments = useMemo(
    () => findAssignmentsForTeacher(allAssignments, user),
    [allAssignments, user]
  );

  // Determine active teacher assignment in GURU mode
  useEffect(() => {
    if (!isOpen) return;
    if (!isAdminControl && guruAssignments.length > 0) {
      const stillValid = guruAssignments.some((a) => a.id === selectedAssignmentId);
      const chosen = stillValid
        ? guruAssignments.find((a) => a.id === selectedAssignmentId)!
        : guruAssignments[0];
      if (chosen.id !== selectedAssignmentId) {
        setSelectedAssignmentId(chosen.id);
      }
      if (!chosen.examTracks.includes(activeTrack) && chosen.examTracks.length > 0) {
        setActiveTrack(chosen.examTracks[0]);
      }
    }
  }, [isOpen, isAdminControl, guruAssignments, selectedAssignmentId, activeTrack]);

  const activeGuruAssignment = useMemo(
    () => guruAssignments.find((a) => a.id === selectedAssignmentId) || guruAssignments[0] || null,
    [guruAssignments, selectedAssignmentId]
  );

  // Sync admin create wizard defaults when assignments finish loading
  useEffect(() => {
    if (allAssignments.length === 0) return;
    if (!selectedGroupId || !allAssignments.some((a) => a.id === selectedGroupId)) {
      const matchedGroup = findMatchingOfficialOralGroup(user?.full_name);
      const firstId = matchedGroup?.id && allAssignments.some((a) => a.id === matchedGroup.id)
        ? matchedGroup.id
        : allAssignments[0].id;
      setSelectedGroupId(firstId);
    }
  }, [allAssignments, selectedGroupId, user?.full_name]);

  // Sessions filtered STRICTLY by active track (Bahasa vs BTQ separated)
  const trackSessions = useMemo(
    () => sessions.filter((s) => getOralExamSessionTrack(s) === activeTrack),
    [sessions, activeTrack]
  );

  const bahasaCount = useMemo(
    () => sessions.filter((s) => getOralExamSessionTrack(s) === 'BAHASA').length,
    [sessions]
  );
  const btqCount = useMemo(
    () => sessions.filter((s) => getOralExamSessionTrack(s) === 'BTQ').length,
    [sessions]
  );

  const selectedAdminAssignment = useMemo(
    () => allAssignments.find((g) => g.id === selectedGroupId) || allAssignments[0] || null,
    [allAssignments, selectedGroupId]
  );

  const existingSessionForActiveGuruTrack = useMemo(() => {
    if (!activeGuruAssignment) return null;
    return (
      sessions.find(
        (s) => s.groupId === activeGuruAssignment.id && getOralExamSessionTrack(s) === activeTrack
      ) || null
    );
  }, [sessions, activeGuruAssignment, activeTrack]);

  const openCreateScreen = (track: OralExamTrack = activeTrack) => {
    if (!isAdminControl) return;
    setActiveTrack(track);
    setSubjectScopeDraft(track === 'BAHASA' ? 'ENGLISH_ONLY' : 'BOTH');
    setSessionTitle('');
    setSessionDate(getTodayDateInJakarta());
    const targetGrp = selectedAdminAssignment;
    if (targetGrp) {
      setRosterSourceMode('OFFICIAL_GROUP');
      setSelectedGroupId(targetGrp.id);
      setExaminerName(targetGrp.examinerName);
      setRoomNumber(targetGrp.roomNumber);
      setSelectedClass(targetGrp.className);
    } else {
      setExaminerName(user?.full_name || 'Guru Penguji');
    }
    setScreen('CREATE');
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = allAssignments.find((g) => g.id === groupId);
    if (grp) {
      setExaminerName(grp.examinerName);
      setRoomNumber(grp.roomNumber);
      setSelectedClass(grp.className);
    }
  };

  const handleOpenSession = (session: OralExamSession) => {
    const cloned: OralExamSession = JSON.parse(JSON.stringify(session));
    const scope = getEffectiveSubjectScope(cloned);
    setActiveTrack(getOralExamSessionTrack(cloned));
    setCurrentSession(cloned);
    setActiveLanguageTab(scope === 'ARABIC_ONLY' ? 'arabic' : 'english');
    setActiveStudentIndex(0);
    setAssessViewMode('FOCUS');
    setSearchQuery('');
    setStatusFilter('ALL');
    setScoreDrafts({});
    setIsDirty(false);
    setScreen('ASSESS');
  };

  const handleLaunchReadyAssignmentSession = (
    assignment: OralExamAssignment,
    track: OralExamTrack = activeTrack
  ) => {
    const session = OralExamRepository.openOrSyncAssignedSession({
      assignment,
      track,
      academicYear: activeAcademicYear,
      semester: activeSemester,
      examinerNpp: user?.nip ?? assignment.examinerNpp ?? null,
      date: getTodayDateInJakarta(),
    });
    loadSessions();
    handleOpenSession(session);
  };

  const handleCreateSessionSubmit = async () => {
    setIsCreatingLoading(true);
    try {
      const templateType: OralExamTemplateType =
        activeTrack === 'BAHASA' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN';

      let targetClassName = selectedClass;
      let targetRoomNumber = roomNumber.trim() || 'Ruang 01';
      let targetExaminerName = examinerName.trim() || user?.full_name || 'Guru Penguji';
      let groupId: string | null = null;
      let classStudents: Array<{ studentId: string; studentName: string; nisn?: string; className?: string }> = [];

      if (rosterSourceMode === 'OFFICIAL_GROUP' && selectedAdminAssignment) {
        targetClassName = selectedAdminAssignment.className;
        targetRoomNumber = roomNumber.trim() || selectedAdminAssignment.roomNumber;
        targetExaminerName = examinerName.trim() || selectedAdminAssignment.examinerName;
        groupId = selectedAdminAssignment.id;
        classStudents = selectedAdminAssignment.students.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          nisn: s.nisn,
          className: s.className || selectedAdminAssignment.className,
        }));
      } else {
        try {
          const allStudents = await StudentRepository.getStudents();
          const normTarget = normalizeClassCode(selectedClass);
          classStudents = allStudents
            .filter((st: StudentItem) => {
              const rawCls = st.className || '';
              if (areClassCodesEqual(rawCls, selectedClass)) return true;
              const normCls = normalizeClassCode(rawCls);
              if (normTarget === '7' && (normCls === '7' || normCls === '7A' || normCls === '7B')) {
                return true;
              }
              return false;
            })
            .map((st: StudentItem) => ({
              studentId: st.id,
              studentName: st.fullName || 'Siswa',
              nisn: st.nisn || undefined,
              className: st.className || selectedClass,
            }));
        } catch (err) {
          console.warn('Gagal memuat siswa dari master:', err);
        }

        if (classStudents.length === 0) {
          classStudents = [
            { studentId: `manual_${Date.now()}_1`, studentName: 'Siswa Contoh 1', className: selectedClass },
            { studentId: `manual_${Date.now()}_2`, studentName: 'Siswa Contoh 2', className: selectedClass },
          ];
          showToast(
            'info',
            'Data Kelas Belum Tersedia di Master',
            'Sesi dibuat dengan baris contoh. Anda dapat menambah nama siswa dengan tombol "+ Siswa".'
          );
        }
      }

      const defaultTitle =
        templateType === 'BAHASA_INGGRIS_ARAB'
          ? `Ujian Lisan ${getScopeLabel(templateType, subjectScopeDraft)} - ${targetClassName === 'SMA' ? 'SMA' : `Kelas ${targetClassName}`}`
          : `Penilaian ${getScopeLabel(templateType, subjectScopeDraft)} - ${targetClassName === 'SMA' ? 'SMA' : `Kelas ${targetClassName}`}`;

      const created = OralExamRepository.createNewSession({
        templateType,
        subjectScope: subjectScopeDraft,
        groupId,
        title: sessionTitle.trim() || defaultTitle,
        academicYear: activeAcademicYear,
        semester: activeSemester,
        examinerName: targetExaminerName,
        examinerNpp: user?.nip || null,
        roomNumber: targetRoomNumber,
        className: targetClassName,
        date: sessionDate,
        students: classStudents,
      });

      loadSessions();
      handleOpenSession(created);
      showToast(
        'success',
        'Sesi Siap Digunakan',
        `${created.students.length} peserta (${targetRoomNumber}) siap dinilai.`
      );
    } finally {
      setIsCreatingLoading(false);
    }
  };

  // --- Scoring Handlers ---
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
    if (!/^\d*(?:\.\d*)?$/.test(normalizedStr)) {
      return;
    }

    setScoreDrafts((prev) => ({ ...prev, [draftKey]: valStr }));
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

  const handleApplyQuickScore = (
    studentIndex: number,
    field: 'btqScore' | 'hafalanScore',
    scoreValue: number
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const student = currentSession.students[studentIndex];
    const draftKey = `${student.studentId}:${field}`;
    setScoreDrafts((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });

    const predicate = calculateDirectScorePredicate(scoreValue);
    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };
    if (field === 'btqScore') {
      target.btqScore = scoreValue;
      target.btqPredicate = predicate;
    } else {
      target.hafalanScore = scoreValue;
      target.hafalanPredicate = predicate;
    }
    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  const handleNotesChange = (studentIndex: number, notes: string) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const updatedStudents = [...currentSession.students];
    updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], notes };
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  const updateChecklistTrack = (
    studentIndex: number,
    subject: 'english' | 'arabic',
    nextChecklist: boolean[],
    assessedFlag: boolean
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const calc = calculateChecklistScoreAndPredicate(nextChecklist, 15);
    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };

    if (subject === 'english') {
      target.englishChecklist = nextChecklist;
      target.englishCorrectCount = assessedFlag ? calc.correctCount : null;
      target.englishScore = assessedFlag ? calc.score : null;
      target.englishPredicate = assessedFlag ? calc.predicate : null;
      target.englishAssessed = assessedFlag;
    } else {
      target.arabicChecklist = nextChecklist;
      target.arabicCorrectCount = assessedFlag ? calc.correctCount : null;
      target.arabicScore = assessedFlag ? calc.score : null;
      target.arabicPredicate = assessedFlag ? calc.predicate : null;
      target.arabicAssessed = assessedFlag;
    }

    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  const handleToggleChecklist = (
    studentIndex: number,
    subject: 'english' | 'arabic',
    qIndex: number
  ) => {
    if (!currentSession) return;
    const target = currentSession.students[studentIndex];
    if (!target) return;
    const currentArr =
      subject === 'english'
        ? (target.englishChecklist ? [...target.englishChecklist] : new Array(15).fill(false))
        : (target.arabicChecklist ? [...target.arabicChecklist] : new Array(15).fill(false));
    currentArr[qIndex] = !currentArr[qIndex];
    updateChecklistTrack(studentIndex, subject, currentArr, true);
  };

  const handleBulkChecklist = (
    studentIndex: number,
    subject: 'english' | 'arabic',
    fillAll: boolean
  ) => {
    const arr = new Array(15).fill(fillAll);
    updateChecklistTrack(studentIndex, subject, arr, fillAll);
  };

  const handleConfirmAddStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSession) return;
    const trimmed = newStudentNameDraft.trim();
    if (!trimmed) {
      showToast('error', 'Nama Siswa Wajib Diisi', 'Masukkan nama lengkap siswa sebelum menambahkan.');
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
    setActiveStudentIndex(updated.length - 1);
    setIsDirty(true);
    setAddStudentDialogOpen(false);
    setNewStudentNameDraft('');
    showToast('success', 'Siswa Ditambahkan', `${trimmed} berhasil ditambahkan ke daftar ujian.`);
  };

  const handleRemoveStudent = (idx: number) => {
    if (!currentSession || idx < 0 || idx >= currentSession.students.length) return;
    const target = currentSession.students[idx];
    setConfirmDialog({
      title: 'Hapus Peserta Ujian?',
      message: `Hapus ${target.studentName} dari sesi penilaian ini?`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        setCurrentSession((prev) => {
          if (!prev) return prev;
          const updated = prev.students.filter((st, i) => !(st.studentId === target.studentId && i === idx));
          setActiveStudentIndex((currIdx) => Math.max(0, Math.min(currIdx, updated.length - 1)));
          return { ...prev, students: updated };
        });
        setIsDirty(true);
      },
    });
  };

  const handleSaveSession = useCallback((silentToast = false) => {
    if (!currentSession) return;
    const saved = OralExamRepository.saveSession(currentSession);
    setCurrentSession(saved);
    setIsDirty(false);
    setScoreDrafts({});
    loadSessions();
    if (!silentToast) {
      showToast('success', 'Nilai Tersimpan', 'Seluruh nilai ujian lisan berhasil disimpan.');
    }
  }, [currentSession, loadSessions, showToast]);

  const handleDeleteSessionById = (sessionToDelete: OralExamSession) => {
    setConfirmDialog({
      title: 'Hapus Sesi Ujian Lisan?',
      message: `Hapus sesi "${sessionToDelete.title}" beserta seluruh nilai siswanya?`,
      confirmLabel: 'Ya, Hapus Sesi',
      tone: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        OralExamRepository.deleteSession(sessionToDelete.id);
        if (currentSession?.id === sessionToDelete.id) {
          setCurrentSession(null);
          setScreen('LIST');
        }
        setIsDirty(false);
        setScoreDrafts({});
        loadSessions();
        showToast('info', 'Sesi Dihapus', 'Sesi penilaian lisan telah dihapus.');
      },
    });
  };

  const handleExportPdf = async () => {
    if (!currentSession) return;
    if (isDirty) {
      handleSaveSession(true);
    }
    try {
      setIsExporting(true);
      const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
      await OralExamExportService.exportToPdf(currentSession);
      showToast('success', 'PDF Berhasil Diunduh!', 'Dokumen lembar penilaian resmi siap dicetak.');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('error', 'Gagal Cetak PDF', 'Terjadi kesalahan saat memproses dokumen PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!currentSession) return;
    if (isDirty) {
      handleSaveSession(true);
    }
    try {
      const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
      OralExamExportService.exportToExcel(currentSession);
      showToast('success', 'Excel Berhasil Diunduh!', 'File rekap penilaian .xlsx telah disimpan.');
    } catch (err) {
      console.error('Failed to export Excel:', err);
      showToast('error', 'Gagal Ekspor Excel', 'Terjadi kesalahan saat membuat file Excel.');
    }
  };

  const navigateWithDirtyGuard = useCallback((action: () => void) => {
    if (isDirty && screen === 'ASSESS') {
      setConfirmDialog({
        title: 'Simpan Nilai Terlebih Dahulu?',
        message: 'Ada nilai ujian yang belum disimpan. Pilih "Simpan & Keluar" agar data aman, atau "Buang Perubahan".',
        confirmLabel: 'Simpan & Keluar',
        tone: 'primary',
        onConfirm: () => {
          handleSaveSession(false);
          setConfirmDialog(null);
          action();
        },
        secondaryLabel: 'Buang Perubahan',
        onSecondary: () => {
          setConfirmDialog(null);
          setIsDirty(false);
          setScoreDrafts({});
          action();
        },
      });
      return;
    }
    action();
  }, [handleSaveSession, isDirty, screen]);

  const handleBackNavigation = useCallback(() => {
    if (screen === 'LIST') {
      onClose();
      return;
    }
    navigateWithDirtyGuard(() => {
      setCurrentSession(null);
      setScreen('LIST');
    });
  }, [navigateWithDirtyGuard, onClose, screen]);

  const handleRequestCloseModal = useCallback(() => {
    navigateWithDirtyGuard(() => {
      onClose();
    });
  }, [navigateWithDirtyGuard, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isAdminSetupOpen) {
        if (confirmDialog) {
          setConfirmDialog(null);
        } else if (addStudentDialogOpen) {
          setAddStudentDialogOpen(false);
        } else {
          handleRequestCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAdminSetupOpen, confirmDialog, addStudentDialogOpen, handleRequestCloseModal]);

  const effectiveScope = useMemo(
    () => (currentSession ? getEffectiveSubjectScope(currentSession) : 'BOTH'),
    [currentSession]
  );

  const isChecklistSession = currentSession?.templateType === 'BAHASA_INGGRIS_ARAB';

  const summaryStats = useMemo(() => {
    if (!currentSession) return null;
    return calculateOralExamSummaryStats(
      currentSession.students,
      currentSession.templateType === 'BAHASA_INGGRIS_ARAB',
      getEffectiveSubjectScope(currentSession)
    );
  }, [currentSession]);

  const filteredStudentsWithIndex = useMemo(() => {
    if (!currentSession) return [];
    const q = searchQuery.trim().toLowerCase();
    return currentSession.students
      .map((student, originalIndex) => ({ student, originalIndex }))
      .filter(({ student }) => {
        if (q && !student.studentName.toLowerCase().includes(q) && !(student.nisn || '').includes(q)) {
          return false;
        }
        if (statusFilter === 'ALL') return true;
        const done = isStudentOralExamCompleted(student, currentSession.templateType, effectiveScope);
        return statusFilter === 'ASSESSED' ? done : !done;
      });
  }, [currentSession, searchQuery, statusFilter, effectiveScope]);

  const activeFocusStudent =
    currentSession && currentSession.students[activeStudentIndex]
      ? currentSession.students[activeStudentIndex]
      : null;

  if (!isOpen || typeof document === 'undefined') return null;

  const renderChecklistAssessmentBody = (student: OralExamStudentRecord, studentIdx: number) => {
    const showEnglishTab = effectiveScope !== 'ARABIC_ONLY';
    const showArabicTab = effectiveScope !== 'ENGLISH_ONLY';
    const currentLang: 'english' | 'arabic' =
      showEnglishTab && showArabicTab ? activeLanguageTab : showEnglishTab ? 'english' : 'arabic';

    const checklistArr =
      currentLang === 'english'
        ? (student.englishChecklist || new Array(15).fill(false))
        : (student.arabicChecklist || new Array(15).fill(false));
    const isAssessed =
      currentLang === 'english'
        ? isChecklistTrackAssessed(student.englishScore, student.englishChecklist, student.englishAssessed)
        : isChecklistTrackAssessed(student.arabicScore, student.arabicChecklist, student.arabicAssessed);
    const correctCount =
      currentLang === 'english' ? (student.englishCorrectCount ?? 0) : (student.arabicCorrectCount ?? 0);
    const score = currentLang === 'english' ? student.englishScore : student.arabicScore;
    const predicate = currentLang === 'english' ? student.englishPredicate : student.arabicPredicate;
    const badge = getOralExamPredicateBadgeStyle(isAssessed ? predicate : null);

    return (
      <div className="space-y-4">
        {showEnglishTab && showArabicTab && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveLanguageTab('english')}
              className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                currentLang === 'english'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <span>Bahasa Inggris</span>
              {isChecklistTrackAssessed(student.englishScore, student.englishChecklist, student.englishAssessed) && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">
                  {student.englishScore} ({student.englishPredicate})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveLanguageTab('arabic')}
              className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                currentLang === 'arabic'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <span>Bahasa Arab</span>
              {isChecklistTrackAssessed(student.arabicScore, student.arabicChecklist, student.arabicAssessed) && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">
                  {student.arabicScore} ({student.arabicPredicate})
                </span>
              )}
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-slate-600">
            Sentuh nomor soal <strong className="text-slate-900">{currentLang === 'english' ? 'Bahasa Inggris' : 'Bahasa Arab'}</strong> yang dijawab <strong className="text-emerald-700">BENAR</strong> oleh siswa:
          </p>

          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }, (_, qIdx) => {
              const isTrue = Boolean(checklistArr[qIdx]);
              return (
                <button
                  key={`${currentLang}_q_${qIdx}`}
                  type="button"
                  onClick={() => handleToggleChecklist(studentIdx, currentLang, qIdx)}
                  className={`min-h-12 rounded-xl border text-base font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                    isTrue
                      ? 'bg-[#023246] border-[#023246] text-white shadow-xs'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-pressed={isTrue}
                  aria-label={`Soal ${qIdx + 1} ${isTrue ? 'Benar' : 'Belum Benar'}`}
                >
                  {isTrue && <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
                  <span>{qIdx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instant Score Summary */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 block">Hasil Otomatis</span>
            <p className="text-sm font-extrabold text-slate-900">
              {isAssessed
                ? `Benar ${correctCount}/15 Soal • Nilai ${score ?? 0}`
                : 'Belum ada soal dicentang'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
            {isAssessed ? badge.badgeLabel : 'Belum Dinilai'}
          </span>
        </div>

        {/* Easy helper buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleBulkChecklist(studentIdx, currentLang, true)}
            className="min-h-11 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer transition-colors"
          >
            Benar Semua (15)
          </button>
          <button
            type="button"
            onClick={() => handleBulkChecklist(studentIdx, currentLang, false)}
            className="min-h-11 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer transition-colors"
          >
            Kosongkan / Ulangi
          </button>
        </div>
      </div>
    );
  };

  const renderDirectScoreInputBlock = (
    student: OralExamStudentRecord,
    studentIdx: number,
    field: 'btqScore' | 'hafalanScore',
    label: string
  ) => {
    const draftKey = `${student.studentId}:${field}`;
    const currentScore = field === 'btqScore' ? student.btqScore : student.hafalanScore;
    const currentPred = field === 'btqScore' ? student.btqPredicate : student.hafalanPredicate;
    const badge = getOralExamPredicateBadgeStyle(currentPred);
    const displayValue =
      draftKey in scoreDrafts
        ? scoreDrafts[draftKey]
        : currentScore !== null && currentScore !== undefined
          ? String(currentScore)
          : '';

    return (
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-bold text-slate-900">{label}</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
            {currentPred ? badge.badgeLabel : 'Belum diisi'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={(e) => handleDirectScoreChange(studentIdx, field, e.target.value)}
            onBlur={() => handleDirectScoreBlur(student.studentId, field)}
            placeholder="Ketik nilai 0 – 100"
            className="flex-1 h-12 px-3 bg-white border border-slate-300 rounded-xl text-center text-lg font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
          />
          {displayValue !== '' && (
            <button
              type="button"
              onClick={() => handleDirectScoreChange(studentIdx, field, '')}
              className="h-12 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer shrink-0"
            >
              Hapus
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 block">
            Atau sentuh cepat angka nilai:
          </span>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_BTQ_SCORES.map((val) => {
              const isSelected = currentScore === val;
              return (
                <button
                  key={`${field}_${val}`}
                  type="button"
                  onClick={() => handleApplyQuickScore(studentIdx, field, val)}
                  className={`min-h-11 rounded-xl border text-sm font-bold transition-colors cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#023246] border-[#023246] text-white'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderBtqAssessmentBody = (student: OralExamStudentRecord, studentIdx: number) => {
    const showBtq = effectiveScope !== 'HAFALAN_ONLY';
    const showHafalan = effectiveScope !== 'BTQ_ONLY';

    return (
      <div className="space-y-3.5">
        {showBtq && renderDirectScoreInputBlock(student, studentIdx, 'btqScore', "Nilai BTQ (Baca Tulis Qur'an)")}
        {showHafalan && renderDirectScoreInputBlock(student, studentIdx, 'hafalanScore', 'Nilai Hafalan (Tahfidz)')}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 block">
            Catatan Penguji (Opsional)
          </label>
          <input
            type="text"
            value={student.notes || ''}
            onChange={(e) => handleNotesChange(studentIdx, e.target.value)}
            placeholder="Contoh: Bacaan lancar, perbaiki makhraj..."
            className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
          />
        </div>
      </div>
    );
  };

  const renderTrackSwitcher = (allowedTracks?: OralExamTrack[]) => {
    const canBahasa = !allowedTracks || allowedTracks.includes('BAHASA');
    const canBtq = !allowedTracks || allowedTracks.includes('BTQ');

    return (
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={!canBahasa}
          onClick={() => setActiveTrack('BAHASA')}
          className={`p-3.5 rounded-xl border text-left transition-colors min-h-14 ${
            !canBahasa
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : activeTrack === 'BAHASA'
                ? 'bg-[#023246] border-[#023246] text-white shadow-sm cursor-pointer'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
              <Languages className="w-4 h-4 shrink-0" />
              <span>Ujian Bahasa</span>
            </span>
            {isAdminControl && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                activeTrack === 'BAHASA' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {bahasaCount}
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-1 ${
            !canBahasa ? 'text-slate-400' : activeTrack === 'BAHASA' ? 'text-slate-200' : 'text-slate-500'
          }`}>
            {canBahasa ? 'Inggris / Arab • 15 Soal' : 'Tidak ditugaskan'}
          </p>
        </button>

        <button
          type="button"
          disabled={!canBtq}
          onClick={() => setActiveTrack('BTQ')}
          className={`p-3.5 rounded-xl border text-left transition-colors min-h-14 ${
            !canBtq
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : activeTrack === 'BTQ'
                ? 'bg-[#0D7A5F] border-[#0D7A5F] text-white shadow-sm cursor-pointer'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Ujian BTQ</span>
            </span>
            {isAdminControl && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                activeTrack === 'BTQ' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {btqCount}
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-1 ${
            !canBtq ? 'text-slate-400' : activeTrack === 'BTQ' ? 'text-emerald-100' : 'text-slate-500'
          }`}>
            {canBtq ? 'BTQ & Hafalan • 0–100' : 'Tidak ditugaskan'}
          </p>
        </button>
      </div>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oral-exam-title"
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-xs"
    >
      <div className="w-full h-dvh md:h-auto md:max-h-[92dvh] md:max-w-3xl bg-[#F8FAFC] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 font-sans">
        {/* 1. STICKY HEADER */}
        <header className="h-14 sm:h-16 px-4 pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleBackNavigation}
              aria-label={screen === 'LIST' ? 'Tutup' : 'Kembali'}
              className="w-11 h-11 -ml-1.5 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 id="oral-exam-title" className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {screen === 'LIST' && 'Penilaian Ujian Lisan'}
                {screen === 'CREATE' && (activeTrack === 'BAHASA' ? 'Buat Sesi Ujian Bahasa' : 'Buat Sesi Ujian BTQ')}
                {screen === 'ASSESS' && (currentSession?.title || 'Input Nilai Ujian Lisan')}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {screen === 'LIST' && (isAdminControl ? 'Kelola penugasan penguji & pantau penilaian' : 'Siap pakai menilai siswa sesuai penempatan Admin')}
                {screen === 'CREATE' && 'Mode Admin: Buat sesi penilaian tambahan'}
                {screen === 'ASSESS' && currentSession && (
                  `${currentSession.examinerName} • ${currentSession.className === 'SMA' ? 'SMA' : `Kelas ${currentSession.className}`} • ${currentSession.roomNumber || 'Ruang 01'}`
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdminControl && screen === 'LIST' && (
              <button
                type="button"
                onClick={() => setIsAdminSetupOpen(true)}
                className="h-10 px-3 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Atur Penguji</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRequestCloseModal}
              aria-label="Tutup Penilaian Ujian Lisan"
              className="w-11 h-11 rounded-xl hidden md:flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="w-full max-w-lg mx-auto space-y-4">
            {/* ==================== SCREEN 1: GURU READY-TO-USE HOME ==================== */}
            {screen === 'LIST' && !isAdminControl && (
              <>
                {isLoadingAssignments ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs font-semibold text-slate-500">
                    Memuat penugasan penguji dari Admin...
                  </div>
                ) : !activeGuruAssignment ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Belum Ada Penempatan Penguji
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Pengaturan siapa yang menjadi penguji, ruangan, dan daftar siswa ditetapkan oleh Admin.
                        Silakan hubungi Admin/Panitia Ujian jika akun Anda (<strong>{user?.full_name}</strong>) bertugas menguji Ujian Lisan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Assignment Selector if Guru has >1 group */}
                    {guruAssignments.length > 1 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Pilih Kelompok Penugasan Anda ({guruAssignments.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {guruAssignments.map((grp) => (
                            <button
                              key={grp.id}
                              type="button"
                              onClick={() => setSelectedAssignmentId(grp.id)}
                              className={`h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                                grp.id === activeGuruAssignment.id
                                  ? 'bg-[#023246] border-[#023246] text-white'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              {grp.roomNumber} • {grp.className === 'SMA' ? 'SMA' : `Kls ${grp.className}`} ({grp.students.length})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teacher Ready-to-Use Placement Card */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          Penempatan Resmi dari Admin
                        </span>
                        <span className="text-xs font-bold text-slate-600">TA {activeAcademicYear}</span>
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {activeGuruAssignment.roomNumber} •{' '}
                          {activeGuruAssignment.className === 'SMA'
                            ? 'Jenjang SMA'
                            : `Kelas ${activeGuruAssignment.className}`}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Penguji: <strong>{activeGuruAssignment.examinerName}</strong> •{' '}
                          <strong>{activeGuruAssignment.students.length} Siswa</strong> siap dinilai
                        </p>
                      </div>
                    </div>

                    {/* Separated Bahasa vs BTQ Tabs */}
                    {renderTrackSwitcher(activeGuruAssignment.examTracks)}

                    {/* Ready-to-Start Card for Selected Track */}
                    {(() => {
                      const trackAllowed = activeGuruAssignment.examTracks.includes(activeTrack);
                      if (!trackAllowed) {
                        return (
                          <div className="p-5 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-600">
                            Anda tidak ditugaskan menguji kategori ini oleh Admin. Silakan pilih kategori lain di atas.
                          </div>
                        );
                      }

                      const scope =
                        activeTrack === 'BAHASA'
                          ? activeGuruAssignment.bahasaScope
                          : activeGuruAssignment.btqScope;
                      const template: OralExamTemplateType =
                        activeTrack === 'BAHASA' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN';
                      const stats = existingSessionForActiveGuruTrack
                        ? calculateOralExamSummaryStats(
                            existingSessionForActiveGuruTrack.students,
                            activeTrack === 'BAHASA',
                            scope
                          )
                        : null;
                      const totalCount = activeGuruAssignment.students.length;
                      const doneCount = stats?.completedStudents ?? 0;
                      const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                      return (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {getScopeLabel(template, scope)}
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              {doneCount} / {totalCount} siswa ({pct}%)
                            </span>
                          </div>

                          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLaunchReadyAssignmentSession(activeGuruAssignment, activeTrack)}
                            className="w-full h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer transition-colors"
                          >
                            {doneCount > 0
                              ? `Lanjutkan Menilai (${doneCount}/${totalCount})`
                              : `Mulai Menilai Sekarang (${totalCount} Siswa)`}
                          </button>

                          {existingSessionForActiveGuruTrack && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
                                  await OralExamExportService.exportToPdf(existingSessionForActiveGuruTrack);
                                }}
                                className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="w-4 h-4 text-[#023246]" />
                                <span>Unduh PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
                                  OralExamExportService.exportToExcel(existingSessionForActiveGuruTrack);
                                }}
                                className="h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                <span>Unduh Excel</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}

            {/* ==================== SCREEN 1: ADMIN OVERVIEW ==================== */}
            {screen === 'LIST' && isAdminControl && (
              <>
                {/* Card Pengaturan Penguji (Admin Only) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Pengaturan Penguji &amp; Penempatan
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {allAssignments.filter((a) => a.isActive).length} penguji aktif • Sinkron otomatis ke HP guru
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdminSetupOpen(true)}
                    className="h-11 px-3.5 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Kelola Penguji
                  </button>
                </div>

                {/* Tab Pemisah Ujian Bahasa vs BTQ */}
                {renderTrackSwitcher()}

                {/* Daftar Sesi pada Tab Aktif */}
                {trackSessions.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#023246] flex items-center justify-center mx-auto">
                      {activeTrack === 'BAHASA' ? <Languages className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {activeTrack === 'BAHASA'
                        ? 'Belum Ada Sesi Ujian Bahasa di Perangkat Ini'
                        : 'Belum Ada Sesi Ujian BTQ di Perangkat Ini'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Klik tombol di bawah untuk membuka/membuat sesi penilaian kelompok penguji atau kelas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {activeTrack === 'BAHASA' ? 'Sesi Ujian Bahasa' : 'Sesi Ujian BTQ'}
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">TA {activeAcademicYear}</span>
                    </div>

                    {trackSessions.map((sess) => {
                      const scope = getEffectiveSubjectScope(sess);
                      const stats = calculateOralExamSummaryStats(
                        sess.students,
                        sess.templateType === 'BAHASA_INGGRIS_ARAB',
                        scope
                      );
                      const pct =
                        stats.totalStudents > 0
                          ? Math.round((stats.completedStudents / stats.totalStudents) * 100)
                          : 0;

                      return (
                        <div
                          key={sess.id}
                          className="p-4 rounded-xl bg-white border border-slate-200 space-y-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                              {getScopeLabel(sess.templateType, scope)}
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                              {sess.title}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Penguji: <strong className="text-slate-700">{sess.examinerName}</strong>
                            </p>
                            <p className="text-xs text-slate-500">
                              {sess.className === 'SMA' ? 'SMA' : `Kelas ${sess.className}`} • {sess.roomNumber || 'Ruang 01'} • {sess.date}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                              <span>Progress</span>
                              <span className="text-slate-900 font-bold">
                                {stats.completedStudents}/{stats.totalStudents} siswa ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSession(sess)}
                              className="flex-1 h-11 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                            >
                              Buka &amp; Nilai
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSessionById(sess)}
                              aria-label={`Hapus sesi ${sess.title}`}
                              className="w-11 h-11 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ==================== SCREEN 2: CREATE (ADMIN ONLY) ==================== */}
            {screen === 'CREATE' && isAdminControl && (
              <div className="space-y-4">
                {/* Langkah 1: Pilih Mata Uji */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Langkah 1 dari 3
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {activeTrack === 'BAHASA' ? 'Pilih Mata Pelajaran Bahasa' : 'Pilih Aspek Mengaji (BTQ / Hafalan)'}
                    </h3>
                  </div>

                  {activeTrack === 'BAHASA' ? (
                    <div className="space-y-2">
                      {[
                        { scope: 'ENGLISH_ONLY' as const, title: 'Bahasa Inggris Saja (15 Soal)', desc: 'Fokus menilai 15 soal lisan Bahasa Inggris saja.' },
                        { scope: 'ARABIC_ONLY' as const, title: 'Bahasa Arab Saja (15 Soal)', desc: 'Fokus menilai 15 soal lisan Bahasa Arab saja.' },
                        { scope: 'BOTH' as const, title: 'Bahasa Inggris & Bahasa Arab', desc: 'Menguji keduanya dalam 1 sesi penilaian.' },
                      ].map((opt) => (
                        <label
                          key={opt.scope}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            subjectScopeDraft === opt.scope
                              ? 'border-[#023246] bg-sky-50/60'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="subjectScope"
                            checked={subjectScopeDraft === opt.scope}
                            onChange={() => setSubjectScopeDraft(opt.scope)}
                            className="mt-1 accent-[#023246] w-4 h-4 shrink-0"
                          />
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">{opt.title}</span>
                            <span className="text-[11px] text-slate-500 block">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { scope: 'BTQ_ONLY' as const, title: 'BTQ Saja (Nilai 0–100)', desc: "Lebih ringkas bila hanya menguji Baca Tulis Qur'an." },
                        { scope: 'BOTH' as const, title: 'BTQ & Hafalan (Keduanya)', desc: 'Menguji nilai BTQ sekaligus nilai Hafalan / Tahfidz.' },
                        { scope: 'HAFALAN_ONLY' as const, title: 'Hafalan Saja (Nilai 0–100)', desc: 'Khusus menilai setoran hafalan / tahfidz siswa.' },
                      ].map((opt) => (
                        <label
                          key={opt.scope}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            subjectScopeDraft === opt.scope
                              ? 'border-[#0D7A5F] bg-emerald-50/60'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="subjectScope"
                            checked={subjectScopeDraft === opt.scope}
                            onChange={() => setSubjectScopeDraft(opt.scope)}
                            className="mt-1 accent-[#0D7A5F] w-4 h-4 shrink-0"
                          />
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">{opt.title}</span>
                            <span className="text-[11px] text-slate-500 block">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Langkah 2: Pilih Daftar Siswa / Penguji */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Langkah 2 dari 3
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Pilih Daftar Peserta Ujian
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRosterSourceMode('OFFICIAL_GROUP');
                        handleGroupChange(selectedGroupId);
                      }}
                      className={`min-h-11 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 ${
                        rosterSourceMode === 'OFFICIAL_GROUP'
                          ? 'bg-[#023246] border-[#023246] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>Kelompok Penguji</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRosterSourceMode('CLASS_FULL')}
                      className={`min-h-11 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 ${
                        rosterSourceMode === 'CLASS_FULL'
                          ? 'bg-[#023246] border-[#023246] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <span>Satu Kelas Penuh</span>
                    </button>
                  </div>

                  {rosterSourceMode === 'OFFICIAL_GROUP' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Pilih Penguji &amp; Penempatan:
                      </label>
                      <select
                        value={selectedGroupId}
                        onChange={(e) => handleGroupChange(e.target.value)}
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      >
                        {allAssignments.map((grp) => (
                          <option key={grp.id} value={grp.id}>
                            {grp.examinerName} — {grp.roomNumber} ({grp.className === 'SMA' ? 'SMA' : `Kls ${grp.className}`}, {grp.students.length} siswa)
                          </option>
                        ))}
                      </select>
                      {selectedAdminAssignment && (
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Terpilih {selectedAdminAssignment.students.length} siswa di {selectedAdminAssignment.roomNumber} ({selectedAdminAssignment.className === 'SMA' ? 'SMA' : `Kelas ${selectedAdminAssignment.className}`}).
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        Pilih Kelas:
                      </label>
                      <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      >
                        {AVAILABLE_CLASSES.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls === 'SMA' ? 'Jenjang SMA (Gabungan)' : `Kelas ${cls}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Langkah 3: Identitas Penguji, Ruang, Tanggal */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Langkah 3 dari 3
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Cek Nama Penguji &amp; Ruang
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Nama Penguji</label>
                      <input
                        type="text"
                        value={examinerName}
                        onChange={(e) => setExaminerName(e.target.value)}
                        placeholder="Nama lengkap penguji"
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Ruangan</label>
                        <input
                          type="text"
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          placeholder="Ruang 01"
                          className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={sessionDate}
                          onChange={(e) => setSessionDate(e.target.value)}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Judul Lembar Ujian (Opsional)
                      </label>
                      <input
                        type="text"
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        placeholder="Otomatis terisi bila dikosongkan"
                        className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SCREEN 3: ASSESS ==================== */}
            {screen === 'ASSESS' && currentSession && (
              <div className="space-y-3.5">
                {/* Summary & Collapsible Guide */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                      isChecklistSession ? 'bg-[#023246] text-white' : 'bg-[#0D7A5F] text-white'
                    }`}>
                      {getScopeLabel(currentSession.templateType, effectiveScope)}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Sudah dinilai: <strong className="text-emerald-700">{summaryStats?.completedStudents ?? 0}</strong> / {summaryStats?.totalStudents ?? 0} siswa
                    </span>
                  </div>

                  {/* Rubric Accordion Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowRubricGuide((prev) => !prev)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>Panduan Kategori Nilai (A / B / C / D)</span>
                    {showRubricGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showRubricGuide && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                        A ({isChecklistSession ? '14–15 Benar' : '91–100'}) • Sangat Baik
                      </div>
                      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-bold">
                        B ({isChecklistSession ? '11–13 Benar' : '81–90'}) • Baik
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                        C ({isChecklistSession ? '6–10 Benar' : '61–80'}) • Cukup
                      </div>
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                        D ({isChecklistSession ? '0–5 Benar' : '0–60'}) • Perlu Bimbingan
                      </div>
                    </div>
                  )}
                </div>

                {/* View Switcher: Satu per Satu vs Semua Siswa */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAssessViewMode('FOCUS')}
                    className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      assessViewMode === 'FOCUS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nilai Satu per Satu
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessViewMode('ALL')}
                    className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      assessViewMode === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lihat Semua ({currentSession.students.length})
                  </button>
                </div>

                {/* Mode 1: Nilai Satu per Satu (Mobile Guided Flow) */}
                {assessViewMode === 'FOCUS' && (
                  <>
                    {currentSession.students.length === 0 ? (
                      <div className="p-6 rounded-xl bg-white border border-slate-200 text-center space-y-3">
                        <p className="text-sm font-bold text-slate-800">Daftar siswa kosong</p>
                        {isAdminControl && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewStudentNameDraft('');
                              setAddStudentDialogOpen(true);
                            }}
                            className="h-11 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Tambah Siswa Pertama</span>
                          </button>
                        )}
                      </div>
                    ) : activeFocusStudent ? (
                      <div className="space-y-3">
                        {/* Quick Student Selector */}
                        <div className="flex items-center gap-2">
                          <select
                            aria-label="Pilih siswa yang akan dinilai"
                            value={activeStudentIndex}
                            onChange={(e) => setActiveStudentIndex(Number(e.target.value))}
                            className="flex-1 h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                          >
                            {currentSession.students.map((st, idx) => {
                              const done = isStudentOralExamCompleted(st, currentSession.templateType, effectiveScope);
                              return (
                                <option key={`${st.studentId}_${idx}`} value={idx}>
                                  {idx + 1}. {st.studentName} {done ? '✓' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {isAdminControl && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewStudentNameDraft('');
                                setAddStudentDialogOpen(true);
                              }}
                              aria-label="Tambah Siswa Baru"
                              title="Tambah Siswa Baru"
                              className="w-11 h-11 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Active Student Assessment Card */}
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                Siswa {activeStudentIndex + 1} dari {currentSession.students.length}
                              </span>
                              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 wrap-break-word">
                                {activeFocusStudent.studentName}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                  isStudentOralExamCompleted(
                                    activeFocusStudent,
                                    currentSession.templateType,
                                    effectiveScope
                                  )
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isStudentOralExamCompleted(
                                  activeFocusStudent,
                                  currentSession.templateType,
                                  effectiveScope
                                )
                                  ? 'Sudah Dinilai'
                                  : 'Belum Dinilai'}
                              </span>
                              {isAdminControl && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudent(activeStudentIndex)}
                                  aria-label="Hapus siswa ini"
                                  className="w-9 h-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isChecklistSession
                            ? renderChecklistAssessmentBody(activeFocusStudent, activeStudentIndex)
                            : renderBtqAssessmentBody(activeFocusStudent, activeStudentIndex)}
                        </div>

                        {/* Secondary Export Buttons */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={isExporting}
                            className="h-11 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Printer className="w-4 h-4 text-[#023246]" />
                            <span>{isExporting ? 'Membuat PDF...' : 'Unduh PDF Resmi'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportExcel}
                            className="h-11 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>Unduh Excel</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Mode 2: Daftar Semua Siswa (Mobile Cards) */}
                {assessViewMode === 'ALL' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama siswa..."
                          className="w-full h-11 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      </div>
                      {isAdminControl && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewStudentNameDraft('');
                            setAddStudentDialogOpen(true);
                          }}
                          className="h-11 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Siswa</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'ALL' as const, label: `Semua (${currentSession.students.length})` },
                        {
                          key: 'UNASSESSED' as const,
                          label: `Belum (${currentSession.students.length - (summaryStats?.completedStudents ?? 0)})`,
                        },
                        { key: 'ASSESSED' as const, label: `Sudah (${summaryStats?.completedStudents ?? 0})` },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setStatusFilter(tab.key)}
                          className={`min-h-10 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            statusFilter === tab.key
                              ? 'bg-[#023246] border-[#023246] text-white'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {filteredStudentsWithIndex.length === 0 ? (
                      <div className="p-6 rounded-xl bg-white border border-slate-200 text-center space-y-2">
                        <p className="text-xs font-bold text-slate-700">Tidak ada siswa yang sesuai filter.</p>
                        {(searchQuery || statusFilter !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('ALL');
                            }}
                            className="h-10 px-3 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Tampilkan Semua</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredStudentsWithIndex.map(({ student, originalIndex }) => {
                          const done = isStudentOralExamCompleted(student, currentSession.templateType, effectiveScope);
                          const summaryText = isChecklistSession
                            ? [
                                effectiveScope !== 'ARABIC_ONLY'
                                  ? `Inggris: ${isChecklistTrackAssessed(student.englishScore, student.englishChecklist, student.englishAssessed) ? `${student.englishScore} (${student.englishPredicate})` : '-'}`
                                  : '',
                                effectiveScope !== 'ENGLISH_ONLY'
                                  ? `Arab: ${isChecklistTrackAssessed(student.arabicScore, student.arabicChecklist, student.arabicAssessed) ? `${student.arabicScore} (${student.arabicPredicate})` : '-'}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' • ')
                            : [
                                effectiveScope !== 'HAFALAN_ONLY'
                                  ? `BTQ: ${student.btqScore !== null && student.btqScore !== undefined ? `${student.btqScore} (${student.btqPredicate})` : '-'}`
                                  : '',
                                effectiveScope !== 'BTQ_ONLY'
                                  ? `Hafalan: ${student.hafalanScore !== null && student.hafalanScore !== undefined ? `${student.hafalanScore} (${student.hafalanPredicate})` : '-'}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' • ');

                          return (
                            <div
                              key={`${student.studentId}_${originalIndex}`}
                              className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {originalIndex + 1}. {student.studentName}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${done ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                                  {done ? summaryText : 'Belum dinilai'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStudentIndex(originalIndex);
                                  setAssessViewMode('FOCUS');
                                }}
                                className={`h-11 px-3.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                                  done
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                    : 'bg-[#023246] hover:bg-[#034560] text-white'
                                }`}
                              >
                                {done ? 'Ubah' : 'Nilai'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* 3. STICKY BOTTOM ACTION BAR (THUMB ZONE) */}
        <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0">
          <div className="w-full max-w-lg mx-auto">
            {screen === 'LIST' && isAdminControl && (
              <button
                type="button"
                onClick={() => openCreateScreen(activeTrack)}
                className="w-full h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {activeTrack === 'BAHASA' ? 'Buat Sesi Ujian Bahasa' : 'Buat Sesi Ujian BTQ'}
                </span>
              </button>
            )}

            {screen === 'LIST' && !isAdminControl && (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold cursor-pointer"
              >
                Tutup
              </button>
            )}

            {screen === 'CREATE' && isAdminControl && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setScreen('LIST')}
                  className="h-12 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isCreatingLoading}
                  onClick={handleCreateSessionSubmit}
                  className="flex-1 h-12 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  {isCreatingLoading ? 'Menyiapkan...' : 'Mulai Menilai Sekarang'}
                </button>
              </div>
            )}

            {screen === 'ASSESS' && currentSession && assessViewMode === 'FOCUS' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeStudentIndex <= 0}
                  onClick={() => setActiveStudentIndex((idx) => Math.max(0, idx - 1))}
                  className="h-12 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sblm</span>
                </button>

                <button
                  type="button"
                  disabled={!isDirty}
                  onClick={() => handleSaveSession(false)}
                  className={`flex-1 h-12 px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isDirty ? 'Simpan Nilai' : 'Tersimpan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeStudentIndex < currentSession.students.length - 1) {
                      setActiveStudentIndex((idx) => idx + 1);
                    } else {
                      setAssessViewMode('ALL');
                    }
                  }}
                  className="h-12 px-3 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>
                    {activeStudentIndex < currentSession.students.length - 1 ? 'Lanjut' : 'Daftar'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {screen === 'ASSESS' && currentSession && assessViewMode === 'ALL' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isDirty}
                  onClick={() => handleSaveSession(false)}
                  className={`flex-1 h-12 px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isDirty
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isDirty ? 'Simpan Nilai' : 'Tersimpan'}</span>
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportPdf}
                  className="h-12 px-3.5 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="h-12 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Excel</span>
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>

      {/* Modal Pengaturan Penguji Admin */}
      {isAdminControl && isAdminSetupOpen && (
        <OralExamAdminSetupModal
          isOpen={isAdminSetupOpen}
          onClose={() => {
            setIsAdminSetupOpen(false);
            loadAssignments();
          }}
          academicYear={activeAcademicYear}
        />
      )}

      {/* Bottom-sheet Mobile / Clean Modal Desktop: Tambah Siswa Baru (Admin Only) */}
      {isAdminControl && addStudentDialogOpen && (
        <div className="fixed inset-0 z-120 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmAddStudent}
            className="bg-white rounded-t-2xl md:rounded-2xl md:max-w-md w-full p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Tambah Siswa ke Sesi Ujian</h3>
              <p className="text-xs text-slate-500">
                Ketik nama lengkap siswa untuk dimasukkan ke daftar ujian ini.
              </p>
            </div>
            <input
              type="text"
              autoFocus
              value={newStudentNameDraft}
              onChange={(e) => setNewStudentNameDraft(e.target.value)}
              placeholder="Contoh: Ahmad Fauzan"
              className="w-full h-12 bg-white border border-slate-300 rounded-xl px-3.5 text-base font-medium focus:ring-2 focus:ring-[#023246] focus:outline-none"
            />
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAddStudentDialogOpen(false)}
                className="flex-1 h-12 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                Tambah Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom-sheet Mobile / Clean Modal Desktop: Konfirmasi Aksi */}
      {confirmDialog && (
        <div className="fixed inset-0 z-120 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-2xl md:rounded-2xl md:max-w-md w-full p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl border border-slate-200 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="sm:flex-1 h-12 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Batal
              </button>
              {confirmDialog.secondaryLabel && confirmDialog.onSecondary && (
                <button
                  type="button"
                  onClick={confirmDialog.onSecondary}
                  className="sm:flex-1 h-12 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {confirmDialog.secondaryLabel}
                </button>
              )}
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`sm:flex-1 h-12 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#023246] hover:bg-[#034560]'
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
