import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  UserCheck,
  User,
  Clock,
  Sparkles,
  Download,
  Printer,
  ShieldAlert,
  Crown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Users,
  Check,
  Sliders,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import type { UserProfile } from '../../../types/database.types';
import type {
  ExamType,
  CommitteeRole,
  ExamCommitteeMember,
  ExamScheduleData,
  ExamScheduleFormConfig,
  SessionTimeSlot,
  DaySessionOverride,
} from '../../../types/exam-schedule.types';
import { ExamCommitteeRepository } from '../../../repositories/ExamCommitteeRepository';
import { ExamScheduleRepository } from '../../../repositories/ExamScheduleRepository';
import { ExamSchedulerService } from '../../../services/exam-scheduler.service';
import { AdministrationRepository, AVAILABLE_ACADEMIC_YEARS } from '../../../repositories/AdministrationRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { normalizeClassCode } from '../../../utils/class.utils';
import { logger } from '../../../utils/logger.utils';

interface ExamScheduleAndProctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

const DEFAULT_SUBJECTS = [
  'PAI',
  'PKn',
  'Bahasa Indonesia',
  'Matematika',
  'IPA',
  'IPS',
  'Bahasa Inggris',
  'Informatika',
  'Seni Budaya',
  'PJOK',
  'Bahasa Arab',
  'SBPK',
];

const DEFAULT_CLASSES = ['7A', '7B', '8A', '8B', '9A', '9B', 'SMA'];

export const ExamScheduleAndProctorModal: React.FC<ExamScheduleAndProctorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'form' | 'subjects' | 'proctors' | 'my_schedule' | 'committee'>('form');

  // Authorization state
  const [accessInfo, setAccessInfo] = useState<{
    canManage: boolean;
    isCommittee: boolean;
    isAdmin: boolean;
    roleLabel: string;
  }>({
    canManage: false,
    isCommittee: false,
    isAdmin: false,
    roleLabel: 'Memuat...',
  });

  // Active filter state
  const activeAcademicYear = useMemo(() => AdministrationRepository.getActiveAcademicYear(), []);
  const activeSemester = useMemo(() => {
    const s = AdministrationRepository.getActiveSemester();
    return s === 'GENAP' ? 'Genap' : 'Ganjil';
  }, []);
  const [selectedExamType, setSelectedExamType] = useState<ExamType>('ASTS');

  // Teachers & Directory data
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<ExamCommitteeMember[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>(DEFAULT_CLASSES);

  // Saved schedule data
  const [scheduleData, setScheduleData] = useState<ExamScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── FORM QUESTIONNAIRE STATE (Parameters filled by Committee) ──────────────
  const [formAcademicYear, setFormAcademicYear] = useState<string>(() => AdministrationRepository.getActiveAcademicYear());
  const [formExamType, setFormExamType] = useState<ExamType>('ASTS');
  const [formStartDate, setFormStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [formEndDate, setFormEndDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    return nextWeek.toISOString().split('T')[0];
  });
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [sessionSlots, setSessionSlots] = useState<SessionTimeSlot[]>([
    { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:30' },
    { sessionNumber: 2, sessionName: 'Sesi 2 (Siang)', startTime: '10:00', endTime: '12:00' },
  ]);
  const [sessionMode, setSessionMode] = useState<'UNIFORM' | 'PER_DAY'>('PER_DAY');
  const [dayOverrides, setDayOverrides] = useState<DaySessionOverride[]>([]);

  // Valid exam dates (excluding Sundays)
  const validExamDates = useMemo(
    () => ExamSchedulerService.getValidExamDates(formStartDate, formEndDate),
    [formStartDate, formEndDate]
  );

  // Initialize day overrides whenever validExamDates change
  useEffect(() => {
    setDayOverrides((prev) => {
      return validExamDates.map((d) => {
        const existing = prev.find((p) => p.date === d.date);
        if (existing) return existing;
        const isFriday = d.dayName.toLowerCase() === 'jumat';
        const count = isFriday ? 2 : 3;
        return {
          date: d.date,
          dayName: d.dayName,
          sessionsCount: count,
        };
      });
    });
  }, [validExamDates]);

  // Calculate total slot capacity across days
  const totalSlotsCapacity = useMemo(() => {
    if (sessionMode === 'UNIFORM') {
      return validExamDates.length * sessionsPerDay;
    }
    return dayOverrides.reduce((sum, d) => sum + (d.sessionsCount || sessionsPerDay), 0);
  }, [sessionMode, validExamDates, sessionsPerDay, dayOverrides]);

  // Handlers for day overrides
  const handleDaySessionChange = (date: string, count: number) => {
    setDayOverrides((prev) => {
      const idx = prev.findIndex((d) => d.date === date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], sessionsCount: count };
        return next;
      }
      const dateInfo = validExamDates.find((d) => d.date === date);
      return [
        ...prev,
        {
          date,
          dayName: dateInfo?.dayName || 'Ujian',
          sessionsCount: count,
        },
      ];
    });
  };

  const applyPresetFriday1 = () => {
    setDayOverrides(
      validExamDates.map((d) => {
        const isFriday = d.dayName.toLowerCase() === 'jumat';
        return {
          date: d.date,
          dayName: d.dayName,
          sessionsCount: isFriday ? 1 : 2,
        };
      })
    );
    setToast({ text: 'Preset diterapkan: Hari biasa 2 sesi, Jumat 1 sesi.', type: 'success' });
  };

  const applyPresetFriday2 = () => {
    setDayOverrides(
      validExamDates.map((d) => {
        const isFriday = d.dayName.toLowerCase() === 'jumat';
        return {
          date: d.date,
          dayName: d.dayName,
          sessionsCount: isFriday ? 2 : 3,
        };
      })
    );
    setToast({ text: 'Preset diterapkan: Hari biasa 3 sesi, Jumat 2 sesi.', type: 'success' });
  };

  const applyPresetAll = (count: number) => {
    setDayOverrides(
      validExamDates.map((d) => ({
        date: d.date,
        dayName: d.dayName,
        sessionsCount: count,
      }))
    );
    setSessionsPerDay(count);
    handleSessionsPerDayChange(count);
    setToast({ text: `Semua hari disetel ${count} sesi.`, type: 'success' });
  };
  const [selectedClasses, setSelectedClasses] = useState<string[]>(DEFAULT_CLASSES);
  const [classDataSource, setClassDataSource] = useState<'LOCAL_CACHE' | 'TEACHING_SCHEDULE' | 'CLOUD' | 'FALLBACK'>('LOCAL_CACHE');
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});
  const [totalStudentsInYear, setTotalStudentsInYear] = useState<number>(0);
  const [isSyncingClasses, setIsSyncingClasses] = useState(false);
  const [customClassInput, setCustomClassInput] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [proctorsPerRoom, setProctorsPerRoom] = useState<1 | 2>(1);
  const [excludeOwnSubject, setExcludeOwnSubject] = useState(true);
  const [excludeCommitteeProctor, setExcludeCommitteeProctor] = useState(true);
  const [assignBackupProctor, setAssignBackupProctor] = useState(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  // Committee Admin Management State
  const [committeeEditingList, setCommitteeEditingList] = useState<Array<{
    userId: string;
    fullName: string;
    npp?: string;
    role: CommitteeRole;
  }>>([]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load subjects from cache (Zero Egress)
  const loadSubjectsForYear = useCallback((year: string) => {
    try {
      const subjectsSet = new Set<string>(DEFAULT_SUBJECTS);
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = localStorage.getItem('smart_absensi_teaching_schedules');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach((slot: any) => {
              if (!slot.academic_year || slot.academic_year === year) {
                const s = (slot.subject || slot.subject_name || '').trim();
                if (s && s.length > 1) {
                  subjectsSet.add(s);
                }
              }
            });
          }
        }
      }
      const combined = Array.from(subjectsSet);
      setAvailableSubjects(combined);
      setSelectedSubjects((prev) => {
        const merged = new Set([...prev, ...DEFAULT_SUBJECTS]);
        return Array.from(merged).filter((s) => combined.includes(s));
      });
    } catch (err) {
      logger.warn('ExamScheduleAndProctorModal', 'Failed to extract subjects from cache:', err);
    }
  }, []);

  // Load distinct classes strictly filtered by Academic Year (Zero Unnecessary Egress)
  const loadClassesForYear = useCallback(async (year: string, forceRefresh: boolean = false) => {
    if (forceRefresh) setIsSyncingClasses(true);
    try {
      const res = await StudentRepository.getDistinctClassesByAcademicYear(year, forceRefresh);
      setAvailableClasses(res.classes);
      setClassStudentCounts(res.classStudentCounts);
      setClassDataSource(res.source);
      setTotalStudentsInYear(res.totalStudents);
      setSelectedClasses(res.classes);
      if (forceRefresh) {
        setToast({
          text: `Data rombel TA ${year} berhasil disinkronkan (${res.classes.length} rombel, ${res.totalStudents} siswa).`,
          type: 'success',
        });
      }
    } catch (err) {
      logger.error('ExamScheduleAndProctorModal', 'Failed to load distinct classes:', err);
    } finally {
      if (forceRefresh) setIsSyncingClasses(false);
    }
  }, []);

  // Handle academic year change in exam questionnaire
  const handleAcademicYearChange = useCallback(async (newYear: string) => {
    setFormAcademicYear(newYear);
    loadClassesForYear(newYear, false);
    loadSubjectsForYear(newYear);
    const saved = await ExamScheduleRepository.getSchedule(newYear, formExamType);
    setScheduleData(saved);
  }, [loadClassesForYear, loadSubjectsForYear, formExamType]);

  // Handle exam type change
  const handleExamTypeChange = useCallback(async (newType: ExamType) => {
    setFormExamType(newType);
    setSelectedExamType(newType);
    const saved = await ExamScheduleRepository.getSchedule(formAcademicYear, newType);
    setScheduleData(saved);
  }, [formAcademicYear]);

  // Handle adding custom subject to exam
  const handleAddCustomSubject = useCallback(() => {
    const clean = customSubjectInput.trim();
    if (!clean) return;
    if (!availableSubjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setAvailableSubjects((prev) => [...prev, clean]);
    }
    if (!selectedSubjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSelectedSubjects((prev) => [...prev, clean]);
    }
    setCustomSubjectInput('');
    setToast({ text: `Mata pelajaran "${clean}" berhasil ditambahkan ke daftar ujian!`, type: 'success' });
  }, [customSubjectInput, availableSubjects, selectedSubjects]);

  // Handle removing custom subject from list
  const handleRemoveCustomSubject = useCallback((subjToRemove: string) => {
    setAvailableSubjects((prev) => prev.filter((s) => s !== subjToRemove));
    setSelectedSubjects((prev) => prev.filter((s) => s !== subjToRemove));
    setToast({ text: `Mata pelajaran "${subjToRemove}" dihapus dari daftar pilihan.`, type: 'success' });
  }, []);

  // Handle adding custom class / room
  const handleAddCustomClass = useCallback(() => {
    const clean = customClassInput.trim().toUpperCase();
    if (!clean) return;
    const norm = normalizeClassCode(clean) || clean;
    if (!availableClasses.includes(norm)) {
      setAvailableClasses((prev) => [...prev, norm]);
    }
    if (!selectedClasses.includes(norm)) {
      setSelectedClasses((prev) => [...prev, norm]);
    }
    setCustomClassInput('');
    setToast({ text: `Rombel ${norm} berhasil ditambahkan ke daftar!`, type: 'success' });
  }, [customClassInput, availableClasses, selectedClasses]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Check committee access
      const access = await ExamCommitteeRepository.checkCommitteeAccess(currentUser, activeAcademicYear);
      setAccessInfo(access);

      // 2. Load teachers
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      const allUsers = await provider.getAllUsers(token).catch(() => []);
      const activeTeachers = allUsers.filter((u) => {
        const r = (u.role || 'GURU').toUpperCase();
        return ['GURU', 'ADMIN', 'OPERATOR', 'WALIKELAS', 'KEPSEK'].includes(r);
      });
      setTeachers(activeTeachers);

      // Default all active teachers selected for proctor pool
      setSelectedTeacherIds(activeTeachers.map((t) => t.id));

      // 3. Load committee members
      const committee = await ExamCommitteeRepository.getCommitteeMembers(activeAcademicYear);
      setCommitteeMembers(committee);

      // Pre-fill committee editing list
      setCommitteeEditingList(
        committee.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          npp: m.npp,
          role: m.role,
        }))
      );

      // 4. Load dynamic classes strictly filtered by active academic year (Zero Egress Priority)
      await loadClassesForYear(formAcademicYear, false);

      // 5. Load subjects for academic year (Zero Egress Priority)
      loadSubjectsForYear(formAcademicYear);

      // 6. Load existing schedule if available
      const saved = await ExamScheduleRepository.getSchedule(activeAcademicYear, selectedExamType);
      setScheduleData(saved);

      // If user is a regular teacher, default tab to "my_schedule" or "subjects"
      if (!access.canManage) {
        setActiveTab(saved ? 'my_schedule' : 'subjects');
      } else {
        setActiveTab(saved ? 'subjects' : 'form');
      }
    } catch (err) {
      logger.error('ExamScheduleAndProctorModal', 'Error loading initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, activeAcademicYear, selectedExamType, formAcademicYear, loadClassesForYear, loadSubjectsForYear]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, loadInitialData]);

  // Adjust session slots when sessionsPerDay changes
  const handleSessionsPerDayChange = (num: number) => {
    setSessionsPerDay(num);
    const slots: SessionTimeSlot[] = [];
    for (let i = 1; i <= num; i++) {
      if (i === 1) {
        slots.push({ sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:30' });
      } else if (i === 2) {
        slots.push({ sessionNumber: 2, sessionName: 'Sesi 2 (Siang)', startTime: '10:00', endTime: '12:00' });
      } else if (i === 3) {
        slots.push({ sessionNumber: 3, sessionName: 'Sesi 3 (Sore)', startTime: '13:00', endTime: '15:00' });
      } else {
        slots.push({ sessionNumber: i, sessionName: `Sesi ${i}`, startTime: '15:30', endTime: '17:00' });
      }
    }
    setSessionSlots(slots);
  };

  // Trigger AI Generator
  const handleGenerateSchedule = async () => {
    if (selectedClasses.length === 0) {
      setToast({ text: 'Pilih minimal satu kelas / rombel peserta ujian!', type: 'error' });
      return;
    }
    if (selectedSubjects.length === 0) {
      setToast({ text: 'Pilih minimal satu mata pelajaran ujian!', type: 'error' });
      return;
    }
    if (selectedTeacherIds.length === 0) {
      setToast({ text: 'Pilih minimal satu guru pengawas!', type: 'error' });
      return;
    }

    setIsGenerating(true);
    try {
      const config: ExamScheduleFormConfig = {
        examType: formExamType,
        examTitle: `${formExamType === 'ASTS' ? 'Asesmen Sumatif Tengah Semester (ASTS)' : formExamType === 'ASAS' ? 'Asesmen Sumatif Akhir Semester (ASAS)' : `Ujian ${formExamType}`}`,
        academicYear: formAcademicYear,
        semester: activeSemester,
        startDate: formStartDate,
        endDate: formEndDate,
        sessionsPerDay,
        sessionSlots,
        dayOverrides: sessionMode === 'PER_DAY' ? dayOverrides : undefined,
        selectedClasses,
        selectedSubjects,
        selectedTeacherIds,
        proctorsPerRoom,
        excludeOwnSubject,
        excludeCommitteeProctor,
        assignBackupProctor,
        aiCustomPrompt: aiCustomPrompt.trim() || undefined,
      };

      // Generate via ExamSchedulerService
      const generated = ExamSchedulerService.generateSchedule(config, teachers, committeeMembers);

      // Save to repository
      await ExamScheduleRepository.saveSchedule(generated);
      setScheduleData(generated);
      setSelectedExamType(formExamType);
      setActiveTab('subjects');
      setToast({ text: 'Jadwal Ujian & Pengawas berhasil di-generate secara cerdas oleh AI! 🎉', type: 'success' });
    } catch (err: any) {
      logger.error('ExamScheduleAndProctorModal', 'Failed to generate schedule:', err);
      setToast({ text: `Gagal menyusun jadwal: ${err?.message || 'Periksa kendala input'}`, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Committee Members (Admin Only)
  const handleSaveCommittee = async () => {
    if (!accessInfo.isAdmin) {
      setToast({ text: 'Hanya Admin/Operator yang dapat mengubah susunan panitia!', type: 'error' });
      return;
    }

    try {
      const newMembers: ExamCommitteeMember[] = committeeEditingList.map((item, idx) => ({
        id: `comm_${item.userId}_${Date.now()}_${idx}`,
        userId: item.userId,
        fullName: item.fullName,
        npp: item.npp,
        role: item.role,
        academicYear: activeAcademicYear,
        isActive: true,
        createdAt: new Date().toISOString(),
      }));

      await ExamCommitteeRepository.saveCommitteeMembers(newMembers, activeAcademicYear);
      setCommitteeMembers(newMembers);

      // Refresh current user access
      const access = await ExamCommitteeRepository.checkCommitteeAccess(currentUser, activeAcademicYear);
      setAccessInfo(access);

      setToast({ text: 'Susunan Panitia Ujian berhasil disimpan!', type: 'success' });
    } catch {
      setToast({ text: 'Gagal menyimpan data panitia ujian.', type: 'error' });
    }
  };

  // Delete Schedule (Full)
  const handleDeleteSchedule = async () => {
    const targetYear = scheduleData?.config.academicYear || formAcademicYear || activeAcademicYear;
    const targetType = scheduleData?.config.examType || formExamType || selectedExamType;
    try {
      await ExamScheduleRepository.deleteSchedule(targetYear, targetType);
      setScheduleData(null);
      setIsConfirmDeleteOpen(false);
      setActiveTab('form');
      setToast({
        text: `Jadwal ujian ${targetType} (TA ${targetYear}) berhasil dihapus.`,
        type: 'success',
      });
    } catch (err) {
      logger.error('ExamScheduleAndProctorModal', 'Failed to delete schedule:', err);
      setToast({ text: 'Gagal menghapus jadwal ujian.', type: 'error' });
    }
  };

  // Delete Single Subject Slot from active schedule
  const handleDeleteSingleSubject = async (scheduleItemId: string, subjectName: string, className: string) => {
    if (!scheduleData) return;
    const confirmed = window.confirm(`Hapus jadwal ujian ${subjectName} untuk kelas ${className}?`);
    if (!confirmed) return;

    try {
      const updatedSubjectSchedules = scheduleData.subjectSchedules.filter((s) => s.id !== scheduleItemId);
      const updatedSchedule: ExamScheduleData = {
        ...scheduleData,
        subjectSchedules: updatedSubjectSchedules,
        summary: {
          ...scheduleData.summary,
          totalSubjects: new Set(updatedSubjectSchedules.map((s) => s.subject)).size,
        },
        updatedAt: new Date().toISOString(),
      };

      await ExamScheduleRepository.saveSchedule(updatedSchedule);
      setScheduleData(updatedSchedule);
      setToast({
        text: `Jadwal ${subjectName} (${className}) berhasil dihapus dari jadwal aktif.`,
        type: 'success',
      });
    } catch (err) {
      logger.error('ExamScheduleAndProctorModal', 'Failed to delete single subject slot:', err);
      setToast({ text: 'Gagal menghapus slot ujian mata pelajaran.', type: 'error' });
    }
  };

  // Filter my personal schedule (Logged in teacher's assigned duties)
  const myProctorAssignments = useMemo(() => {
    if (!scheduleData || !currentUser) return [];
    return scheduleData.proctorSchedules.filter(
      (p) =>
        p.mainProctorId === currentUser.id ||
        p.secondaryProctorId === currentUser.id ||
        p.backupProctorId === currentUser.id ||
        p.mainProctorName.toLowerCase().trim() === currentUser.full_name?.toLowerCase().trim()
    );
  }, [scheduleData, currentUser]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-schedule-title"
      className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans animate-fadeIn"
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-100 px-4 py-2.5 rounded-xl shadow-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{toast.text}</span>
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
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-[#023246] to-[#18536B] text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="exam-schedule-title" className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                Jadwal Ujian & Pengawas (ASTS / ASAS)
              </h2>
              {accessInfo.isAdmin ? (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 rounded-full flex items-center gap-1 shrink-0">
                  <Crown className="w-2.5 h-2.5" /> Administrator
                </span>
              ) : accessInfo.isCommittee ? (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1 shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Panitia Ujian
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-full shrink-0">
                  Mode Pengajar (Lihat Jadwal)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {scheduleData
                ? `${scheduleData.config.examTitle || scheduleData.config.examType} • TA ${activeAcademicYear} (${activeSemester}) • ${scheduleData.summary.totalDays} Hari Ujian`
                : `Penyusunan jadwal otomatis berbasis AI • Tahun Ajaran ${activeAcademicYear}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {scheduleData && (
            <>
              {accessInfo.canManage && (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors shadow-2xs"
                  title="Hapus Seluruh Jadwal Ujian Ini"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Jadwal</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => ExamScheduleRepository.exportToExcel(scheduleData)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors shadow-2xs"
                title="Ekspor Jadwal ke Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-colors shadow-2xs"
                title="Cetak Jadwal Resmi (Format A4)"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Cetak A4</span>
              </button>
            </>
          )}

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
          {/* Tab 1: Form & AI Generator (Only for Panitia & Admin) */}
          {accessInfo.canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                activeTab === 'form'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Form Parameter & AI</span>
            </button>
          )}

          {/* Tab 2: Jadwal Ujian Siswa */}
          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
              activeTab === 'subjects'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Jadwal Ujian Siswa</span>
            {scheduleData && (
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${
                activeTab === 'subjects' ? 'bg-teal-500/20 text-teal-200 border-teal-400/30' : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}>
                {scheduleData.subjectSchedules.length}
              </span>
            )}
          </button>

          {/* Tab 3: Roster Pengawas Guru */}
          <button
            type="button"
            onClick={() => setActiveTab('proctors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
              activeTab === 'proctors'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Roster Pengawas Guru</span>
            {scheduleData && (
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${
                activeTab === 'proctors' ? 'bg-teal-500/20 text-teal-200 border-teal-400/30' : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}>
                {scheduleData.proctorSchedules.length}
              </span>
            )}
          </button>

          {/* Tab 4: Jadwal Mengawas Saya */}
          <button
            type="button"
            onClick={() => setActiveTab('my_schedule')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
              activeTab === 'my_schedule'
                ? 'bg-[#023246] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Jadwal Mengawas Saya</span>
            {myProctorAssignments.length > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-emerald-500 text-white">
                {myProctorAssignments.length} Sesi
              </span>
            )}
          </button>

          {/* Tab 5: Pengaturan Panitia (Admin Only) */}
          {accessInfo.isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('committee')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                activeTab === 'committee'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Panitia Ujian ({committeeMembers.length})</span>
            </button>
          )}
        </div>

        {/* Action button if schedule exists */}
        {accessInfo.canManage && scheduleData && activeTab !== 'form' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-teal-700 hover:bg-teal-50 border border-teal-200 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Revisi / Buat Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition-colors"
              title="Hapus Seluruh Jadwal Ujian Ini"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Hapus Jadwal</span>
            </button>
          </div>
        )}
      </div>

      {/* Layer Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F8FAFC]">
        {isLoading && (
          <div className="flex items-center justify-center py-8 gap-2 text-xs font-bold text-slate-500">
            <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
            <span>Memuat data jadwal & panitia...</span>
          </div>
        )}
        {/* ========================================================================= */}
        {/* TAB 1: FORM PARAMETER & AI GENERATOR (PANITIA ONLY) */}
        {/* ========================================================================= */}
        {activeTab === 'form' && accessInfo.canManage && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Formulir Parameter Penyusunan Jadwal Ujian Cerdas (AI)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Silakan lengkapi parameter pelaksanaan di bawah ini. AI Engine akan menyusun jadwal mapel dan distribusi pengawas yang adil, seimbang, dan bebas bentrok.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                  {accessInfo.roleLabel}
                </span>
              </div>

              {/* Alert Banner if schedule already exists */}
              {scheduleData && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block">Jadwal Ujian Tersimpan Ditemukan</span>
                      <span className="text-slate-600">
                        Jadwal {scheduleData.config.examTitle || scheduleData.config.examType} (TA {scheduleData.config.academicYear}) sudah tersimpan di sistem. Anda dapat melihat hasil di tab Jadwal Ujian / Roster Pengawas, atau menghapus jadwal saat ini untuk menyusun ulang.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('subjects')}
                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors shadow-2xs"
                    >
                      Lihat Jadwal
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Jadwal Ini</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Identitas Asesmen, Tahun Ajaran & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Ajaran Pelaksanaan</label>
                  <select
                    value={formAcademicYear}
                    onChange={(e) => handleAcademicYearChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  >
                    {AVAILABLE_ACADEMIC_YEARS.map((y) => (
                      <option key={y.year} value={y.year}>
                        TA {y.year} {y.isActive ? '(Tahun Aktif)' : '(Arsip)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Asesmen / Ujian</label>
                  <select
                    value={formExamType}
                    onChange={(e) => handleExamTypeChange(e.target.value as ExamType)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  >
                    <option value="ASTS">ASTS (Asesmen Tengah Semester)</option>
                    <option value="ASAS">ASAS (Asesmen Akhir Semester)</option>
                    <option value="ASAJ">ASAJ (Asesmen Akhir Jenjang / US)</option>
                    <option value="HARIAN">Penilaian Harian Bersama / Kuis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai Ujian</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai Ujian</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-mono"
                    required
                  />
                </div>
              </div>

              {/* 2. Pengaturan Sesi Jam per Hari (Mendukung Jumlah Sesi Berbeda Setiap Hari) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-600" />
                      Pengaturan Sesi Harian
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tentukan jumlah sesi pelaksanaan ujian secara fleksibel (bisa berbeda setiap hari, mis. Jumat 1 atau 2 sesi, hari biasa 3 sesi).
                    </p>
                  </div>

                  {/* Mode Selector Toggle */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs self-start sm:self-auto shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setSessionMode('PER_DAY')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                        sessionMode === 'PER_DAY'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🗓️ Kustom Per Hari</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        sessionMode === 'PER_DAY' ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700'
                      }`}>
                        Rekomendasi
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionMode('UNIFORM')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        sessionMode === 'UNIFORM'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>⚖️ Seragam Semua Hari</span>
                    </button>
                  </div>
                </div>

                {/* Content based on sessionMode */}
                {sessionMode === 'PER_DAY' ? (
                  <div className="space-y-3">
                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 mr-1">Preset Cepat:</span>
                      <button
                        type="button"
                        onClick={applyPresetFriday2}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
                      >
                        ⚡ Hari Biasa 3 Sesi, Jumat 2 Sesi
                      </button>
                      <button
                        type="button"
                        onClick={applyPresetFriday1}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
                      >
                        ⚡ Hari Biasa 2 Sesi, Jumat 1 Sesi
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetAll(3)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
                      >
                        Semua 3 Sesi
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetAll(2)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
                      >
                        Semua 2 Sesi
                      </button>
                    </div>

                    {/* Per-Day Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {validExamDates.map((dateInfo) => {
                        const override = dayOverrides.find((d) => d.date === dateInfo.date);
                        const currentCount = override?.sessionsCount ?? (dateInfo.dayName.toLowerCase() === 'jumat' ? 2 : sessionsPerDay);
                        const isFriday = dateInfo.dayName.toLowerCase() === 'jumat';

                        return (
                          <div
                            key={dateInfo.date}
                            className={`p-3 rounded-xl border transition-all shadow-2xs ${
                              isFriday
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <div>
                                <span className="text-xs font-black text-slate-900 block">
                                  {dateInfo.dayName}
                                  {isFriday && (
                                    <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">
                                      Jumat
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {dateInfo.date}
                                </span>
                              </div>
                              <span className="text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                                {currentCount} Sesi
                              </span>
                            </div>

                            {/* Session count selector pills */}
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4].map((cnt) => (
                                <button
                                  key={cnt}
                                  type="button"
                                  onClick={() => handleDaySessionChange(dateInfo.date, cnt)}
                                  className={`py-1 rounded-lg text-[11px] font-bold text-center transition-all ${
                                    currentCount === cnt
                                      ? 'bg-teal-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {cnt} Sesi
                                </button>
                              ))}
                            </div>

                            {/* Time preview helper */}
                            <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                              {isFriday && currentCount === 2
                                ? '07:15 - 10:30 (Selesai sblm Jumatan)'
                                : isFriday && currentCount === 1
                                ? '07:15 - 08:45 (Sesi Pagi)'
                                : currentCount === 3
                                ? '07:30 - 15:00 (Pagi, Siang, Sore)'
                                : currentCount === 2
                                ? '07:30 - 12:00 (Pagi & Siang)'
                                : '07:30 - 09:30 (1 Sesi)'}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary bar */}
                    <div className="p-2.5 bg-teal-50/80 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900 flex-wrap gap-2">
                      <span className="font-bold">
                        📊 Total Kapasitas Slot: <span className="text-teal-700 font-black">{totalSlotsCapacity} Sesi Ujian</span> ({validExamDates.length} hari pelaksanaan)
                      </span>
                      <span className="text-[11px] text-teal-700 font-semibold">
                        {totalSlotsCapacity >= selectedSubjects.length
                          ? `✓ Kapasitas mencukupi untuk ${selectedSubjects.length} mata pelajaran terpilih`
                          : `⚠️ Kurang ${selectedSubjects.length - totalSlotsCapacity} slot mapel. Tambah sesi pada hari tertentu.`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Jumlah Sesi per Hari (Sama untuk semua hari):</span>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleSessionsPerDayChange(n)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                              sessionsPerDay === n ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {n} Sesi/Hari
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sessionSlots.map((slot, idx) => (
                        <div key={slot.sessionNumber} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                          <span className="text-[11px] font-black text-teal-700 uppercase tracking-wider block">
                            {slot.sessionName}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSessionSlots((prev) => {
                                  const next = [...prev];
                                  next[idx].startTime = val;
                                  return next;
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-center font-mono font-bold text-slate-800"
                            />
                            <span className="text-xs text-slate-400">s/d</span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSessionSlots((prev) => {
                                  const next = [...prev];
                                  next[idx].endTime = val;
                                  return next;
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-center font-mono font-bold text-slate-800"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Pilihan Kelas / Rombel Peserta (Academic Year Aware & Zero-Egress Safe) */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>Rombel / Kelas Peserta Ujian</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                        TA {formAcademicYear}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {selectedClasses.length} Terpilih
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>
                        {classDataSource === 'LOCAL_CACHE'
                          ? `Terdeteksi ${availableClasses.length} rombel (${totalStudentsInYear} siswa terdaftar di TA ${formAcademicYear}) • 0 B Egress (Cache Lokal)`
                          : classDataSource === 'TEACHING_SCHEDULE'
                          ? `Terdeteksi ${availableClasses.length} rombel dari Jadwal KBM aktif TA ${formAcademicYear} • 0 B Egress`
                          : classDataSource === 'CLOUD'
                          ? `Tersinkron dari Cloud Supabase TA ${formAcademicYear} (${totalStudentsInYear} siswa)`
                          : `Standar rombel sekolah TA ${formAcademicYear}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => loadClassesForYear(formAcademicYear, true)}
                      disabled={isSyncingClasses}
                      title="Sinkronkan rombel terbaru dari server (jika ada siswa baru ditambahkan)"
                      className="text-[11px] font-bold text-slate-600 hover:text-teal-700 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingClasses ? 'animate-spin text-teal-600' : ''}`} />
                      <span>{isSyncingClasses ? 'Menyinkron...' : 'Sinkron Server'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClasses.length === availableClasses.length) {
                          setSelectedClasses([]);
                        } else {
                          setSelectedClasses([...availableClasses]);
                        }
                      }}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 px-2 py-1"
                    >
                      {selectedClasses.length === availableClasses.length ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                </div>

                {/* List of class pills */}
                <div className="flex flex-wrap gap-2">
                  {availableClasses.map((cls) => {
                    const isChecked = selectedClasses.includes(cls);
                    const count = classStudentCounts[cls];
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setSelectedClasses((prev) =>
                            isChecked ? prev.filter((c) => c !== cls) : [...prev, cls]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                        <span>Kelas {cls}</span>
                        {count !== undefined && count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                            isChecked ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count} siswa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Input Tambah Rombel Kustom */}
                <div className="flex items-center gap-2 pt-1 max-w-sm">
                  <input
                    type="text"
                    value={customClassInput}
                    onChange={(e) => setCustomClassInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomClass();
                      }
                    }}
                    placeholder="Tambah rombel/ruang kustom (mis. 9C, Lab 1)..."
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex-1 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors shrink-0"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* 4. Pilihan Mata Pelajaran */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>Mata Pelajaran yang Diujikan</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {selectedSubjects.length} dari {availableSubjects.length} Terpilih
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pilih mapel kurikulum atau tambahkan mapel kustom (mis. Bahasa Daerah, Fiqih, BTQ, Tahfidz).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSubjects.length === availableSubjects.length) {
                          setSelectedSubjects([]);
                        } else {
                          setSelectedSubjects([...availableSubjects]);
                        }
                      }}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 px-2 py-1"
                    >
                      {selectedSubjects.length === availableSubjects.length ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                </div>

                {/* List of subject pills */}
                <div className="flex flex-wrap gap-1.5">
                  {availableSubjects.map((sub) => {
                    const isChecked = selectedSubjects.includes(sub);
                    const isCustom = !DEFAULT_SUBJECTS.includes(sub);
                    return (
                      <div
                        key={sub}
                        className={`inline-flex items-center rounded-lg text-xs font-medium transition-all ${
                          isChecked
                            ? 'bg-slate-900 text-white font-bold shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjects((prev) =>
                              isChecked ? prev.filter((s) => s !== sub) : [...prev, sub]
                            );
                          }}
                          className="px-2.5 py-1.5 flex items-center gap-1.5"
                        >
                          {isChecked && <Check className="w-3 h-3 text-emerald-400" />}
                          <span>{sub}</span>
                        </button>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomSubject(sub);
                            }}
                            title={`Hapus ${sub} dari daftar pilihan`}
                            className="pr-2 pl-0.5 py-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Input Tambah Mapel Kustom */}
                <div className="flex items-center gap-2 pt-1 max-w-sm">
                  <input
                    type="text"
                    value={customSubjectInput}
                    onChange={(e) => setCustomSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSubject();
                      }
                    }}
                    placeholder="Tambah mapel kustom (mis. Bahasa Sunda, BTQ, Fiqih)..."
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex-1 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSubject}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors shrink-0"
                  >
                    + Tambah Mapel
                  </button>
                </div>
              </div>

              {/* 5. Aturan Cerdas Pengawas Guru */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Aturan Cerdas Pengawas Ujian
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200 cursor-pointer shadow-2xs">
                    <input
                      type="checkbox"
                      checked={excludeOwnSubject}
                      onChange={(e) => setExcludeOwnSubject(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Anti-Mapel Sendiri (Objektivitas)</span>
                      <span className="text-[11px] text-slate-500 block">Guru dilarang mengawas kelas yang sedang mengujikan mata pelajarannya sendiri.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200 cursor-pointer shadow-2xs">
                    <input
                      type="checkbox"
                      checked={excludeCommitteeProctor}
                      onChange={(e) => setExcludeCommitteeProctor(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Bebaskan Panitia Ujian</span>
                      <span className="text-[11px] text-slate-500 block">Panitia (Ketua/Sekretaris) difokuskan di posko dan dibebaskan dari mengawas ruang.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-amber-200 cursor-pointer shadow-2xs">
                    <input
                      type="checkbox"
                      checked={assignBackupProctor}
                      onChange={(e) => setAssignBackupProctor(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Sertakan Pengawas Cadangan / Piket</span>
                      <span className="text-[11px] text-slate-500 block">Menunjuk 1 guru piket/cadangan per sesi untuk bersiaga di ruang panitia.</span>
                    </div>
                  </label>

                  <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="font-bold text-slate-900 block">Jumlah Pengawas / Ruang</span>
                      <span className="text-[11px] text-slate-500 block">Kebutuhan pengawas per kelas</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setProctorsPerRoom(1)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                          proctorsPerRoom === 1 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        1 Guru
                      </button>
                      <button
                        type="button"
                        onClick={() => setProctorsPerRoom(2)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                          proctorsPerRoom === 2 ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        2 Guru
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Kolom Instruksi Tambahan untuk AI */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instruksi Khusus untuk AI (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  placeholder="Contoh: Hari Jumat hanya 1 sesi sampai jam 10.30. Lab Komputer digunakan bergantian untuk kelas 7 dan 8..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              {/* Action Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-linear-to-r from-teal-600 to-[#18536B] hover:from-teal-700 hover:to-[#023246] disabled:opacity-50 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isGenerating ? 'AI Sedang Menyusun Jadwal...' : '🤖 Buat Jadwal Ujian & Pengawas Cerdas dengan AI'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: JADWAL UJIAN SISWA (MATA PELAJARAN) */}
        {/* ========================================================================= */}
        {activeTab === 'subjects' && (
          <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
            {!scheduleData ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-xs space-y-3">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Belum Ada Jadwal Ujian untuk Periode Ini</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {accessInfo.canManage
                    ? 'Buka tab "Form Parameter & AI" untuk menyusun jadwal asesmen mata pelajaran secara otomatis.'
                    : 'Panitia Ujian belum mengesahkan jadwal ujian untuk tahun ajaran ini. Silakan hubungi Panitia Ujian sekolah.'}
                </p>
                {accessInfo.canManage && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Sliders className="w-4 h-4" /> Buka Formulir Panitia
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header Summary Pill */}
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-900 shadow-2xs">
                  <div>
                    <span className="font-bold text-sm block text-teal-950">
                      {scheduleData.config.examTitle || scheduleData.config.examType}
                    </span>
                    <span className="text-[11px] text-teal-800">
                      {scheduleData.summary.totalDays} Hari Pelaksanaan • {scheduleData.summary.totalClasses} Rombel • {scheduleData.summary.totalSubjects} Mata Pelajaran
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[11px] bg-white px-3 py-1.5 rounded-xl border border-teal-200 font-semibold text-slate-700">
                      Periode: {scheduleData.config.startDate} s.d. {scheduleData.config.endDate}
                    </div>
                    {accessInfo.canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab('form')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
                          title="Ubah parameter atau buat jadwal baru"
                        >
                          <Sliders className="w-3.5 h-3.5 text-teal-600" />
                          <span>Ubah Parameter</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmDeleteOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
                          title="Hapus seluruh jadwal ujian ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Jadwal</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Subject Schedule Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3.5 text-center w-12">No</th>
                          <th className="py-3 px-3.5">Hari & Tanggal</th>
                          <th className="py-3 px-3 text-center">Sesi</th>
                          <th className="py-3 px-3 text-center">Waktu</th>
                          <th className="py-3 px-3.5">Kelas / Rombel</th>
                          <th className="py-3 px-3.5 font-black text-slate-900">Mata Pelajaran</th>
                          <th className="py-3 px-3.5 text-center">Ruangan</th>
                          {accessInfo.canManage && (
                            <th className="py-3 px-3 text-center w-14">Aksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {scheduleData.subjectSchedules.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3.5">
                              <span className="font-bold text-slate-900">{item.dayName}</span>, <span className="text-slate-600">{item.date}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-teal-700">Sesi {item.sessionNumber}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">{item.startTime} - {item.endTime}</td>
                            <td className="py-2.5 px-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                Kelas {item.className}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-900">{item.subject}</td>
                            <td className="py-2.5 px-3.5 text-center">
                              {item.isLabRequired ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  Lab Komputer (CBT)
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">Ruang {item.className}</span>
                              )}
                            </td>
                            {accessInfo.canManage && (
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleSubject(item.id, item.subject, item.className)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title={`Hapus ujian ${item.subject} (${item.className})`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ROSTER PENGAWAS GURU (RUANGAN) */}
        {/* ========================================================================= */}
        {activeTab === 'proctors' && (
          <div className="max-w-6xl mx-auto space-y-4 animate-fadeIn">
            {!scheduleData ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-xs space-y-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Belum Ada Roster Pengawas Ujian</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Jadwal pengawas akan terisi otomatis begitu Panitia Ujian menjalankan generator AI.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* AI Allocation Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Tugas Mengawas</span>
                    <span className="text-2xl font-black text-teal-700 mt-1 block">{scheduleData.summary.totalProctorsAssigned} Sesi</span>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Rata-rata / Guru</span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">{scheduleData.summary.averageSessionsPerTeacher} Sesi</span>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Integritas Ujian</span>
                    <span className="text-xs font-bold text-emerald-700 mt-2 block">✓ 100% Bebas Mapel Sendiri</span>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Double-Booking</span>
                    <span className="text-xs font-bold text-emerald-700 mt-2 block">✓ 0 Konflik Jadwal</span>
                  </div>
                </div>

                {/* Proctor Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3.5 text-center w-12">No</th>
                          <th className="py-3 px-3.5">Hari, Tanggal & Sesi</th>
                          <th className="py-3 px-3.5">Ruang / Rombel</th>
                          <th className="py-3 px-3.5">Mata Pelajaran</th>
                          <th className="py-3 px-3.5 font-black text-teal-900">Pengawas Utama</th>
                          <th className="py-3 px-3.5 text-slate-600">Pengawas Cadangan / Piket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {scheduleData.proctorSchedules.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3.5">
                              <span className="font-bold text-slate-900">{item.dayName}</span>, {item.date} • <span className="font-bold text-teal-700">Sesi {item.sessionNumber}</span> ({item.startTime}-{item.endTime})
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-slate-800">{item.roomName}</td>
                            <td className="py-2.5 px-3.5 font-semibold text-slate-700">{item.subject}</td>
                            <td className="py-2.5 px-3.5 font-bold text-teal-700 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>{item.mainProctorName}</span>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">
                              {item.backupProctorName || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: JADWAL MENGAWAS SAYA (PERSONAL VIEW) */}
        {/* ========================================================================= */}
        {activeTab === 'my_schedule' && (
          <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{currentUser?.full_name || 'Bapak/Ibu Guru'}</h4>
                  <p className="text-[11px] text-slate-500">
                    NPP: {currentUser?.nip || currentUser?.npp || '-'} • Total Tugas Mengawas: <strong className="text-teal-700">{myProctorAssignments.length} Sesi</strong>
                  </p>
                </div>
              </div>

              {myProctorAssignments.length > 0 && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Jadwal Saya</span>
                </button>
              )}
            </div>

            {myProctorAssignments.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/90 shadow-xs space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Tidak Ada Tugas Mengawas untuk Akun Anda</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Anda tidak dijadwalkan mengawas ruangan pada periode asesmen ini (mungkin bertugas sebagai Panitia Ujian atau guru non-pengawas).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {myProctorAssignments.map((duty, idx) => (
                  <div key={duty.id} className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3 hover:border-teal-400/50 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                        Tugas #{idx + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {duty.startTime} - {duty.endTime} WIB
                      </span>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-slate-900">{duty.dayName}, {duty.date}</h5>
                      <p className="text-xs text-slate-600 mt-0.5">
                        <strong className="text-teal-700">Sesi {duty.sessionNumber}</strong> • Mapel: <strong className="text-slate-900">{duty.subject}</strong>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Lokasi Tugas:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {duty.roomName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PENGATURAN PANITIA UJIAN (KHUSUS ADMIN) */}
        {/* ========================================================================= */}
        {activeTab === 'committee' && accessInfo.isAdmin && (
          <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-purple-600" />
                    Penetapan Panitia Ujian Sekolah (Tahun Ajaran {activeAcademicYear})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Guru yang ditandai sebagai Panitia Ujian akan mendapatkan hak akses untuk membuat formulir dan menjalankan generator jadwal ujian.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCommittee}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Susunan Panitia</span>
                </button>
              </div>

              {/* Teacher Checklist Table */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {teachers.map((t) => {
                  const existing = committeeEditingList.find((c) => c.userId === t.id);
                  const isChecked = !!existing;

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isChecked ? 'bg-purple-50/70 border-purple-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCommitteeEditingList((prev) => [
                                ...prev,
                                {
                                  userId: t.id,
                                  fullName: t.full_name || 'Guru',
                                  npp: t.nip || t.npp || undefined,
                                  role: 'ANGGOTA',
                                },
                              ]);
                            } else {
                              setCommitteeEditingList((prev) => prev.filter((c) => c.userId !== t.id));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{t.full_name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            NPP: {t.nip || t.npp || '-'} • Mapel: {Array.isArray(t.teaching_assignment) ? t.teaching_assignment.join(', ') : (t.teaching_assignment || '-')}
                          </span>
                        </div>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-purple-900 uppercase">Jabatan:</span>
                          <select
                            value={existing.role}
                            onChange={(e) => {
                              const newRole = e.target.value as CommitteeRole;
                              setCommitteeEditingList((prev) =>
                                prev.map((c) => (c.userId === t.id ? { ...c, role: newRole } : c))
                              );
                            }}
                            className="bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-bold text-purple-900 focus:outline-none"
                          >
                            <option value="KETUA">Ketua Panitia</option>
                            <option value="SEKRETARIS">Sekretaris</option>
                            <option value="BENDAHARA">Bendahara</option>
                            <option value="ANGGOTA">Anggota Panitia</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Jadwal */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Hapus Seluruh Jadwal Ujian?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus seluruh jadwal ujian mata pelajaran dan pembagian tugas pengawas untuk{' '}
                <span className="font-bold text-slate-800">
                  {scheduleData?.config.examTitle || scheduleData?.config.examType || formExamType} (TA {scheduleData?.config.academicYear || formAcademicYear})
                </span>?
                Tindakan ini akan mengosongkan data jadwal dari penyimpanan dan mengembalikan status ke formulir awal.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-md flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
