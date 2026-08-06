import {
  TeacherProfile,
  AttendanceRecord,
  LeaveRequest,
  CorrectionRequest,
  NotificationItem,
  TeachingSlot,
  SchoolGeofence
} from '../types';

export const INITIAL_SCHOOL_GEOFENCE: SchoolGeofence = {
  lat: -6.2088,
  lng: 106.8456,
  radiusMeter: 50,
  name: "SMP Terpadu Al-Ittihadiyah",
  address: "Jl. Pendidikan No. 45, Terpadu Al-Ittihadiyah"
};

export const INITIAL_TEACHER_PROFILE: TeacherProfile = {
  id: "TCH-001",
  name: "Drs. Ahmad Subagja",
  nip: "19850312 201001 1 002",
  nuptk: "4532763664200003",
  role: "Guru Utama & Pembina OSIS",
  subject: "Matematika & Kewirausahaan",
  photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
  isActive: true,
  schoolName: "SMP Terpadu Al-Ittihadiyah",
  schoolCode: "SMP-IT-BDG",
  phone: "0812-3456-7890",
  email: "ahmad.subagja@al-ittihadiyah.sch.id",
  joinedYear: "2010"
};

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Pengajuan Cuti Disetujui",
    message: "Pengajuan Cuti Tahunan tanggal 15 Agustus 2026 telah disetujui oleh Kepala Sekolah.",
    time: "08:30 WIB",
    date: "05 Ags 2026",
    read: false,
    type: "success"
  },
  {
    id: "notif-2",
    title: "Pengingat Absensi Masuk",
    message: "Batas jam masuk sekolah adalah pukul 07:15 WIB. Mohon segera melakukan presensi QR Code.",
    time: "06:45 WIB",
    date: "06 Ags 2026",
    read: false,
    type: "warning"
  },
  {
    id: "notif-3",
    title: "Rapat Guru & Staf Pengajar",
    message: "Agenda evaluasi kurikulum merdeka dilaksanakan di Ruang Rapat lt. 2 pukul 14:30 WIB.",
    time: "10:15 WIB",
    date: "04 Ags 2026",
    read: true,
    type: "info"
  },
  {
    id: "notif-4",
    title: "Presensi Berhasil Recorded",
    message: "Presensi masuk Rabu, 5 Ags 2026 tercatat jam 07:01 WIB (Hadir).",
    time: "07:01 WIB",
    date: "05 Ags 2026",
    read: true,
    type: "success"
  }
];

export const MOCK_TEACHING_SCHEDULE: TeachingSlot[] = [
  { id: "s1", day: "Senin", time: "07:30 - 09:00", className: "Kelas 8A", subject: "Matematika", room: "Ruang 8A" },
  { id: "s2", day: "Senin", time: "09:30 - 11:00", className: "Kelas 9B", subject: "Matematika", room: "Ruang 9B" },
  { id: "s3", day: "Selasa", time: "08:15 - 09:45", className: "Kelas 7C", subject: "Matematika", room: "Ruang 7C" },
  { id: "s4", day: "Rabu", time: "07:30 - 09:00", className: "Kelas 8B", subject: "Matematika", room: "Ruang 8B" },
  { id: "s5", day: "Rabu", time: "10:15 - 11:45", className: "Kelas 9A", subject: "Matematika", room: "Ruang 9A" },
  { id: "s6", day: "Kamis", time: "07:30 - 09:00", className: "Kelas 8A", subject: "Matematika", room: "Ruang 8A" },
  { id: "s7", day: "Kamis", time: "10:00 - 11:30", className: "Kelas 7A", subject: "Kewirausahaan", room: "Lab Komputer" },
  { id: "s8", day: "Jumat", time: "08:00 - 09:30", className: "Kelas 9B", subject: "Matematika", room: "Ruang 9B" }
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "LV-2026-001",
    date: "2026-08-15",
    type: "Cuti",
    startDate: "15 Ags 2026",
    endDate: "15 Ags 2026",
    reason: "Pemeriksaan Kesehatan Tahunan di RS Pertamedika",
    attachmentName: "surat_rujukan_rs.pdf",
    status: "Disetujui",
    createdAt: "04 Ags 2026",
    approvedBy: "H. Abdullah S.Pd, M.M."
  },
  {
    id: "LV-2026-002",
    date: "2026-07-20",
    type: "Dinas Luar",
    startDate: "20 Jul 2026",
    endDate: "22 Jul 2026",
    reason: "Pelatihan Olimpiade Matematika Guru SMP Se-Jawa Barat",
    attachmentName: "surat_tugas_dinas.pdf",
    status: "Disetujui",
    createdAt: "18 Jul 2026",
    approvedBy: "H. Abdullah S.Pd, M.M."
  }
];

export const MOCK_CORRECTION_REQUESTS: CorrectionRequest[] = [
  {
    id: "COR-2026-01",
    date: "2026-07-28",
    originalCheckIn: "-- : --",
    proposedCheckIn: "07:05 WIB",
    originalCheckOut: "14:10 WIB",
    proposedCheckOut: "14:10 WIB",
    reason: "GPS HP error saat scan pagi, bukti ditandatangani piket",
    proofName: "foto_absen_piket.jpg",
    status: "Disetujui",
    createdAt: "28 Jul 2026"
  }
];

export const MOCK_ATTENDANCE_HISTORY: AttendanceRecord[] = [
  {
    id: "att-today",
    date: "2026-08-06",
    dayName: "Kamis",
    dateFormatted: "6 Agustus 2026",
    checkIn: null,
    checkOut: null,
    status: "Belum Presensi",
    locationName: "Area Kampus SMP Terpadu Al-Ittihadiyah",
    distanceMeter: 42
  },
  {
    id: "att-0805",
    date: "2026-08-05",
    dayName: "Rabu",
    dateFormatted: "5 Agustus 2026",
    checkIn: "07:01 WIB",
    checkOut: "14:08 WIB",
    status: "Hadir",
    locationName: "Gedung Utama (Radius 12m)",
    distanceMeter: 12,
    qrCodeId: "QR-GATE-MAIN-01"
  },
  {
    id: "att-0804",
    date: "2026-08-04",
    dayName: "Selasa",
    dateFormatted: "4 Agustus 2026",
    checkIn: "07:08 WIB",
    checkOut: "14:02 WIB",
    status: "Hadir",
    locationName: "Lobby SMP (Radius 25m)",
    distanceMeter: 25,
    qrCodeId: "QR-GATE-MAIN-01"
  },
  {
    id: "att-0803",
    date: "2026-08-03",
    dayName: "Senin",
    dateFormatted: "3 Agustus 2026",
    checkIn: "07:22 WIB",
    checkOut: "14:15 WIB",
    status: "Terlambat",
    locationName: "Gerbang Depan (Radius 38m)",
    distanceMeter: 38,
    qrCodeId: "QR-GATE-MAIN-02",
    notes: "Macet jalan raya utama"
  },
  {
    id: "att-0801",
    date: "2026-08-01",
    dayName: "Sabtu",
    dateFormatted: "1 Agustus 2026",
    checkIn: "07:10 WIB",
    checkOut: "12:30 WIB",
    status: "Hadir",
    locationName: "Area Sekolah (Radius 18m)",
    distanceMeter: 18,
    qrCodeId: "QR-GATE-MAIN-01"
  },
  {
    id: "att-0731",
    date: "2026-07-31",
    dayName: "Jumat",
    dateFormatted: "31 Juli 2026",
    checkIn: "06:55 WIB",
    checkOut: "11:45 WIB",
    status: "Hadir",
    locationName: "Gedung Utama (Radius 8m)",
    distanceMeter: 8,
    qrCodeId: "QR-GATE-MAIN-01"
  },
  {
    id: "att-0730",
    date: "2026-07-30",
    dayName: "Kamis",
    dateFormatted: "30 Juli 2026",
    checkIn: "07:04 WIB",
    checkOut: "14:01 WIB",
    status: "Hadir",
    locationName: "Lobby SMP (Radius 15m)",
    distanceMeter: 15,
    qrCodeId: "QR-GATE-MAIN-01"
  },
  {
    id: "att-0729",
    date: "2026-07-29",
    dayName: "Rabu",
    dateFormatted: "29 Juli 2026",
    checkIn: null,
    checkOut: null,
    status: "Izin",
    locationName: "Izin Resmi Disetujui",
    distanceMeter: 0,
    notes: "Pendampingan Lomba OSN"
  },
  {
    id: "att-0728",
    date: "2026-07-28",
    dayName: "Selasa",
    dateFormatted: "28 Juli 2026",
    checkIn: "07:05 WIB",
    checkOut: "14:10 WIB",
    status: "Hadir",
    locationName: "Gedung Utama (Radius 20m)",
    distanceMeter: 20,
    qrCodeId: "QR-GATE-MAIN-01"
  }
];
