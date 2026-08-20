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

export type VerificationMethod = 'QR_GPS' | 'MANUAL_OPERATOR' | 'SYSTEM_AUTO';

export type AttendanceSource = 'QR' | 'MANUAL' | 'OFFLINE_SYNC';

export type NotificationType = 'IN_APP' | 'WHATSAPP' | 'SYSTEM' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';

export type DeviceBindingStatus = 'ACTIVE' | 'UNBOUND' | 'DIFFERENT_DEVICE' | 'NEEDS_ADMIN_RESET' | 'UNAVAILABLE';

export interface DeviceBindingCheckResult {
  status: DeviceBindingStatus;
  message: string;
  registered_uuid?: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  action_type?: 'CORRECTION' | 'NAVIGATE_TAB' | 'INFO';
  action_date?: string;
  action_target_id?: string;
  created_at: string;
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

export type HolidayType = 'NATIONAL_HOLIDAY' | 'SCHOOL_HOLIDAY' | 'CUTI_BERSAMA' | 'OTHER';

export interface HolidayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  description?: string;
  created_at: string;
}

export interface TeachingSlot {
  id: string;
  user_id?: string;
  teacher_name?: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  room: string;
  created_at?: string;
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

export interface TeacherAppreciationScore {
  totalPoints: number;
  level: string; // e.g. "Pendidik Teladan Platinum", "Pendidik Disiplin Emas"
  nextLevelPoints: number;
  levelProgressPercent: number;
  hadirTepatWaktuCount: number;
  terlambatCount: number;
  piketCount: number;
  moodCheckinCount: number;
  badges: TeacherBadge[];
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
