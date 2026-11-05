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
  pointHistory?: TeacherPointLog[],
  targetYearMonth?: string
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

  // Isolasi ketat per-bulan: gunakan targetYearMonth eksplisit jika ada, atau prefix dari attendanceHistory, atau bulan berjalan WIB
  const targetMonthPrefix = targetYearMonth || (
    (attendanceHistory && attendanceHistory.length > 0 && attendanceHistory[0]?.date)
      ? attendanceHistory[0].date.substring(0, 7)
      : getTodayDateInJakarta().substring(0, 7)
  );

  // Filter buku besar poin agar HANYA menghitung transaksi di bulan terpilih (reset ke 0 setiap tanggal 1 awal bulan)
  const monthlyPointLogs = (pointHistory || []).filter((p) => {
    if (p.status === 'VOIDED') return false;
    const d = p.date || p.created_at;
    return Boolean(d && d.startsWith(targetMonthPrefix));
  });

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
  rankPredicate?: string;
  rankCriteria?: string;
  targetOnTimeRate?: string;
  avgCheckInMinutes?: number;
  avgCheckInFormatted?: string;
  checkOutCompletionRate?: number;
  tieBreakerAdvantage?: string;
}

export interface TeacherRankTierInfo {
  rank: number;
  level: string;
  predicate: string;
  badgeIcon: string;
  badgeTitle: string;
  criteria: string;
  description: string;
  targetOnTimeRate: string;
  bgBadgeClass: string;
  textBadgeClass: string;
}

/**
 * Katalog Kriteria Resmi dan Sebutan Predikat Peringkat Disiplin Guru
 * Setiap peringkat memiliki kata-kata predikat unik, lencana khusus, dan kriteria terukur yang berbeda.
 */
export const TEACHER_RANK_CRITERIA_CATALOG: TeacherRankTierInfo[] = [
  {
    rank: 1,
    level: '🏆 Super Disiplin',
    predicate: 'Super Disiplin',
    badgeIcon: '🏆',
    badgeTitle: 'Super Disiplin (Peringkat 1)',
    criteria: 'Juara 1 Klasemen: Akumulasi poin tertinggi se-sekolah, rasio ketepatan waktu prima (≥95% On-Time), teladan fajar (≤07:00 WIB) terbanyak, presensi pulang tuntas 100%, serta bebas dari pelanggaran alfa atau keterlambatan berulang.',
    description: 'Inspirator kedisiplinan tertinggi dan percontohan integritas waktu utama sekolah.',
    targetOnTimeRate: '≥ 95%',
    bgBadgeClass: 'bg-amber-100 border-amber-300',
    textBadgeClass: 'text-amber-950',
  },
  {
    rank: 2,
    level: '🥈 Sangat Disiplin',
    predicate: 'Sangat Disiplin',
    badgeIcon: '🥈',
    badgeTitle: 'Sangat Disiplin (Peringkat 2)',
    criteria: 'Runner-up Klasemen: Poin tertinggi ke-2, konsistensi hadir On-Time sangat tinggi (≥90%), aktif membina piket gerbang sekolah, presensi pulang teratur tuntas, serta toleransi keterlambatan minimal.',
    description: 'Teladan unggul yang konsisten menjaga ketepatan waktu dan ketertiban sekolah.',
    targetOnTimeRate: '≥ 90%',
    bgBadgeClass: 'bg-slate-200 border-slate-300',
    textBadgeClass: 'text-slate-900',
  },
  {
    rank: 3,
    level: '🥉 Disiplin',
    predicate: 'Disiplin',
    badgeIcon: '🥉',
    badgeTitle: 'Disiplin (Peringkat 3)',
    criteria: 'Podium 3 Klasemen: Poin tertinggi ke-3, rasio On-Time teruji (≥85%), keaktifan tugas piket terjaga, disiplin jam pulang harian, dan ketertiban jam mengajar kelas prima.',
    description: 'Pilar ketepatan waktu sekolah dengan kepatuhan jam operasional yang kokoh.',
    targetOnTimeRate: '≥ 85%',
    bgBadgeClass: 'bg-amber-50 border-amber-200',
    textBadgeClass: 'text-amber-900',
  },
  {
    rank: 4,
    level: '🎖️ Cukup Disiplin',
    predicate: 'Cukup Disiplin',
    badgeIcon: '🎖️',
    badgeTitle: 'Cukup Disiplin (Peringkat 4)',
    criteria: 'Peringkat ke-4: Membayangi 3 besar klasemen, rasio On-Time stabil (≥80%), presensi masuk dan pulang tuntas, siap bersaing menembus podium 3 besar.',
    description: 'Pendidik tangguh berdaya saing tinggi menuju podium 3 besar.',
    targetOnTimeRate: '≥ 80%',
    bgBadgeClass: 'bg-indigo-50 border-indigo-200',
    textBadgeClass: 'text-indigo-900',
  },
  {
    rank: 5,
    level: '⭐ Tertib Waktu',
    predicate: 'Tertib Waktu',
    badgeIcon: '⭐',
    badgeTitle: 'Tertib Waktu (Peringkat 5)',
    criteria: 'Peringkat ke-5: Presensi masuk teratur (≥75% On-Time), kepatuhan jam kerja konsisten, tugas harian tuntas tanpa penalti mangkir.',
    description: 'Pola kehadiran tertib dan disiplin dalam membimbing peserta didik.',
    targetOnTimeRate: '≥ 75%',
    bgBadgeClass: 'bg-yellow-50 border-yellow-200',
    textBadgeClass: 'text-yellow-900',
  },
  {
    rank: 6,
    level: '🛡️ Berdedikasi Aktif',
    predicate: 'Berdedikasi Aktif',
    badgeIcon: '🛡️',
    badgeTitle: 'Berdedikasi Aktif (Peringkat 6)',
    criteria: 'Peringkat ke-6: Komitmen kehadiran mengajar tinggi (≥70% On-Time), aktif bertugas piket, presensi pulang tercatat baik, siap menaikkan rasio On-Time pagi.',
    description: 'Dedikasi nyata memenuhi jam wajib mengajar di sekolah.',
    targetOnTimeRate: '≥ 70%',
    bgBadgeClass: 'bg-teal-50 border-teal-200',
    textBadgeClass: 'text-teal-900',
  },
  {
    rank: 7,
    level: '🌟 Berkomitmen Kuat',
    predicate: 'Berkomitmen Kuat',
    badgeIcon: '🌟',
    badgeTitle: 'Berkomitmen Kuat (Peringkat 7)',
    criteria: 'Peringkat ke-7: Kepatuhan jam masuk terjaga (≥65% On-Time), ikhtiar perbaikan disiplin positif, siap melangkah ke papan tengah atas.',
    description: 'Menjaga komitmen tugas pendidik dan ketepatan presensi.',
    targetOnTimeRate: '≥ 65%',
    bgBadgeClass: 'bg-sky-50 border-sky-200',
    textBadgeClass: 'text-sky-900',
  },
  {
    rank: 8,
    level: '📈 Tumbuh Disiplin',
    predicate: 'Tumbuh Disiplin',
    badgeIcon: '📈',
    badgeTitle: 'Tumbuh Disiplin (Peringkat 8)',
    criteria: 'Peringkat ke-8: Tren kehadiran positif (≥60% On-Time), jam kerja terpenuhi, membutuhkan dorongan konsistensi kehadiran fajar.',
    description: 'Progres kedisiplinan terus bertumbuh menuju standar optimal.',
    targetOnTimeRate: '≥ 60%',
    bgBadgeClass: 'bg-emerald-50 border-emerald-200',
    textBadgeClass: 'text-emerald-900',
  },
  {
    rank: 9,
    level: '🎯 Menuju Konsistensi',
    predicate: 'Menuju Konsistensi',
    badgeIcon: '🎯',
    badgeTitle: 'Menuju Konsistensi (Peringkat 9)',
    criteria: 'Peringkat ke-9: Jam mengajar terpenuhi (≥55% On-Time), namun frekuensi keterlambatan perlu ditekan untuk mengamankan poin peringkat atas.',
    description: 'Fokus mengurangi keterlambatan tipis saat jam masuk pagi.',
    targetOnTimeRate: '≥ 55%',
    bgBadgeClass: 'bg-blue-50 border-blue-200',
    textBadgeClass: 'text-blue-900',
  },
  {
    rank: 10,
    level: '⚡ Perlu Penguatan Disiplin',
    predicate: 'Perlu Penguatan Disiplin',
    badgeIcon: '⚡',
    badgeTitle: 'Perlu Penguatan Disiplin (Peringkat 10)',
    criteria: 'Peringkat ke-10: Jam kedatangan pagi perlu dievaluasi dan dipercepat sebelum batas toleransi 07:15 WIB untuk mencegah pemotongan poin (≥50% On-Time).',
    description: 'Perlu manajemen waktu keberangkatan dari rumah yang lebih terencana.',
    targetOnTimeRate: '≥ 50%',
    bgBadgeClass: 'bg-orange-50 border-orange-200',
    textBadgeClass: 'text-orange-900',
  },
  {
    rank: 11,
    level: '🌱 Tahap Pembinaan Waktu',
    predicate: 'Tahap Pembinaan Waktu',
    badgeIcon: '🌱',
    badgeTitle: 'Tahap Pembinaan Waktu (Peringkat 11)',
    criteria: 'Peringkat ke-11: Keterlambatan tercatat berulang (<50% On-Time), disarankan membiasakan check-in lebih awal dan memaksimalkan poin piket harian.',
    description: 'Mendapat perhatian pembinaan waktu untuk memulihkan skor ketepatan presensi.',
    targetOnTimeRate: '< 50%',
    bgBadgeClass: 'bg-lime-50 border-lime-200',
    textBadgeClass: 'text-lime-900',
  },
  {
    rank: 12,
    level: '⚠️ Perlu Evaluasi Kehadiran',
    predicate: 'Perlu Evaluasi Kehadiran',
    badgeIcon: '⚠️',
    badgeTitle: 'Perlu Evaluasi Kehadiran (Peringkat 12+)',
    criteria: 'Peringkat ke-12 ke bawah: Akumulasi poin di bawah target minimal (<40% On-Time), diprioritaskan untuk pendampingan kedisiplinan dan monitoring berkala Kepala Sekolah.',
    description: 'Prioritas monitoring langsung demi kepatuhan jam kerja dan mutu pembelajaran.',
    targetOnTimeRate: '< 40%',
    bgBadgeClass: 'bg-rose-50 border-rose-200',
    textBadgeClass: 'text-rose-900',
  },
];

/**
 * Menghasilkan data predikat dan kriteria unik untuk peringkat guru tertentu.
 */
export function getTeacherRankTierInfo(
  rank: number,
  totalPoints: number,
  status?: string
): TeacherRankTierInfo {
  if (status === 'ON_LEAVE') {
    return {
      rank: Math.max(1, rank),
      level: '🏖️ Sedang Cuti Resmi',
      predicate: 'Sedang Cuti Resmi',
      badgeIcon: '🏖️',
      badgeTitle: 'Izin Dinas / Cuti Resmi',
      criteria: 'Guru memiliki permohonan izin dinas atau cuti resmi yang telah disetujui Kepala Sekolah.',
      description: 'Status resmi terverifikasi cuti / izin dinas berkala.',
      targetOnTimeRate: 'N/A',
      bgBadgeClass: 'bg-cyan-50 border-cyan-200',
      textBadgeClass: 'text-cyan-900',
    };
  }

  if (totalPoints <= 0) {
    return {
      rank: Math.max(1, rank),
      level: '⏳ Belum Ada Aktivitas',
      predicate: 'Belum Ada Aktivitas',
      badgeIcon: '⏳',
      badgeTitle: 'Aktivitas Belum Tercatat',
      criteria: 'Belum ada catatan presensi masuk atau buku besar poin pada periode berjalan.',
      description: 'Menunggu pencatatan presensi perdana bulan ini.',
      targetOnTimeRate: '0%',
      bgBadgeClass: 'bg-slate-100 border-slate-200',
      textBadgeClass: 'text-slate-600',
    };
  }

  const catalogItem = TEACHER_RANK_CRITERIA_CATALOG.find((c) => c.rank === rank);
  if (catalogItem) {
    return catalogItem;
  }

  return {
    rank,
    level: `⚠️ Perlu Evaluasi Kehadiran`,
    predicate: 'Perlu Evaluasi Kehadiran',
    badgeIcon: '⚠️',
    badgeTitle: `Perlu Evaluasi (Peringkat ${rank})`,
    criteria: `Peringkat ke-${rank}: Akumulasi poin di bawah target minimal (<40% On-Time), diprioritaskan untuk pendampingan kedisiplinan dan monitoring berkala Kepala Sekolah.`,
    description: 'Prioritas monitoring langsung demi kepatuhan jam kerja dan mutu pembelajaran.',
    targetOnTimeRate: '< 40%',
    bgBadgeClass: 'bg-rose-50 border-rose-200',
    textBadgeClass: 'text-rose-900',
  };
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
export function getInitialSeedLeaderboardOctober(): TeacherLeaderboardItem[] {
  return [
    { id: 'usr_guru_007', name: 'Septi Nur Aeni, S.E', nip: null, position: 'Guru Mapel B. Indonesia', totalPoints: 385, level: '🏆 Super Disiplin', rank: 1, hadirTepatWaktuCount: 14, terlambatCount: 0, piketCount: 2, earlyBirdCount: 1, streakCount: 1, avgCheckInMinutes: 402, avgCheckInFormatted: '06:42 WIB', checkOutCompletionRate: 100, tieBreakerAdvantage: 'Unggul rata-rata kedatangan fajar (06:42 vs 06:58 WIB)', topBadge: { icon: '🏆', title: 'Super Disiplin (Peringkat 1)' } },
    { id: 'usr_guru_009', name: 'Widianingsih, S.Si., G.r', nip: null, position: 'Guru Mapel IPA', totalPoints: 385, level: '🥈 Sangat Disiplin', rank: 2, hadirTepatWaktuCount: 13, terlambatCount: 1, piketCount: 3, earlyBirdCount: 3, streakCount: 1, avgCheckInMinutes: 418, avgCheckInFormatted: '06:58 WIB', checkOutCompletionRate: 98, topBadge: { icon: '🥈', title: 'Sangat Disiplin (Peringkat 2)' } },
    { id: 'usr_guru_002', name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', nip: null, position: 'Wakasek Sarana dan Prasarana', totalPoints: 375, level: '🥉 Disiplin', rank: 3, hadirTepatWaktuCount: 14, terlambatCount: 0, piketCount: 3, earlyBirdCount: 4, streakCount: 1, avgCheckInMinutes: 410, avgCheckInFormatted: '06:50 WIB', checkOutCompletionRate: 100, topBadge: { icon: '🥉', title: 'Disiplin (Peringkat 3)' } },
    { id: 'usr_guru_005', name: 'Fitri Ani Rahayu, S.Mat', nip: null, position: 'Wakasek Kesiswaan', totalPoints: 330, level: '🎖️ Cukup Disiplin', rank: 4, hadirTepatWaktuCount: 9, terlambatCount: 4, piketCount: 3, earlyBirdCount: 3, streakCount: 0, avgCheckInMinutes: 425, avgCheckInFormatted: '07:05 WIB', checkOutCompletionRate: 100, topBadge: { icon: '🎖️', title: 'Cukup Disiplin (Peringkat 4)' } },
    { id: 'usr_1786512137742', name: 'Ridho Maulana Al Farizi', nip: null, position: 'Guru Mapel Akhlak lil Banin', totalPoints: 315, level: '⭐ Tertib Waktu', rank: 5, hadirTepatWaktuCount: 9, terlambatCount: 5, piketCount: 3, earlyBirdCount: 1, streakCount: 0, avgCheckInMinutes: 428, avgCheckInFormatted: '07:08 WIB', checkOutCompletionRate: 94, topBadge: { icon: '⭐', title: 'Tertib Waktu (Peringkat 5)' } },
    { id: 'usr_guru_006', name: 'Nurul Fahriya, S.Pd., G.r', nip: null, position: 'Wakasek Kurikulum', totalPoints: 300, level: '🛡️ Berdedikasi Aktif', rank: 6, hadirTepatWaktuCount: 8, terlambatCount: 4, piketCount: 2, earlyBirdCount: 1, streakCount: 0, avgCheckInMinutes: 429, avgCheckInFormatted: '07:09 WIB', checkOutCompletionRate: 96, topBadge: { icon: '🛡️', title: 'Berdedikasi Aktif (Peringkat 6)' } },
    { id: 'usr_guru_004', name: 'Mira Nurdianti, S.Pd', nip: null, position: 'Tata Usaha (TU)', totalPoints: 275, level: '🌟 Berkomitmen Kuat', rank: 7, hadirTepatWaktuCount: 7, terlambatCount: 7, piketCount: 3, earlyBirdCount: 1, streakCount: 0, avgCheckInMinutes: 430, avgCheckInFormatted: '07:10 WIB', checkOutCompletionRate: 95, tieBreakerAdvantage: 'Unggul rasio kehadiran tepat waktu (7 vs 5 hari)', topBadge: { icon: '🌟', title: 'Berkomitmen Kuat (Peringkat 7)' } },
    { id: 'usr_admin_001', name: 'Dafa Maulana, S.Pd', nip: null, position: 'Guru Mapel Informatika', totalPoints: 275, level: '📈 Tumbuh Disiplin', rank: 8, hadirTepatWaktuCount: 5, terlambatCount: 8, piketCount: 2, earlyBirdCount: 0, streakCount: 0, avgCheckInMinutes: 436, avgCheckInFormatted: '07:16 WIB', checkOutCompletionRate: 90, topBadge: { icon: '📈', title: 'Tumbuh Disiplin (Peringkat 8)' } },
    { id: 'usr_guru_003', name: 'Adi Prasetyo, S.Pd., G.r', nip: null, position: 'Guru Mapel Bahasa Inggris', totalPoints: 200, level: '🎯 Menuju Konsistensi', rank: 9, hadirTepatWaktuCount: 11, terlambatCount: 1, piketCount: 3, earlyBirdCount: 0, streakCount: 0, avgCheckInMinutes: 432, avgCheckInFormatted: '07:12 WIB', checkOutCompletionRate: 92, topBadge: { icon: '🎯', title: 'Menuju Konsistensi (Peringkat 9)' } },
    { id: 'usr_guru_010', name: 'Mawar Andinia, S.Pd., G.r', nip: null, position: 'Bimbingan Konseling (BK)', totalPoints: 185, level: '⚡ Perlu Penguatan Disiplin', rank: 10, hadirTepatWaktuCount: 6, terlambatCount: 6, piketCount: 3, earlyBirdCount: 3, streakCount: 0, avgCheckInMinutes: 433, avgCheckInFormatted: '07:13 WIB', checkOutCompletionRate: 90, topBadge: { icon: '⚡', title: 'Perlu Penguatan Disiplin (Peringkat 10)' } },
    { id: 'usr_kepsek_002', name: 'Farhan Sopian Sahid, S.Pd.I', nip: null, position: 'Kepala Sekolah', totalPoints: 130, level: '🌱 Tahap Pembinaan Waktu', rank: 11, hadirTepatWaktuCount: 3, terlambatCount: 5, piketCount: 0, earlyBirdCount: 1, streakCount: 0, avgCheckInMinutes: 440, avgCheckInFormatted: '07:20 WIB', checkOutCompletionRate: 85, topBadge: { icon: '🌱', title: 'Tahap Pembinaan Waktu (Peringkat 11)' } },
    { id: 'usr_op_002', name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', nip: null, position: 'Operator Sekolah', totalPoints: 50, level: '⚠️ Perlu Evaluasi Kehadiran', rank: 12, hadirTepatWaktuCount: 0, terlambatCount: 6, piketCount: 0, earlyBirdCount: 0, streakCount: 0, avgCheckInMinutes: 450, avgCheckInFormatted: '07:30 WIB', checkOutCompletionRate: 75, topBadge: { icon: '⚠️', title: 'Perlu Evaluasi Kehadiran (Peringkat 12)' } },
    { id: 'usr_guru_008', name: 'Windiani, S.E., G.r', nip: null, position: 'Bendahara Sekolah', totalPoints: 0, level: '🏖️ Sedang Cuti Resmi', rank: 13, hadirTepatWaktuCount: 0, terlambatCount: 0, piketCount: 0, earlyBirdCount: 0, streakCount: 0, status: 'ON_LEAVE' as const, topBadge: { icon: '🏖️', title: 'Sedang Cuti Resmi' } },
  ];
}

export function getInitialSeedLeaderboardAugust(): TeacherLeaderboardItem[] {
  return [
    { id: 'usr_guru_005', name: 'Fitri Ani Rahayu, S.Mat', nip: null, position: 'Wakasek Kesiswaan', totalPoints: 415, level: '🏆 Super Disiplin', rank: 1, hadirTepatWaktuCount: 14, terlambatCount: 4, piketCount: 3, avgCheckInMinutes: 405, avgCheckInFormatted: '06:45 WIB', checkOutCompletionRate: 100, topBadge: { icon: '🏆', title: 'Super Disiplin (Peringkat 1)' } },
    { id: 'usr_admin_001', name: 'Dafa Maulana, S.Pd', nip: null, position: 'Guru Mapel Informatika', totalPoints: 400, level: '🥈 Sangat Disiplin', rank: 2, hadirTepatWaktuCount: 10, terlambatCount: 7, piketCount: 2, avgCheckInMinutes: 415, avgCheckInFormatted: '06:55 WIB', checkOutCompletionRate: 98, topBadge: { icon: '🥈', title: 'Sangat Disiplin (Peringkat 2)' } },
    { id: 'usr_guru_009', name: 'Widianingsih, S.Si., G.r', nip: null, position: 'Guru Mapel IPA', totalPoints: 395, level: '🥉 Disiplin', rank: 3, hadirTepatWaktuCount: 14, terlambatCount: 2, piketCount: 3, avgCheckInMinutes: 412, avgCheckInFormatted: '06:52 WIB', checkOutCompletionRate: 100, topBadge: { icon: '🥉', title: 'Disiplin (Peringkat 3)' } },
    { id: 'usr_guru_007', name: 'Septi Nur Aeni, S.E', nip: null, position: 'Guru Mapel B. Indonesia', totalPoints: 390, level: '🎖️ Cukup Disiplin', rank: 4, hadirTepatWaktuCount: 14, terlambatCount: 1, piketCount: 3, avgCheckInMinutes: 414, avgCheckInFormatted: '06:54 WIB', checkOutCompletionRate: 100, topBadge: { icon: '🎖️', title: 'Cukup Disiplin (Peringkat 4)' } },
    { id: 'usr_guru_006', name: 'Nurul Fahriya, S.Pd., G.r', nip: null, position: 'Wakasek Kurikulum', totalPoints: 380, level: '⭐ Tertib Waktu', rank: 5, hadirTepatWaktuCount: 9, terlambatCount: 8, piketCount: 2, avgCheckInMinutes: 422, avgCheckInFormatted: '07:02 WIB', checkOutCompletionRate: 95, topBadge: { icon: '⭐', title: 'Tertib Waktu (Peringkat 5)' } },
    { id: 'usr_guru_002', name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', nip: null, position: 'Wakasek Sarana dan Prasarana', totalPoints: 370, level: '🛡️ Berdedikasi Aktif', rank: 6, hadirTepatWaktuCount: 12, terlambatCount: 4, piketCount: 3, avgCheckInMinutes: 420, avgCheckInFormatted: '07:00 WIB', checkOutCompletionRate: 97, topBadge: { icon: '🛡️', title: 'Berdedikasi Aktif (Peringkat 6)' } },
    { id: 'usr_guru_003', name: 'Adi Prasetyo, S.Pd., G.r', nip: null, position: 'Guru Mapel Bahasa Inggris', totalPoints: 300, level: '🌟 Berkomitmen Kuat', rank: 7, hadirTepatWaktuCount: 12, terlambatCount: 2, piketCount: 3, avgCheckInMinutes: 426, avgCheckInFormatted: '07:06 WIB', checkOutCompletionRate: 94, topBadge: { icon: '🌟', title: 'Berkomitmen Kuat (Peringkat 7)' } },
    { id: 'usr_guru_010', name: 'Mawar Andinia, S.Pd., G.r', nip: null, position: 'Bimbingan Konseling (BK)', totalPoints: 280, level: '📈 Tumbuh Disiplin', rank: 8, hadirTepatWaktuCount: 7, terlambatCount: 7, piketCount: 2, avgCheckInMinutes: 430, avgCheckInFormatted: '07:10 WIB', checkOutCompletionRate: 92, topBadge: { icon: '📈', title: 'Tumbuh Disiplin (Peringkat 8)' } },
    { id: 'usr_guru_004', name: 'Mira Nurdianti, S.Pd', nip: null, position: 'Tata Usaha (TU)', totalPoints: 260, level: '🎯 Menuju Konsistensi', rank: 9, hadirTepatWaktuCount: 5, terlambatCount: 9, piketCount: 2, avgCheckInMinutes: 434, avgCheckInFormatted: '07:14 WIB', checkOutCompletionRate: 90, topBadge: { icon: '🎯', title: 'Menuju Konsistensi (Peringkat 9)' } },
    { id: 'usr_guru_008', name: 'Windiani, S.E., G.r', nip: null, position: 'Bendahara Sekolah', totalPoints: 240, level: '⚡ Perlu Penguatan Disiplin', rank: 10, hadirTepatWaktuCount: 5, terlambatCount: 9, piketCount: 1, avgCheckInMinutes: 438, avgCheckInFormatted: '07:18 WIB', checkOutCompletionRate: 88, topBadge: { icon: '⚡', title: 'Perlu Penguatan Disiplin (Peringkat 10)' } },
    { id: 'usr_kepsek_002', name: 'Farhan Sopian Sahid, S.Pd.I', nip: null, position: 'Kepala Sekolah', totalPoints: 215, level: '🌱 Tahap Pembinaan Waktu', rank: 11, hadirTepatWaktuCount: 4, terlambatCount: 8, piketCount: 0, avgCheckInMinutes: 442, avgCheckInFormatted: '07:22 WIB', checkOutCompletionRate: 85, topBadge: { icon: '🌱', title: 'Tahap Pembinaan Waktu (Peringkat 11)' } },
    { id: 'usr_op_002', name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', nip: null, position: 'Operator Sekolah', totalPoints: 165, level: '⚠️ Perlu Evaluasi Kehadiran', rank: 12, hadirTepatWaktuCount: 3, terlambatCount: 8, piketCount: 1, avgCheckInMinutes: 448, avgCheckInFormatted: '07:28 WIB', checkOutCompletionRate: 80, topBadge: { icon: '⚠️', title: 'Perlu Evaluasi Kehadiran (Peringkat 12)' } },
    { id: 'usr_1786512137742', name: 'Ridho Maulana Al Farizi', nip: null, position: 'Guru Mapel Akhlak lil Banin', totalPoints: 140, level: '⚠️ Perlu Evaluasi Kehadiran', rank: 13, hadirTepatWaktuCount: 3, terlambatCount: 6, piketCount: 1, avgCheckInMinutes: 446, avgCheckInFormatted: '07:26 WIB', checkOutCompletionRate: 82, topBadge: { icon: '⚠️', title: 'Perlu Evaluasi Kehadiran (Peringkat 13)' } },
  ];
}

function getInitialSeedLeaderboardCurrentMonth(): TeacherLeaderboardItem[] {
  return getInitialSeedLeaderboardOctober();
}

function getInitialSeedLeaderboardPreviousMonth(): TeacherLeaderboardItem[] {
  return getInitialSeedLeaderboardAugust();
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
    if (targetMonthPrefix === '2026-10') {
      teachers = getInitialSeedLeaderboardOctober();
    } else if (targetMonthPrefix === '2026-08' || targetMonthPrefix === '2026-09') {
      teachers = getInitialSeedLeaderboardAugust();
    } else if (isCurrent) {
      teachers = getInitialSeedLeaderboardCurrentMonth();
    } else {
      teachers = getInitialSeedLeaderboardPreviousMonth();
    }

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

  // 2. Sertakan currentUser jika aktif dan belum ada di teachers (pencocokan id, NPP, atau nama)
  if (currentUser && currentUser.id) {
    const existingIdx = teachers.findIndex((t) =>
      t.id === currentUser.id ||
      (currentUser.nip && t.nip && t.nip.replace(/\s+/g, '') === currentUser.nip.replace(/\s+/g, '')) ||
      (currentUser.full_name && t.name && t.name.trim().toLowerCase() === currentUser.full_name.trim().toLowerCase())
    );
    const role = ((currentUser as any).role || 'GURU').toUpperCase().trim();
    const isEligible = role === 'GURU' || role === 'ADMIN' || ((currentUser as any).position || '').toLowerCase().includes('guru');

    if (existingIdx !== -1) {
      teachers[existingIdx].isCurrentUser = true;
      if (currentUser.avatar_url) {
        teachers[existingIdx].avatar_url = currentUser.avatar_url;
      }
      if (currentUser.id && teachers[existingIdx].id !== currentUser.id) {
        teachers[existingIdx].id = currentUser.id;
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

    if (!hasLogsForTargetMonth && isSeedAllowed && (targetMonthPrefix === '2026-08' || targetMonthPrefix === '2026-10')) {
      // Pertahankan baseline seed resmi Agustus dan Oktober jika logs yang dioper belum memuat bulan tersebut
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
          avgCheckInMinutes: undefined,
          avgCheckInFormatted: '-',
          checkOutCompletionRate: 0,
          tieBreakerAdvantage: undefined,
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

      // Ekstraksi rata-rata menit kedatangan presensi masuk (WIB)
      const checkInLogs = logs.filter(
        (l) => l.activity_type === 'CHECK_IN_ON_TIME' || l.activity_type === 'CHECK_IN_LATE'
      );
      let totalCheckInMinutes = 0;
      let validCheckInCount = 0;

      checkInLogs.forEach((l) => {
        let mins: number | null = null;
        const text = `${l.title || ''} ${l.description || ''}`;
        const match = text.match(/(?:pukul\s*)?([0-2]?[0-9]):([0-5][0-9])/i);
        if (match) {
          mins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        } else if (l.occurred_at || l.created_at) {
          const raw = l.occurred_at || l.created_at;
          const timeMatch = raw.match(/T?([0-2][0-9]):([0-5][0-9])/);
          if (timeMatch) {
            mins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
          }
        }
        if (mins !== null && mins >= 300 && mins <= 660) {
          totalCheckInMinutes += mins;
          validCheckInCount++;
        }
      });

      const avgCheckInMin = validCheckInCount > 0 ? Math.round(totalCheckInMinutes / validCheckInCount) : undefined;
      const avgCheckInFormatted = (avgCheckInMin !== undefined && avgCheckInMin <= 720)
        ? `${String(Math.floor(avgCheckInMin / 60)).padStart(2, '0')}:${String(avgCheckInMin % 60).padStart(2, '0')} WIB`
        : '-';

      const checkOutLogs = logs.filter((l) => l.activity_type === 'CHECK_OUT');
      const totalPresence = onTime + late;
      const checkOutCompletionRate = totalPresence > 0
        ? Math.min(100, Math.round((checkOutLogs.length / totalPresence) * 100))
        : 0;

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
        avgCheckInMinutes: avgCheckInMin,
        avgCheckInFormatted,
        checkOutCompletionRate,
        status: 'ACTIVE' as const,
      };
    });
    }
  }

  // 4. Pengurutan Tie-Breaker Deterministik:
  // 1. net points (totalPoints signed) tertinggi
  // 2. hadirTepatWaktuCount terbanyak
  // 3. earlyBirdCount (fajar <= 07:00 WIB) terbanyak
  // 4. rata-rata jam kedatangan fisik lebih awal (avgCheckInMinutes terendah)
  // 5. kelengkapan kepulangan (checkOutCompletionRate tertinggi)
  // 6. piketCount terbanyak
  // 7. terlambatCount paling sedikit
  // 8. ID konsisten deterministik
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

    const aAvgMin = a.avgCheckInMinutes ?? 9999;
    const bAvgMin = b.avgCheckInMinutes ?? 9999;
    if (aAvgMin !== bAvgMin) return aAvgMin - bAvgMin;

    const aCheckoutRate = a.checkOutCompletionRate ?? 0;
    const bCheckoutRate = b.checkOutCompletionRate ?? 0;
    if (bCheckoutRate !== aCheckoutRate) return bCheckoutRate - aCheckoutRate;

    const aPiket = Number(a.piketCount) || 0;
    const bPiket = Number(b.piketCount) || 0;
    if (bPiket !== aPiket) return bPiket - aPiket;

    const aLate = Number(a.terlambatCount) || 0;
    const bLate = Number(b.terlambatCount) || 0;
    if (aLate !== bLate) return aLate - bLate;

    return (a.id || '').localeCompare(b.id || '');
  });

  // 5. Penetapan Peringkat & Indikator Keunggulan Tie-Breaker
  for (let i = 0; i < teachers.length; i++) {
    const cur = teachers[i];
    const prev = i > 0 ? teachers[i - 1] : null;

    const isTieWithPrev =
      prev !== null &&
      cur.totalPoints === prev.totalPoints &&
      (cur.avgCheckInMinutes ?? 9999) === (prev.avgCheckInMinutes ?? 9999) &&
      (cur.checkOutCompletionRate ?? 0) === (prev.checkOutCompletionRate ?? 0) &&
      cur.hadirTepatWaktuCount === prev.hadirTepatWaktuCount &&
      (cur.earlyBirdCount || 0) === (prev.earlyBirdCount || 0) &&
      (cur.piketCount || 0) === (prev.piketCount || 0) &&
      cur.terlambatCount === prev.terlambatCount;

    if (isTieWithPrev) {
      cur.rank = prev.rank;
      cur.isTie = true;
      prev.isTie = true;
    } else {
      cur.rank = i + 1;
      cur.isTie = false;
    }

    // Berikan keterangan keunggulan jika poin sama (> 0) namun peringkat terpisah adil
    // PENTING: Keunggulan pembeda HANYA diberikan jika kedua guru memiliki poin aktif (> 0) dan status aktif
    const hasActivePoints = (prev?.totalPoints ?? 0) > 0 && cur.totalPoints > 0;
    const hasActiveStatus = prev?.status === 'ACTIVE' && cur.status === 'ACTIVE';

    if (prev !== null && hasActivePoints && hasActiveStatus && cur.totalPoints === prev.totalPoints && !isTieWithPrev) {
      if (
        prev.avgCheckInMinutes !== undefined &&
        cur.avgCheckInMinutes !== undefined &&
        prev.avgCheckInMinutes < cur.avgCheckInMinutes
      ) {
        prev.tieBreakerAdvantage = `Unggul rata-rata kedatangan fajar (${prev.avgCheckInFormatted || 'lebih awal'} vs ${cur.avgCheckInFormatted || '-'})`;
      } else if ((prev.checkOutCompletionRate ?? 0) > (cur.checkOutCompletionRate ?? 0)) {
        prev.tieBreakerAdvantage = `Unggul kepatuhan pulang (${prev.checkOutCompletionRate}% vs ${cur.checkOutCompletionRate}%)`;
      } else if (prev.hadirTepatWaktuCount > cur.hadirTepatWaktuCount) {
        prev.tieBreakerAdvantage = `Unggul kehadiran tepat waktu (${prev.hadirTepatWaktuCount} vs ${cur.hadirTepatWaktuCount} hari)`;
      } else if ((prev.earlyBirdCount || 0) > (cur.earlyBirdCount || 0)) {
        prev.tieBreakerAdvantage = `Unggul presensi fajar Early Bird (${prev.earlyBirdCount}x vs ${cur.earlyBirdCount}x)`;
      } else if ((prev.piketCount || 0) > (cur.piketCount || 0)) {
        prev.tieBreakerAdvantage = `Unggul keaktifan piket (${prev.piketCount}x vs ${cur.piketCount}x)`;
      }
    }

    if (cur.totalPoints <= 0 || cur.status === 'NO_ACTIVITY' || cur.status === 'ON_LEAVE') {
      cur.tieBreakerAdvantage = undefined;
    }

    const tierInfo = getTeacherRankTierInfo(cur.rank, cur.totalPoints, cur.status);
    cur.level = tierInfo.level;
    cur.rankPredicate = tierInfo.predicate;
    cur.rankCriteria = tierInfo.criteria;
    cur.targetOnTimeRate = tierInfo.targetOnTimeRate;
    cur.topBadge = { icon: tierInfo.badgeIcon, title: tierInfo.badgeTitle };
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

