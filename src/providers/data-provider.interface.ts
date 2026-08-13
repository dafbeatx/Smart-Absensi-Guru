import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
  HolidayRecord,
  AppNotification,
  DeviceBindingCheckResult,
  TeacherMoodType,
  TeacherMoodLog,
  BurnoutAnalytics,
  TeacherDutySchedule,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';

export interface IDataProvider {
  // Auth API
  login(dto: LoginDTO): Promise<LoginResponseDTO>;
  verifySession(token: string): Promise<UserProfile>;
  resetDevice(userId: string, token: string): Promise<boolean>;
  changePin(userId: string, newPin: string, token: string): Promise<boolean>;
  resetPin(userId: string, newPin: string, token: string): Promise<boolean>;
  checkDeviceBinding(userId: string, currentDeviceUUID: string, token: string): Promise<DeviceBindingCheckResult>;

  // Attendance API
  scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO>;
  getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null>;
  getMonthlyAttendance(userId: string, month: string, year: string, token: string): Promise<AttendanceRecord[]>;
  correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean>;
  resetAttendance(targetUserId: string, date: string, adminPasswordInput: string, token: string): Promise<boolean>;
  getDailyAttendance(date: string, token: string): Promise<AttendanceRecord[]>;
  updateAttendanceNote(userId: string, date: string, note: string, token: string): Promise<boolean>;

  // Leave & Approval API
  submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest>;
  approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean>;
  getPendingLeaves(token: string): Promise<LeaveRequest[]>;
  getAllLeaves(token: string): Promise<LeaveRequest[]>;
  getUserLeaves(userId: string, token: string): Promise<LeaveRequest[]>;

  // Notification API
  getNotifications(userId: string, token: string): Promise<AppNotification[]>;
  markNotificationAsRead(notificationId: string, token: string): Promise<boolean>;

  // Settings API
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: SystemSettings, token: string): Promise<boolean>;

  // User Management API (Admin)
  getAllUsers(token: string): Promise<UserProfile[]>;
  createUser(user: Partial<UserProfile>, token: string): Promise<UserProfile>;
  updateUser(userId: string, updates: Partial<UserProfile>, token: string): Promise<boolean>;
  deleteUser(userId: string, token: string): Promise<boolean>;
  toggleUserStatus(userId: string, token: string): Promise<boolean>;

  // Academic Calendar & Holidays API
  getHolidays(token?: string): Promise<HolidayRecord[]>;
  createHoliday(holiday: Omit<HolidayRecord, 'id' | 'created_at'>, token?: string): Promise<HolidayRecord>;
  updateHoliday(id: string, holiday: Partial<HolidayRecord>, token?: string): Promise<HolidayRecord>;
  deleteHoliday(id: string, token?: string): Promise<boolean>;

  // Teacher Well-being & Mood API
  saveTeacherMood(userId: string, date: string, mood: TeacherMoodType, note?: string, token?: string): Promise<boolean>;
  getTodayTeacherMood(userId: string, date: string, token?: string): Promise<TeacherMoodLog | null>;
  getBurnoutAnalytics(month?: string, year?: string, token?: string): Promise<BurnoutAnalytics>;

  // Teacher Duty Schedule API (Jadwal Piket Guru Senin - Jumat)
  getDutySchedules(token?: string): Promise<TeacherDutySchedule[]>;
  saveDutySchedules(schedules: Omit<TeacherDutySchedule, 'id' | 'created_at'>[], token?: string): Promise<boolean>;
}


