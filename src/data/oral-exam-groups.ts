import type { UserProfile } from '../types/database.types';
import type { OralExamAssignment } from '../types/oral-exam.types';

/**
 * SMART ABSENSI GURU - KELOMPOK PENGUJI & PESERTA UJIAN LISAN RESMI
 * Sumber pembagian resmi sekolah (12 Kelompok Penguji, 144 Peserta across Ruang 01–05 & SMA).
 */

export interface OfficialOralExamGroup {
  id: string;
  examinerName: string;
  roomNumber: string;
  className: string;
  students: Array<{
    studentId: string;
    studentName: string;
  }>;
}

const buildGroupStudents = (groupId: string, names: string[]) =>
  names.map((fullName, idx) => ({
    studentId: `${groupId}_s${String(idx + 1).padStart(2, '0')}`,
    studentName: fullName,
  }));

export const ORAL_EXAM_OFFICIAL_GROUPS: OfficialOralExamGroup[] = [
  {
    id: 'oral_grp_01_adi',
    examinerName: 'Adi Prastyo, S.Pd',
    roomNumber: 'Ruang 01',
    className: '7',
    students: buildGroupStudents('oral_grp_01_adi', [
      'Afhtar Shakil',
      'Akbar Azhi Mughni',
      'Al-Dafi Putra Asyabani',
      'Fatturahman Rangga',
      'Hanifah Al-Qusyari',
      'Ifham Fathar Mubarok',
      'Muhamad Ardhiansyah',
      'Muhamad Ibnu Zikra',
      'Muhamad Milan Azka',
      'Muhamad Ridwan Aulah',
      'Muhammad Hamdan Zulfan',
    ]),
  },
  {
    id: 'oral_grp_02_fitri',
    examinerName: 'Fitri Ani Rahayu, S.Mat',
    roomNumber: 'Ruang 01',
    className: '7',
    students: buildGroupStudents('oral_grp_02_fitri', [
      'Adiba Khansa Az-Zahra',
      'Carisa Cania Maryam',
      'Delisa Qeren Surfina',
      'Fitriani Azahra',
      'Hilya Himmatul Aliyah',
      'Keisha Putri Eliana',
      'Kinara Azzahra',
      'Naira Rubbiatul Hikmah',
      'Nazma Maratun Solihah',
      'Muhammad Rian',
    ]),
  },
  {
    id: 'oral_grp_03_nurul',
    examinerName: 'Nurul Farhiyah, S.Pd',
    roomNumber: 'Ruang 01',
    className: '7',
    students: buildGroupStudents('oral_grp_03_nurul', [
      'Muhammad Nabiel Alqarani',
      'Sela Mutia Nur Azimah',
      'Shirin Fatina Jasmin',
      'Siti Nadipatul Mala',
      "Sya'datun Nisa",
      'Tasya Nurasri Setiawan',
      'Viodora Shakila Nur Zafira',
      'Zahrofal Maula',
      'Ratu Siti Maghfiroh',
      'Siti Hana',
    ]),
  },
  {
    id: 'oral_grp_04_widianingsih',
    examinerName: 'Widianingsih, S.Si',
    roomNumber: 'Ruang 02',
    className: '8A',
    students: buildGroupStudents('oral_grp_04_widianingsih', [
      'Amanda Hasna Mirza',
      'Bilqis Ainunnisa',
      'Caskia Aprilian',
      'Kirana Aura Anwarudin',
      'Najwa Nur Fadillah',
      'Natasya Kholifah',
      'Radisti Putri Riyanti',
      'Riska Liana Hakim',
      'Santika',
      'Siti Rukoyah',
      'Suci Rahmawati',
      'Tasyira Afifah',
      'Wanda Indriani',
      'Yola Aulia',
      'Yuna Handayani',
    ]),
  },
  {
    id: 'oral_grp_05_iqbal',
    examinerName: 'Muhamad Iqbal Gutiawan, S.Pd',
    roomNumber: 'Ruang 04',
    className: '8B',
    students: buildGroupStudents('oral_grp_05_iqbal', [
      'Abila Yazid Rizaki',
      'Adrian Putra Nugraha',
      'Afnan Syakir Azzakwan',
      'Fakih Sirojul Mufthi',
      'Fardan Hanif',
      'Fauzi Fadilah',
      'Ferdiansyah',
      'Leonel Putra Pratama',
      'Luthfi Aditia',
      'M. Akbar Nurrizki',
      'M. Firdaus Akbar',
      'M. Gibran Al Habsyi',
      'M. Khoirul Azam',
      'M. Raka Aditia',
      'Marvhel Putra Ihsanul Alim',
    ]),
  },
  {
    id: 'oral_grp_06_dafa',
    examinerName: 'Dafa Maulana, S.Pd',
    roomNumber: 'Ruang 04',
    className: '8B',
    students: buildGroupStudents('oral_grp_06_dafa', [
      'Muhammad Adwa al Fatah',
      'Muhammad Alfajri',
      'Muhammad Galih Hakiki',
      'Muhammad Hafidz Tri H',
      'Muhammad Ilham Azzikra',
      'Muhammad Kahril Zibran',
      'Muhammad Mussyaf Ikramuddin',
      'Muhammad Rizal Pratama',
      'Muhammad Ziban al Abror',
      'Nafil Khairil',
      'Romadhoni',
      'Satria Aqilla Purnama',
      'Syahrul Fauzan',
      'Yusuf Saputra',
      'Muhamad Nazriel Adha',
    ]),
  },
  {
    id: 'oral_grp_07_mira',
    examinerName: 'Mira Nurdianti, S.Pd',
    roomNumber: 'Ruang 03',
    className: '9A',
    students: buildGroupStudents('oral_grp_07_mira', [
      'Adelia Zafirah Bilqiz',
      'Ajeng Alifatul Khoir',
      'Alika Sayla Indriliawan',
      'Amanda Sinta Rahman',
      'Azzahra Ashila Rohmah',
      'Beryl Callysta Al Vina',
      'Fuji Hikmah',
      'Najwa Putri Az Zahwa',
      'Nasywa Auliul Kamilah',
      'Nenden Sekar Arum',
    ]),
  },
  {
    id: 'oral_grp_08_septi',
    examinerName: 'Septi Nur Aeni, S.E',
    roomNumber: 'Ruang 03',
    className: '9A',
    students: buildGroupStudents('oral_grp_08_septi', [
      'Putri Hafsoh Rabani',
      'Rahma Nur Alipah',
      'Refna Napisa',
      'Reni Keyla',
      'Salwa Nailatul Putri',
      'Septi Mujianti',
      'Sifa Nurkhalifah',
      'Siti Najwa Al Zajira',
      'Syarifa Lutfiana',
      'Tiya Apriyani',
    ]),
  },
  {
    id: 'oral_grp_09_ridho',
    examinerName: 'Ridho Maulana Alfarizi',
    roomNumber: 'Ruang 05',
    className: '9B',
    students: buildGroupStudents('oral_grp_09_ridho', [
      'Andika Pratama',
      'Ariiq Safwaan Al Barraq',
      'Azpia Mauludin Ilham',
      'Fairuz Prasetya',
      'Fariz Abqori Maulana',
      'Fitra Ramadhan',
      'M. Azka Pratama',
      'Muhamad Ainul Yaqin',
      'Muhamad Alfin',
      'Muhamad Saepul Amri',
      'Muhamad Sandi Alfatih',
      'Muhammad Akmalludin Maulana',
    ]),
  },
  {
    id: 'oral_grp_10_mawar',
    examinerName: 'Mawar Andinia, S.Pd',
    roomNumber: 'Ruang 05',
    className: '9B',
    students: buildGroupStudents('oral_grp_10_mawar', [
      'Muhammad Aqiel Ardhabilly',
      'Muhamad Nurdin',
      'Muhamad Rafa',
      'Muhammad Raffa Julyana. R',
      'Muhammad Revan Al-Asqolani',
      'Muhammad Syahrul Adi Putra',
      'Nazrul Ilham',
      'Ridho Permana',
      'Sonaji',
      'Syarif Alamsyah',
      'Wildan Khoer Basuki',
      'Yugata Ramadhan',
    ]),
  },
  {
    id: 'oral_grp_11_asrof',
    examinerName: 'Qodiatul Asrof Ramadoni, S.E',
    roomNumber: 'Ruang SMA',
    className: 'SMA',
    students: buildGroupStudents('oral_grp_11_asrof', [
      'Arnesta Hadiwinata',
      'Muhamad Tahfidz',
      'Nazwatunnisa',
      'Quennesa Sabaniah Haryani',
      'Siti Nurasiah',
      'Hayatussifa',
      'Nur Azizah Sobihah',
      'Nihawanda Nadzira',
      'Eviana',
      'Fadli Adriansyah',
      'Fahira Mutiara Asyfa',
      'Zakii Ahmad Alfaridzi',
      'Intan Cahyani Putri Azzahra',
    ]),
  },
  {
    id: 'oral_grp_12_farhan',
    examinerName: 'Ust. Farhan Sopian Sahid, S.Pd.I',
    roomNumber: 'Ruang SMA',
    className: 'SMA',
    students: buildGroupStudents('oral_grp_12_farhan', [
      'M. Fazril Faturrahman',
      'M. Rizki Zaelani',
      'M. Sayyid Agil',
      'Mutiara',
      'Putri Wieke Deprianti',
      'Sandra Putri',
      'Winarsih Trinafiska Putri',
      'Awulia Solihatun Zahwa',
      'Nyimas Rani Rahmawati',
      'Kessya Syifaur Rohmah',
      'Silfia Riani',
    ]),
  },
];

const normalizeExaminerPersonName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/^(ust\.?|ibu|bapak|pak|bu)\s+/i, '')
    .split(',')[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPersonNameMatch = (nameA: string, nameB: string): boolean => {
  const normA = normalizeExaminerPersonName(nameA);
  const normB = normalizeExaminerPersonName(nameB);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
    return true;
  }
  const tokensA = normA.split(' ').filter((t) => t.length >= 3);
  const tokensB = normB.split(' ').filter((t) => t.length >= 3);
  const matched = tokensA.filter((ta) =>
    tokensB.some((tb) => tb === ta || (ta.length >= 5 && tb.length >= 5 && ta.slice(0, 5) === tb.slice(0, 5)))
  );
  return matched.length >= 2;
};

/**
 * Mencocokkan nama guru yang sedang login dengan salah satu dari 12 kelompok penguji resmi.
 */
export function findMatchingOfficialOralGroup(
  userName?: string | null
): OfficialOralExamGroup | null {
  if (!userName || !userName.trim()) return null;
  for (const grp of ORAL_EXAM_OFFICIAL_GROUPS) {
    if (isPersonNameMatch(grp.examinerName, userName)) {
      return grp;
    }
  }
  return null;
}

/**
 * Menghasilkan daftar penugasan penguji bawaan dari 12 kelompok resmi sekolah.
 */
export function getDefaultOralExamAssignments(academicYear: string = '2026/2027'): OralExamAssignment[] {
  const nowIso = new Date().toISOString();
  return ORAL_EXAM_OFFICIAL_GROUPS.map((grp) => ({
    id: grp.id,
    examinerUserId: null,
    examinerName: grp.examinerName,
    examinerNpp: null,
    roomNumber: grp.roomNumber,
    className: grp.className,
    examTracks: ['BAHASA', 'BTQ'],
    bahasaScope: 'ENGLISH_ONLY',
    btqScope: 'BOTH',
    students: grp.students.map((st) => ({
      studentId: st.studentId,
      studentName: st.studentName,
      className: grp.className,
    })),
    academicYear,
    isActive: true,
    updatedAt: nowIso,
  }));
}

/**
 * Mencari seluruh penugasan penguji ujian lisan milik guru yang sedang login.
 * Memprioritaskan kecocokan ID user (jika Admin menautkan akun), lalu kecocokan nama penguji.
 */
export function findAssignmentsForTeacher(
  assignments: OralExamAssignment[],
  user?: Pick<UserProfile, 'id' | 'full_name'> | null
): OralExamAssignment[] {
  if (!user) return [];
  const active = assignments.filter((a) => a && a.isActive !== false);
  return active.filter((a) => {
    if (a.examinerUserId && user.id && a.examinerUserId === user.id) {
      return true;
    }
    if (!a.examinerUserId && user.full_name) {
      return isPersonNameMatch(a.examinerName, user.full_name);
    }
    // Jika examinerUserId ditautkan ke akun lain yang berbeda ID, pastikan tidak bocor;
    // namun bila nama persis sama & id belum diisi, tetap cocokkan
    if (a.examinerUserId && user.id && a.examinerUserId !== user.id) {
      return false;
    }
    return false;
  });
}
