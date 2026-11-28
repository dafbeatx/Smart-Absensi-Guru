/**
 * SMART ABSENSI GURU - MODAL PENILAIAN UJIAN LISAN (MOBILE-FIRST & RAMAH GURU)
 * Memisahkan secara tegas 2 jalur penilaian berbasis 3 kriteria langsung (Skala 0–100 & Otomatis Predikat A–D):
 * 1. Ujian Bahasa (Bahasa Inggris / Bahasa Arab — 3 Kriteria)
 * 2. Ujian BTQ & Hafalan (BTQ / Tahfidz — 3 Kriteria)
 *
 * Pemisahan Wewenang:
 * - Mode ADMIN (`roleMode === 'ADMIN'`): Mengatur siapa penguji, ruang, mata uji, 3 kriteria, dan daftar siswa via OralExamAdminSetupModal + monitoring sesi.
 * - Mode GURU (`roleMode === 'GURU'`): Tinggal siap pakai langsung menilai siswa pada 3 kriteria sesuai penempatan Admin.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
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
import {
  OralExamRepository,
  ORAL_EXAM_CHANGED_EVENT,
} from '../../../repositories/OralExamRepository';
import {
  OralExamAssignmentRepository,
  ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT,
} from '../../../repositories/OralExamAssignmentRepository';
import {
  findAssignmentsForTeacher,
  findMatchingOfficialOralGroup,
  hydrateOralExamAssignmentsWithTeachers,
  resolveAssignmentDisplayForUser,
} from '../../../data/oral-exam-groups';
import {
  getDefaultCriteriaHelpers,
  getDefaultCriteriaLabels,
  getEffectiveSubjectScope,
  getOralExamSessionTrack,
  ORAL_EXAM_SCHEDULE_DAYS,
  ORAL_EXAM_SCHEDULE_LABEL,
  resolveCriteriaLabels,
  type OralExamAssignment,
  type OralExamCriteriaLabels,
  type OralExamSession,
  type OralExamStudentRecord,
  type OralExamSubjectScoreKey,
  type OralExamSubjectScope,
  type OralExamTemplateType,
  type OralExamTrack,
} from '../../../types/oral-exam.types';
import {
  calculateCriteriaAverageAndPredicate,
  calculateDirectScorePredicate,
  getOralExamPeriodStatus,
  getOralExamPredicateBadgeStyle,
  calculateOralExamSummaryStats,
  isOralSubjectAssessed,
  isStudentOralExamCompleted,
  normalizeCriteriaScores,
  resolveDefaultOralExamDate,
} from '../../../utils/oral-exam-scoring.utils';
import { areClassCodesEqual, normalizeClassCode } from '../../../utils/class.utils';
import type { StudentItem, UserProfile } from '../../../types/database.types';
import { OralExamAdminSetupModal } from './OralExamAdminSetupModal';

export interface OralExamAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
  roleMode?: 'GURU' | 'ADMIN' | 'KEPSEK';
  displayMode?: 'page' | 'modal';
}

type ModalScreen = 'LIST' | 'CREATE' | 'ASSESS';
type AssessViewMode = 'FOCUS' | 'ALL';
type RecapDisplayMode = 'BY_SESSION' | 'BY_STUDENT';
type RosterSourceMode = 'OFFICIAL_GROUP' | 'CLASS_FULL';

const AVAILABLE_CLASSES = ['7', '8A', '8B', '9A', '9B', 'SMA', '10', '11', '12'];
const QUICK_CRITERIA_SCORES = [60, 70, 75, 80, 85, 90, 95, 100];

const getScopeLabel = (templateType: OralExamTemplateType, scope: OralExamSubjectScope): string => {
  if (templateType === 'BAHASA_INGGRIS_ARAB') {
    if (scope === 'ENGLISH_ONLY') return 'Bahasa Inggris (3 Kriteria)';
    if (scope === 'ARABIC_ONLY') return 'Bahasa Arab (3 Kriteria)';
    return 'Bahasa Inggris & Arab';
  }
  if (scope === 'BTQ_ONLY') return 'BTQ Saja (3 Kriteria)';
  if (scope === 'HAFALAN_ONLY') return 'Hafalan Saja (3 Kriteria)';
  return 'BTQ & Hafalan';
};

export const OralExamAssessmentModal: React.FC<OralExamAssessmentModalProps> = ({
  isOpen,
  onClose,
  academicYear: propAcademicYear,
  roleMode = 'GURU',
  displayMode = 'page',
}) => {
  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const isAdminControl = roleMode === 'ADMIN';
  const isKepsekControl = roleMode === 'KEPSEK';
  const activeAcademicYear = useMemo(
    () => propAcademicYear || AdministrationRepository.getActiveAcademicYear(),
    [propAcademicYear]
  );
  const activeSemester = useMemo(() => AdministrationRepository.getActiveSemester(), []);

  // Navigation & track separation
  const [activeTrack, setActiveTrack] = useState<OralExamTrack>('BAHASA');
  const [screen, setScreen] = useState<ModalScreen>('LIST');
  const [assessViewMode, setAssessViewMode] = useState<AssessViewMode>('FOCUS');
  const [recapDisplayMode, setRecapDisplayMode] = useState<RecapDisplayMode>('BY_SESSION');
  const [recapSearchQuery, setRecapSearchQuery] = useState<string>('');
  const [recapClassFilter, setRecapClassFilter] = useState<string>('ALL');
  const [recapStatusFilter, setRecapStatusFilter] = useState<'ALL' | 'ASSESSED' | 'UNASSESSED'>('ALL');

  // Admin-configured Examiner Assignments (Cloud Synced)
  const [allAssignments, setAllAssignments] = useState<OralExamAssignment[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<UserProfile[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState<boolean>(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [isAdminSetupOpen, setIsAdminSetupOpen] = useState<boolean>(false);

  // Sessions & editing state
  const [sessions, setSessions] = useState<OralExamSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [isOpeningSession, setIsOpeningSession] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<OralExamSession | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Create session wizard state (Admin Only)
  const [subjectScopeDraft, setSubjectScopeDraft] = useState<OralExamSubjectScope>('ENGLISH_ONLY');
  const [criteriaLabelsDraft, setCriteriaLabelsDraft] = useState<OralExamCriteriaLabels>(() =>
    getDefaultCriteriaLabels('BAHASA')
  );
  const [rosterSourceMode, setRosterSourceMode] = useState<RosterSourceMode>('OFFICIAL_GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupChecklistSearch, setGroupChecklistSearch] = useState<string>('');
  const hasSeededGroupChecklistRef = useRef<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>('7');
  const [selectedExaminerUserId, setSelectedExaminerUserId] = useState<string>('');
  const [examinerName, setExaminerName] = useState<string>('');
  const [examinerNppDraft, setExaminerNppDraft] = useState<string | null>(null);
  const [useManualExaminerInput, setUseManualExaminerInput] = useState<boolean>(false);
  const [roomNumber, setRoomNumber] = useState<string>('Ruang 01');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(() => resolveDefaultOralExamDate());
  const oralPeriodStatus = getOralExamPeriodStatus();
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

  // Lock background scroll only when rendered as popup modal
  useEffect(() => {
    if (displayMode !== 'modal' || !isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, displayMode]);

  // Smoothly scroll inline confirm/add form into view when using non-popup page mode
  useEffect(() => {
    if (displayMode === 'page' && (confirmDialog || addStudentDialogOpen) && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [displayMode, confirmDialog, addStudentDialogOpen]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const list = await OralExamRepository.getAllSessions(activeAcademicYear, token || undefined);
      setSessions(list);
      return list;
    } catch (err) {
      console.warn('Gagal memuat sesi ujian lisan dari Supabase:', err);
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeAcademicYear, token]);

  const loadAssignments = useCallback(async () => {
    setIsLoadingAssignments(true);
    try {
      const [list, loadedStaff] = await Promise.all([
        OralExamAssignmentRepository.getAssignments(activeAcademicYear, token || undefined),
        isAdminControl
          ? OralExamAssignmentRepository.getStaffDirectory(token || '')
          : Promise.resolve<UserProfile[]>([]),
      ]);
      if (isAdminControl) {
        setStaffDirectory(loadedStaff);
        setAllAssignments(hydrateOralExamAssignmentsWithTeachers(list, loadedStaff));
      } else {
        setAllAssignments(list);
      }
      return list;
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [activeAcademicYear, isAdminControl, token]);

  // Reset modal entry state cleanly when opened + listen for cloud assignment & session updates
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
    const handleSessionsChanged = () => {
      loadSessions();
    };
    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadSessions();
      loadAssignments();
    };

    window.addEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
    window.addEventListener(ORAL_EXAM_CHANGED_EVENT, handleSessionsChanged);
    window.addEventListener('smart_absensi_teachers_updated', handleAssignmentsChanged);
    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    return () => {
      window.removeEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
      window.removeEventListener(ORAL_EXAM_CHANGED_EVENT, handleSessionsChanged);
      window.removeEventListener('smart_absensi_teachers_updated', handleAssignmentsChanged);
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    };
  }, [isOpen, loadSessions, loadAssignments]);

  const guruAssignments = useMemo(
    () =>
      findAssignmentsForTeacher(allAssignments, user).map((assignment) =>
        resolveAssignmentDisplayForUser(assignment, user)
      ),
    [allAssignments, user]
  );

  const canEditSession = useCallback(
    (session: OralExamSession | null): boolean => {
      if (!session) return false;
      if (isAdminControl) return true;
      if (isKepsekControl) return false;
      const ownedGroupIds = new Set(guruAssignments.map((a) => a.id));
      if (session.groupId && ownedGroupIds.has(session.groupId)) return true;
      if (session.examinerUserId && user?.id && session.examinerUserId === user.id) return true;
      return false;
    },
    [isAdminControl, isKepsekControl, guruAssignments, user?.id]
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
  const activeSelectableAssignments = useMemo(() => {
    const actives = allAssignments.filter((a) => a.isActive !== false);
    return actives.length > 0 ? actives : allAssignments;
  }, [allAssignments]);

  useEffect(() => {
    if (activeSelectableAssignments.length === 0) return;
    if (!selectedGroupId || !activeSelectableAssignments.some((a) => a.id === selectedGroupId)) {
      const matchedGroup = findMatchingOfficialOralGroup(user?.full_name);
      const firstId = matchedGroup?.id && activeSelectableAssignments.some((a) => a.id === matchedGroup.id)
        ? matchedGroup.id
        : activeSelectableAssignments[0].id;
      setSelectedGroupId(firstId);
    }
    if (!hasSeededGroupChecklistRef.current) {
      hasSeededGroupChecklistRef.current = true;
      setSelectedGroupIds(activeSelectableAssignments.map((a) => a.id));
    }
  }, [activeSelectableAssignments, selectedGroupId, user?.full_name]);

  // Sessions filtered STRICTLY by active track (Bahasa vs BTQ separated)
  const trackSessions = useMemo(
    () => sessions.filter((s) => getOralExamSessionTrack(s) === activeTrack),
    [sessions, activeTrack]
  );

  const existingTrackGroupIds = useMemo(
    () => new Set(trackSessions.map((s) => s.groupId).filter(Boolean) as string[]),
    [trackSessions]
  );

  const selectedAssignments = useMemo(
    () => activeSelectableAssignments.filter((a) => selectedGroupIds.includes(a.id)),
    [activeSelectableAssignments, selectedGroupIds]
  );

  const filteredChecklistAssignments = useMemo(() => {
    const q = groupChecklistSearch.trim().toLowerCase();
    if (!q) return activeSelectableAssignments;
    return activeSelectableAssignments.filter(
      (g) =>
        g.examinerName.toLowerCase().includes(q) ||
        g.roomNumber.toLowerCase().includes(q) ||
        g.className.toLowerCase().includes(q)
    );
  }, [activeSelectableAssignments, groupChecklistSearch]);

  const totalSelectedStudentCount = useMemo(
    () => selectedAssignments.reduce((acc, grp) => acc + grp.students.length, 0),
    [selectedAssignments]
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
    () =>
      selectedAssignments[0] ||
      allAssignments.find((g) => g.id === selectedGroupId) ||
      activeSelectableAssignments[0] ||
      null,
    [selectedAssignments, allAssignments, selectedGroupId, activeSelectableAssignments]
  );

  const existingSessionForActiveGuruTrack = useMemo(() => {
    if (!activeGuruAssignment) return null;
    return (
      sessions.find(
        (s) => s.groupId === activeGuruAssignment.id && getOralExamSessionTrack(s) === activeTrack
      ) || null
    );
  }, [sessions, activeGuruAssignment, activeTrack]);

  const applySingleGroupDraft = (grp: OralExamAssignment, track: OralExamTrack = activeTrack) => {
    setSelectedGroupId(grp.id);
    setSelectedExaminerUserId(grp.examinerUserId || '');
    setExaminerName(grp.examinerName);
    setExaminerNppDraft(grp.examinerNpp || null);
    setUseManualExaminerInput(!grp.examinerUserId && Boolean(grp.examinerName));
    setRoomNumber(grp.roomNumber);
    setSelectedClass(grp.className);
    setCriteriaLabelsDraft(
      resolveCriteriaLabels(track === 'BAHASA' ? grp.bahasaCriteria : grp.btqCriteria, track)
    );
  };

  const openCreateScreen = (track: OralExamTrack = activeTrack) => {
    if (!isAdminControl) return;
    setActiveTrack(track);
    setSubjectScopeDraft(track === 'BAHASA' ? 'ENGLISH_ONLY' : 'BOTH');
    setSessionTitle('');
    setSessionDate(resolveDefaultOralExamDate());
    setGroupChecklistSearch('');
    const allIds = activeSelectableAssignments.map((g) => g.id);
    setSelectedGroupIds(allIds);
    const targetGrp = selectedAdminAssignment || activeSelectableAssignments[0] || null;
    const grpCriteria = targetGrp
      ? resolveCriteriaLabels(track === 'BAHASA' ? targetGrp.bahasaCriteria : targetGrp.btqCriteria, track)
      : getDefaultCriteriaLabels(track);
    setCriteriaLabelsDraft(grpCriteria);
    if (targetGrp) {
      setRosterSourceMode('OFFICIAL_GROUP');
      applySingleGroupDraft(targetGrp, track);
    } else {
      const firstStaff = staffDirectory[0];
      setSelectedExaminerUserId(firstStaff?.id || user?.id || '');
      setExaminerName(firstStaff?.full_name || user?.full_name || 'Guru Penguji');
      setExaminerNppDraft(firstStaff?.nip ?? user?.nip ?? null);
      setUseManualExaminerInput(false);
    }
    setScreen('CREATE');
  };

  const handleToggleGroupChecklist = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const exists = prev.includes(groupId);
      const next = exists ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      if (next.length === 1) {
        const loneGrp = activeSelectableAssignments.find((g) => g.id === next[0]);
        if (loneGrp) applySingleGroupDraft(loneGrp);
      }
      return next;
    });
  };

  const handleSelectAllGroupChecklists = () => {
    setSelectedGroupIds(activeSelectableAssignments.map((g) => g.id));
  };

  const handleClearAllGroupChecklists = () => {
    setSelectedGroupIds([]);
  };

  const handleSelectExaminerStaff = (staffId: string) => {
    setSelectedExaminerUserId(staffId);
    if (!staffId) {
      setExaminerNppDraft(null);
      return;
    }
    const found = staffDirectory.find((t) => t.id === staffId);
    if (found) {
      setExaminerName(found.full_name);
      setExaminerNppDraft(found.nip || null);
      setUseManualExaminerInput(false);
    }
  };

  const handleOpenSession = (
    session: OralExamSession,
    initialStudentIndex = 0,
    preferredViewMode?: AssessViewMode
  ) => {
    const cloned: OralExamSession = JSON.parse(JSON.stringify(session));
    const scope = getEffectiveSubjectScope(cloned);
    const editable = canEditSession(cloned);
    setActiveTrack(getOralExamSessionTrack(cloned));
    setCurrentSession(cloned);
    setActiveLanguageTab(scope === 'ARABIC_ONLY' ? 'arabic' : 'english');
    setActiveStudentIndex(
      Math.max(0, Math.min(initialStudentIndex, Math.max(0, cloned.students.length - 1)))
    );
    setAssessViewMode(preferredViewMode || (editable ? 'FOCUS' : 'ALL'));
    setSearchQuery('');
    setStatusFilter('ALL');
    setScoreDrafts({});
    setIsDirty(false);
    setScreen('ASSESS');
  };

  const handleLaunchReadyAssignmentSession = async (
    assignment: OralExamAssignment,
    track: OralExamTrack = activeTrack
  ) => {
    if (isOpeningSession) return;
    setIsOpeningSession(true);
    try {
      const session = await OralExamRepository.openOrSyncAssignedSession(
        {
          assignment,
          track,
          academicYear: activeAcademicYear,
          semester: activeSemester,
          examinerNpp: user?.nip ?? assignment.examinerNpp ?? null,
          date: resolveDefaultOralExamDate(),
        },
        token || undefined
      );
      await loadSessions();
      handleOpenSession(session);
    } catch (err: any) {
      showToast(
        'error',
        'Gagal Memuat Sesi dari Supabase',
        err?.message || 'Periksa koneksi internet Anda lalu coba kembali.'
      );
    } finally {
      setIsOpeningSession(false);
    }
  };

  const handleCreateSessionSubmit = async () => {
    if (rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length === 0) {
      showToast(
        'error',
        'Pilih Minimal 1 Penguji',
        'Centang minimal satu kelompok penguji pada Langkah 2 terlebih dahulu.'
      );
      return;
    }

    setIsCreatingLoading(true);
    try {
      const resolvedCriteria = resolveCriteriaLabels(criteriaLabelsDraft, activeTrack);

      // Batch creation when > 1 examiners are checked
      if (rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length > 1) {
        const batchResult = await OralExamRepository.openOrSyncBatchSessions(
          {
            assignments: selectedAssignments,
            track: activeTrack,
            academicYear: activeAcademicYear,
            semester: activeSemester,
            date: sessionDate,
            subjectScopeOverride: subjectScopeDraft,
            criteriaLabelsOverride: resolvedCriteria,
          },
          token || undefined
        );

        await loadSessions();
        setScreen('LIST');
        showToast(
          'success',
          'Semua Penguji Terpilih Tersimpan di Supabase',
          `${batchResult.createdCount} sesi baru dibuat & ${batchResult.syncedCount} sesi disinkronkan (${totalSelectedStudentCount} siswa).`
        );
        return;
      }

      const templateType: OralExamTemplateType =
        activeTrack === 'BAHASA' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN';

      let targetClassName = selectedClass;
      let targetRoomNumber = roomNumber.trim() || 'Ruang 01';
      let targetExaminerName = examinerName.trim() || user?.full_name || 'Guru Penguji';
      let targetExaminerNpp: string | null = examinerNppDraft ?? user?.nip ?? null;
      let groupId: string | null = null;
      let classStudents: Array<{ studentId: string; studentName: string; nisn?: string; className?: string }> = [];

      const singleSelectedGrp = selectedAssignments[0] || selectedAdminAssignment;
      if (rosterSourceMode === 'OFFICIAL_GROUP' && singleSelectedGrp) {
        targetClassName = singleSelectedGrp.className;
        targetRoomNumber = roomNumber.trim() || singleSelectedGrp.roomNumber;
        targetExaminerName = examinerName.trim() || singleSelectedGrp.examinerName;
        targetExaminerNpp = examinerNppDraft ?? singleSelectedGrp.examinerNpp ?? null;
        groupId = singleSelectedGrp.id;
        classStudents = singleSelectedGrp.students.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          nisn: s.nisn,
          className: s.className || singleSelectedGrp.className,
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

      const created = await OralExamRepository.createNewSession(
        {
          templateType,
          subjectScope: subjectScopeDraft,
          criteriaLabels: resolveCriteriaLabels(criteriaLabelsDraft, activeTrack),
          groupId,
          title: sessionTitle.trim() || defaultTitle,
          academicYear: activeAcademicYear,
          semester: activeSemester,
          examinerUserId:
            selectedExaminerUserId ||
            (rosterSourceMode === 'OFFICIAL_GROUP' ? selectedAdminAssignment?.examinerUserId : null) ||
            null,
          examinerName: targetExaminerName,
          examinerNpp: targetExaminerNpp,
          roomNumber: targetRoomNumber,
          className: targetClassName,
          date: sessionDate,
          students: classStudents,
        },
        token || undefined
      );

      await loadSessions();
      handleOpenSession(created);
      showToast(
        'success',
        'Sesi Tersimpan di Supabase',
        `${created.students.length} peserta (${targetRoomNumber}) siap dinilai.`
      );
    } catch (err: any) {
      showToast(
        'error',
        'Gagal Membuat Sesi di Supabase',
        err?.message || 'Pastikan Anda masih login dan koneksi internet aktif.'
      );
    } finally {
      setIsCreatingLoading(false);
    }
  };

  // --- Unified 3-Criteria Direct Scoring Handlers ---
  const applySubjectCriteriaValue = (
    studentIndex: number,
    subjectKey: OralExamSubjectScoreKey,
    criterionIndex: 0 | 1 | 2,
    scoreValue: number | null
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };

    const existingCriteria =
      subjectKey === 'english'
        ? target.englishCriteria
        : subjectKey === 'arabic'
          ? target.arabicCriteria
          : subjectKey === 'btq'
            ? target.btqCriteria
            : target.hafalanCriteria;

    const nextScores = normalizeCriteriaScores(existingCriteria);
    nextScores[criterionIndex] = scoreValue;
    const calc = calculateCriteriaAverageAndPredicate(nextScores);

    if (subjectKey === 'english') {
      target.englishCriteria = calc.scores;
      target.englishScore = calc.averageScore;
      target.englishPredicate = calc.predicate;
      target.englishAssessed = calc.isComplete;
    } else if (subjectKey === 'arabic') {
      target.arabicCriteria = calc.scores;
      target.arabicScore = calc.averageScore;
      target.arabicPredicate = calc.predicate;
      target.arabicAssessed = calc.isComplete;
    } else if (subjectKey === 'btq') {
      target.btqCriteria = calc.scores;
      target.btqScore = calc.averageScore;
      target.btqPredicate = calc.predicate;
    } else {
      target.hafalanCriteria = calc.scores;
      target.hafalanScore = calc.averageScore;
      target.hafalanPredicate = calc.predicate;
    }

    updatedStudents[studentIndex] = target;
    setCurrentSession({ ...currentSession, students: updatedStudents });
    setIsDirty(true);
  };

  const handleCriterionScoreChange = (
    studentIndex: number,
    subjectKey: OralExamSubjectScoreKey,
    criterionIndex: 0 | 1 | 2,
    valStr: string
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const student = currentSession.students[studentIndex];
    const draftKey = `${student.studentId}:${subjectKey}:${criterionIndex}`;
    const trimmed = valStr.trim();

    if (trimmed === '') {
      setScoreDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      applySubjectCriteriaValue(studentIndex, subjectKey, criterionIndex, null);
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
    applySubjectCriteriaValue(studentIndex, subjectKey, criterionIndex, clamped);
  };

  const handleCriterionScoreBlur = (
    studentId: string,
    subjectKey: OralExamSubjectScoreKey,
    criterionIndex: 0 | 1 | 2
  ) => {
    const draftKey = `${studentId}:${subjectKey}:${criterionIndex}`;
    setScoreDrafts((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  };

  const handleApplyCriterionQuickScore = (
    studentIndex: number,
    subjectKey: OralExamSubjectScoreKey,
    criterionIndex: 0 | 1 | 2,
    scoreValue: number
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const student = currentSession.students[studentIndex];
    const draftKey = `${student.studentId}:${subjectKey}:${criterionIndex}`;
    setScoreDrafts((prev) => {
      if (!(draftKey in prev)) return prev;
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
    applySubjectCriteriaValue(studentIndex, subjectKey, criterionIndex, scoreValue);
  };

  const handleClearSubjectCriteria = (
    studentIndex: number,
    subjectKey: OralExamSubjectScoreKey
  ) => {
    if (!currentSession || studentIndex < 0 || studentIndex >= currentSession.students.length) return;
    const student = currentSession.students[studentIndex];
    setScoreDrafts((prev) => {
      const next = { ...prev };
      for (const idx of [0, 1, 2] as const) {
        delete next[`${student.studentId}:${subjectKey}:${idx}`];
      }
      return next;
    });

    const updatedStudents = [...currentSession.students];
    const target = { ...updatedStudents[studentIndex] };
    if (subjectKey === 'english') {
      target.englishCriteria = [null, null, null];
      target.englishScore = null;
      target.englishPredicate = null;
      target.englishAssessed = false;
    } else if (subjectKey === 'arabic') {
      target.arabicCriteria = [null, null, null];
      target.arabicScore = null;
      target.arabicPredicate = null;
      target.arabicAssessed = false;
    } else if (subjectKey === 'btq') {
      target.btqCriteria = [null, null, null];
      target.btqScore = null;
      target.btqPredicate = null;
    } else {
      target.hafalanCriteria = [null, null, null];
      target.hafalanScore = null;
      target.hafalanPredicate = null;
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

  const handleConfirmAddStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSession) return;
    const trimmed = newStudentNameDraft.trim();
    if (!trimmed) {
      showToast('error', 'Nama Siswa Wajib Diisi', 'Masukkan nama lengkap siswa sebelum menambahkan.');
      return;
    }

    const isBahasa = currentSession.templateType === 'BAHASA_INGGRIS_ARAB';
    const newRecord: OralExamStudentRecord = {
      studentId: `manual_${Date.now()}`,
      studentName: trimmed,
      className: currentSession.className,
      ...(isBahasa
        ? {
            englishCriteria: [null, null, null],
            englishScore: null,
            englishPredicate: null,
            englishAssessed: false,
            arabicCriteria: [null, null, null],
            arabicScore: null,
            arabicPredicate: null,
            arabicAssessed: false,
          }
        : {
            btqCriteria: [null, null, null],
            btqScore: null,
            btqPredicate: null,
            hafalanCriteria: [null, null, null],
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

  const handleSaveSession = useCallback(async (silentToast = false): Promise<boolean> => {
    if (!currentSession || isSavingSession) return false;
    setIsSavingSession(true);
    try {
      const saved = await OralExamRepository.saveSession(currentSession, token || undefined);
      setCurrentSession(saved);
      setIsDirty(false);
      setScoreDrafts({});
      await loadSessions();
      if (!silentToast) {
        showToast(
          'success',
          'Tersimpan di Supabase Cloud',
          'Seluruh nilai ujian lisan tersimpan permanen ke server Supabase.'
        );
      }
      return true;
    } catch (err: any) {
      showToast(
        'error',
        'Gagal Menyimpan ke Supabase',
        err?.message || 'Periksa koneksi internet Anda lalu tekan Simpan Nilai lagi.'
      );
      return false;
    } finally {
      setIsSavingSession(false);
    }
  }, [currentSession, isSavingSession, loadSessions, showToast, token]);

  const handleDeleteSessionById = (sessionToDelete: OralExamSession) => {
    setConfirmDialog({
      title: 'Hapus Sesi Ujian Lisan?',
      message: `Hapus sesi "${sessionToDelete.title}" beserta seluruh nilai siswanya dari Supabase?`,
      confirmLabel: 'Ya, Hapus Sesi',
      tone: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await OralExamRepository.deleteSession(sessionToDelete.id, token || undefined);
          if (currentSession?.id === sessionToDelete.id) {
            setCurrentSession(null);
            setScreen('LIST');
          }
          setIsDirty(false);
          setScoreDrafts({});
          await loadSessions();
          showToast('info', 'Sesi Dihapus', 'Sesi penilaian lisan telah dihapus dari Supabase.');
        } catch (err: any) {
          showToast(
            'error',
            'Gagal Menghapus Sesi',
            err?.message || 'Hanya Admin/Operator aktif yang dapat menghapus sesi di server.'
          );
        }
      },
    });
  };

  const handleExportPdf = async () => {
    if (!currentSession) return;
    if (isDirty) {
      const ok = await handleSaveSession(true);
      if (!ok) return;
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
      const ok = await handleSaveSession(true);
      if (!ok) return;
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
    if (isDirty && screen === 'ASSESS' && canEditSession(currentSession)) {
      setConfirmDialog({
        title: 'Simpan Nilai ke Supabase?',
        message: 'Ada nilai ujian yang belum disimpan ke cloud. Pilih "Simpan & Keluar" agar data aman, atau "Buang Perubahan".',
        confirmLabel: 'Simpan & Keluar',
        tone: 'primary',
        onConfirm: async () => {
          const ok = await handleSaveSession(false);
          if (!ok) return;
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
  }, [canEditSession, currentSession, handleSaveSession, isDirty, screen]);

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

  const isBahasaSession = currentSession?.templateType === 'BAHASA_INGGRIS_ARAB';
  const isCurrentSessionReadOnly = screen === 'ASSESS' && !canEditSession(currentSession);

  const filteredRecapSessions = useMemo(() => {
    const q = recapSearchQuery.trim().toLowerCase();
    return trackSessions.filter((sess) => {
      if (recapClassFilter !== 'ALL' && sess.className !== recapClassFilter) {
        return false;
      }
      if (!q) return true;
      return (
        sess.examinerName.toLowerCase().includes(q) ||
        (sess.roomNumber || '').toLowerCase().includes(q) ||
        sess.className.toLowerCase().includes(q) ||
        sess.title.toLowerCase().includes(q) ||
        sess.students.some((s) => s.studentName.toLowerCase().includes(q))
      );
    });
  }, [trackSessions, recapSearchQuery, recapClassFilter]);

  const recapAvailableClasses = useMemo(() => {
    const clsSet = new Set<string>();
    trackSessions.forEach((sess) => {
      if (sess.className) clsSet.add(sess.className);
    });
    return Array.from(clsSet);
  }, [trackSessions]);

  const flattenedRecapStudents = useMemo(() => {
    const q = recapSearchQuery.trim().toLowerCase();
    const list: Array<{
      session: OralExamSession;
      student: OralExamStudentRecord;
      originalIndex: number;
      scope: OralExamSubjectScope;
      isDone: boolean;
    }> = [];

    trackSessions.forEach((sess) => {
      const scope = getEffectiveSubjectScope(sess);
      sess.students.forEach((st, idx) => {
        const studentClass = st.className || sess.className;
        if (
          recapClassFilter !== 'ALL' &&
          sess.className !== recapClassFilter &&
          studentClass !== recapClassFilter
        ) {
          return;
        }
        if (q) {
          const hit =
            st.studentName.toLowerCase().includes(q) ||
            sess.examinerName.toLowerCase().includes(q) ||
            (sess.roomNumber || '').toLowerCase().includes(q) ||
            studentClass.toLowerCase().includes(q);
          if (!hit) return;
        }
        const isDone = isStudentOralExamCompleted(st, sess.templateType, scope);
        if (recapStatusFilter === 'ASSESSED' && !isDone) return;
        if (recapStatusFilter === 'UNASSESSED' && isDone) return;

        list.push({
          session: sess,
          student: st,
          originalIndex: idx,
          scope,
          isDone,
        });
      });
    });

    return list;
  }, [trackSessions, recapSearchQuery, recapClassFilter, recapStatusFilter]);

  const activeSessionCriteriaLabels = useMemo(
    () =>
      currentSession
        ? resolveCriteriaLabels(currentSession.criteriaLabels, getOralExamSessionTrack(currentSession))
        : getDefaultCriteriaLabels(activeTrack),
    [currentSession, activeTrack]
  );

  const activeSessionCriteriaHelpers = useMemo(
    () =>
      getDefaultCriteriaHelpers(
        currentSession ? getOralExamSessionTrack(currentSession) : activeTrack
      ),
    [currentSession, activeTrack]
  );

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

  const getSubjectCriteriaSnapshot = (
    student: OralExamStudentRecord,
    subjectKey: OralExamSubjectScoreKey
  ) => {
    const rawCriteria =
      subjectKey === 'english'
        ? student.englishCriteria
        : subjectKey === 'arabic'
          ? student.arabicCriteria
          : subjectKey === 'btq'
            ? student.btqCriteria
            : student.hafalanCriteria;
    const storedScore =
      subjectKey === 'english'
        ? student.englishScore
        : subjectKey === 'arabic'
          ? student.arabicScore
          : subjectKey === 'btq'
            ? student.btqScore
            : student.hafalanScore;
    const storedPred =
      subjectKey === 'english'
        ? student.englishPredicate
        : subjectKey === 'arabic'
          ? student.arabicPredicate
          : subjectKey === 'btq'
            ? student.btqPredicate
            : student.hafalanPredicate;
    const calc = calculateCriteriaAverageAndPredicate(rawCriteria);
    const hasLegacyOnly =
      calc.filledCount === 0 &&
      typeof storedScore === 'number' &&
      !Number.isNaN(storedScore) &&
      (subjectKey === 'english'
        ? student.englishAssessed !== false
        : subjectKey === 'arabic'
          ? student.arabicAssessed !== false
          : true);
    const effectiveScore = calc.filledCount > 0 ? calc.averageScore : hasLegacyOnly ? storedScore : null;
    const effectivePredicate =
      calc.filledCount > 0
        ? calc.predicate
        : hasLegacyOnly
          ? storedPred || calculateDirectScorePredicate(storedScore)
          : null;

    return {
      scores: calc.scores,
      filledCount: calc.filledCount,
      isComplete: calc.isComplete || hasLegacyOnly,
      hasLegacyOnly,
      effectiveScore,
      effectivePredicate,
    };
  };

  const renderCriteriaSubjectCard = (
    student: OralExamStudentRecord,
    studentIdx: number,
    subjectKey: OralExamSubjectScoreKey,
    subjectTitle: string
  ) => {
    const snapshot = getSubjectCriteriaSnapshot(student, subjectKey);
    const badge = getOralExamPredicateBadgeStyle(snapshot.effectivePredicate);
    const accentBg = isBahasaSession ? 'bg-[#023246]' : 'bg-[#0D7A5F]';
    const focusRing = isBahasaSession ? 'focus:ring-[#023246]' : 'focus:ring-[#0D7A5F]';

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">{subjectTitle}</h4>
            <p className="text-[11px] text-slate-500">
              {isCurrentSessionReadOnly
                ? 'Rincian nilai 3 kriteria skala 0–100 dari penguji:'
                : 'Penguji langsung isi nilai skala 0–100 untuk 3 kriteria penilaian:'}
            </p>
          </div>
          {!isCurrentSessionReadOnly && snapshot.filledCount > 0 && (
            <button
              type="button"
              onClick={() => handleClearSubjectCriteria(studentIdx, subjectKey)}
              className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Ulangi</span>
            </button>
          )}
        </div>

        {snapshot.hasLegacyOnly && (
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 font-medium">
            Data tersimpan sebelumnya: <strong>Nilai {snapshot.effectiveScore}</strong> ({snapshot.effectivePredicate || '-'}).
            Isi 3 kriteria di bawah jika ingin memperbarui rincian penilaian.
          </div>
        )}

        <div className="space-y-2.5">
          {([0, 1, 2] as const).map((criterionIdx) => {
            const draftKey = `${student.studentId}:${subjectKey}:${criterionIdx}`;
            const currentVal = snapshot.scores[criterionIdx];
            const displayValue =
              draftKey in scoreDrafts
                ? scoreDrafts[draftKey]
                : currentVal !== null && currentVal !== undefined
                  ? String(currentVal)
                  : '';
            const criterionLabel = activeSessionCriteriaLabels[criterionIdx];
            const defaultLabels = getDefaultCriteriaLabels(isBahasaSession ? 'BAHASA' : 'BTQ');
            const isDefaultLabel = criterionLabel === defaultLabels[criterionIdx];

            return (
              <div
                key={`${subjectKey}_crit_${criterionIdx}`}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-md ${accentBg} text-white text-[11px] font-extrabold inline-flex items-center justify-center shrink-0`}
                      >
                        {criterionIdx + 1}
                      </span>
                      <span className="truncate">{criterionLabel}</span>
                    </span>
                    {isDefaultLabel && (
                      <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                        {activeSessionCriteriaHelpers[criterionIdx]}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                    0–100
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly={isCurrentSessionReadOnly}
                    disabled={isCurrentSessionReadOnly}
                    aria-label={`${subjectTitle} - Kriteria ${criterionIdx + 1} ${criterionLabel}`}
                    value={displayValue}
                    onChange={(e) =>
                      handleCriterionScoreChange(studentIdx, subjectKey, criterionIdx, e.target.value)
                    }
                    onBlur={() => handleCriterionScoreBlur(student.studentId, subjectKey, criterionIdx)}
                    placeholder={isCurrentSessionReadOnly ? '-' : 'Ketik nilai 0 – 100'}
                    className={`flex-1 h-11 px-3 rounded-xl text-center text-base sm:text-lg font-extrabold focus:outline-none ${
                      isCurrentSessionReadOnly
                        ? 'bg-slate-100 border border-slate-200 text-slate-700 cursor-default'
                        : `bg-white border border-slate-300 text-slate-900 focus:ring-2 ${focusRing}`
                    }`}
                  />
                  {!isCurrentSessionReadOnly && displayValue !== '' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCriterionScoreChange(studentIdx, subjectKey, criterionIdx, '')
                      }
                      className="h-11 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {!isCurrentSessionReadOnly && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_CRITERIA_SCORES.map((val) => {
                      const isSelected = currentVal === val;
                      return (
                        <button
                          key={`${subjectKey}_${criterionIdx}_${val}`}
                          type="button"
                          onClick={() =>
                            handleApplyCriterionQuickScore(studentIdx, subjectKey, criterionIdx, val)
                          }
                          className={`min-h-10 rounded-lg border text-xs sm:text-sm font-bold transition-colors cursor-pointer active:scale-95 ${
                            isSelected
                              ? `${accentBg} border-transparent text-white`
                              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ringkasan Rata-rata 3 Kriteria Otomatis */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Nilai Akhir (Rata-rata 3 Kriteria)
            </span>
            <p className="text-sm font-extrabold text-slate-900">
              {snapshot.effectiveScore !== null
                ? snapshot.isComplete
                  ? `Nilai ${snapshot.effectiveScore} (3/3 Kriteria)`
                  : `Sementara ${snapshot.effectiveScore} (${snapshot.filledCount}/3 Kriteria)`
                : 'Belum ada kriteria yang diisi'}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
          >
            {snapshot.effectivePredicate
              ? snapshot.isComplete
                ? badge.badgeLabel
                : `Sementara ${snapshot.effectivePredicate}`
              : 'Belum Dinilai'}
          </span>
        </div>
      </div>
    );
  };

  const renderExaminerNotesField = (
    student: OralExamStudentRecord,
    studentIdx: number,
    focusRingClass: string,
    editablePlaceholder: string
  ) => (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-700 block">
        Catatan Penguji (Opsional)
      </label>
      <input
        type="text"
        readOnly={isCurrentSessionReadOnly}
        disabled={isCurrentSessionReadOnly}
        value={student.notes || ''}
        onChange={(e) => handleNotesChange(studentIdx, e.target.value)}
        placeholder={isCurrentSessionReadOnly ? 'Tidak ada catatan penguji' : editablePlaceholder}
        className={`w-full h-11 px-3.5 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none ${
          isCurrentSessionReadOnly
            ? 'bg-slate-100 text-slate-600 cursor-default'
            : `bg-white text-slate-900 focus:ring-2 ${focusRingClass}`
        }`}
      />
    </div>
  );

  const renderBahasaAssessmentBody = (student: OralExamStudentRecord, studentIdx: number) => {
    const showEnglishTab = effectiveScope !== 'ARABIC_ONLY';
    const showArabicTab = effectiveScope !== 'ENGLISH_ONLY';
    const currentLang: 'english' | 'arabic' =
      showEnglishTab && showArabicTab ? activeLanguageTab : showEnglishTab ? 'english' : 'arabic';

    const engDone = isOralSubjectAssessed(
      student.englishScore,
      student.englishCriteria,
      student.englishChecklist,
      student.englishAssessed,
      false
    );
    const araDone = isOralSubjectAssessed(
      student.arabicScore,
      student.arabicCriteria,
      student.arabicChecklist,
      student.arabicAssessed,
      false
    );

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
              {engDone && (
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
              {araDone && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px]">
                  {student.arabicScore} ({student.arabicPredicate})
                </span>
              )}
            </button>
          </div>
        )}

        {renderCriteriaSubjectCard(
          student,
          studentIdx,
          currentLang,
          currentLang === 'english' ? 'Nilai Ujian Lisan Bahasa Inggris' : 'Nilai Ujian Lisan Bahasa Arab'
        )}

        {renderExaminerNotesField(
          student,
          studentIdx,
          'focus:ring-[#023246]',
          'Contoh: Pelafalan jelas, kosakata perlu diperkaya...'
        )}
      </div>
    );
  };

  const renderBtqAssessmentBody = (student: OralExamStudentRecord, studentIdx: number) => {
    const showBtq = effectiveScope !== 'HAFALAN_ONLY';
    const showHafalan = effectiveScope !== 'BTQ_ONLY';

    return (
      <div className="space-y-4">
        {showBtq && renderCriteriaSubjectCard(student, studentIdx, 'btq', "Nilai BTQ (Baca Tulis Qur'an)")}
        {showHafalan && renderCriteriaSubjectCard(student, studentIdx, 'hafalan', 'Nilai Hafalan (Tahfidz)')}
        {renderExaminerNotesField(
          student,
          studentIdx,
          'focus:ring-[#0D7A5F]',
          'Contoh: Bacaan lancar, perbaiki makhraj...'
        )}
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
          onClick={() => setActiveTrack('BAHASA')}
          className={`p-3.5 rounded-xl border text-left transition-colors min-h-14 cursor-pointer ${
            activeTrack === 'BAHASA'
              ? 'bg-[#023246] border-[#023246] text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
              <Languages className="w-4 h-4 shrink-0" />
              <span>Ujian Bahasa</span>
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              activeTrack === 'BAHASA' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {bahasaCount}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${
            activeTrack === 'BAHASA' ? 'text-slate-200' : 'text-slate-500'
          }`}>
            {allowedTracks && !canBahasa ? 'Lihat Rekap Semua Penguji' : 'Inggris / Arab • 3 Kriteria'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTrack('BTQ')}
          className={`p-3.5 rounded-xl border text-left transition-colors min-h-14 cursor-pointer ${
            activeTrack === 'BTQ'
              ? 'bg-[#0D7A5F] border-[#0D7A5F] text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Ujian BTQ</span>
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              activeTrack === 'BTQ' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {btqCount}
            </span>
          </div>
          <p className={`text-[11px] mt-1 ${
            activeTrack === 'BTQ' ? 'text-emerald-100' : 'text-slate-500'
          }`}>
            {allowedTracks && !canBtq ? 'Lihat Rekap Semua Penguji' : 'BTQ & Hafalan • 3 Kriteria'}
          </p>
        </button>
      </div>
    );
  };

  const renderScheduleBanner = () => (
    <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 flex items-center justify-between gap-2.5 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#023246] text-white flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-900">
            Pelaksanaan Ujian Lisan: {ORAL_EXAM_SCHEDULE_LABEL}
          </p>
          <p className="text-[11px] text-slate-600">{oralPeriodStatus.detailText}</p>
        </div>
      </div>
      <span
        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold border shrink-0 ${
          oralPeriodStatus.phase === 'ONGOING'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : oralPeriodStatus.phase === 'UPCOMING'
              ? 'bg-sky-100 text-[#023246] border-sky-300'
              : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {oralPeriodStatus.badgeText}
      </span>
    </div>
  );

  const renderExecutionDateField = (labelText: string) => (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-700 block">{labelText}</label>
      <div className="flex flex-wrap gap-1.5">
        {ORAL_EXAM_SCHEDULE_DAYS.map((day) => {
          const isSelected = sessionDate === day.date;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSessionDate(day.date)}
              className={`h-9 px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#023246] border-[#023246] text-white'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              {day.shortLabel}
            </button>
          );
        })}
      </div>
      <input
        type="date"
        value={sessionDate}
        onChange={(e) => setSessionDate(e.target.value)}
        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
      />
      <p className="text-[11px] text-slate-500">
        Jadwal resmi pelaksanaan: <strong>{ORAL_EXAM_SCHEDULE_LABEL}</strong>.
      </p>
    </div>
  );

  const renderAllResultsSection = () => {
    const formatCompactSubjectResult = (
      label: string,
      criteria: OralExamStudentRecord['englishCriteria'],
      score: number | null | undefined,
      predicate: OralExamStudentRecord['englishPredicate'],
      assessedFlag: boolean | undefined,
      allowZeroLegacy: boolean
    ) => {
      const calc = calculateCriteriaAverageAndPredicate(criteria);
      if (calc.filledCount > 0) {
        const detail = `${calc.scores[0] ?? '-'} • ${calc.scores[1] ?? '-'} • ${calc.scores[2] ?? '-'}`;
        if (calc.isComplete) {
          return {
            text: `${label}: ${calc.averageScore} (${calc.predicate || '-'})`,
            detail,
            done: true,
          };
        }
        return {
          text: `${label}: ${calc.filledCount}/3 kriteria (${calc.averageScore ?? '-'})`,
          detail,
          done: false,
        };
      }
      const hasLegacy =
        assessedFlag !== false &&
        typeof score === 'number' &&
        !Number.isNaN(score) &&
        (allowZeroLegacy || assessedFlag === true || score > 0);
      if (hasLegacy) {
        return {
          text: `${label}: ${score} (${predicate || calculateDirectScorePredicate(score) || '-'})`,
          detail: null,
          done: true,
        };
      }
      return { text: `${label}: Belum dinilai`, detail: null, done: false };
    };

    return (
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
              {activeTrack === 'BAHASA'
                ? 'Hasil Penilaian Ujian Bahasa (Semua Penguji)'
                : 'Hasil Penilaian Ujian BTQ (Semua Penguji)'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {trackSessions.length} sesi tersimpan di Supabase • TA {activeAcademicYear}
            </p>
          </div>
          {trackSessions.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
                  OralExamExportService.exportAllTrackSessionsToExcel(
                    sessions,
                    activeTrack,
                    activeAcademicYear
                  );
                  showToast(
                    'success',
                    'Rekap Semua Ruang Diunduh',
                    'File Excel gabungan seluruh penguji berhasil disimpan.'
                  );
                } catch {
                  showToast('error', 'Gagal Ekspor Excel', 'Terjadi kesalahan saat membuat rekap Excel.');
                }
              }}
              className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Rekap Excel Semua</span>
            </button>
          )}
        </div>

        {/* Switcher: Per Ruang/Penguji vs Cari Semua Siswa */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70 border border-slate-200">
          <button
            type="button"
            onClick={() => setRecapDisplayMode('BY_SESSION')}
            className={`min-h-10 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              recapDisplayMode === 'BY_SESSION'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Per Penguji / Ruang ({trackSessions.length})
          </button>
          <button
            type="button"
            onClick={() => setRecapDisplayMode('BY_STUDENT')}
            className={`min-h-10 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              recapDisplayMode === 'BY_STUDENT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rekap Semua Siswa
          </button>
        </div>

        {trackSessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={recapSearchQuery}
                  onChange={(e) => setRecapSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa, penguji, ruang, atau kelas..."
                  className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                />
              </div>
              {recapAvailableClasses.length > 1 && (
                <select
                  aria-label="Filter kelas"
                  value={recapClassFilter}
                  onChange={(e) => setRecapClassFilter(e.target.value)}
                  className="h-10 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="ALL">Semua Kelas</option>
                  {recapAvailableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls === 'SMA' ? 'SMA' : `Kelas ${cls}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {recapDisplayMode === 'BY_STUDENT' && (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'ALL' as const, label: 'Semua' },
                  { key: 'ASSESSED' as const, label: 'Sudah Dinilai' },
                  { key: 'UNASSESSED' as const, label: 'Belum' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRecapStatusFilter(opt.key)}
                    className={`min-h-9 px-2 rounded-xl border text-[11px] font-bold cursor-pointer ${
                      recapStatusFilter === opt.key
                        ? 'bg-[#023246] border-[#023246] text-white'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoadingSessions ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs font-semibold text-slate-500">
            Memuat seluruh hasil penilaian ujian lisan dari Supabase...
          </div>
        ) : trackSessions.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#023246] flex items-center justify-center mx-auto">
              {activeTrack === 'BAHASA' ? <Languages className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {activeTrack === 'BAHASA'
                ? 'Belum Ada Nilai Ujian Bahasa di Supabase'
                : 'Belum Ada Nilai Ujian BTQ di Supabase'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isAdminControl
                ? 'Klik tombol "Buat Sesi" di bawah untuk menyiapkan sesi, atau tunggu penguji memulai penilaian.'
                : 'Nilai akan tampil di sini secara otomatis segera setelah penguji mulai menginput penilaian.'}
            </p>
          </div>
        ) : recapDisplayMode === 'BY_SESSION' ? (
          filteredRecapSessions.length === 0 ? (
            <div className="p-5 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
              Tidak ada sesi penguji yang cocok dengan filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRecapSessions.map((sess) => {
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
                const editable = canEditSession(sess);

                return (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl bg-white border border-slate-200 space-y-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {getScopeLabel(sess.templateType, scope)}
                        </span>
                        {editable && !isAdminControl && (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Sesi Anda
                          </span>
                        )}
                      </div>
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
                        <span>Progress Penilaian</span>
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
                        className={`flex-1 h-11 px-3.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          editable
                            ? 'bg-[#023246] hover:bg-[#034560] text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {!editable && <Eye className="w-4 h-4 shrink-0" />}
                        <span>{editable ? 'Buka & Nilai' : 'Lihat Nilai'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
                          await OralExamExportService.exportToPdf(sess);
                        }}
                        aria-label={`Unduh PDF ${sess.examinerName}`}
                        title="Unduh PDF"
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#023246] flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const { OralExamExportService } = await import('../../../lib/oral-exam-export.lib');
                          OralExamExportService.exportToExcel(sess);
                        }}
                        aria-label={`Unduh Excel ${sess.examinerName}`}
                        title="Unduh Excel"
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-emerald-700 flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      {isAdminControl && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSessionById(sess)}
                          aria-label={`Hapus sesi ${sess.title}`}
                          className="w-11 h-11 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : flattenedRecapStudents.length === 0 ? (
          <div className="p-5 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            Tidak ada siswa yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="space-y-2">
            {flattenedRecapStudents.map(({ session: sess, student, originalIndex, scope, isDone }) => {
              const isBahasa = sess.templateType === 'BAHASA_INGGRIS_ARAB';
              const items = isBahasa
                ? [
                    scope !== 'ARABIC_ONLY'
                      ? formatCompactSubjectResult(
                          'B. Inggris',
                          student.englishCriteria,
                          student.englishScore,
                          student.englishPredicate,
                          student.englishAssessed,
                          false
                        )
                      : null,
                    scope !== 'ENGLISH_ONLY'
                      ? formatCompactSubjectResult(
                          'B. Arab',
                          student.arabicCriteria,
                          student.arabicScore,
                          student.arabicPredicate,
                          student.arabicAssessed,
                          false
                        )
                      : null,
                  ].filter((x): x is NonNullable<typeof x> => x !== null)
                : [
                    scope !== 'HAFALAN_ONLY'
                      ? formatCompactSubjectResult(
                          'BTQ',
                          student.btqCriteria,
                          student.btqScore,
                          student.btqPredicate,
                          undefined,
                          true
                        )
                      : null,
                    scope !== 'BTQ_ONLY'
                      ? formatCompactSubjectResult(
                          'Hafalan',
                          student.hafalanCriteria,
                          student.hafalanScore,
                          student.hafalanPredicate,
                          undefined,
                          true
                        )
                      : null,
                  ].filter((x): x is NonNullable<typeof x> => x !== null);

              return (
                <div
                  key={`${sess.id}_${student.studentId}_${originalIndex}`}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-2.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {student.studentName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {student.className || sess.className} • {sess.roomNumber || 'Ruang 01'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Penguji: {sess.examinerName}
                    </p>
                    <div className="space-y-0.5 pt-0.5">
                      {items.map((it) => (
                        <p
                          key={it.text}
                          className={`text-[11px] font-semibold ${
                            it.done ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {it.text}
                          {it.detail ? <span className="text-slate-500 font-normal"> ({it.detail})</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenSession(sess, originalIndex, 'FOCUS')}
                    className={`h-10 px-3 rounded-xl text-xs font-bold shrink-0 cursor-pointer ${
                      isDone
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        : 'bg-[#023246] hover:bg-[#034560] text-white'
                    }`}
                  >
                    {canEditSession(sess) ? (isDone ? 'Ubah' : 'Nilai') : 'Detail'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const isPageMode = displayMode === 'page';

  // In page mode, render Admin setup inline without any floating popup overlay
  if (isPageMode && isAdminControl && isAdminSetupOpen) {
    return (
      <OralExamAdminSetupModal
        isOpen={true}
        displayMode="page"
        onClose={() => {
          setIsAdminSetupOpen(false);
          loadAssignments();
        }}
        academicYear={activeAcademicYear}
      />
    );
  }

  const inlineAddStudentCard = isAdminControl && addStudentDialogOpen && isPageMode && (
    <form
      onSubmit={handleConfirmAddStudent}
      className="bg-white rounded-2xl w-full p-4 shadow-sm border-2 border-emerald-200 space-y-3"
    >
      <div className="space-y-0.5">
        <h3 className="text-sm font-extrabold text-slate-900">Tambah Siswa ke Sesi Ujian</h3>
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
        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-base sm:text-sm font-medium focus:ring-2 focus:ring-[#023246] focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAddStudentDialogOpen(false)}
          className="h-11 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
        >
          Batal
        </button>
        <button
          type="submit"
          className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
        >
          Tambahkan Siswa
        </button>
      </div>
    </form>
  );

  const inlineConfirmCard = confirmDialog && isPageMode && (
    <div
      role="alert"
      className="bg-amber-50/95 rounded-2xl w-full p-4 shadow-sm border border-amber-300 space-y-3"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-extrabold text-slate-900">{confirmDialog.title}</h3>
        <p className="text-xs text-slate-700 leading-relaxed">{confirmDialog.message}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirmDialog(null)}
          className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
        >
          Batal
        </button>
        {confirmDialog.secondaryLabel && confirmDialog.onSecondary && (
          <button
            type="button"
            onClick={confirmDialog.onSecondary}
            className="h-11 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
          >
            {confirmDialog.secondaryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={confirmDialog.onConfirm}
          className={`flex-1 h-11 px-4 rounded-xl text-white text-xs font-bold cursor-pointer ${
            confirmDialog.tone === 'danger'
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-[#023246] hover:bg-[#034560]'
          }`}
        >
          {confirmDialog.confirmLabel}
        </button>
      </div>
    </div>
  );

  const hasFooterContent =
    (screen === 'LIST' && isAdminControl) ||
    (screen === 'CREATE' && isAdminControl) ||
    (screen === 'ASSESS' && Boolean(currentSession));

  const viewBody = (
    <div
      className={
        isPageMode
          ? 'w-full space-y-4 text-slate-900 font-sans pb-6'
          : 'w-full h-dvh md:h-auto md:max-h-[92dvh] md:max-w-3xl bg-[#F8FAFC] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 font-sans'
      }
    >
      {/* 1. STICKY HEADER */}
      <header
        className={
          isPageMode
            ? 'sticky top-0 z-20 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between gap-2'
            : 'h-14 sm:h-16 px-4 pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-20'
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBackNavigation}
            aria-label={screen === 'LIST' ? 'Kembali' : 'Kembali'}
            className="w-11 h-11 -ml-1.5 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 id="oral-exam-title" className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {screen === 'LIST' && (isKepsekControl ? 'Rekap Hasil Ujian Lisan' : 'Penilaian Ujian Lisan')}
              {screen === 'CREATE' && (activeTrack === 'BAHASA' ? 'Buat Sesi Ujian Bahasa' : 'Buat Sesi Ujian BTQ')}
              {screen === 'ASSESS' && (currentSession?.title || 'Hasil Nilai Ujian Lisan')}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {screen === 'LIST' &&
                (isAdminControl
                  ? 'Kelola penguji, pantau & lihat seluruh hasil penilaian'
                  : isKepsekControl
                    ? 'Monitoring kepala sekolah seluruh ruang & penguji (Read-Only)'
                    : 'Siap pakai menguji & melihat rekap nilai semua ruang')}
              {screen === 'CREATE' && 'Mode Admin: Buat atau siapkan sesi penilaian'}
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
          {!isPageMode && (
            <button
              type="button"
              onClick={handleRequestCloseModal}
              aria-label="Tutup Penilaian Ujian Lisan"
              className="w-11 h-11 rounded-xl hidden md:flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. SCROLLABLE WORKSPACE */}
      <div className={isPageMode ? '' : 'flex-1 overflow-y-auto overscroll-contain px-4 py-4'}>
        <div className={isPageMode ? (isAdminControl || isKepsekControl ? 'w-full max-w-3xl mx-auto space-y-4' : 'w-full space-y-4') : 'w-full max-w-lg mx-auto space-y-4'}>
          {inlineConfirmCard}
          {inlineAddStudentCard}
          {screen === 'LIST' && renderScheduleBanner()}
            {/* ==================== SCREEN 1: GURU READY-TO-USE HOME + SCHOOL RECAP ==================== */}
            {screen === 'LIST' && !isAdminControl && !isKepsekControl && (
              <>
                {isLoadingAssignments ? (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs font-semibold text-slate-500">
                    Memuat penugasan penguji dari Admin...
                  </div>
                ) : !activeGuruAssignment ? (
                  <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        Pantau Hasil Penilaian Semua Penguji
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Akun Anda (<strong>{user?.full_name}</strong>) belum ditugaskan menguji ruang tertentu, namun Anda tetap dapat melihat seluruh nilai siswa yang diinput penguji dan mengunduh rekapnya di bawah ini.
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
                          Tugas Menguji Anda (Siap Pakai)
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

                    {/* Ready-to-Start Card for Selected Track if Assigned */}
                    {activeGuruAssignment.examTracks.includes(activeTrack) && (() => {
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
                        <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-3">
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
                            disabled={isOpeningSession || isLoadingSessions}
                            onClick={() => handleLaunchReadyAssignmentSession(activeGuruAssignment, activeTrack)}
                            className="w-full h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold cursor-pointer transition-colors"
                          >
                            {isOpeningSession
                              ? 'Menyiapkan Data Supabase...'
                              : isLoadingSessions
                                ? 'Menyinkronkan Nilai...'
                                : doneCount > 0
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

                {!activeGuruAssignment && renderTrackSwitcher()}
                {renderAllResultsSection()}
              </>
            )}

            {/* ==================== SCREEN 1: KEPSEK READ-ONLY MONITORING ==================== */}
            {screen === 'LIST' && isKepsekControl && (
              <>
                <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Monitoring Kepala Sekolah (Read-Only)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pantau real-time hasil penilaian ujian lisan dari seluruh penguji &amp; ruang, cari nilai siswa tertentu, serta unduh laporan PDF/Excel resmi.
                    </p>
                  </div>
                </div>

                {renderTrackSwitcher()}
                {renderAllResultsSection()}
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

                {/* Seluruh Hasil Penilaian Penguji & Rekap Semua Siswa */}
                {renderAllResultsSection()}
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
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {[
                          { scope: 'ENGLISH_ONLY' as const, title: 'Bahasa Inggris Saja (3 Kriteria • 0–100)', desc: 'Penguji langsung menilai 3 kriteria Bahasa Inggris skala 0–100.' },
                          { scope: 'ARABIC_ONLY' as const, title: 'Bahasa Arab Saja (3 Kriteria • 0–100)', desc: 'Penguji langsung menilai 3 kriteria Bahasa Arab skala 0–100.' },
                          { scope: 'BOTH' as const, title: 'Bahasa Inggris & Bahasa Arab', desc: 'Menguji keduanya dalam 1 sesi penilaian (masing-masing 3 kriteria).' },
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
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { scope: 'BTQ_ONLY' as const, title: 'BTQ Saja (3 Kriteria • 0–100)', desc: "Lebih ringkas bila hanya menguji Baca Tulis Qur'an." },
                        { scope: 'BOTH' as const, title: 'BTQ & Hafalan (Keduanya)', desc: 'Menguji nilai BTQ sekaligus nilai Hafalan / Tahfidz (3 kriteria).' },
                        { scope: 'HAFALAN_ONLY' as const, title: 'Hafalan Saja (3 Kriteria • 0–100)', desc: 'Khusus menilai setoran hafalan / tahfidz siswa.' },
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

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700">
                        3 Kriteria Penilaian (Skala 0–100 per Kriteria)
                      </span>
                      <button
                        type="button"
                        onClick={() => setCriteriaLabelsDraft(getDefaultCriteriaLabels(activeTrack))}
                        className="text-[11px] font-semibold text-[#023246] hover:underline cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={`create_crit_${idx}`}
                          type="text"
                          value={criteriaLabelsDraft[idx] ?? ''}
                          onChange={(e) => {
                            const next: OralExamCriteriaLabels = [
                              criteriaLabelsDraft[0],
                              criteriaLabelsDraft[1],
                              criteriaLabelsDraft[2],
                            ];
                            next[idx] = e.target.value;
                            setCriteriaLabelsDraft(next);
                          }}
                          placeholder={`Kriteria ${idx + 1}`}
                          className="w-full h-10 px-2.5 bg-white border border-slate-300 rounded-lg text-base sm:text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      ))}
                    </div>
                  </div>
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
                        if (selectedGroupIds.length === 0 && activeSelectableAssignments.length > 0) {
                          setSelectedGroupIds(activeSelectableAssignments.map((g) => g.id));
                        }
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
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-xs font-bold text-slate-700">
                          Ceklis Penguji &amp; Penempatan ({selectedAssignments.length}/{activeSelectableAssignments.length})
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSelectAllGroupChecklists}
                            className="h-8 px-2.5 rounded-lg bg-[#023246] hover:bg-[#034560] text-white text-[11px] font-bold cursor-pointer"
                          >
                            Pilih Semua ({activeSelectableAssignments.length})
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllGroupChecklists}
                            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>

                      {activeSelectableAssignments.length > 5 && (
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={groupChecklistSearch}
                            onChange={(e) => setGroupChecklistSearch(e.target.value)}
                            placeholder="Cari nama penguji, ruang, atau kelas..."
                            className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                          />
                        </div>
                      )}

                      <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto bg-white">
                        {filteredChecklistAssignments.length === 0 ? (
                          <p className="p-4 text-xs text-slate-500 text-center">
                            Tidak ada penguji yang cocok dengan pencarian.
                          </p>
                        ) : (
                          filteredChecklistAssignments.map((grp, idx) => {
                            const checked = selectedGroupIds.includes(grp.id);
                            const alreadyExists = existingTrackGroupIds.has(grp.id);
                            const rowBorder =
                              idx < filteredChecklistAssignments.length - 1
                                ? 'border-b border-slate-100'
                                : '';
                            return (
                              <label
                                key={grp.id}
                                className={`flex items-center gap-3 px-3 py-2.5 min-h-12 cursor-pointer transition-colors ${rowBorder} ${
                                  checked ? 'bg-sky-50/70' : 'bg-white hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleGroupChecklist(grp.id)}
                                  className="w-5 h-5 accent-[#023246] rounded cursor-pointer shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                      {grp.examinerName}
                                    </span>
                                    {alreadyExists && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                                        Sudah Ada Sesi
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 block">
                                    {grp.roomNumber} • {grp.className === 'SMA' ? 'SMA' : `Kelas ${grp.className}`} •{' '}
                                    {grp.students.length} siswa
                                  </span>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>

                      {selectedAssignments.length > 0 ? (
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          Terpilih {selectedAssignments.length} penguji (total {totalSelectedStudentCount} siswa).
                        </p>
                      ) : (
                        <p className="text-[11px] text-rose-600 font-semibold">
                          Centang minimal 1 penguji untuk membuat atau menyiapkan sesi ujian.
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
                      {rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length > 1
                        ? `Tanggal & Ringkasan (${selectedAssignments.length} Penguji)`
                        : 'Cek Nama Penguji & Ruang'}
                    </h3>
                  </div>

                  {rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length > 1 ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                        Mode ceklis massal aktif: <strong>{selectedAssignments.length} penguji</strong> (total{' '}
                        <strong>{totalSelectedStudentCount} siswa</strong>) akan menggunakan nama penguji, NPP, ruangan,
                        dan kelas sesuai penempatan resminya masing-masing di Supabase. Jika sesi sudah ada, nilai siswa
                        tetap aman terjaga.
                      </div>
                      {renderExecutionDateField('Tanggal Ujian')}
                    </div>
                  ) : (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          Nama Penguji (Manajemen Guru &amp; Staf)
                        </label>
                        {staffDirectory.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setUseManualExaminerInput((prev) => !prev)}
                            className="text-[11px] font-semibold text-[#023246] hover:underline cursor-pointer"
                          >
                            {useManualExaminerInput ? 'Pilih dari Daftar Guru' : 'Ketik Manual'}
                          </button>
                        )}
                      </div>

                      {!useManualExaminerInput && staffDirectory.length > 0 ? (
                        <select
                          value={selectedExaminerUserId}
                          onChange={(e) => handleSelectExaminerStaff(e.target.value)}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        >
                          <option value="">
                            {examinerName
                              ? `-- Pilih Guru / Staf (Saat ini: ${examinerName}) --`
                              : `-- Pilih Guru / Staf (${staffDirectory.length} akun) --`}
                          </option>
                          {staffDirectory.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name} ({t.role})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={examinerName}
                          onChange={(e) => {
                            setExaminerName(e.target.value);
                            setSelectedExaminerUserId('');
                            setExaminerNppDraft(null);
                          }}
                          placeholder="Nama lengkap penguji"
                          className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#023246]"
                        />
                      )}
                    </div>

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

                    {renderExecutionDateField('Tanggal')}

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
                  )}
                </div>
              </div>
            )}

            {/* ==================== SCREEN 3: ASSESS ==================== */}
            {screen === 'ASSESS' && currentSession && (
              <div className="space-y-3.5">
                {isCurrentSessionReadOnly && (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center gap-2 font-medium">
                    <Eye className="w-4 h-4 text-[#023246] shrink-0" />
                    <span>
                      <strong>Mode Lihat Saja (Read-Only):</strong> Nilai diinput oleh{' '}
                      <strong>{currentSession.examinerName}</strong>. Anda dapat meninjau rincian 3 kriteria dan mengunduh PDF/Excel.
                    </span>
                  </div>
                )}

                {/* Summary & Collapsible Guide */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                      isBahasaSession ? 'bg-[#023246] text-white' : 'bg-[#0D7A5F] text-white'
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
                    <span>Panduan 3 Kriteria &amp; Predikat (A / B / C / D)</span>
                    {showRubricGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showRubricGuide && (
                    <div className="space-y-2 pt-1">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-slate-900 block">
                          3 Kriteria Sesi Ini (Rata-rata ke Nilai Akhir 0–100):
                        </span>
                        <p>
                          1. <strong>{activeSessionCriteriaLabels[0]}</strong> • 2.{' '}
                          <strong>{activeSessionCriteriaLabels[1]}</strong> • 3.{' '}
                          <strong>{activeSessionCriteriaLabels[2]}</strong>
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                          A (91–100) • Sangat Baik
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-bold">
                          B (81–90) • Baik
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                          C (61–80) • Cukup
                        </div>
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                          D (0–60) • Perlu Bimbingan
                        </div>
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

                          {isBahasaSession
                            ? renderBahasaAssessmentBody(activeFocusStudent, activeStudentIndex)
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
                          const engSnap = getSubjectCriteriaSnapshot(student, 'english');
                          const araSnap = getSubjectCriteriaSnapshot(student, 'arabic');
                          const btqSnap = getSubjectCriteriaSnapshot(student, 'btq');
                          const hafSnap = getSubjectCriteriaSnapshot(student, 'hafalan');
                          const formatSnapLabel = (label: string, snap: ReturnType<typeof getSubjectCriteriaSnapshot>) => {
                            if (snap.isComplete && snap.effectiveScore !== null) {
                              return `${label}: ${snap.effectiveScore} (${snap.effectivePredicate || '-'})`;
                            }
                            if (snap.filledCount > 0) {
                              return `${label}: ${snap.filledCount}/3 kriteria`;
                            }
                            return `${label}: -`;
                          };
                          const summaryText = isBahasaSession
                            ? [
                                effectiveScope !== 'ARABIC_ONLY' ? formatSnapLabel('Inggris', engSnap) : '',
                                effectiveScope !== 'ENGLISH_ONLY' ? formatSnapLabel('Arab', araSnap) : '',
                              ]
                                .filter(Boolean)
                                .join(' • ')
                            : [
                                effectiveScope !== 'HAFALAN_ONLY' ? formatSnapLabel('BTQ', btqSnap) : '',
                                effectiveScope !== 'BTQ_ONLY' ? formatSnapLabel('Hafalan', hafSnap) : '',
                              ]
                                .filter(Boolean)
                                .join(' • ');

                          const hasPartialProgress =
                            engSnap.filledCount > 0 ||
                            araSnap.filledCount > 0 ||
                            btqSnap.filledCount > 0 ||
                            hafSnap.filledCount > 0;

                          return (
                            <div
                              key={`${student.studentId}_${originalIndex}`}
                              className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {originalIndex + 1}. {student.studentName}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${
                                  done
                                    ? 'text-emerald-700 font-semibold'
                                    : hasPartialProgress
                                      ? 'text-amber-700 font-semibold'
                                      : 'text-slate-500'
                                }`}>
                                  {done || hasPartialProgress ? summaryText : 'Belum dinilai'}
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
                                {isCurrentSessionReadOnly ? 'Lihat' : done ? 'Ubah' : 'Nilai'}
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
        </div>

        {/* 3. STICKY BOTTOM ACTION BAR (THUMB ZONE) */}
        {(!isPageMode || hasFooterContent) && (
          <footer
            className={
              isPageMode
                ? `${
                    isAdminControl
                      ? 'sticky bottom-2 max-w-3xl mx-auto'
                      : isKepsekControl
                        ? 'sticky bottom-17 sm:bottom-3 max-w-3xl mx-auto'
                        : 'sticky bottom-17 sm:bottom-3'
                  } z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl p-3 shadow-lg w-full`
                : 'sticky bottom-0 z-20 bg-white border-t border-slate-200 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0'
            }
          >
            <div className={isPageMode ? 'w-full' : 'w-full max-w-lg mx-auto'}>
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

              {!isPageMode && screen === 'LIST' && !isAdminControl && (
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
                    disabled={
                      isCreatingLoading ||
                      (rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length === 0)
                    }
                    onClick={handleCreateSessionSubmit}
                    className="flex-1 h-12 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] disabled:opacity-50 text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                  >
                    {isCreatingLoading
                      ? 'Menyiapkan...'
                      : rosterSourceMode === 'OFFICIAL_GROUP' && selectedAssignments.length > 1
                        ? `Buat Sesi (${selectedAssignments.length} Penguji)`
                        : 'Mulai Menilai Sekarang'}
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

                  {isCurrentSessionReadOnly ? (
                    <>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handleExportPdf}
                        className="flex-1 h-12 px-3 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="flex-1 h-12 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Excel</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!isDirty || isSavingSession}
                      onClick={() => handleSaveSession(false)}
                      className={`flex-1 h-12 px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDirty
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingSession ? 'Menyimpan...' : isDirty ? 'Simpan Nilai' : 'Tersimpan di Cloud'}</span>
                    </button>
                  )}

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
                  {!isCurrentSessionReadOnly && (
                    <button
                      type="button"
                      disabled={!isDirty || isSavingSession}
                      onClick={() => handleSaveSession(false)}
                      className={`flex-1 h-12 px-3 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDirty
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingSession ? 'Menyimpan...' : isDirty ? 'Simpan Nilai' : 'Tersimpan di Cloud'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleExportPdf}
                    className={`${isCurrentSessionReadOnly ? 'flex-1' : ''} h-12 px-3.5 rounded-xl bg-[#023246] hover:bg-[#034560] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0`}
                  >
                    <Printer className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className={`${isCurrentSessionReadOnly ? 'flex-1' : ''} h-12 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                </div>
              )}
            </div>
          </footer>
        )}
    </div>
  );

  if (isPageMode || typeof document === 'undefined') {
    return viewBody;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oral-exam-title"
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-xs"
    >
      {viewBody}

      {/* Modal Pengaturan Penguji Admin (hanya saat modal mode) */}
      {isAdminControl && isAdminSetupOpen && (
        <OralExamAdminSetupModal
          isOpen={isAdminSetupOpen}
          displayMode="modal"
          onClose={() => {
            setIsAdminSetupOpen(false);
            loadAssignments();
          }}
          academicYear={activeAcademicYear}
        />
      )}

      {/* Bottom-sheet Mobile / Clean Modal Desktop: Tambah Siswa Baru (Admin Only, modal mode) */}
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

      {/* Bottom-sheet Mobile / Clean Modal Desktop: Konfirmasi Aksi (modal mode) */}
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
