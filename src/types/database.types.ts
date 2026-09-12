/**
 * SMART ABSENSI GURU - STRICT DATABASE TYPESHEET
 */

export type RoleCode = 'GURU' | 'KEPSEK' | 'ADMIN' | 'OPERATOR';

export type AttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'ALFA'
  | 'IZIN'
  | 'SAKIT'
  | 'DINAS_LUAR'
  | 'BELUM_ABSEN';

export type LeaveType = 'SAKIT' | 'IZIN' | 'DINAS_LUAR' | 'CUTI' | 'KOREKSI_ABSEN';

export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export type VerificationMethod = 'QR_GPS' | 'MANUAL_OPERATOR' | 'SYSTEM_AUTO' | 'BIOMETRIC_GPS';

export type AttendanceSource = 'QR' | 'MANUAL' | 'OFFLINE_SYNC' | 'BIOMETRIC';

export type NotificationType = 'IN_APP' | 'WHATSAPP' | 'SYSTEM' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';

export type DeviceBindingStatus = 'ACTIVE' | 'UNBOUND' | 'DIFFERENT_DEVICE' | 'NEEDS_ADMIN_RESET' | 'UNAVAILABLE';

export interface DeviceBindingCheckResult {
  status: DeviceBindingStatus;
  message: string;
  registered_uuid?: string;
}

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type NotificationAudience = 'ALL' | 'ADMIN' | 'KEPSEK' | 'GURU' | 'OPERATOR';

export type NotificationItemCategory =
  | 'OPERATIONAL_STATUS'
  | 'ACTIVE_ALERT'
  | 'HISTORICAL_EVENT'
  | 'OPERATIONAL'
  | 'ALERT'
  | 'HISTORICAL'
  | 'MY_STATUS'
  | 'TEACHER_SCAN'
  | 'LEAVE_REQUEST'
  | 'SYSTEM_ALERT';

export interface AppNotification {
  id: string;
  user_id?: string | null;
  recipient_user_id?: string | null;
  audience_role?: NotificationAudience;
  title: string;
  message: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  is_read: boolean;
  read_at?: string | null;
  action_url?: string;
  action_type?: 'CORRECTION' | 'NAVIGATE_TAB' | 'INFO';
  action_date?: string;
  action_target_id?: string;
  payload?: Record<string, any>;
  dedupe_key?: string;
  revision?: number;
  expires_at?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  sync_state?: 'SYNCED' | 'LOCAL_DRAFT' | 'FAILED';
  category?: NotificationItemCategory;
  created_at: string;
}

export interface MarkNotificationDTO {
  userId?: string;
  notificationId?: string;
  user_id?: string;
  notification_id?: string;
  revision?: string | number;
  token?: string;
}

export interface MarkBatchNotificationsDTO {
  userId?: string;
  notificationIds?: string[];
  user_id?: string;
  notification_ids?: string[];
  token?: string;
}

export interface MarkReadResult {
  success: boolean;
  persisted?: boolean;
  synced?: boolean;
  syncState?: 'SYNCED' | 'LOCAL_DRAFT' | 'FAILED';
  failedIds?: string[];
  errorCode?: string;
  error?: string;
}

export interface UserProfile {
  id: string;
  nip: string | null;
  full_name: string;
  phone_number: string;
  role: RoleCode;
  position: string;
  avatar_url: string | null;
  is_active: boolean;
  must_change_pin?: boolean;
  created_at: string;
}

export interface DeviceBinding {
  id: string;
  user_id: string;
  device_uuid: string;
  device_model: string;
  fingerprint_hash: string;
  registered_at: string;
  last_used_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in_time: string | null; // HH:mm
  check_out_time: string | null; // HH:mm
  status: AttendanceStatus;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_meters: number | null;
  verification_method: VerificationMethod;
  attendance_source: AttendanceSource;
  is_offline: boolean;
  notes?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name?: string | null;
  teacher_name?: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url: string | null;
  approval_status: ApprovalStatus;
  status?: string | null;
  approval_deadline: string;
  approved_by?: string | null;
  approval_notes?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  request_id?: string;
  actor_id: string;
  actor_role: RoleCode;
  action_type: string;
  target_entity: string;
  before_value: string | null;
  after_value: string | null;
  change_reason: string | null;
  ip_address: string;
  device: string;
  created_at: string;
}

export interface SystemSettings {
  app_name: string;
  institution_name: string;
  work_checkin_start: string;
  work_checkin_end: string;
  work_checkout_start: string; // Senin - Kamis (e.g. 15:30)
  friday_checkout_start?: string; // Khusus Jumat (e.g. 11:00)
  saturday_is_holiday?: boolean; // Libur Sabtu (default true)
  sunday_is_holiday?: boolean; // Libur Minggu (default true)
  geofence_lat: number;
  geofence_lng: number;
  geofence_radius: number;
  admin_reset_password?: string; // Password keamanan khusus buatan Admin untuk reset absensi harian
}

export type CalendarCategoryType = 'HOLIDAY' | 'SCHEDULE';

export type HolidayType =
  | 'NATIONAL_HOLIDAY'
  | 'SCHOOL_HOLIDAY'
  | 'CUTI_BERSAMA'
  | 'RAPAT'
  | 'UJIAN'
  | 'UPACARA'
  | 'WORKSHOP'
  | 'OTHER';

export interface HolidayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  category_type?: CalendarCategoryType; // 'HOLIDAY' = Libur Resmi | 'SCHEDULE' = Agenda/Acara (Tetap Masuk)
  is_holiday?: boolean; // TRUE: guru libur (presensi mati) | FALSE: pengingat acara (presensi aktif)
  description?: string;
  created_at: string;
}

export interface TeachingSlot {
  id: string;
  user_id?: string;
  teacher_user_id?: string;
  teacher_name?: string;
  day_of_week?: number; // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
  day: string;
  start_time?: string; // HH:mm
  end_time?: string;   // HH:mm
  time: string;
  className: string;
  class_name?: string;
  subject: string;
  room: string;
  academic_year?: string;
  is_active?: boolean;
  version?: number;
  effective_from?: string;
  effective_until?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateTeachingScheduleDTO {
  teacher_user_id: string;
  day_of_week: number;
  day?: string;
  start_time: string;
  end_time: string;
  class_name: string;
  subject: string;
  room: string;
  academic_year?: string;
  is_active?: boolean;
  effective_from?: string;
  effective_until?: string;
}

export interface UpdateTeachingScheduleDTO {
  id: string;
  teacher_user_id?: string;
  day_of_week?: number;
  day?: string;
  start_time?: string;
  end_time?: string;
  class_name?: string;
  subject?: string;
  room?: string;
  academic_year?: string;
  is_active?: boolean;
  version: number;
  effective_from?: string;
  effective_until?: string;
}

export interface TeachingScheduleConflictError {
  conflict_type: 'TEACHER' | 'CLASS' | 'ROOM';
  conflicting_schedule: TeachingSlot;
  message: string;
}

export interface TeachingScheduleResult<T = TeachingSlot> {
  success: boolean;
  data?: T;
  error?: string;
  conflict?: TeachingScheduleConflictError;
}

export type TeacherMoodType = 'VERY_HAPPY' | 'HAPPY' | 'NEUTRAL' | 'TIRED' | 'STRESSED';

export interface TeacherMoodLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  mood: TeacherMoodType;
  note?: string;
  created_at: string;
}

export interface BurnoutAnalytics {
  total_responses: number;
  burnout_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  burnout_score: number; // 0 - 100
  mood_breakdown: Record<TeacherMoodType, number>;
  recommendation: string;
}

export interface TeacherDutySchedule {
  id: string;
  day_of_week: number; // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat
  teacher_id: string;
  teacher_name: string;
  notes?: string;
  created_at: string;
}

export interface TeacherBadge {
  id: string;
  title: string;
  category: 'DISCIPLINE' | 'DUTY' | 'RESILIENCE' | 'PERFECT_MONTH';
  icon: string;
  description: string;
  isUnlocked: boolean;
  progressPercent: number;
  unlockedAt?: string;
}

export type TeacherPointActivityType =
  | 'CHECK_IN_ON_TIME'
  | 'CHECK_IN_LATE'
  | 'CHECK_OUT'
  | 'DUTY_PIKET'
  | 'EARLY_BIRD_BONUS'
  | 'STREAK_MILESTONE'
  | 'BONUS_DISCIPLINE'
  | 'PENALTY_ALFA'
  | 'MANUAL_ADJUSTMENT'
  | 'MOOD_CHECKIN'
  | 'COMPLAINT_SUBMIT'
  | 'STUDENT_MERIT'
  | 'STUDENT_DEMERIT';

export interface TeacherPointLog {
  id: string;
  user_id: string;
  teacher_name?: string;
  date: string; // YYYY-MM-DD
  points: number; // e.g. +15, +5, +10, -10
  activity_type: TeacherPointActivityType;
  title?: string;
  description?: string;
  created_at: string;
}

export interface TeacherAppreciationScore {
  totalPoints: number;
  level: string; // e.g. "Pendidik Teladan Platinum", "Pendidik Disiplin Emas"
  nextLevelPoints: number;
  levelProgressPercent: number;
  hadirTepatWaktuCount: number;
  terlambatCount: number;
  piketCount: number;
  earlyBirdCount?: number;
  streakCount?: number;
  moodCheckinCount: number;
  badges: TeacherBadge[];
  pointHistory?: TeacherPointLog[];
}

export type ComplaintCategory =
  | 'SARANA_PRASARANA' // Fasilitas, AC, Proyektor, Kebersihan, Internet
  | 'SISTEM_APLIKASI' // Kendala Absensi, GPS, Barcode, Error
  | 'KEBIJAKAN_MANAJEMEN' // Jadwal Mengajar, Beban Kerja, Koordinasi
  | 'KESEJAHTERAAN' // Kenyamanan Kerja, Lingkungan Sekolah
  | 'LAINNYA'; // Aspirasi & Saran Umum

export type ComplaintStatus =
  | 'SUBMITTED' // Terkirim (Menunggu Tinjauan)
  | 'IN_REVIEW' // Sedang Ditinjau Admin / Kepsek
  | 'RESOLVED' // Selesai / Ditindaklanjuti
  | 'ARCHIVED'; // Diarsipkan

export interface TeacherComplaint {
  id: string;
  user_id: string; // ID Pengirim (Hanya dapat diakses oleh guru pengirim, disamarkan menjadi 'ANONYMOUS' untuk admin/kepsek)
  date: string; // YYYY-MM-DD
  category: ComplaintCategory;
  content: string; // Isi keluhan / catatan
  status: ComplaintStatus;
  admin_response?: string | null; // Tanggapan / Solusi resmi dari Kepsek atau Admin
  responded_at?: string | null;
  responded_by_role?: 'ADMIN' | 'KEPSEK' | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface SubmitComplaintDTO {
  category: ComplaintCategory;
  content: string;
  is_anonymous?: boolean;
}

export interface UpdateComplaintStatusDTO {
  complaintId: string;
  status: ComplaintStatus;
  adminResponse?: string;
  respondedByRole?: 'ADMIN' | 'KEPSEK';
}

export interface StudentItem {
  id: string;
  nisn: string;
  fullName: string;
  className: string;
  gender: 'L' | 'P';
  rfidUid?: string;
  cardStatus?: 'ACTIVE' | 'INACTIVE' | 'LOST';
  academicYear?: string;
  attendanceRate?: number;
  lastTapAt?: string;
  address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentAttendanceRecord {
  id: string;
  studentName: string;
  className: string;
  subject?: string;
  academicYear?: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  rfidUid?: string;
  createdAt?: string;
}

export interface StudentBehaviorLog {
  id?: string;
  student_id?: string;
  type: 'GOOD' | 'BAD';
  points: number;
  reason: string;
  reason_code?: string;
  timestamp: string;
  violation_date?: string;
  occurred_at?: string;
  timezone?: string;
  recordedBy?: string;
  recorded_by_user_id?: string;
  recorded_by_name?: string;
  idempotency_key?: string;
  voided_at?: string | null;
  voided_by_user_id?: string | null;
  void_reason?: string | null;
  sync_status?: 'SYNCED' | 'PENDING_SYNC' | 'FAILED_SYNC' | 'LOCAL_DRAFT';
}

export interface StudentBehaviorRecord {
  id: string;
  student_id?: string;
  student_name: string;
  class_name: string;
  academic_year: string;
  total_points: number;
  merits_points?: number; // Akumulasi Poin Kebaikan Siswa (GOOD >= 0)
  demerits_points?: number; // Akumulasi Poin Pelanggaran / Kedisiplinan Siswa (BAD >= 0)
  net_points?: number; // merits_points - demerits_points
  behavior_logs: StudentBehaviorLog[];
  sync_status?: 'SYNCED' | 'PENDING_SYNC' | 'FAILED_SYNC' | 'LOCAL_DRAFT';
  avatar_url?: string | null;
  points_used_today?: number;
  points_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecordStudentBehaviorParams {
  studentId?: string; // ID relasional dari public.students
  studentName: string;
  className: string;
  type: 'GOOD' | 'BAD';
  points: number;
  reason: string;
  reasonCode?: string;
  teacherName?: string;
  recordedByUserId?: string;
  academicYear?: string;
  violationDate?: string; // Tanggal & waktu kejadian (ISO string dengan timezone offset)
  occurredAt?: string;
  timezone?: string;
  idempotencyKey?: string;
}

export interface StudentCharacterSummary {
  student_id: string;
  academic_year: string;
  merits_points: number;
  demerits_points: number;
  net_points: number;
  last_activity_at?: string;
  updated_at?: string;
}

export interface RecordStudentBehaviorResult {
  success: boolean;
  newTotal: number;
  merits_points?: number;
  demerits_points?: number;
  net_points?: number;
  record?: StudentBehaviorRecord;
  logId?: string;
  isDuplicate?: boolean;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC' | 'FAILED_SYNC' | 'LOCAL_DRAFT';
  message: string;
}

export interface GradeMasterBehaviorCategory {
  text: string;
  weight: number;
  isGood: boolean;
  icon?: string;
}

// Classroom Emergency (SOS UKS & Guru Piket)
export type EmergencyCategory = 'MEDIS_UKS' | 'DISIPLIN_PERKELAHIAN' | 'LAB_K3' | 'LAINNYA';
export type EmergencyStatus = 'ACTIVE' | 'RESPONDED' | 'RESOLVED' | 'CANCELLED';

export interface ClassroomEmergencyAlert {
  id: string;
  teacher_id: string;
  teacher_name: string;
  room_name: string;
  class_name?: string;
  category: EmergencyCategory;
  notes?: string;
  status: EmergencyStatus;
  responded_by?: string;
  responded_at?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface CreateEmergencyAlertDTO {
  room_name: string;
  class_name?: string;
  category: EmergencyCategory;
  notes?: string;
}

// Web Push Notifications Subscription
export interface PushSubscriptionPayload {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_type?: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'UNKNOWN';
  user_agent?: string;
}

export interface PushSubscriptionRecord extends PushSubscriptionPayload {
  id: string;
  created_at: string;
  updated_at: string;
}

// Notification & Audio Preferences per User
export interface NotificationPreferences {
  user_id: string;
  push_enabled?: boolean;
  attendance_enabled?: boolean;
  leave_enabled?: boolean;
  schedule_enabled?: boolean;
  announcement_enabled?: boolean;
  critical_enabled?: boolean;
  voice_enabled?: boolean;
  sound_enabled?: boolean;
  attendance_sound_enabled?: boolean;
  chime_enabled?: boolean;
  auto_greeting_enabled?: boolean;
  quiet_hours_start?: string | null; // e.g. '21:00'
  quiet_hours_end?: string | null;   // e.g. '05:00'
  quiet_hours_enabled?: boolean;
  // Aliases for test & legacy compatibility
  attendance_alerts?: boolean;
  leave_alerts?: boolean;
  event_alerts?: boolean;
  attendance_policy_agreed?: boolean;
  attendance_policy_agreed_at?: string;
  updated_at?: string;
}

// Sarana dan Prasarana (Sarpras) Inventory
export type SarprasCondition = 'LAYAK' | 'RUSAK';

export interface InventorySarprasItem {
  id: string;
  ruangan: string;
  nama_barang: string;
  jumlah_total: number;
  merek: string;
  tahun_perolehan: number;
  kondisi: SarprasCondition;
  yang_harus_dibeli: string;
  sumber_dana: string;
  keterangan?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInventorySarprasDTO {
  ruangan: string;
  nama_barang: string;
  jumlah_total: number;
  merek: string;
  tahun_perolehan: number;
  kondisi: SarprasCondition;
  yang_harus_dibeli: string;
  sumber_dana: string;
  keterangan?: string;
  created_by?: string;
  created_by_name?: string;
}

export interface UpdateInventorySarprasDTO {
  ruangan?: string;
  nama_barang?: string;
  jumlah_total?: number;
  merek?: string;
  tahun_perolehan?: number;
  kondisi?: SarprasCondition;
  yang_harus_dibeli?: string;
  sumber_dana?: string;
  keterangan?: string;
}

// ==============================================================================
// EXAM CORRECTION & GRADING ENGINE (Koreksi Soal & Nilai Siswa - Web-Input-Nilai)
// ==============================================================================

export interface ScoringConfig {
  pgWeight: number;
  essayWeight: number;
  essayMaxScore: number;
  essayCount: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  pgWeight: 0.7,
  essayWeight: 0.3,
  essayMaxScore: 20,
  essayCount: 5,
};

export interface ExamSessionRecord {
  id: string;
  session_name: string;
  teacher: string;
  subject: string;
  class_name: string;
  class_code?: string;
  owner_user_id?: string;
  school_level: 'SMP' | 'SMA';
  answer_key: string[];
  student_list: string[];
  scoring_config?: ScoringConfig;
  exam_type?: string;
  academic_year?: string;
  semester?: string;
  kkm: number;
  remedial_essay_count?: number;
  remedial_timer?: number;
  is_public?: boolean;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExamSessionDTO {
  id?: string;
  session_name: string;
  teacher: string;
  subject: string;
  class_name: string;
  class_code?: string;
  owner_user_id?: string;
  school_level: 'SMP' | 'SMA';
  answer_key: string[];
  student_list: string[];
  scoring_config?: ScoringConfig;
  exam_type?: string;
  academic_year?: string;
  semester?: string;
  kkm: number;
}

export interface GradedStudentScoreRecord {
  id: string;
  session_id: string;
  name: string;
  student_user_id?: string;
  mcq_answers: Record<number, string>;
  essay_scores: number[];
  mcq_score: number;
  essay_score: number;
  final_score: number;
  csi: number;
  lps: number;
  correct: number;
  wrong: number;
  remedial_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaveGradedStudentDTO {
  id?: string;
  session_id: string;
  name: string;
  student_user_id?: string;
  mcq_answers: Record<number, string>;
  essay_scores: number[];
  mcq_score: number;
  essay_score: number;
  final_score: number;
  csi: number;
  lps: number;
  correct: number;
  wrong: number;
  answer_key?: string[];
}

export interface StudentCalculationResult {
  correct: number;
  wrong: number;
  unanswered: number;
  score: number;
  essayScore: number;
  finalScore: number;
  percentage: number;
  csi: number;
  lps: number;
}

