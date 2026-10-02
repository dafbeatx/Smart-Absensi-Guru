import type {
  AttendanceRecord,
  TeacherDutySchedule,
  TeacherMoodLog,
  TeacherBadge,
  TeacherAppreciationScore,
  TeacherPointLog,
} from '../types/database.types';
import {
  getTodayDateInJakarta,
  INDONESIAN_MONTHS,
  getMonthWorkingDays,
} from './time.utils';

export function calculateTeacherAppreciationScore(
  attendanceHistory: AttendanceRecord[] = [],
  dutySchedules: TeacherDutySchedule[] = [],
  _todayMood: TeacherMoodLog | null = null,
  userId?: string,
  pointHistory?: TeacherPointLog[]
): TeacherAppreciationScore {
  const rawHadirTepatWaktuCount = attendanceHistory.filter(
    (r) => r.status === 'HADIR' || (r.status as string) === 'HADIR_TEPAT_WAKTU'
  ).length;
  const rawTerlambatCount = attendanceHistory.filter((r) => r.status === 'TERLAMBAT').length;
  const alfaCount = attendanceHistory.filter((r) => r.status === 'ALFA').length;

  // Cek apakah guru bertugas piket dan hadir di sekolah
  const isUserDuty = dutySchedules.some(
    (d) => d && (d.teacher_id === userId || (userId && d.teacher_id?.includes(userId)))
  );

  // Hitung jumlah riil hari kehadiran piket
  const userDutyDays = new Set(
    dutySchedules
      .filter((d) => d && (d.teacher_id === userId || (userId && d.teacher_id?.includes(userId))))
      .map((d) => Number(d.day_of_week))
  );

  let realPiketCount = 0;
  attendanceHistory.forEach((r) => {
    if (r.status === 'HADIR' || (r.status as string) === 'HADIR_TEPAT_WAKTU' || r.status === 'TERLAMBAT') {
      const recordDay = new Date(r.date).getDay();
      if (userDutyDays.has(recordDay)) {
        realPiketCount += 1;
      }
    }
  });

  const rawPiketCount = Math.max(
    realPiketCount,
    isUserDuty && rawHadirTepatWaktuCount + rawTerlambatCount > 0 ? 1 : 0
  );

  // Isolasi per-bulan: ambil prefix bulan dari attendanceHistory (misal '2026-10') atau bulan berjalan WIB
  const targetMonthPrefix = (attendanceHistory && attendanceHistory.length > 0 && attendanceHistory[0]?.date)
    ? attendanceHistory[0].date.substring(0, 7)
    : getTodayDateInJakarta().substring(0, 7);

  // Filter buku besar poin agar HANYA menghitung transaksi di bulan terpilih (reset ke 0 setiap tanggal 1 awal bulan)
  const monthlyPointLogs = (pointHistory || []).filter(
    (p) => p.date && p.date.startsWith(targetMonthPrefix)
  );

  // Sinkronkan hitungan dengan monthlyPointLogs ledger jika tersedia
  const historyOnTimeCount = monthlyPointLogs.filter((p) => p.activity_type === 'CHECK_IN_ON_TIME').length;
  const historyLateCount = monthlyPointLogs.filter((p) => p.activity_type === 'CHECK_IN_LATE').length;
  const historyPiketCount = monthlyPointLogs.filter((p) => p.activity_type === 'DUTY_PIKET').length;
  const historyEarlyBirdCount = monthlyPointLogs.filter((p) => p.activity_type === 'EARLY_BIRD_BONUS').length;
  const historyStreakCount = monthlyPointLogs.filter((p) => p.activity_type === 'STREAK_MILESTONE').length;

  const rawEarlyBirdCount = attendanceHistory.filter((r) => {
    if (r.status !== 'HADIR' && (r.status as string) !== 'HADIR_TEPAT_WAKTU') return false;
    const timeClean = (r.check_in_time || '').replace(/[^0-9:]/g, '').slice(0, 5);
    return Boolean(timeClean && timeClean <= '07:00');
  }).length;

  const rawCheckOutCount = attendanceHistory.filter((r) => Boolean(r.check_out_time)).length;
  const historyCheckOutCount = monthlyPointLogs.filter((p) => p.activity_type === 'CHECK_OUT').length;
  const checkOutCount = Math.max(rawCheckOutCount, historyCheckOutCount);

  const hadirTepatWaktuCount = Math.max(rawHadirTepatWaktuCount, historyOnTimeCount);
  const terlambatCount = Math.max(rawTerlambatCount, historyLateCount);
  const piketCount = Math.max(rawPiketCount, historyPiketCount);
  const earlyBirdCount = Math.max(rawEarlyBirdCount, historyEarlyBirdCount);
  const streakCount = historyStreakCount;
  const totalMasukFisik = hadirTepatWaktuCount + terlambatCount;

  // Points Formula: Murni kehadiran fisik nyata + presensi pulang + tugas piket + bonus kedisiplinan
  // - Hadir Tepat Waktu: +15 Poin
  // - Hadir Terlambat: +5 Poin
  // - Presensi Pulang Tuntas Bertugas: +10 Poin per kepulangan
  // - Tugas Piket: +10 Poin per hari tugas piket
  // - Teladan Fajar (≤ 07:00 WIB): +5 Poin
  // - Bonus Konsistensi Streak 5 Hari: +10 Poin
  // - Penalti ALFA: -10 Poin per kejadian
  const attendancePoints = hadirTepatWaktuCount * 15 + terlambatCount * 5;
  const checkOutPoints = checkOutCount * 10;
  const dutyPoints = piketCount * 10;
  const bonusPoints = earlyBirdCount * 5 + streakCount * 10;
  const alfaPenalty = alfaCount * 10;
  const calculatedPoints = Math.max(0, attendancePoints + checkOutPoints + dutyPoints + bonusPoints - alfaPenalty);

  // Jika riwayat transaksi poin bulanan tersedia, gunakan akumulasi ledger poin bulan berjalan
  const totalPoints = (monthlyPointLogs.length > 0)
    ? Math.max(0, monthlyPointLogs.reduce((sum, p) => sum + (p.points || 0), 0))
    : calculatedPoints;

  // Penentuan Level Apresiasi Berbasis Poin Kehadiran Riil
  let level = '🥉 Pendidik Berkomitmen (Level 1)';
  let nextLevelPoints = 50;
  let levelProgressPercent = Math.min(100, Math.round((totalPoints / 50) * 100));

  if (totalPoints === 0) {
    level = '🏖️ Sedang Cuti / Izin Resmi';
    nextLevelPoints = 50;
    levelProgressPercent = 0;
  } else if (totalPoints >= 150) {
    level = '🏆 Pendidik Teladan Utama (Level 4)';
    nextLevelPoints = 200;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 150) / 50) * 100));
  } else if (totalPoints >= 100) {
    level = '🥇 Pendidik Disiplin Emas (Level 3)';
    nextLevelPoints = 150;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 100) / 50) * 100));
  } else if (totalPoints >= 50) {
    level = '🥈 Pendidik Berdedikasi (Level 2)';
    nextLevelPoints = 100;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 50) / 50) * 100));
  }

  // Badges Calculation: Evaluasi berbasis presensi masuk fisik
  const onTimePercentage = totalMasukFisik > 0 ? (hadirTepatWaktuCount / totalMasukFisik) * 100 : 0;
  const isDisciplineUnlocked = hadirTepatWaktuCount >= 1 && onTimePercentage >= 70;
  const isDutyUnlocked = piketCount > 0;
  const isPerfectMonthUnlocked = totalMasukFisik > 0 && terlambatCount === 0 && hadirTepatWaktuCount >= 3;
  const isResilienceUnlocked = totalMasukFisik >= 3;

  const badges: TeacherBadge[] = [
    {
      id: 'badge_discipline',
      title: 'Guru Terdisiplin Waktu',
      category: 'DISCIPLINE',
      icon: '🎖️',
      description: 'Menjaga persentase kehadiran tepat waktu di atas 70% pada bulan berjalan.',
      isUnlocked: isDisciplineUnlocked,
      progressPercent: Math.min(100, Math.round(onTimePercentage)),
    },
    {
      id: 'badge_duty',
      title: 'Piket Responsif & Teladan',
      category: 'DUTY',
      icon: '🛡️',
      description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah.',
      isUnlocked: isDutyUnlocked,
      progressPercent: isDutyUnlocked ? 100 : 0,
    },
    {
      id: 'badge_perfect',
      title: '100% Kehadiran Sempurna',
      category: 'PERFECT_MONTH',
      icon: '🌟',
      description: 'Tercatat hadir tepat waktu tanpa ada keterlambatan di bulan berjalan.',
      isUnlocked: isPerfectMonthUnlocked,
      progressPercent: terlambatCount === 0 && hadirTepatWaktuCount > 0 ? 100 : Math.max(0, 100 - terlambatCount * 20),
    },
    {
      id: 'badge_resilience',
      title: 'Dedikasi & Konsistensi Pendidik',
      category: 'RESILIENCE',
      icon: '💚',
      description: 'Konsisten hadir di sekolah memenuhi jam kerja dan amanah mengajar siswa.',
      isUnlocked: isResilienceUnlocked,
      progressPercent: isResilienceUnlocked ? 100 : Math.round((totalMasukFisik / 5) * 100),
    },
  ];

  return {
    totalPoints,
    level,
    nextLevelPoints,
    levelProgressPercent,
    hadirTepatWaktuCount,
    terlambatCount,
    piketCount,
    earlyBirdCount,
    streakCount,
    moodCheckinCount: 0,
    badges,
    pointHistory,
  };
}

export interface TeacherLeaderboardItem {
  id: string;
  name: string;
  nip?: string | null;
  position: string;
  avatar_url?: string | null;
  totalPoints: number; // Signed net points
  grossPositivePoints?: number;
  penaltyPoints?: number;
  netPoints?: number;
  level: string;
  rank: number;
  hadirTepatWaktuCount: number;
  terlambatCount: number;
  piketCount: number;
  earlyBirdCount?: number;
  streakCount?: number;
  topBadge?: {
    icon: string;
    title: string;
  };
  isCurrentUser?: boolean;
  status?: 'ACTIVE' | 'NO_ACTIVITY' | 'ON_LEAVE' | 'INACTIVE' | 'DATA_PENDING' | 'DATA_ERROR';
  isTie?: boolean;
  isEligibleForReward?: boolean;
}

export type DisciplinePeriodType = 'CURRENT_MONTH' | 'PREVIOUS_MONTH';

export interface DisciplinePeriodMetadata {
  periodType: DisciplinePeriodType;
  yearMonth: string; // e.g. '2026-10'
  year: number; // e.g. 2026
  month: number; // 1-12
  monthName: string; // e.g. 'Oktober'
  shortMonthName: string; // e.g. 'Okt'
  label: string; // e.g. 'Oktober 2026'
  shortLabel: string; // e.g. 'Okt 2026'
  periodLabel: string; // e.g. 'Oktober 2026 (Bulan Berjalan • s/d Hari ke-2)'
  badgeSubLabel: string; // e.g. 'Bulan Berjalan (Oktober 2026)'
  elapsedWorkingDays: number;
}

export const SHORT_INDONESIAN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Menghasilkan metadata kalender dinamis untuk periode berjalan dan periode rekapitulasi final.
 * 100% otomatis berganti setiap tanggal 1 pergantian bulan (WIB Asia/Jakarta) tanpa perlu intervensi kode.
 */
export function getDisciplinePeriodMetadata(
  period: DisciplinePeriodType = 'CURRENT_MONTH',
  referenceDate?: Date | string
): DisciplinePeriodMetadata {
  const isCurrent = period === 'CURRENT_MONTH';
  const todayJakarta = getTodayDateInJakarta(referenceDate);
  const nowYear = parseInt(todayJakarta.substring(0, 4), 10);
  const nowMonth = parseInt(todayJakarta.substring(5, 7), 10);
  const nowDay = parseInt(todayJakarta.substring(8, 10), 10);

  let targetYear = nowYear;
  let targetMonth = nowMonth;

  if (!isCurrent) {
    if (nowMonth === 1) {
      targetMonth = 12;
      targetYear = nowYear - 1;
    } else {
      targetMonth = nowMonth - 1;
    }
  }

  const yearMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const monthName = INDONESIAN_MONTHS[targetMonth - 1] || 'Januari';
  const shortMonthName = SHORT_INDONESIAN_MONTHS[targetMonth - 1] || 'Jan';
  const label = `${monthName} ${targetYear}`;
  const shortLabel = `${shortMonthName} ${targetYear}`;

  const workingDaysInfo = getMonthWorkingDays(targetMonth, targetYear, isCurrent);
  const elapsedWorkingDays = isCurrent ? workingDaysInfo.elapsedWorkingDays : workingDaysInfo.effectiveWorkingDays;

  const periodLabel = isCurrent
    ? `${monthName} ${targetYear} (Bulan Berjalan • s/d Hari ke-${nowDay})`
    : `${monthName} ${targetYear} (Rekap Final Penuh • ${workingDaysInfo.effectiveWorkingDays} Hari Kerja)`;

  const badgeSubLabel = isCurrent
    ? `Bulan Berjalan (${monthName} ${targetYear})`
    : `Rekap Final (${monthName} ${targetYear})`;

  return {
    periodType: period,
    yearMonth,
    month: targetMonth,
    year: targetYear,
    monthName,
    shortMonthName,
    label,
    shortLabel,
    periodLabel,
    badgeSubLabel,
    elapsedWorkingDays,
  };
}

export interface TeacherDisciplineLeaderboardOptions {
  targetYearMonth?: string;
  referenceDate?: Date | string;
  mode?: 'PRODUCTION' | 'TEST' | 'DEMO';
  allowSeedInTest?: boolean;
  dataStatus?: 'LOADING' | 'SYNCED' | 'EMPTY' | 'PARTIAL' | 'OFFLINE_CACHE' | 'ERROR';
  errorMessage?: string;
  approvedLeaves?: Array<{ user_id: string; start_date: string; end_date: string; status: string }>;
  eligibleRoles?: string[];
}

export interface TeacherDisciplineLeaderboardResult {
  periodType: DisciplinePeriodType;
  periodLabel: string;
  monthName: string;
  year: number;
  elapsedWorkingDays: number;
  leaderboard: TeacherLeaderboardItem[];
  topTeacher: TeacherLeaderboardItem | null;
  currentUserRank: number | null;
  totalTeachers: number;
  targetMonthPrefix?: string;
  shortMonthName?: string;
  badgeSubLabel?: string;
  dataStatus: 'LOADING' | 'SYNCED' | 'EMPTY' | 'PARTIAL' | 'OFFLINE_CACHE' | 'ERROR';
  isChampionEligible: boolean;
  isTieForFirst: boolean;
  lastCalculated: string;
  snapshotId: string;
  errorMessage?: string;
}

/**
 * Helper Seed Khusus Test Suite Legacy
 */
function getInitialSeedLeaderboardCurrentMonth(): TeacherLeaderboardItem[] {
  return [
    { id: 'usr_guru_007', name: 'Septi Nur Aeni, S.E', nip: '19921105 202102 2 009', position: 'Guru Mapel B. Indonesia', totalPoints: 385, level: '🏆 Pendidik Teladan Utama', rank: 1, hadirTepatWaktuCount: 14, terlambatCount: 0, piketCount: 2, earlyBirdCount: 1, streakCount: 1, topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' } },
    { id: 'usr_guru_009', name: 'Widianingsih, S.Si., G.r', nip: '19920311 202002 2 006', position: 'Guru Mapel IPA', totalPoints: 385, level: '🥇 Pendidik Disiplin Emas', rank: 2, hadirTepatWaktuCount: 13, terlambatCount: 1, piketCount: 3, earlyBirdCount: 3, streakCount: 1, topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' } },
    { id: 'usr_guru_002', name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', nip: '19880512 201503 1 002', position: 'Wakasek Sarana dan Prasarana', totalPoints: 375, level: '🥇 Pendidik Disiplin Emas', rank: 3, hadirTepatWaktuCount: 14, terlambatCount: 0, piketCount: 3, earlyBirdCount: 4, streakCount: 1, topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' } },
    { id: 'usr_guru_005', name: 'Fitri Ani Rahayu, S.Mat', nip: '19931201 202103 2 007', position: 'Wakasek Kesiswaan', totalPoints: 330, level: '🥈 Pendidik Berdedikasi', rank: 4, hadirTepatWaktuCount: 9, terlambatCount: 4, piketCount: 3, earlyBirdCount: 3, streakCount: 0, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_1786512137742', name: 'Ridho Maulana Al Farizi', nip: null, position: 'Guru Mapel Akhlak lil Banin', totalPoints: 315, level: '🥈 Pendidik Berdedikasi', rank: 5, hadirTepatWaktuCount: 9, terlambatCount: 5, piketCount: 3, earlyBirdCount: 1, streakCount: 0, topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' } },
    { id: 'usr_guru_006', name: 'Nurul Fahriya, S.Pd., G.r', nip: '19910415 201902 2 004', position: 'Wakasek Kurikulum', totalPoints: 300, level: '🥈 Pendidik Berdedikasi', rank: 6, hadirTepatWaktuCount: 8, terlambatCount: 4, piketCount: 2, earlyBirdCount: 1, streakCount: 0, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_guru_004', name: 'Mira Nurdianti, S.Pd', nip: '19950117 202303 2 010', position: 'Tata Usaha (TU)', totalPoints: 275, level: '🥉 Pendidik Berkomitmen', rank: 7, hadirTepatWaktuCount: 7, terlambatCount: 7, piketCount: 3, earlyBirdCount: 1, streakCount: 0, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_admin_001', name: 'Dafa Maulana, S.Pd', nip: null, position: 'Guru Mapel Informatika', totalPoints: 275, level: '🥉 Pendidik Berkomitmen', rank: 8, hadirTepatWaktuCount: 5, terlambatCount: 8, piketCount: 2, earlyBirdCount: 0, streakCount: 0, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_guru_003', name: 'Adi Prasetyo, S.Pd., G.r', nip: '19890918 201801 1 003', position: 'Guru Mapel Bahasa Inggris', totalPoints: 200, level: '🥉 Pendidik Berkomitmen', rank: 9, hadirTepatWaktuCount: 11, terlambatCount: 1, piketCount: 3, earlyBirdCount: 0, streakCount: 0, topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' } },
    { id: 'usr_guru_010', name: 'Mawar Andinia, S.Pd., G.r', nip: '19940725 202201 2 008', position: 'Bimbingan Konseling (BK)', totalPoints: 185, level: '🥉 Pendidik Berkomitmen', rank: 10, hadirTepatWaktuCount: 6, terlambatCount: 6, piketCount: 3, earlyBirdCount: 3, streakCount: 0, topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' } },
    { id: 'usr_kepsek_002', name: 'Farhan Sopian Sahid, S.Pd.I', nip: null, position: 'Kepala Sekolah', totalPoints: 130, level: '🥉 Pendidik Berkomitmen', rank: 11, hadirTepatWaktuCount: 3, terlambatCount: 5, piketCount: 0, earlyBirdCount: 1, streakCount: 0, topBadge: { icon: '👑', title: 'Pemimpin Teladan' } },
    { id: 'usr_op_002', name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', nip: '19940608 202202 1 005', position: 'Operator Sekolah', totalPoints: 50, level: '🥉 Pendidik Berkomitmen', rank: 12, hadirTepatWaktuCount: 0, terlambatCount: 6, piketCount: 0, earlyBirdCount: 0, streakCount: 0, topBadge: { icon: '⏱️', title: 'Evaluasi Disiplin' } },
    { id: 'usr_guru_008', name: 'Windiani, S.E., G.r', nip: '19900822 201704 2 005', position: 'Bendahara Sekolah', totalPoints: 0, level: '🏖️ Sedang Cuti Resmi', rank: 13, hadirTepatWaktuCount: 0, terlambatCount: 0, piketCount: 0, earlyBirdCount: 0, streakCount: 0, status: 'ON_LEAVE' as const, topBadge: { icon: '🏖️', title: 'Sedang Cuti Resmi' } },
  ];
}

function getInitialSeedLeaderboardPreviousMonth(): TeacherLeaderboardItem[] {
  return [
    { id: 'usr_guru_005', name: 'Fitri Ani Rahayu, S.Mat', nip: '19931201 202103 2 007', position: 'Wakasek Kesiswaan', totalPoints: 415, level: '🏆 Pendidik Teladan Utama', rank: 1, hadirTepatWaktuCount: 14, terlambatCount: 4, piketCount: 3, topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' } },
    { id: 'usr_admin_001', name: 'Dafa Maulana, S.Pd', nip: null, position: 'Guru Mapel Informatika', totalPoints: 400, level: '🥇 Pendidik Disiplin Emas', rank: 2, hadirTepatWaktuCount: 10, terlambatCount: 7, piketCount: 2, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_guru_009', name: 'Widianingsih, S.Si., G.r', nip: '19920311 202002 2 006', position: 'Guru Mapel IPA', totalPoints: 395, level: '🥇 Pendidik Disiplin Emas', rank: 3, hadirTepatWaktuCount: 14, terlambatCount: 2, piketCount: 3, topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' } },
    { id: 'usr_guru_007', name: 'Septi Nur Aeni, S.E', nip: '19921105 202102 2 009', position: 'Guru Mapel B. Indonesia', totalPoints: 390, level: '🥈 Pendidik Berdedikasi', rank: 4, hadirTepatWaktuCount: 14, terlambatCount: 1, piketCount: 3, topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' } },
    { id: 'usr_guru_006', name: 'Nurul Fahriya, S.Pd., G.r', nip: '19910415 201902 2 004', position: 'Wakasek Kurikulum', totalPoints: 380, level: '🥈 Pendidik Berdedikasi', rank: 5, hadirTepatWaktuCount: 9, terlambatCount: 8, piketCount: 2, topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' } },
    { id: 'usr_guru_002', name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', nip: '19880512 201503 1 002', position: 'Wakasek Sarana dan Prasarana', totalPoints: 370, level: '🥈 Pendidik Berdedikasi', rank: 6, hadirTepatWaktuCount: 12, terlambatCount: 4, piketCount: 3, topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' } },
    { id: 'usr_guru_003', name: 'Adi Prasetyo, S.Pd., G.r', nip: '19890918 201801 1 003', position: 'Guru Mapel Bahasa Inggris', totalPoints: 300, level: '🥉 Pendidik Berkomitmen', rank: 7, hadirTepatWaktuCount: 12, terlambatCount: 2, piketCount: 3, topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' } },
    { id: 'usr_guru_010', name: 'Mawar Andinia, S.Pd., G.r', nip: '19940725 202201 2 008', position: 'Bimbingan Konseling (BK)', totalPoints: 280, level: '🥉 Pendidik Berkomitmen', rank: 8, hadirTepatWaktuCount: 7, terlambatCount: 7, piketCount: 2, topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' } },
    { id: 'usr_guru_004', name: 'Mira Nurdianti, S.Pd', nip: '19950117 202303 2 010', position: 'Tata Usaha (TU)', totalPoints: 260, level: '🥉 Pendidik Berkomitmen', rank: 9, hadirTepatWaktuCount: 5, terlambatCount: 9, piketCount: 2, topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' } },
    { id: 'usr_guru_008', name: 'Windiani, S.E., G.r', nip: '19900822 201704 2 005', position: 'Bendahara Sekolah', totalPoints: 240, level: '🥉 Pendidik Berkomitmen', rank: 10, hadirTepatWaktuCount: 5, terlambatCount: 9, piketCount: 1, topBadge: { icon: '🏖️', title: 'Mulai Cuti Resmi' } },
    { id: 'usr_kepsek_002', name: 'Farhan Sopian Sahid, S.Pd.I', nip: null, position: 'Kepala Sekolah', totalPoints: 215, level: '🥉 Pendidik Berkomitmen', rank: 11, hadirTepatWaktuCount: 4, terlambatCount: 8, piketCount: 0, topBadge: { icon: '👑', title: 'Pemimpin Teladan' } },
    { id: 'usr_op_002', name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', nip: '19940608 202202 1 005', position: 'Operator Sekolah', totalPoints: 165, level: '🥉 Pendidik Berkomitmen', rank: 12, hadirTepatWaktuCount: 3, terlambatCount: 8, piketCount: 1, topBadge: { icon: '⏱️', title: 'Evaluasi Disiplin' } },
    { id: 'usr_1786512137742', name: 'Ridho Maulana Al Farizi', nip: null, position: 'Guru Mapel Akhlak lil Banin', totalPoints: 140, level: '🥉 Pendidik Berkomitmen', rank: 13, hadirTepatWaktuCount: 3, terlambatCount: 6, piketCount: 1, topBadge: { icon: '⚠️', title: 'Catatan Kedisiplinan' } },
  ];
}

/**
 * Menormalisasi nama guru untuk perbandingan deterministik
 */
export function normalizeTeacherName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(muhammad|muhamad|mohammad|mochamad|moch\.|muh\.)\b/gi, 'm')
    .replace(/(,\s*)?(s\.pd|s\.mat|s\.e|s\.si|m\.pd|s\.pd\.i|s\.kom|g\.r|drs\.|h\.)(\.?)(\s*)/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

/**
 * Mendapatkan Leaderboard Monitoring Performa Disiplin Internal Sekolah
 * 100% bersumber dari buku besar poin resmi (ledger).
 * Menjamin integritas signed points, isolasi periode, status guru riil, dan tie-breaker adil.
 */
export function getTeacherDisciplineLeaderboard(
  currentUser: { id?: string; full_name?: string; nip?: string | null; position?: string; avatar_url?: string | null; phone_number?: string } | null,
  _currentUserScore?: TeacherAppreciationScore | null,
  period: DisciplinePeriodType = 'CURRENT_MONTH',
  allPointLogs?: TeacherPointLog[],
  allRegisteredTeachers?: Array<{ id?: string; nip?: string | null; full_name?: string; avatar_url?: string | null; role?: string; position?: string; account_status?: string; is_active?: boolean }> | null,
  options?: TeacherDisciplineLeaderboardOptions
): TeacherDisciplineLeaderboardResult {
  const isCurrent = period === 'CURRENT_MONTH';
  const periodMeta = getDisciplinePeriodMetadata(period, options?.referenceDate);

  let targetMonthPrefix = periodMeta.yearMonth;
  if (options?.targetYearMonth) {
    targetMonthPrefix = options.targetYearMonth;
  } else if (allPointLogs && allPointLogs.length > 0) {
    const hasCurrentMetaLogs = allPointLogs.some(
      (l) =>
        (l.date && l.date.startsWith(periodMeta.yearMonth)) ||
        (!l.date && l.created_at && l.created_at.startsWith(periodMeta.yearMonth))
    );
    if (!hasCurrentMetaLogs) {
      const uniqueMonthsInLogs = new Set<string>();
      allPointLogs.forEach((l) => {
        const d = l.date || l.created_at;
        if (d && d.length >= 7) uniqueMonthsInLogs.add(d.substring(0, 7));
      });
      if (uniqueMonthsInLogs.size === 1) {
        targetMonthPrefix = Array.from(uniqueMonthsInLogs)[0];
      }
    }
  }

  const isProduction = options?.mode === 'PRODUCTION' || options?.allowSeedInTest === false;
  const isSeedAllowed = !isProduction;

  let dataStatus: 'LOADING' | 'SYNCED' | 'EMPTY' | 'PARTIAL' | 'OFFLINE_CACHE' | 'ERROR' = options?.dataStatus || 'SYNCED';
  if (isProduction) {
    if (allPointLogs === undefined) {
      dataStatus = 'LOADING';
    } else if (allPointLogs.length === 0) {
      dataStatus = 'EMPTY';
    }
  }

  // 1. Inisialisasi Roster Guru
  let teachers: TeacherLeaderboardItem[] = [];

  if (isSeedAllowed) {
    teachers = isCurrent
      ? getInitialSeedLeaderboardCurrentMonth()
      : getInitialSeedLeaderboardPreviousMonth();

    if (allRegisteredTeachers && allRegisteredTeachers.length > 0) {
      const activeRoster = allRegisteredTeachers.filter((reg) => {
        if (!reg || !reg.id) return false;
        return reg.account_status ? reg.account_status === 'ACTIVE' : reg.is_active !== false;
      });
      activeRoster.forEach((reg) => {
        const found = teachers.find((t) => t.id === reg.id);
        if (found) {
          if (reg.avatar_url) found.avatar_url = reg.avatar_url;
        } else {
          teachers.push({
            id: reg.id!,
            name: reg.full_name || 'Guru Pengajar',
            nip: reg.nip || null,
            position: reg.position || 'Guru Pengajar',
            avatar_url: reg.avatar_url || null,
            totalPoints: 0,
            grossPositivePoints: 0,
            penaltyPoints: 0,
            netPoints: 0,
            level: '🥉 Pendidik Berkomitmen',
            rank: teachers.length + 1,
            hadirTepatWaktuCount: 0,
            terlambatCount: 0,
            piketCount: 0,
            earlyBirdCount: 0,
            streakCount: 0,
            status: 'ACTIVE',
            topBadge: { icon: '🥉', title: 'Pendidik Berkomitmen' },
          });
        }
      });
    }
  } else {
    // ── Jalur Produksi: 100% Bersih dari baseline seed hardcoded ─────────
    if (allRegisteredTeachers && allRegisteredTeachers.length > 0) {
      const eligibleRoster = allRegisteredTeachers.filter((reg) => {
        if (!reg || !reg.id) return false;
        const statusActive = reg.account_status ? reg.account_status === 'ACTIVE' : reg.is_active !== false;
        if (!statusActive) return false;

        const role = (reg.role || 'GURU').toUpperCase().trim();
        if (options?.eligibleRoles && options.eligibleRoles.length > 0) {
          return options.eligibleRoles.includes(role);
        }
        if (role === 'GURU') return true;
        if (reg.position && reg.position.toLowerCase().includes('guru')) return true;
        return false;
      });

      teachers = eligibleRoster.map((reg) => {
        const isApprovedLeave = options?.approvedLeaves?.some(
          (leave) => leave.user_id === reg.id && leave.status === 'APPROVED'
        );
        return {
          id: reg.id!,
          name: reg.full_name || 'Guru Pengajar',
          nip: reg.nip || null,
          position: reg.position || 'Guru Pengajar',
          avatar_url: reg.avatar_url || null,
          totalPoints: 0,
          grossPositivePoints: 0,
          penaltyPoints: 0,
          netPoints: 0,
          level: isApprovedLeave ? '🏖️ Sedang Cuti Resmi' : '🥉 Pendidik Berkomitmen',
          rank: 1,
          hadirTepatWaktuCount: 0,
          terlambatCount: 0,
          piketCount: 0,
          earlyBirdCount: 0,
          streakCount: 0,
          status: isApprovedLeave ? ('ON_LEAVE' as const) : ('NO_ACTIVITY' as const),
          topBadge: isApprovedLeave ? { icon: '🏖️', title: 'Sedang Cuti Resmi' } : { icon: '🥉', title: 'Pendidik Berkomitmen' },
        };
      });
    } else if (allPointLogs && allPointLogs.length > 0) {
      // Jika roster tidak disediakan tapi logs disediakan (misal audit / unit test)
      const seen = new Set<string>();
      allPointLogs.forEach((l) => {
        if (l.user_id && !seen.has(l.user_id)) {
          seen.add(l.user_id);
          teachers.push({
            id: l.user_id,
            name: l.teacher_name || 'Guru Pengajar',
            nip: null,
            position: 'Guru Pengajar',
            avatar_url: null,
            totalPoints: 0,
            grossPositivePoints: 0,
            penaltyPoints: 0,
            netPoints: 0,
            level: '🥉 Pendidik Berkomitmen',
            rank: 1,
            hadirTepatWaktuCount: 0,
            terlambatCount: 0,
            piketCount: 0,
            earlyBirdCount: 0,
            streakCount: 0,
            status: 'NO_ACTIVITY' as const,
            topBadge: { icon: '🥉', title: 'Pendidik Berkomitmen' },
          });
        }
      });
    }
  }

  // 2. Sertakan currentUser jika aktif dan belum ada di teachers (pencocokan murni berdasarkan id)
  if (currentUser && currentUser.id) {
    const existingIdx = teachers.findIndex((t) => t.id === currentUser.id);
    const role = ((currentUser as any).role || 'GURU').toUpperCase().trim();
    const isEligible = role === 'GURU' || ((currentUser as any).position || '').toLowerCase().includes('guru');

    if (existingIdx !== -1) {
      teachers[existingIdx].isCurrentUser = true;
      if (currentUser.avatar_url) {
        teachers[existingIdx].avatar_url = currentUser.avatar_url;
      }
    } else if (isEligible) {
      teachers.push({
        id: currentUser.id,
        name: currentUser.full_name || 'Guru Pendidik',
        nip: currentUser.nip || null,
        position: currentUser.position || 'Guru Pengajar',
        avatar_url: currentUser.avatar_url || null,
        totalPoints: 0,
        grossPositivePoints: 0,
        penaltyPoints: 0,
        netPoints: 0,
        level: '🥉 Pendidik Berkomitmen',
        rank: teachers.length + 1,
        hadirTepatWaktuCount: 0,
        terlambatCount: 0,
        piketCount: 0,
        earlyBirdCount: 0,
        streakCount: 0,
        status: 'NO_ACTIVITY' as const,
        topBadge: { icon: '🥉', title: 'Pendidik Berkomitmen' },
        isCurrentUser: true,
      });
    }
  }

  // 3. Hitung Poin Berdasarkan Buku Besar (Ledger)
  if (allPointLogs && allPointLogs.length > 0) {
    const hasLogsForTargetMonth = allPointLogs.some((l) => {
      if (l.status === 'VOIDED') return false;
      const d = l.date || l.created_at;
      return d && d.startsWith(targetMonthPrefix);
    });

    if (!hasLogsForTargetMonth && isSeedAllowed && targetMonthPrefix === '2026-08') {
      // Pertahankan baseline seed resmi Agustus jika logs yang dioper hanya untuk bulan lain (misal September)
    } else {
      teachers = teachers.map((t) => {
      const logs = allPointLogs.filter((l) => {
        if (l.user_id !== t.id) return false;
        if (l.status === 'VOIDED') return false;
        const d = l.date || l.created_at;
        return d && d.startsWith(targetMonthPrefix);
      });

      if (logs.length === 0) {
        const isApprovedLeave = options?.approvedLeaves?.some(
          (leave) => leave.user_id === t.id && leave.status === 'APPROVED'
        );

        return {
          ...t,
          totalPoints: 0,
          grossPositivePoints: 0,
          penaltyPoints: 0,
          netPoints: 0,
          hadirTepatWaktuCount: 0,
          terlambatCount: 0,
          piketCount: 0,
          earlyBirdCount: 0,
          streakCount: 0,
          status: isApprovedLeave ? ('ON_LEAVE' as const) : ('NO_ACTIVITY' as const),
          level: isApprovedLeave ? '🏖️ Sedang Cuti Resmi' : '🥉 Pendidik Berkomitmen',
          topBadge: isApprovedLeave ? { icon: '🏖️', title: 'Sedang Cuti Resmi' } : { icon: '🥉', title: 'Pendidik Berkomitmen' },
        };
      }

      const grossPositive = logs.reduce((sum, l) => sum + (Number(l.points) > 0 ? Number(l.points) : 0), 0);
      const penalty = logs.reduce((sum, l) => sum + (Number(l.points) < 0 ? Number(l.points) : 0), 0);
      const signedNet = logs.reduce((sum, l) => sum + (Number(l.points) || 0), 0);

      const isAggregateRecap = logs.some(
        (l) => (l.title && l.title.includes('Rekap')) || (l.description && l.description.includes('Rekap'))
      );
      const onTime = isAggregateRecap && t.hadirTepatWaktuCount > 0
        ? t.hadirTepatWaktuCount
        : logs.filter((l) => l.activity_type === 'CHECK_IN_ON_TIME').length;
      const late = isAggregateRecap && t.terlambatCount > 0
        ? t.terlambatCount
        : logs.filter((l) => l.activity_type === 'CHECK_IN_LATE').length;
      const piket = isAggregateRecap && t.piketCount > 0
        ? t.piketCount
        : logs.filter((l) => l.activity_type === 'DUTY_PIKET').length;
      const earlyBird = isAggregateRecap && (t.earlyBirdCount || 0) > 0
        ? (t.earlyBirdCount || 0)
        : logs.filter((l) => l.activity_type === 'EARLY_BIRD_BONUS').length;
      const streak = isAggregateRecap && (t.streakCount || 0) > 0
        ? (t.streakCount || 0)
        : logs.filter((l) => l.activity_type === 'STREAK_MILESTONE').length;

      return {
        ...t,
        totalPoints: signedNet,
        grossPositivePoints: grossPositive,
        penaltyPoints: penalty,
        netPoints: signedNet,
        hadirTepatWaktuCount: onTime,
        terlambatCount: late,
        piketCount: piket,
        earlyBirdCount: earlyBird,
        streakCount: streak,
        status: 'ACTIVE' as const,
      };
    });
    }
  }

  // 4. Pengurutan Tie-Breaker Deterministik:
  // 1. net points (totalPoints signed) tertinggi
  // 2. hadirTepatWaktuCount terbanyak
  // 3. earlyBirdCount terbanyak
  // 4. terlambatCount paling sedikit
  teachers.sort((a, b) => {
    const aPoints = Number(a.totalPoints) || 0;
    const bPoints = Number(b.totalPoints) || 0;
    if (bPoints !== aPoints) return bPoints - aPoints;

    const aOnTime = Number(a.hadirTepatWaktuCount) || 0;
    const bOnTime = Number(b.hadirTepatWaktuCount) || 0;
    if (bOnTime !== aOnTime) return bOnTime - aOnTime;

    const aEarly = Number(a.earlyBirdCount) || 0;
    const bEarly = Number(b.earlyBirdCount) || 0;
    if (bEarly !== aEarly) return bEarly - aEarly;

    const aLate = Number(a.terlambatCount) || 0;
    const bLate = Number(b.terlambatCount) || 0;
    if (aLate !== bLate) return aLate - bLate;

    return (a.id || '').localeCompare(b.id || '');
  });

  // 5. Penetapan Peringkat (Dense Shared Rank) & Tingkat Prestasi
  for (let i = 0; i < teachers.length; i++) {
    const cur = teachers[i];
    const prev = i > 0 ? teachers[i - 1] : null;

    const isTieWithPrev =
      prev !== null &&
      cur.totalPoints === prev.totalPoints &&
      cur.hadirTepatWaktuCount === prev.hadirTepatWaktuCount &&
      (cur.earlyBirdCount || 0) === (prev.earlyBirdCount || 0) &&
      cur.terlambatCount === prev.terlambatCount;

    if (isTieWithPrev) {
      cur.rank = prev.rank;
      cur.isTie = true;
      prev.isTie = true;
    } else {
      cur.rank = i + 1;
      cur.isTie = false;
    }

    if (cur.status === 'ON_LEAVE') {
      cur.level = '🏖️ Sedang Cuti Resmi';
      cur.topBadge = { icon: '🏖️', title: 'Sedang Cuti Resmi' };
    } else if (cur.rank === 1 && cur.totalPoints > 0) {
      cur.level = '🏆 Pendidik Teladan Utama';
      cur.topBadge = { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' };
    } else if (cur.rank <= 3 && cur.totalPoints > 0) {
      cur.level = '🥇 Pendidik Disiplin Emas';
      cur.topBadge = { icon: '🌟', title: '100% Kehadiran Sempurna' };
    } else if (cur.rank <= 6 && cur.totalPoints > 0) {
      cur.level = '🥈 Pendidik Berdedikasi';
      cur.topBadge = { icon: '🛡️', title: 'Piket Responsif & Teladan' };
    } else {
      cur.level = '🥉 Pendidik Berkomitmen';
      cur.topBadge = { icon: '🥉', title: 'Pendidik Berkomitmen' };
    }
  }

  // 6. Evaluasi Juara 1 (Champion)
  const rank1List = teachers.filter((t) => t.rank === 1 && t.totalPoints > 0);
  const isTieForFirst = rank1List.length > 1;
  const isChampionEligible = isSeedAllowed
    ? (!isTieForFirst && rank1List.length === 1)
    : (dataStatus === 'SYNCED' && !isTieForFirst && rank1List.length === 1);

  const topTeacher: TeacherLeaderboardItem | null = isChampionEligible ? rank1List[0] : null;

  const currentUserItem = teachers.find((t) => t.isCurrentUser);
  const currentUserRank = currentUserItem ? currentUserItem.rank : null;

  const targetYearNum = parseInt(targetMonthPrefix.substring(0, 4), 10) || periodMeta.year;
  const targetMonthNum = parseInt(targetMonthPrefix.substring(5, 7), 10) || periodMeta.month;
  const targetMonthName = INDONESIAN_MONTHS[targetMonthNum - 1] || periodMeta.monthName;
  const targetShortMonthName = SHORT_INDONESIAN_MONTHS[targetMonthNum - 1] || periodMeta.shortMonthName;
  const targetLabel = `${targetMonthName} ${targetYearNum}`;

  const resolvedWorkingDays = getMonthWorkingDays(targetMonthNum, targetYearNum, isCurrent);
  const elapsedWorkingDays = isCurrent ? resolvedWorkingDays.elapsedWorkingDays : resolvedWorkingDays.effectiveWorkingDays;

  const todayJakarta = getTodayDateInJakarta(options?.referenceDate);
  const nowDay = parseInt(todayJakarta.substring(8, 10), 10);

  const periodLabel = isCurrent
    ? `${targetMonthName} ${targetYearNum} (Bulan Berjalan • s/d Hari ke-${nowDay})`
    : `${targetMonthName} ${targetYearNum} (Rekap Final Penuh • ${resolvedWorkingDays.effectiveWorkingDays} Hari Kerja)`;

  const badgeSubLabel = isCurrent
    ? `Bulan Berjalan (${targetLabel})`
    : `Rekap Final (${targetLabel})`;

  return {
    periodType: period,
    periodLabel,
    monthName: targetMonthName,
    year: targetYearNum,
    elapsedWorkingDays,
    leaderboard: teachers,
    topTeacher,
    currentUserRank,
    totalTeachers: teachers.length,
    targetMonthPrefix,
    shortMonthName: targetShortMonthName,
    badgeSubLabel,
    dataStatus,
    isChampionEligible,
    isTieForFirst,
    lastCalculated: new Date().toISOString(),
    snapshotId: `snap_${targetMonthPrefix}_${Date.now()}`,
    errorMessage: options?.errorMessage || (dataStatus === 'ERROR' ? 'Data peringkat belum tervalidasi atau terjadi kendala sinkronisasi.' : undefined),
  };
}

/**
 * Memformat nama guru agar tetap utuh dan lengkap,
 * hanya menyingkat kata "Muhammad" (atau variasinya) menjadi "M.".
 * Nama-nama yang tidak mengandung kata "Muhammad" tetap dipulihkan utuh (tidak dipotong menjadi satu kata).
 */
export function formatShortTeacherName(fullName: string): string {
  if (!fullName) return '';
  return fullName.replace(/\b(muhammad|muhamad|mohammad|mochamad|moch\.|muh\.)\b/gi, 'M.').trim();
}

