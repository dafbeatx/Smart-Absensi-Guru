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
  ListFilter,
  DoorOpen,
  LayoutGrid,
  BookOpen,
  Layers,
  Info,
  Bot,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
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
import { ExamMatrixBuilderService } from '../../../services/exam-matrix-builder.service';
import { ExamWordExporterService } from '../../../services/exam-word-exporter.service';
import {
  ExamScheduleAIGeneratorService,
  EXAM_AI_PROMPT_PRESETS,
} from '../../../services/exam-ai-generator.service';
import { AdministrationRepository, AVAILABLE_ACADEMIC_YEARS } from '../../../repositories/AdministrationRepository';
import { StudentRepository } from '../../../repositories/StudentRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { normalizeClassCode } from '../../../utils/class.utils';
import { logger } from '../../../utils/logger.utils';

const formatIndonesianDateLabel = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) {
      const months = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const mIdx = parseInt(m, 10);
      return `${parseInt(d, 10)} ${months[mIdx] || m} ${y}`;
    }
  } catch {}
  return dateStr;
};

const getSessionDurationText = (start?: string, end?: string) => {
  if (!start || !end) return '';
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff > 0) return `${diff} mnt`;
    }
  } catch {}
  return '';
};

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
  const [activeTab, setActiveTab] = useState<'ai_prompt' | 'form' | 'subjects' | 'proctors' | 'my_schedule' | 'committee'>('ai_prompt');
  const [proctorViewMode, setProctorViewMode] = useState<'MATRIX' | 'TABLE'>('MATRIX');
  const institutionName = useSettingsStore((s) => s.settings.institution_name) || 'SMP Terpadu Al-Ittihadiyah';

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

  // Helper to compute smart default exam dates (Standard 5-day school week: Senin s/d Jumat)
  const getSmartDefaultExamStartDate = (): string => {
    const now = new Date();
    const day = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    const diff = day === 1 ? 0 : (8 - day) % 7;
    const targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() + diff);
    return targetMonday.toISOString().split('T')[0];
  };

  const getSmartDefaultExamEndDate = (startDateStr: string): string => {
    const start = new Date(startDateStr);
    const targetFriday = new Date(start);
    targetFriday.setDate(start.getDate() + 4); // Senin + 4 hari = Jumat
    return targetFriday.toISOString().split('T')[0];
  };

  const [includeSaturday, setIncludeSaturday] = useState<boolean>(false);
  const [formStartDate, setFormStartDate] = useState<string>(() => getSmartDefaultExamStartDate());
  const [formEndDate, setFormEndDate] = useState<string>(() => getSmartDefaultExamEndDate(getSmartDefaultExamStartDate()));
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(3);
  const [sessionSlots, setSessionSlots] = useState<SessionTimeSlot[]>([
    { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' },
    { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' },
    { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' },
    { sessionNumber: 4, sessionName: 'Sesi 4 (Tambahan)', startTime: '13:15', endTime: '14:45' },
  ]);
  const [sessionMode, setSessionMode] = useState<'UNIFORM' | 'PER_DAY'>('PER_DAY');
  const [dayOverrides, setDayOverrides] = useState<DaySessionOverride[]>([]);
  const [subjectViewMode, setSubjectViewMode] = useState<'DAILY' | 'TABLE'>('DAILY');

  // Valid exam dates (excluding Sundays, and excluding Saturdays unless includeSaturday is true)
  const validExamDates = useMemo(
    () => ExamSchedulerService.getValidExamDates(formStartDate, formEndDate, includeSaturday),
    [formStartDate, formEndDate, includeSaturday]
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

  // Cumulative slot offsets for labeling subjects (e.g. Mapel #1, #2, #3...)
  const slotOffsets = useMemo(() => {
    let cumulative = 0;
    const map = new Map<string, number>();
    validExamDates.forEach((d) => {
      map.set(d.date, cumulative);
      const override = dayOverrides.find((o) => o.date === d.date);
      const count = override?.sessionsCount ?? (d.dayName.toLowerCase() === 'jumat' ? 2 : sessionsPerDay);
      cumulative += count;
    });
    return map;
  }, [validExamDates, dayOverrides, sessionsPerDay]);

  // Group subject schedules by day and session for clear multi-subject daily display
  const dailyGroupedSchedules = useMemo(() => {
    if (!scheduleData?.subjectSchedules) return [];
    const dayMap = new Map<
      string,
      {
        date: string;
        dayName: string;
        sessions: Array<{
          sessionNumber: number;
          startTime: string;
          endTime: string;
          subject: string;
          classes: string[];
          isLabRequired?: boolean;
          scheduleItemIds: string[];
        }>;
      }
    >();

    scheduleData.subjectSchedules.forEach((item) => {
      let dayEntry = dayMap.get(item.date);
      if (!dayEntry) {
        dayEntry = { date: item.date, dayName: item.dayName, sessions: [] };
        dayMap.set(item.date, dayEntry);
      }

      let sessEntry = dayEntry.sessions.find(
        (s) => s.sessionNumber === item.sessionNumber && s.subject === item.subject
      );
      if (!sessEntry) {
        sessEntry = {
          sessionNumber: item.sessionNumber,
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          classes: [item.className],
          isLabRequired: item.isLabRequired,
          scheduleItemIds: [item.id],
        };
        dayEntry.sessions.push(sessEntry);
      } else {
        if (!sessEntry.classes.includes(item.className)) {
          sessEntry.classes.push(item.className);
        }
        sessEntry.scheduleItemIds.push(item.id);
      }
    });

    const result = Array.from(dayMap.values());
    result.sort((a, b) => a.date.localeCompare(b.date));
    result.forEach((d) => {
      d.sessions.sort((a, b) => a.sessionNumber - b.sessionNumber);
    });
    return result;
  }, [scheduleData]);

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
  const [totalRooms, setTotalRooms] = useState<number>(() => DEFAULT_CLASSES.length);
  const [roomFormat, setRoomFormat] = useState<'NUMERIC' | 'DOUBLE_DIGIT'>('NUMERIC');
  const [classRoomMapping, setClassRoomMapping] = useState<Record<string, string>>({});
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
  const [aiPromptInput, setAiPromptInput] = useState<string>(() => EXAM_AI_PROMPT_PRESETS[0].prompt);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGenerationMessage, setAiGenerationMessage] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => EXAM_AI_PROMPT_PRESETS[0].id);

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
      if (saved?.config) {
        if (saved.config.totalRooms) setTotalRooms(saved.config.totalRooms);
        if (saved.config.roomFormat) setRoomFormat(saved.config.roomFormat);
        if (saved.config.classRoomMapping) setClassRoomMapping(saved.config.classRoomMapping);
      }

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
        slots.push({ sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' });
      } else if (i === 2) {
        slots.push({ sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' });
      } else if (i === 3) {
        slots.push({ sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' });
      } else {
        slots.push({ sessionNumber: i, sessionName: `Sesi ${i}`, startTime: '13:15', endTime: '14:45' });
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
        includeSaturday,
        sessionsPerDay,
        sessionSlots,
        dayOverrides: sessionMode === 'PER_DAY' ? dayOverrides : undefined,
        selectedClasses,
        totalRooms,
        roomFormat,
        classRoomMapping: Object.keys(classRoomMapping).length > 0 ? classRoomMapping : undefined,
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

  // Trigger AI Prompt Generator (Fast 1-Click NLP Mode)
  const handleGenerateWithAIPrompt = async (promptToUse?: string) => {
    const prompt = (promptToUse || aiPromptInput).trim();
    if (!prompt) {
      setToast({ text: 'Mohon masukkan instruksi jadwal ujian terlebih dahulu.', type: 'error' });
      return;
    }

    setIsGeneratingAI(true);
    setAiGenerationMessage('AI sedang menganalisis instruksi jadwal ujian...');

    try {
      const result = await ExamScheduleAIGeneratorService.generateFromPrompt({
        prompt,
        academicYear: formAcademicYear || activeAcademicYear,
        semester: activeSemester,
        teachers,
        committeeMembers,
        availableClasses,
        availableSubjects,
      });

      setScheduleData(result.schedule);
      setSelectedExamType(result.config.examType);
      setFormExamType(result.config.examType);
      setFormStartDate(result.config.startDate);
      setFormEndDate(result.config.endDate);
      setSessionsPerDay(result.config.sessionsPerDay);
      if (result.config.dayOverrides) {
        setDayOverrides(result.config.dayOverrides);
      }
      setSelectedClasses(result.config.selectedClasses);
      setSelectedSubjects(result.config.selectedSubjects);

      setToast({
        text: `Jadwal ${result.config.examType} berhasil disusun otomatis oleh AI (${result.schedule.summary.totalDays} hari, ${result.schedule.summary.totalClasses} rombel)! 🎉`,
        type: 'success',
      });
      setActiveTab('subjects');
    } catch (err: any) {
      logger.error('ExamScheduleAndProctorModal', 'AI generation failed:', err);
      setToast({ text: `Gagal menyusun jadwal: ${err?.message || 'Kendala parsing prompt'}`, type: 'error' });
    } finally {
      setIsGeneratingAI(false);
      setAiGenerationMessage('');
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

  // Build Official Invigilation Matrix (Official School Layout)
  const invigilationMatrix = useMemo(() => {
    if (!scheduleData) return null;
    return ExamMatrixBuilderService.buildMatrix(scheduleData, teachers, institutionName);
  }, [scheduleData, teachers, institutionName]);

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
                onClick={() => {
                  if (invigilationMatrix) {
                    ExamWordExporterService.exportToWord(invigilationMatrix);
                    setToast({ text: 'Dokumen Word (.doc) berhasil diunduh.', type: 'success' });
                  } else {
                    setToast({ text: 'Belum ada jadwal pengawas untuk diekspor.', type: 'error' });
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors shadow-2xs"
                title="Unduh Jadwal Pengawas Format Word (.doc)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Unduh Word</span>
              </button>

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
                onClick={() => {
                  if (invigilationMatrix) {
                    ExamWordExporterService.printOfficialMatrix(invigilationMatrix);
                  } else {
                    window.print();
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-colors shadow-2xs"
                title="Cetak Jadwal Pengawas Format Resmi Sekolah (A4)"
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
          {/* Tab 0: Asisten AI Jadwal (Prompt Cepat) */}
          {accessInfo.canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('ai_prompt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-9.5 ${
                activeTab === 'ai_prompt'
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Asisten AI Jadwal</span>
            </button>
          )}

          {/* Tab 1: Form Parameter Manual */}
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
              <span>Form Parameter Manual</span>
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
        {/* TAB 0: ASISTEN AI JADWAL UJIAN (PROMPT CEPAT & OTOMATIS) */}
        {/* ========================================================================= */}
        {activeTab === 'ai_prompt' && accessInfo.canManage && (
          <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn pb-12">
            {/* 1. Header Banner */}
            <div className="bg-linear-to-r from-[#023246] via-[#18536B] to-[#2457A6] rounded-2xl p-5 sm:p-6 text-white shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <span>Asisten AI Jadwal Ujian & Pengawas</span>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 rounded-full">
                        AI Cepat
                      </span>
                    </h3>
                    <p className="text-xs text-teal-100/90 mt-0.5">
                      Cukup masukkan instruksi kebutuhan ujian dalam bahasa sehari-hari. AI akan menyusun jadwal mapel dan membagi rata pengawas secara instan tanpa ribet.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-[11px] font-semibold text-teal-100 shrink-0">
                  <span>{accessInfo.roleLabel}</span>
                </div>
              </div>

              {/* Data Context Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/15 text-xs">
                <div className="bg-black/20 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-teal-200 block uppercase font-bold tracking-wider">Tahun Ajaran</span>
                  <span className="font-bold text-white text-sm">{formAcademicYear || activeAcademicYear}</span>
                </div>
                <div className="bg-black/20 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-teal-200 block uppercase font-bold tracking-wider">Semester</span>
                  <span className="font-bold text-white text-sm">{activeSemester}</span>
                </div>
                <div className="bg-black/20 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-teal-200 block uppercase font-bold tracking-wider">Rombel Terdata</span>
                  <span className="font-bold text-white text-sm">{availableClasses.length} Kelas</span>
                </div>
                <div className="bg-black/20 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-teal-200 block uppercase font-bold tracking-wider">Guru Pengawas</span>
                  <span className="font-bold text-white text-sm">{teachers.length} Guru Aktif</span>
                </div>
              </div>
            </div>

            {/* 2. Existing Schedule Status Banner (Bisa Dihapus / Diperbaharui) */}
            {scheduleData && (
              <div className="bg-white rounded-2xl p-5 border border-teal-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          Jadwal {scheduleData.config.examTitle || scheduleData.config.examType} Sudah Tersimpan
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full">
                          Aktif (TA {scheduleData.config.academicYear})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Periode: {formatIndonesianDateLabel(scheduleData.config.startDate)} s.d. {formatIndonesianDateLabel(scheduleData.config.endDate)} • {scheduleData.summary.totalDays} Hari • {scheduleData.summary.totalClasses} Rombel • {scheduleData.summary.totalSubjects} Mapel • {scheduleData.summary.totalProctorsAssigned} Penugasan Pengawas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick actions for existing schedule */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('subjects')}
                    className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-600" />
                    <span>Lihat Jadwal Siswa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('proctors')}
                    className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Lihat Roster Pengawas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-600" />
                    <span>Buka Form Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors ml-auto"
                    title="Hapus Jadwal Saat Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Jadwal Ini</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Prompt Presets (1-Click Fill) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Pilih Template Prompt Cepat (1-Klik Isi):</span>
                </label>
                <span className="text-[11px] text-slate-400">Klik salah satu untuk mengisi otomatis</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EXAM_AI_PROMPT_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setAiPromptInput(preset.prompt);
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 min-h-19 ${
                        isSelected
                          ? 'bg-teal-50 border-teal-500/50 shadow-2xs ring-1 ring-teal-500/30'
                          : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{preset.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Prompt Input Box */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-teal-600" />
                    <span>Instruksi Kebutuhan Jadwal Ujian:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {aiPromptInput.length} karakter • Anda bebas mengedit kalimat ini
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={aiPromptInput}
                  onChange={(e) => {
                    setAiPromptInput(e.target.value);
                    setSelectedPresetId(null);
                  }}
                  placeholder="Contoh: Buatkan jadwal ASTS ganjil dari tanggal 29 September sampai 3 Oktober 2026, 2 sesi per hari (sesi 1 jam 07:30 - 09:00, sesi 2 jam 09:30 - 11:00). Khusus hari Jumat 1 sesi saja. Bagi rata semua guru yang aktif untuk mengawas..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-xs text-slate-900 placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all font-sans leading-relaxed resize-y min-h-27.5"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setAiPromptInput('');
                      setSelectedPresetId(null);
                    }}
                    disabled={!aiPromptInput || isGeneratingAI}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    Bersihkan Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(EXAM_AI_PROMPT_PRESETS[0].id);
                      setAiPromptInput(EXAM_AI_PROMPT_PRESETS[0].prompt);
                    }}
                    disabled={isGeneratingAI}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-40 transition-colors"
                  >
                    Reset ke Standar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateWithAIPrompt()}
                  disabled={isGeneratingAI || !aiPromptInput.trim()}
                  className="w-full sm:w-auto min-h-11 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#023246] to-[#18536B] hover:from-[#18536B] hover:to-[#2457A6] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                      <span>AI Sedang Menyusun Jadwal...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>{scheduleData ? '🔄 Perbarui Jadwal dengan AI' : '🚀 Susun Jadwal Ujian dengan AI'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* In-flight status / hint */}
              {isGeneratingAI && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-2 text-xs text-teal-950 animate-pulse">
                  <div className="flex items-center gap-2 font-bold text-teal-900">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>{aiGenerationMessage || 'Sedang memproses instruksi dengan AI Engine...'}</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-teal-800">
                    <p>✓ Menganalisis parameter waktu, rombel, dan mata pelajaran...</p>
                    <p>✓ Menghitung pembagian tugas pengawas bebas bentrok mengajar...</p>
                    <p>✓ Menyimpan buku besar jadwal ujian ke database cloud sekolah...</p>
                  </div>
                </div>
              )}
            </div>
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

              {/* Quick Range Selector & Saturday Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">⚡ Rentang Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const mon = getSmartDefaultExamStartDate();
                      setFormStartDate(mon);
                      setFormEndDate(getSmartDefaultExamEndDate(mon));
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 shadow-2xs transition-all"
                  >
                    🗓️ Senin - Jumat Pekan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const day = now.getDay();
                      const daysToNextNextMon = day === 1 ? 7 : (8 - day) % 7 + 7;
                      const nextMon = new Date(now);
                      nextMon.setDate(now.getDate() + daysToNextNextMon);
                      const monStr = nextMon.toISOString().split('T')[0];
                      setFormStartDate(monStr);
                      setFormEndDate(getSmartDefaultExamEndDate(monStr));
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-2xs transition-all"
                  >
                    🗓️ Senin - Jumat Pekan Depan
                  </button>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSaturday}
                    onChange={(e) => setIncludeSaturday(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    Sertakan Hari Sabtu {includeSaturday ? '(Aktif)' : '(Libur Pekan)'}
                  </span>
                </label>
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

                    {/* Master Session Time Slots (Adjustable by Committee) */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <span>⏰</span>
                          <span>Jam Pelaksanaan Tiap Sesi (Hari Biasa: Senin - Kamis & Sabtu)</span>
                        </span>
                        <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-bold border border-teal-200">
                          Setiap sesi menguji 1 mata pelajaran berbeda
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {sessionSlots.map((slot, idx) => (
                          <div key={slot.sessionNumber} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5">
                            <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block truncate">
                              {slot.sessionName}
                            </span>
                            <div className="flex items-center gap-1.5">
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
                                className="w-full bg-white border border-slate-300 rounded-md p-1 text-xs text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">s/d</span>
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
                                className="w-full bg-white border border-slate-300 rounded-md p-1 text-xs text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-[11px] text-amber-900 flex-wrap gap-1">
                        <span className="font-bold flex items-center gap-1">
                          <span>🕌</span>
                          <span>Khusus Hari Jumat (Otomatis Selesai Sebelum Sholat Jumat):</span>
                        </span>
                        <span className="font-mono font-semibold">
                          Sesi 1: 07:15 - 08:45 | Sesi 2: 09:00 - 10:30 WIB
                        </span>
                      </div>
                    </div>

                    {/* Per-Day Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {validExamDates.map((dateInfo) => {
                        const override = dayOverrides.find((d) => d.date === dateInfo.date);
                        const currentCount = override?.sessionsCount ?? (dateInfo.dayName.toLowerCase() === 'jumat' ? 2 : sessionsPerDay);
                        const isFriday = dateInfo.dayName.toLowerCase() === 'jumat';
                        const dayOffset = slotOffsets.get(dateInfo.date) || 0;

                        return (
                          <div
                            key={dateInfo.date}
                            className={`p-3 rounded-xl border transition-all shadow-2xs space-y-2 ${
                              isFriday
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
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
                                {currentCount} Sesi / Mapel
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

                            {/* Session Breakdown List */}
                            <div className="space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-200/70">
                              {Array.from({ length: currentCount }, (_, i) => i + 1).map((sNum) => {
                                let sStart = '07:30';
                                let sEnd = '09:00';
                                if (isFriday) {
                                  if (sNum === 1) { sStart = '07:15'; sEnd = '08:45'; }
                                  else if (sNum === 2) { sStart = '09:00'; sEnd = '10:30'; }
                                  else if (sNum === 3) { sStart = '13:30'; sEnd = '15:00'; }
                                  else { sStart = '15:15'; sEnd = '16:30'; }
                                } else {
                                  const slot = sessionSlots.find((s) => s.sessionNumber === sNum);
                                  if (slot) { sStart = slot.startTime; sEnd = slot.endTime; }
                                  else if (sNum === 1) { sStart = '07:30'; sEnd = '09:00'; }
                                  else if (sNum === 2) { sStart = '09:30'; sEnd = '11:00'; }
                                  else if (sNum === 3) { sStart = '11:15'; sEnd = '12:45'; }
                                  else { sStart = '13:15'; sEnd = '14:45'; }
                                }

                                return (
                                  <div key={sNum} className="flex items-center justify-between text-[11px] bg-white px-2 py-1 rounded-md border border-slate-200/60 shadow-2xs">
                                    <span className="font-bold text-teal-900">
                                      Sesi {sNum}: <span className="font-mono text-slate-700 font-semibold">{sStart} - {sEnd}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Mapel #{dayOffset + sNum}
                                    </span>
                                  </div>
                                );
                              })}
                              {isFriday && (
                                <p className="text-[10px] text-amber-800 font-bold flex items-center gap-1 pt-0.5">
                                  <span>🕌</span>
                                  <span>Selesai 10:30 (Sebelum Jumatan)</span>
                                </p>
                              )}
                            </div>
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

              {/* 4. Pengaturan Ruangan Ujian (Ruang 1 s/d Ruang X) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <DoorOpen className="w-4 h-4 text-teal-600" />
                      Pengaturan Ruangan Ujian (Ruang 1 s/d ...)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tentukan nomor ruangan ujian (mulai dari Ruang 1 hingga berapa) dan alokasi rombel peserta ke setiap ruangan.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-black text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                      {roomFormat === 'DOUBLE_DIGIT'
                        ? `Ruang 01 s/d Ruang ${String(totalRooms).padStart(2, '0')}`
                        : `Ruang 1 s/d Ruang ${totalRooms}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Stepper Jumlah Ruangan */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Jumlah Ruangan Ujian (Ruang 1 s/d ...)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTotalRooms((prev) => Math.max(1, prev - 1))}
                        className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center transition-colors shrink-0"
                        title="Kurangi 1 Ruang"
                      >
                        -
                      </button>
                      <div className="flex-1 text-center font-mono font-bold text-sm sm:text-base text-slate-900 bg-slate-50 py-1.5 rounded-lg border border-slate-200">
                        Ruang 1 s/d {roomFormat === 'DOUBLE_DIGIT' ? String(totalRooms).padStart(2, '0') : totalRooms}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTotalRooms((prev) => Math.min(50, prev + 1))}
                        className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center transition-colors shrink-0"
                        title="Tambah 1 Ruang"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-slate-500 font-medium">
                        Total: <strong className="text-slate-800">{totalRooms} Ruangan</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setTotalRooms(Math.max(1, selectedClasses.length))}
                        className="text-teal-700 font-bold hover:underline"
                        title="Samakan jumlah ruangan dengan jumlah rombel terpilih"
                      >
                        🔄 Samakan dg Rombel ({selectedClasses.length})
                      </button>
                    </div>
                  </div>

                  {/* Format Penomoran Ruangan */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Format Penomoran Ruangan
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRoomFormat('NUMERIC')}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all ${
                          roomFormat === 'NUMERIC'
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        Ruang 1, 2, 3...
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoomFormat('DOUBLE_DIGIT')}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all ${
                          roomFormat === 'DOUBLE_DIGIT'
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        Ruang 01, 02...
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Format penamaan ini berlaku untuk jadwal siswa, jadwal pengawas, dan kartu ujian.
                    </p>
                  </div>

                  {/* Kebutuhan Pengawas */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 flex flex-col justify-between shadow-2xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Kebutuhan Guru Pengawas
                      </label>
                      <p className="text-sm font-black text-slate-900 mt-1">
                        {totalRooms * proctorsPerRoom} Guru / Sesi
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {totalRooms} ruangan × {proctorsPerRoom} pengawas per ruangan
                      </p>
                    </div>
                    <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 self-start">
                      {selectedClasses.length === totalRooms
                        ? '✓ 1 Rombel = 1 Ruangan'
                        : `${selectedClasses.length} Rombel disebar ke ${totalRooms} Ruang`}
                    </span>
                  </div>
                </div>

                {/* Pemetaan Rombel ke Ruang Ujian */}
                {selectedClasses.length > 0 && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[11px] font-bold text-slate-700">
                        Alokasi Ruangan per Kelas / Rombel:
                      </span>
                      <button
                        type="button"
                        onClick={() => setClassRoomMapping({})}
                        className="text-[10px] text-slate-500 hover:text-teal-700 font-bold"
                      >
                        Reset Alokasi Berurutan
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                      {selectedClasses.map((cls, idx) => {
                        const defaultRoomName = roomFormat === 'DOUBLE_DIGIT'
                          ? `Ruang ${String((idx % totalRooms) + 1).padStart(2, '0')}`
                          : `Ruang ${(idx % totalRooms) + 1}`;
                        const currentAssigned = classRoomMapping[cls] || defaultRoomName;

                        return (
                          <div key={cls} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-700 block">
                              Kelas {cls}
                            </span>
                            <select
                              value={currentAssigned}
                              onChange={(e) => {
                                const val = e.target.value;
                                setClassRoomMapping((prev) => ({
                                  ...prev,
                                  [cls]: val,
                                }));
                              }}
                              className="w-full bg-white border border-teal-300 rounded-md py-1 px-1 text-[11px] font-bold text-teal-800 text-center focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs cursor-pointer"
                            >
                              {Array.from({ length: totalRooms }, (_, rIdx) => {
                                const rName = roomFormat === 'DOUBLE_DIGIT'
                                  ? `Ruang ${String(rIdx + 1).padStart(2, '0')}`
                                  : `Ruang ${rIdx + 1}`;
                                return (
                                  <option key={rName} value={rName}>
                                    {rName}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Pilihan Mata Pelajaran */}
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
                  placeholder="Contoh: Hari Jumat hanya 1 sesi sampai jam 10.30 WIB. Guru yang bertugas sebagai walikelas diprioritaskan tidak mengawas di kelas asuhannya..."
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

                {/* View Mode Toggle */}
                <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
                  <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setSubjectViewMode('DAILY')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        subjectViewMode === 'DAILY'
                          ? 'bg-white text-teal-900 shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      <span>Tampilan Harian (Sesi & Mapel)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectViewMode('TABLE')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        subjectViewMode === 'TABLE'
                          ? 'bg-white text-teal-900 shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5 text-teal-600" />
                      <span>Tabel Detail (Per Rombel)</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Dalam 1 hari pelaksanaan terdapat beberapa sesi ujian dengan mata pelajaran berbeda.</span>
                  </div>
                </div>

                {subjectViewMode === 'DAILY' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dailyGroupedSchedules.map((day) => {
                      const isFriday = day.dayName.toLowerCase() === 'jumat';
                      return (
                        <div
                          key={day.date}
                          className={`rounded-2xl border transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                            isFriday
                              ? 'bg-amber-50/30 border-amber-200/90'
                              : 'bg-white border-slate-200/90'
                          }`}
                        >
                          {/* Card Header: Day & Date + Sesi & Mapel counts */}
                          <div className={`p-4 border-b flex items-start justify-between gap-3 ${
                            isFriday ? 'bg-amber-100/40 border-amber-200/80' : 'bg-slate-50/80 border-slate-100'
                          }`}>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-black text-slate-900 tracking-tight">
                                  {day.dayName}
                                </h4>
                                {isFriday && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Khusus Jumat
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-slate-500">
                                {formatIndonesianDateLabel(day.date)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-white text-teal-800 border border-teal-200/80 shadow-2xs">
                                <Layers className="w-3 h-3 text-teal-600" />
                                <span>{day.sessions.length} Sesi</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                                <BookOpen className="w-3 h-3 text-slate-500" />
                                <span>{day.sessions.length} Mapel</span>
                              </span>
                            </div>
                          </div>

                          {/* Sessions List */}
                          <div className="p-4 space-y-3 flex-1">
                            {day.sessions.map((sess) => {
                              const durationText = getSessionDurationText(sess.startTime, sess.endTime);
                              return (
                                <div
                                  key={`${sess.sessionNumber}_${sess.subject}`}
                                  className="rounded-xl p-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3"
                                >
                                  {/* Session Header Row: Sesi Badge + Subject Title + Time */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-teal-700 text-white font-black text-[10px] uppercase tracking-wider shadow-2xs">
                                        Sesi {sess.sessionNumber}
                                      </span>
                                      <h5 className="text-sm sm:text-base font-black text-slate-900 truncate tracking-tight">
                                        {sess.subject}
                                      </h5>
                                    </div>

                                    <div className="inline-flex items-center gap-1.5 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs self-start sm:self-auto">
                                      <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                      <span className="font-mono">{sess.startTime} - {sess.endTime} WIB</span>
                                      {durationText && (
                                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded ml-0.5">
                                          {durationText}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Room & Class Allocation Section */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-0.5">
                                      <span className="flex items-center gap-1.5 text-slate-600">
                                        <DoorOpen className="w-3.5 h-3.5 text-teal-600" />
                                        <span>Alokasi Rombel & Ruang Ujian:</span>
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        {sess.classes.length} Rombel
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                      {sess.classes.map((cls) => {
                                        const matchingItem = scheduleData.subjectSchedules.find(
                                          (s) => s.date === day.date && s.sessionNumber === sess.sessionNumber && s.className === cls
                                        );
                                        return (
                                          <div
                                            key={cls}
                                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs hover:border-teal-300 transition-colors"
                                          >
                                            <span className="text-xs font-bold text-slate-800 truncate">
                                              Kelas {cls}
                                            </span>
                                            <span className="shrink-0 ml-1.5 px-2 py-0.5 rounded text-[10px] font-black text-teal-800 bg-teal-50 border border-teal-200/70">
                                              {matchingItem?.roomName || `Ruang ${cls}`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Friday Footer Notice */}
                          {isFriday && (
                            <div className="p-3 mx-4 mb-4 rounded-xl bg-amber-100/60 border border-amber-200/90 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
                              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-bold text-amber-950">Jadwal Khusus Hari Jumat</p>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                  Seluruh sesi ujian diselesaikan maksimal pukul 10:30 WIB untuk persiapan Ibadah Sholat Jumat.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Subject Schedule Table */
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
                                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs inline-block">
                                  {item.roomName || `Ruang ${item.className}`}
                                </span>
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
                )}
              </div>
            )}
          </div>
        )}

        {/* ===============        {/* ========================================================================= */}
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
                {/* View Switcher & Action Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 shrink-0">Tampilan:</span>
                    <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setProctorViewMode('MATRIX')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          proctorViewMode === 'MATRIX'
                            ? 'bg-white text-[#023246] shadow-2xs font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
                        <span>Format Resmi Sekolah (Matriks)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProctorViewMode('TABLE')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          proctorViewMode === 'TABLE'
                            ? 'bg-white text-[#023246] shadow-2xs font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                        <span>Roster Pengawas (Detail)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (invigilationMatrix) {
                          ExamWordExporterService.exportToWord(invigilationMatrix);
                          setToast({ text: 'Dokumen Word (.doc) berhasil diunduh.', type: 'success' });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors shadow-2xs"
                      title="Unduh Dokumen Microsoft Word (.doc)"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Unduh Word (.doc)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (invigilationMatrix) {
                          ExamWordExporterService.printOfficialMatrix(invigilationMatrix);
                        } else {
                          window.print();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors shadow-2xs"
                      title="Cetak Jadwal atau Simpan ke PDF (A4)"
                    >
                      <Printer className="w-3.5 h-3.5 text-teal-700" />
                      <span>Cetak / PDF (A4)</span>
                    </button>
                  </div>
                </div>

                {/* MODE 1: FORMAT MATRIKS RESMI SEKOLAH (IDENTIK DENGAN FOTO FISIK) */}
                {proctorViewMode === 'MATRIX' && invigilationMatrix && (
                  <div className="space-y-6">
                    {/* Paper Container Preview */}
                    <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 sm:p-7 space-y-6 text-slate-800">
                      {/* Paper Official Header */}
                      <div className="text-center space-y-1 pb-4 border-b border-slate-300">
                        <h2 className="text-base sm:text-lg font-black tracking-wide text-slate-900 uppercase">
                          {invigilationMatrix.title}
                        </h2>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase">
                          {invigilationMatrix.subTitle}
                        </h3>
                        <h4 className="text-sm sm:text-base font-extrabold text-teal-900 uppercase tracking-wide">
                          {invigilationMatrix.institutionName}
                        </h4>
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-600">
                          Tahun Pelajaran {scheduleData.config.academicYear || activeAcademicYear}
                        </p>
                      </div>

                      {/* Table 1: Matrix Jadwal Pengawas (Atas) */}
                      <div className="space-y-2">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse border border-slate-400">
                            <thead>
                              <tr className="bg-slate-100 text-slate-800 font-bold text-center">
                                <th rowSpan={2} className="border border-slate-400 py-2.5 px-2 w-10 text-center font-black">
                                  No
                                </th>
                                <th rowSpan={2} className="border border-slate-400 py-2.5 px-3 min-w-32.5 text-center font-black">
                                  Hari / Tanggal
                                </th>
                                <th rowSpan={2} className="border border-slate-400 py-2.5 px-2 min-w-25 text-center font-black">
                                  Waktu
                                </th>
                                <th rowSpan={2} className="border border-slate-400 py-2.5 px-3 min-w-35 text-left font-black">
                                  Mata Pelajaran
                                </th>
                                <th
                                  colSpan={invigilationMatrix.rooms.length}
                                  className="border border-slate-400 py-2 px-2 text-center font-black bg-slate-200/90 text-slate-900"
                                >
                                  Kode Pengawas
                                </th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-800 font-bold text-center">
                                {invigilationMatrix.rooms.map((col) => (
                                  <th
                                    key={col.key}
                                    className="border border-slate-400 py-1.5 px-2 text-center text-[11px] font-black w-12 text-teal-950"
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {invigilationMatrix.days.map((day) =>
                                day.sessions.map((slot, idxSlot) => (
                                  <tr key={`${day.date}-${slot.sessionNumber}`} className="hover:bg-slate-50/90 transition-colors">
                                    {idxSlot === 0 && (
                                      <>
                                        <td
                                          rowSpan={day.sessions.length}
                                          className="border border-slate-400 py-2 px-2 text-center font-bold align-middle bg-white text-slate-700"
                                        >
                                          {day.dayNumber}
                                        </td>
                                        <td
                                          rowSpan={day.sessions.length}
                                          className="border border-slate-400 py-2 px-3 align-middle bg-white"
                                        >
                                          <div className="font-extrabold text-slate-900 text-xs">{day.dayFormatted}</div>
                                        </td>
                                      </>
                                    )}
                                    <td className="border border-slate-400 py-2 px-2 text-center font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                      {slot.timeRange}
                                    </td>
                                    <td className="border border-slate-400 py-2 px-3 font-semibold text-slate-800">
                                      <span className="text-slate-400 font-bold mr-1">{slot.subjectNumber}.</span>
                                      <span>{slot.subjectTitle}</span>
                                    </td>
                                    {invigilationMatrix.rooms.map((col) => {
                                      const code = slot.roomCodes[col.key];
                                      return (
                                        <td
                                          key={col.key}
                                          className="border border-slate-400 py-1.5 px-1.5 text-center align-middle"
                                        >
                                          {code ? (
                                            <span
                                              className="inline-flex items-center justify-center w-8 h-7 rounded bg-teal-50 text-teal-900 border border-teal-300 font-mono font-black text-xs shadow-2xs hover:bg-teal-600 hover:text-white transition-colors cursor-help"
                                              title={`Ruang ${col.label}: Kode ${code}`}
                                            >
                                              {code}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 font-bold">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Table 2: Daftar Kode Pengawas Ruang (Bawah) */}
                      <div className="pt-2 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-wide uppercase">
                            Daftar Kode Pengawas Ruang
                          </h4>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Total {invigilationMatrix.teacherLegend.length} Guru Pengawas
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse border border-slate-400">
                            <thead>
                              <tr className="bg-slate-100 text-slate-800 font-bold">
                                <th className="border border-slate-400 py-2 px-2.5 w-12 text-center font-black">No</th>
                                <th className="border border-slate-400 py-2 px-3 text-left font-black">Nama Guru</th>
                                <th className="border border-slate-400 py-2 px-3 text-left font-black">Mata Pelajaran</th>
                                <th className="border border-slate-400 py-2 px-3 w-28 text-center font-black">Kode Pengawas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invigilationMatrix.teacherLegend.map((item, idx) => (
                                <tr key={item.userId || idx} className="hover:bg-slate-50/90 transition-colors">
                                  <td className="border border-slate-400 py-1.5 px-2.5 text-center text-slate-600 font-mono font-medium">
                                    {item.no || idx + 1}
                                  </td>
                                  <td className="border border-slate-400 py-1.5 px-3 font-bold text-slate-900">
                                    {item.fullName}
                                  </td>
                                  <td className="border border-slate-400 py-1.5 px-3 text-slate-700">
                                    {item.subject}
                                  </td>
                                  <td className="border border-slate-400 py-1.5 px-3 text-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded font-mono font-black text-xs bg-slate-100 text-teal-900 border border-slate-300">
                                      {item.code}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Official Footer Note */}
                      <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                        <p className="font-bold text-slate-700">Catatan Pengawas:</p>
                        <ol className="list-decimal list-inside space-y-0.5 pl-1">
                          <li>Pengawas hadir di ruang sekretariat panitia ujian 15 menit sebelum asesmen dimulai.</li>
                          <li>Mengambil naskah asesmen, lembar jawaban, dan menandatangani berita acara pelaksanaan.</li>
                          <li>Memastikan seluruh peserta ujian mematuhi tata tertib asesmen di ruang masing-masing.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: ROSTER PENGAWAS DETAIL (VIEW LAMA) */}
                {proctorViewMode === 'TABLE' && (
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
                                <td className="py-2.5 px-3.5">
                                  <span className="font-black text-teal-900 text-xs block">{item.roomName}</span>
                                  <span className="text-[10px] text-slate-500 font-semibold">Kelas {item.className}</span>
                                </td>
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
                      <span className="text-slate-500 font-medium">Lokasi Tugas:</span>
                      <span className="font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                        {duty.roomName} ({duty.className})
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
