/**
 * Smart Absensi Guru — Counseling & Student Guidance Types (Catatan BK)
 * Terintegrasi dua arah dengan Nawasena Platform Siswa (https://nawasena-platform-siswa.vercel.app)
 */

export type CounselingType =
  | 'INDIVIDUAL'         // Konseling Individu
  | 'GROUP'              // Konseling Kelompok
  | 'PARENT_CONFERENCE'  // Konferensi / Panggilan Orang Tua
  | 'HOME_VISIT'         // Kunjungan Rumah (Home Visit)
  | 'ACADEMIC_GUIDANCE'  // Bimbingan Belajar & Akademik
  | 'BEHAVIOR_MEDIATION' // Mediasi Perilaku & Kedisiplinan
  | 'CAREER_INTEREST';   // Bimbingan Minat / Karir Lanjutan

export type CounselingStatus =
  | 'SCHEDULED'   // Terjadwal
  | 'IN_PROGRESS' // Sedang Ditangani / Proses Pembinaan
  | 'RESOLVED'    // Selesai / Tuntas
  | 'MONITORING'  // Dalam Pemantauan Lanjutan
  | 'REFERRED';   // Dirujuk ke Pihak Eksternal / Ahli

export type CounselingUrgency =
  | 'LOW'    // Rendah / Pembinaan Rutin
  | 'MEDIUM' // Sedang / Perlu Perhatian
  | 'HIGH';  // Tinggi / Mendesak

export type CounselingVisibility =
  | 'PUBLIC_STUDENT'       // Tampil di web siswa Nawasena (Siswa & Orang Tua)
  | 'CONFIDENTIAL_STAFF';  // Khusus Guru BK, Wali Kelas & Pimpinan Sekolah

export interface CounselingRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_nisn?: string | null;
  class_name: string;
  counselor_id: string;
  counselor_name: string;
  counselor_npp?: string | null;
  counseling_date: string; // YYYY-MM-DD
  counseling_time?: string | null; // HH:mm
  counseling_type: CounselingType;
  urgency: CounselingUrgency;
  status: CounselingStatus;
  visibility: CounselingVisibility;
  topic: string;
  background_narrative?: string | null;
  action_taken: string;
  student_commitment?: string | null;
  parent_involvement?: string | null;
  follow_up_plan?: string | null;
  follow_up_date?: string | null; // YYYY-MM-DD
  academic_year: string; // Misal '2026/2027'
  semester: 'GANJIL' | 'GENAP';
  created_at: string;
  updated_at: string;
  synced_to_nawasena?: boolean;
}

export interface CreateCounselingDTO {
  student_id: string;
  student_name: string;
  student_nisn?: string | null;
  class_name: string;
  counselor_id: string;
  counselor_name: string;
  counselor_npp?: string | null;
  counseling_date: string;
  counseling_time?: string | null;
  counseling_type: CounselingType;
  urgency: CounselingUrgency;
  status?: CounselingStatus;
  visibility?: CounselingVisibility;
  topic: string;
  background_narrative?: string | null;
  action_taken: string;
  student_commitment?: string | null;
  parent_involvement?: string | null;
  follow_up_plan?: string | null;
  follow_up_date?: string | null;
  academic_year?: string;
  semester?: 'GANJIL' | 'GENAP';
}

export interface UpdateCounselingDTO {
  counseling_type?: CounselingType;
  urgency?: CounselingUrgency;
  status?: CounselingStatus;
  visibility?: CounselingVisibility;
  topic?: string;
  background_narrative?: string | null;
  action_taken?: string;
  student_commitment?: string | null;
  parent_involvement?: string | null;
  follow_up_plan?: string | null;
  follow_up_date?: string | null;
}

export interface CounselingStatistics {
  totalRecords: number;
  resolvedCount: number;
  inProgressCount: number;
  highUrgencyCount: number;
  parentInvolvedCount: number;
  publicToNawasenaCount: number;
}

export interface CounselingFilter {
  className?: string;
  counselingType?: CounselingType | 'ALL';
  status?: CounselingStatus | 'ALL';
  urgency?: CounselingUrgency | 'ALL';
  counselorId?: string;
  studentName?: string;
  academicYear?: string;
}

export const COUNSELING_TYPE_LABELS: Record<CounselingType, string> = {
  INDIVIDUAL: 'Konseling Individu',
  GROUP: 'Konseling Kelompok',
  PARENT_CONFERENCE: 'Panggilan Orang Tua',
  HOME_VISIT: 'Kunjungan Rumah (Home Visit)',
  ACADEMIC_GUIDANCE: 'Bimbingan Belajar & Akademik',
  BEHAVIOR_MEDIATION: 'Mediasi Kedisiplinan',
  CAREER_INTEREST: 'Bimbingan Minat & Karir',
};

export const COUNSELING_STATUS_LABELS: Record<CounselingStatus, string> = {
  SCHEDULED: 'Terjadwal',
  IN_PROGRESS: 'Sedang Proses',
  RESOLVED: 'Selesai / Tuntas',
  MONITORING: 'Dalam Pemantauan',
  REFERRED: 'Dirujuk ke Ahli',
};

export const COUNSELING_URGENCY_LABELS: Record<CounselingUrgency, string> = {
  LOW: 'Rutin / Rendah',
  MEDIUM: 'Perlu Perhatian',
  HIGH: 'Mendesak / Prioritas',
};

export const POPULAR_BK_TOPICS = [
  'Kesulitan memahami materi pembelajaran & fokus di kelas',
  'Penurunan motivasi belajar pasca asesmen',
  'Keterlambatan masuk sekolah berulang kali',
  'Mediasi perselisihan antar siswa di lingkungan kelas',
  'Konsultasi minat bakat & persiapan penjurusan',
  'Kendala kehadiran karena merawat anggota keluarga',
  'Panggilan orang tua terkait pembinaan kedisiplinan',
  'Apresiasi peningkatan karakter & keaktifan beribadah',
];

