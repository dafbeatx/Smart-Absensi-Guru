/**
 * SMART ABSENSI GURU — EXAM & INVIGILATOR SCHEDULING SYSTEM
 * Types and interfaces for ASTS/ASAS exam scheduler, committee authorization, and AI allocation.
 */

export type ExamType = 'ASTS' | 'ASAS' | 'ASAJ' | 'HARIAN';

export type EducationLevel = 'SMP' | 'SMA';

export type CommitteeRole = 'KETUA' | 'SEKRETARIS' | 'BENDAHARA' | 'ANGGOTA';

export interface ExamCommitteeMember {
  id: string;
  userId: string;
  fullName: string;
  npp?: string;
  role: CommitteeRole;
  academicYear: string;
  isActive: boolean;
  createdAt?: string;
}

export interface SessionTimeSlot {
  sessionNumber: number;
  sessionName: string;
  startTime: string; // HH:mm format, e.g. "07:30"
  endTime: string;   // HH:mm format, e.g. "09:30"
}

export interface ExamSubjectScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Senin"
  sessionNumber: number;
  startTime: string;
  endTime: string;
  className: string;
  subject: string;
  roomName?: string; // e.g. "Ruang 1", "Ruang 01"
  isLabRequired?: boolean;
}

export interface ExamProctorItem {
  id: string;
  date: string; // YYYY-MM-DD
  dayName: string;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  roomName: string;
  className: string;
  subject: string;
  mainProctorId: string;
  mainProctorName: string;
  secondaryProctorId?: string;
  secondaryProctorName?: string;
  backupProctorId?: string;
  backupProctorName?: string;
}

export interface DaySessionOverride {
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Senin", "Jumat"
  sessionsCount: number; // 1, 2, 3, or 4
  sessionSlots?: SessionTimeSlot[]; // Optional custom start/end times for this specific day
}

export interface ExamScheduleFormConfig {
  educationLevel?: EducationLevel; // 'SMP' | 'SMA' (Terpisah antar jenjang)
  examType: ExamType;
  examTitle: string;
  academicYear: string;
  semester: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  includeSaturday?: boolean; // Default false (Sekolah 5 Hari Kerja: Senin s/d Jumat)
  sessionsPerDay: number;
  sessionSlots: SessionTimeSlot[];
  dayOverrides?: DaySessionOverride[];
  selectedClasses: string[];
  totalRooms?: number; // Setting admin: Jumlah ruangan ujian (Ruang 1 s/d Ruang X)
  roomFormat?: 'NUMERIC' | 'DOUBLE_DIGIT'; // 'Ruang 1' vs 'Ruang 01'
  classRoomMapping?: Record<string, string>; // Mapping rombel/kelas ke nomor ruangan
  selectedSubjects: string[];
  selectedTeacherIds: string[];
  proctorsPerRoom: 1 | 2;
  excludeOwnSubject: boolean;
  excludeCommitteeProctor: boolean;
  assignBackupProctor: boolean;
  aiCustomPrompt?: string;
  customSubjectProctors?: Record<string, string[]>; // Alokasi eksak pengawas per mapel & ruang [P1, P2, P3, ...]
  skipProctorAssignment?: boolean; // Jika prompt AI tidak menyebutkan guru/pengawas, roster pengawas tidak dibuat
}

export interface ExamScheduleSummary {
  totalDays: number;
  totalSessions: number;
  totalClasses: number;
  totalSubjects: number;
  totalProctorsAssigned: number;
  averageSessionsPerTeacher: number;
  aiOptimizationNote?: string;
}

export interface ExamScheduleData {
  id: string;
  educationLevel?: EducationLevel; // 'SMP' | 'SMA'
  config: ExamScheduleFormConfig;
  subjectSchedules: ExamSubjectScheduleItem[];
  proctorSchedules: ExamProctorItem[];
  summary: ExamScheduleSummary;
  createdAt: string;
  updatedAt: string;
}
