/**
 * Tipe Data dan Definisi Antarmuka Fitur Pencatatan Bimtek & Diklat Guru
 * SMP Terpadu Al-Ittihadiyah
 */

export type BimtekActivityType =
  | 'BIMTEK'                  // Bimbingan Teknis
  | 'DIKLAT'                  // Pendidikan dan Pelatihan
  | 'WORKSHOP'                // Workshop / Lokakarya
  | 'WEBINAR'                 // Webinar / Seminar Daring
  | 'SEMINAR'                 // Seminar / Konferensi Tatap Muka
  | 'PELATIHAN_MANDIRI_PMM'   // Pelatihan Mandiri Platform Merdeka Mengajar (PMM)
  | 'LAINNYA';                // Kegiatan Pengembangan Diri Lainnya

export type BimtekScope =
  | 'SEKOLAH'                 // Tingkat Sekolah / Satuan Pendidikan
  | 'GUGUS_KECAMATAN'         // Tingkat Gugus / Kecamatan
  | 'KOTA_KABUPATEN'          // Tingkat Kota / Kabupaten
  | 'PROVINSI'                // Tingkat Provinsi
  | 'NASIONAL'                // Tingkat Nasional
  | 'INTERNASIONAL';          // Tingkat Internasional

export type BimtekRole =
  | 'PESERTA'                 // Peserta
  | 'NARASUMBER'              // Narasumber / Pemateri
  | 'FASILITATOR'             // Fasilitator / Pengajar Praktik
  | 'PANITIA'                 // Panitia Penyelenggara
  | 'MODERATOR';              // Moderator

export type BimtekMethod =
  | 'DARING'                  // Daring (Online / Virtual)
  | 'LURING'                  // Luring (Tatap Muka Fisik)
  | 'HYBRID';                 // Campuran (Blended / Hybrid)

export type BimtekStatus =
  | 'SUBMITTED'               // Diajukan (Menunggu Validasi)
  | 'APPROVED'                // Disetujui / Terverifikasi Resmi
  | 'REVISION';               // Perlu Perbaikan Dokumen

export interface BimtekRecord {
  id: string;
  user_id: string;
  teacher_name: string;
  teacher_nip?: string | null;            // Nomor Pokok Pegawai (NPP)
  teacher_avatar?: string | null;
  title: string;                          // Nama Kegiatan Bimtek
  activity_type: BimtekActivityType;
  organizer: string;                      // Penyelenggara (Kemendikbud, BBGP, Disdik, MGMP, Yayasan, dll.)
  scope: BimtekScope;
  role: BimtekRole;
  execution_method: BimtekMethod;
  start_date: string;                     // YYYY-MM-DD
  end_date: string;                       // YYYY-MM-DD
  duration_hours: number;                 // Jumlah Jam Pelajaran (JP), misal 32 JP
  location_or_platform: string;           // Lokasi fisik / platform daring (misal Zoom, BBGP Bandung, dsb.)
  certificate_number?: string | null;     // Nomor Sertifikat / Piagam
  certificate_date?: string | null;       // Tanggal Sertifikat (YYYY-MM-DD)
  certificate_url?: string | null;        // URL Bukti Dokumen / File Sertifikat / Drive
  assignment_letter_number?: string | null; // Nomor Surat Tugas
  summary_notes?: string | null;          // Ringkasan Materi & Rencana Tindak Lanjut (RTL)
  status: BimtekStatus;
  verified_by?: string | null;            // Nama Verifikator (Kepala Sekolah / Admin)
  verified_at?: string | null;            // ISO Date
  verification_notes?: string | null;     // Catatan dari verifikator
  academic_year?: string;                 // Tahun Ajaran (misal 2026/2027)
  created_at: string;
  updated_at: string;
}

export interface CreateBimtekDTO {
  user_id: string;
  teacher_name: string;
  teacher_nip?: string | null;
  teacher_avatar?: string | null;
  title: string;
  activity_type: BimtekActivityType;
  organizer: string;
  scope: BimtekScope;
  role?: BimtekRole;
  execution_method?: BimtekMethod;
  start_date: string;
  end_date: string;
  duration_hours: number;
  location_or_platform: string;
  certificate_number?: string | null;
  certificate_date?: string | null;
  certificate_url?: string | null;
  assignment_letter_number?: string | null;
  summary_notes?: string | null;
  academic_year?: string;
}

export interface UpdateBimtekDTO {
  title?: string;
  activity_type?: BimtekActivityType;
  organizer?: string;
  scope?: BimtekScope;
  role?: BimtekRole;
  execution_method?: BimtekMethod;
  start_date?: string;
  end_date?: string;
  duration_hours?: number;
  location_or_platform?: string;
  certificate_number?: string | null;
  certificate_date?: string | null;
  certificate_url?: string | null;
  assignment_letter_number?: string | null;
  summary_notes?: string | null;
  academic_year?: string;
}

export interface VerifyBimtekDTO {
  status: 'APPROVED' | 'REVISION';
  verified_by: string;
  verification_notes?: string | null;
}

export interface BimtekStatistics {
  totalActivities: number;
  totalDurationHours: number;   // Total Akumulasi JP
  totalCertificates: number;
  approvedCount: number;
  submittedCount: number;
  revisionCount: number;
  activeTeachersCount: number;
  byActivityType: Record<BimtekActivityType, number>;
  byScope: Record<BimtekScope, number>;
}

export const BIMTEK_ACTIVITY_LABELS: Record<BimtekActivityType, string> = {
  BIMTEK: 'Bimbingan Teknis (Bimtek)',
  DIKLAT: 'Pendidikan & Pelatihan (Diklat)',
  WORKSHOP: 'Workshop / Lokakarya',
  WEBINAR: 'Webinar Daring',
  SEMINAR: 'Seminar / Konferensi',
  PELATIHAN_MANDIRI_PMM: 'Pelatihan Mandiri PMM',
  LAINNYA: 'Pengembangan Diri Lainnya',
};

export const BIMTEK_SCOPE_LABELS: Record<BimtekScope, string> = {
  SEKOLAH: 'Tingkat Sekolah',
  GUGUS_KECAMATAN: 'Gugus / Kecamatan',
  KOTA_KABUPATEN: 'Kota / Kabupaten',
  PROVINSI: 'Provinsi',
  NASIONAL: 'Nasional',
  INTERNASIONAL: 'Internasional',
};

export const BIMTEK_ROLE_LABELS: Record<BimtekRole, string> = {
  PESERTA: 'Peserta',
  NARASUMBER: 'Narasumber / Pemateri',
  FASILITATOR: 'Fasilitator / Pengajar Praktik',
  PANITIA: 'Panitia Penyelenggara',
  MODERATOR: 'Moderator',
};

export const BIMTEK_METHOD_LABELS: Record<BimtekMethod, string> = {
  DARING: 'Daring (Online)',
  LURING: 'Luring (Tatap Muka)',
  HYBRID: 'Hybrid / Blended',
};

export const BIMTEK_STATUS_LABELS: Record<BimtekStatus, string> = {
  SUBMITTED: 'Menunggu Validasi',
  APPROVED: 'Disetujui Resmi',
  REVISION: 'Perlu Revisi',
};

export const POPULAR_BIMTEK_ORGANIZERS: string[] = [
  'Kemendikbudristek',
  'BBGP Jawa Barat (Balai Guru Penggerak)',
  'Dinas Pendidikan Kab. Bandung',
  'MGMP SMP Kab. Bandung',
  'Platform Merdeka Mengajar (PMM)',
  'Yayasan Pendidikan Al-Ittihadiyah',
  'SMP Terpadu Al-Ittihadiyah',
  'Google for Education Indonesia',
  'SEAMEO QITEP',
  'Kementerian Agama RI',
];
