import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';

export interface IDataProvider {
  // Auth API
  login(dto: LoginDTO): Promise<LoginResponseDTO>;
  verifySession(token: string): Promise<UserProfile>;
  resetDevice(userId: string, token: string): Promise<boolean>;

  // Attendance API
  scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO>;
  getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null>;
  getMonthlyAttendance(userId: string, month: string, year: string, token: string): Promise<AttendanceRecord[]>;

  // Leave & Approval API
  submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest>;
  approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean>;

  // Settings API
  getSettings(): Promise<SystemSettings>;
}
