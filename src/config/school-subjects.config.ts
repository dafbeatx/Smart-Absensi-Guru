/**
 * SMART ABSENSI GURU — OFFICIAL SCHOOL SUBJECTS CONFIGURATION
 * Berisi 12 mata pelajaran resmi yang digunakan di lingkungan sekolah.
 */

export interface OfficialSchoolSubject {
  code: string;
  name: string;
  label: string; // e.g. "PAI – Pendidikan Agama Islam"
  category: 'Keagamaan' | 'Umum / Wajib' | 'Muatan Lokal';
  aliases: string[];
}

export const OFFICIAL_SCHOOL_SUBJECTS: OfficialSchoolSubject[] = [
  {
    code: 'PAI',
    name: 'Pendidikan Agama Islam',
    label: 'PAI – Pendidikan Agama Islam',
    category: 'Keagamaan',
    aliases: ['PAI', 'Agama Islam', 'Pendidikan Agama Islam & Budi Pekerti', 'PAI & BP'],
  },
  {
    code: 'IPA',
    name: 'Ilmu Pengetahuan Alam',
    label: 'IPA – Ilmu Pengetahuan Alam',
    category: 'Umum / Wajib',
    aliases: ['IPA', 'Sains', 'Ilmu Pengetahuan Alam (IPA)'],
  },
  {
    code: 'MTK',
    name: 'Matematika',
    label: 'MTK – Matematika',
    category: 'Umum / Wajib',
    aliases: ['MTK', 'Matematika', 'Math'],
  },
  {
    code: 'PP',
    name: 'Pendidikan Pancasila',
    label: 'PP – Pendidikan Pancasila',
    category: 'Umum / Wajib',
    aliases: ['PP', 'PKn', 'PPKn', 'Pendidikan Pancasila & Kewarganegaraan'],
  },
  {
    code: 'B. Indonesia',
    name: 'Bahasa Indonesia',
    label: 'B. Indonesia – Bahasa Indonesia',
    category: 'Umum / Wajib',
    aliases: ['B. Indonesia', 'Bahasa Indonesia', 'BIND', 'B. Indo', 'B Indo'],
  },
  {
    code: 'IPS',
    name: 'Ilmu Pengetahuan Sosial',
    label: 'IPS – Ilmu Pengetahuan Sosial',
    category: 'Umum / Wajib',
    aliases: ['IPS', 'Sosial', 'Ilmu Pengetahuan Sosial (IPS)'],
  },
  {
    code: 'B. Arab',
    name: 'Bahasa Arab',
    label: 'B. Arab – Bahasa Arab',
    category: 'Muatan Lokal',
    aliases: ['B. Arab', 'Bahasa Arab', 'BARB', 'Arab'],
  },
  {
    code: 'B. Inggris',
    name: 'Bahasa Inggris',
    label: 'B. Inggris – Bahasa Inggris',
    category: 'Umum / Wajib',
    aliases: ['B. Inggris', 'Bahasa Inggris', 'BING', 'English', 'B. Ing'],
  },
  {
    code: 'SBPK',
    name: 'Seni Budaya dan Prakarya',
    label: 'SBPK – Seni Budaya dan Prakarya',
    category: 'Umum / Wajib',
    aliases: ['SBPK', 'Seni Budaya', 'SBK', 'Prakarya', 'SNB', 'PKWU'],
  },
  {
    code: 'Informatika',
    name: 'Informatika',
    label: 'Informatika',
    category: 'Umum / Wajib',
    aliases: ['Informatika', 'TIK', 'Komputer', 'INF'],
  },
  {
    code: 'Hadits',
    name: 'Hadits',
    label: 'Hadits',
    category: 'Keagamaan',
    aliases: ['Hadits', 'Hadist', 'Ilmu Hadits'],
  },
  {
    code: 'BTQ',
    name: "Baca Tulis Al-Qur'an",
    label: "BTQ – Baca Tulis Al-Qur'an",
    category: 'Keagamaan',
    aliases: ['BTQ', "Baca Tulis Al-Qur'an", "Baca Tulis Al-Quran", "Tahfidz", "Al-Quran", "Tahfidz / Al-Quran"],
  },
];

/**
 * Normalisasi nama mata pelajaran agar seragam sesuai standar sekolah
 */
export const normalizeSubjectName = (raw?: string | null): string => {
  if (!raw) return '';
  const clean = raw.trim();
  const lower = clean.toLowerCase();

  const matched = OFFICIAL_SCHOOL_SUBJECTS.find(
    (s) =>
      s.label.toLowerCase() === lower ||
      s.code.toLowerCase() === lower ||
      s.name.toLowerCase() === lower ||
      s.aliases.some((a) => a.toLowerCase() === lower)
  );

  return matched ? matched.label : clean;
};

/**
 * Memeriksa apakah dua referensi mata pelajaran adalah mapel yang sama
 */
export const isSameSubject = (subjA?: string | null, subjB?: string | null): boolean => {
  if (!subjA || !subjB) return false;
  return normalizeSubjectName(subjA) === normalizeSubjectName(subjB);
};

/**
 * Mengambil kode singkat dari mata pelajaran
 */
export const getSubjectShortCode = (raw?: string | null): string => {
  if (!raw) return '';
  const clean = raw.trim();
  const lower = clean.toLowerCase();

  const matched = OFFICIAL_SCHOOL_SUBJECTS.find(
    (s) =>
      s.label.toLowerCase() === lower ||
      s.code.toLowerCase() === lower ||
      s.name.toLowerCase() === lower ||
      s.aliases.some((a) => a.toLowerCase() === lower)
  );

  return matched ? matched.code : clean;
};
