export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Belum Presensi';

export interface AttendanceRecord {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  dayName: string; // e.g. "Kamis"
  dateFormatted: string; // e.g. "6 Agustus 2026"
  checkIn: string | null; // e.g. "07:02 WIB"
  checkOut: string | null; // e.g. "14:05 WIB"
  status: AttendanceStatus;
  locationName: string;
  distanceMeter: number;
  qrCodeId?: string;
  notes?: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  nip: string;
  nuptk: string;
  role: string;
  subject: string;
  photoUrl: string;
  isActive: boolean;
  schoolName: string;
  schoolCode: string;
  phone: string;
  email: string;
  joinedYear: string;
}

export type LeaveType = 'Izin' | 'Cuti' | 'Sakit' | 'Dinas Luar';

export interface LeaveRequest {
  id: string;
  date: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentName?: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  createdAt: string;
  approvedBy?: string;
}

export interface CorrectionRequest {
  id: string;
  date: string;
  originalCheckIn: string;
  proposedCheckIn: string;
  originalCheckOut: string;
  proposedCheckOut: string;
  reason: string;
  proofName?: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  date: string;
  read: boolean;
  type: 'success' | 'warning' | 'info' | 'alert';
}

export interface TeachingSlot {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  room: string;
}

export interface SchoolGeofence {
  lat: number;
  lng: number;
  radiusMeter: number;
  name: string;
  address: string;
}
