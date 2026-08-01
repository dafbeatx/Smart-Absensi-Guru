import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
  HolidayRecord,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';

export interface IDataProvider {
  // Auth API
  login(dto: LoginDTO): Promise<LoginResponseDTO>;
  verifySession(token: string): Promise<UserProfile>;
  resetDevice(userId: string, token: string): Promise<boolean>;
  changePin(userId: string, newPin: string, token: string): Promise<boolean>;

  // Attendance API
  scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO>;
  getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null>;
  getMonthlyAttendance(userId: string, month: string, year: string, token: string): Promise<AttendanceRecord[]>;

  // Leave & Approval API
  submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest>;
  approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean>;

  // Settings API
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: SystemSettings, token: string): Promise<boolean>;

  // User Management API (Admin)
  getAllUsers(token: string): Promise<UserProfile[]>;
  createUser(user: Partial<UserProfile>, token: string): Promise<UserProfile>;
  deleteUser(userId: string, token: string): Promise<boolean>;
  toggleUserStatus(userId: string, token: string): Promise<boolean>;

  // Academic Calendar & Holidays API
  getHolidays(token?: string): Promise<HolidayRecord[]>;
  createHoliday(holiday: Omit<HolidayRecord, 'id' | 'created_at'>, token?: string): Promise<HolidayRecord>;
  updateHoliday(id: string, holiday: Partial<HolidayRecord>, token?: string): Promise<HolidayRecord>;
  deleteHoliday(id: string, token?: string): Promise<boolean>;
}
