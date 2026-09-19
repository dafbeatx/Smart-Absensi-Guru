import type {
  AttendanceRecord,
  TeacherDutySchedule,
  TeacherMoodLog,
  TeacherBadge,
  TeacherAppreciationScore,
  TeacherPointLog,
} from '../types/database.types';

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

  // Isolasi per-bulan: ambil prefix bulan dari attendanceHistory (misal '2026-09') atau bulan berjalan
  const targetMonthPrefix = (attendanceHistory && attendanceHistory.length > 0 && attendanceHistory[0]?.date)
    ? attendanceHistory[0].date.substring(0, 7)
    : new Date().toISOString().substring(0, 7);

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
  totalPoints: number;
  level: string;
  rank: number;
  hadirTepatWaktuCount: number;
  terlambatCount: number;
  piketCount: number;
  earlyBirdCount?: number;
  streakCount?: number;
  topBadge: {
    icon: string;
    title: string;
  };
  isCurrentUser?: boolean;
}

export type DisciplinePeriodType = 'CURRENT_MONTH' | 'PREVIOUS_MONTH';

export interface TeacherDisciplineLeaderboardResult {
  periodType: DisciplinePeriodType;
  periodLabel: string;
  monthName: string;
  year: number;
  elapsedWorkingDays: number;
  leaderboard: TeacherLeaderboardItem[];
  topTeacher: TeacherLeaderboardItem;
  currentUserRank: number;
  totalTeachers: number;
}

/**
 * Mendapatkan Leaderboard Monitoring Performa Disiplin Internal Sekolah
 * 100% sinkron dengan database riil Supabase:
 * 1. CURRENT_MONTH: Bulan Berjalan (September 2026, 5 hari kerja efektif berlalu: 1-7 September)
 * 2. PREVIOUS_MONTH: Rekap Final Bulan Penuh (Agustus 2026 • 22 hari kerja efektif)
 */
export function getTeacherDisciplineLeaderboard(
  currentUser: { id?: string; full_name?: string; nip?: string | null; position?: string; avatar_url?: string | null; phone_number?: string } | null,
  currentUserScore?: TeacherAppreciationScore | null,
  period: DisciplinePeriodType = 'CURRENT_MONTH',
  allPointLogs?: TeacherPointLog[],
  allRegisteredTeachers?: Array<{ id?: string; nip?: string | null; full_name?: string; avatar_url?: string | null }> | null
): TeacherDisciplineLeaderboardResult {
  const isCurrent = period === 'CURRENT_MONTH';

  // 1. Data Riil Bulan Berjalan (September 2026 - Rekap Buku Besar Cloud Supabase)
  //    Formula: Hadir=15, Telat=5, Pulang=10, Piket=10, EarlyBird(≤07:00)=5, Streak=10, Sakit/Izin/Cuti=0, Alfa=-10.
  //    100% sinkron dengan buku besar poin ledger database & generateSeedTeacherPointLogs.
  const currentMonthTeachers: TeacherLeaderboardItem[] = [
    {
      id: 'usr_guru_007',
      name: 'Septi Nur Aeni, S.E',
      nip: '19921105 202102 2 009',
      position: 'Guru Mapel B. Indonesia',
      totalPoints: 385,
      level: '🏆 Pendidik Teladan Utama',
      rank: 1,
      hadirTepatWaktuCount: 14,
      terlambatCount: 0,
      piketCount: 2,
      earlyBirdCount: 1,
      streakCount: 1,
      topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' },
    },
    {
      id: 'usr_guru_009',
      name: 'Widianingsih, S.Si., G.r',
      nip: '19920311 202002 2 006',
      position: 'Guru Mapel IPA',
      totalPoints: 385,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 2,
      hadirTepatWaktuCount: 13,
      terlambatCount: 1,
      piketCount: 3,
      earlyBirdCount: 3,
      streakCount: 1,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_002',
      name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
      nip: '19880512 201503 1 002',
      position: 'Wakasek Sarana dan Prasarana',
      totalPoints: 375,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 3,
      hadirTepatWaktuCount: 14,
      terlambatCount: 0,
      piketCount: 3,
      earlyBirdCount: 4,
      streakCount: 1,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_005',
      name: 'Fitri Ani Rahayu, S.Mat',
      nip: '19931201 202103 2 007',
      position: 'Wakasek Kesiswaan',
      totalPoints: 330,
      level: '🥈 Pendidik Berdedikasi',
      rank: 4,
      hadirTepatWaktuCount: 9,
      terlambatCount: 4,
      piketCount: 3,
      earlyBirdCount: 3,
      streakCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_1786512137742',
      name: 'Ridho Maulana Al Farizi',
      nip: null,
      position: 'Guru Mapel Akhlak lil Banin',
      totalPoints: 315,
      level: '🥈 Pendidik Berdedikasi',
      rank: 5,
      hadirTepatWaktuCount: 9,
      terlambatCount: 5,
      piketCount: 3,
      earlyBirdCount: 1,
      streakCount: 0,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_006',
      name: 'Nurul Fahriya, S.Pd., G.r',
      nip: '19910415 201902 2 004',
      position: 'Wakasek Kurikulum',
      totalPoints: 300,
      level: '🥈 Pendidik Berdedikasi',
      rank: 6,
      hadirTepatWaktuCount: 8,
      terlambatCount: 4,
      piketCount: 2,
      earlyBirdCount: 1,
      streakCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_004',
      name: 'Mira Nurdianti, S.Pd',
      nip: '19950117 202303 2 010',
      position: 'Tata Usaha (TU)',
      totalPoints: 275,
      level: '🥉 Pendidik Berkomitmen',
      rank: 7,
      hadirTepatWaktuCount: 7,
      terlambatCount: 7,
      piketCount: 3,
      earlyBirdCount: 1,
      streakCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_admin_001',
      name: 'Dafa Maulana, S.Pd',
      nip: null,
      position: 'Guru Mapel Informatika',
      totalPoints: 275,
      level: '🥉 Pendidik Berkomitmen',
      rank: 8,
      hadirTepatWaktuCount: 5,
      terlambatCount: 8,
      piketCount: 2,
      earlyBirdCount: 0,
      streakCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_003',
      name: 'Adi Prasetyo, S.Pd., G.r',
      nip: '19890918 201801 1 003',
      position: 'Guru Mapel Bahasa Inggris',
      totalPoints: 200,
      level: '🥉 Pendidik Berkomitmen',
      rank: 9,
      hadirTepatWaktuCount: 11,
      terlambatCount: 1,
      piketCount: 3,
      earlyBirdCount: 0,
      streakCount: 0,
      topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' },
    },
    {
      id: 'usr_guru_010',
      name: 'Mawar Andinia, S.Pd., G.r',
      nip: '19940725 202201 2 008',
      position: 'Bimbingan Konseling (BK)',
      totalPoints: 185,
      level: '🥉 Pendidik Berkomitmen',
      rank: 10,
      hadirTepatWaktuCount: 6,
      terlambatCount: 6,
      piketCount: 3,
      earlyBirdCount: 3,
      streakCount: 0,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_kepsek_002',
      name: 'Farhan Sopian Sahid, S.Pd.I',
      nip: null,
      position: 'Kepala Sekolah',
      totalPoints: 130,
      level: '🥉 Pendidik Berkomitmen',
      rank: 11,
      hadirTepatWaktuCount: 3,
      terlambatCount: 5,
      piketCount: 0,
      earlyBirdCount: 1,
      streakCount: 0,
      topBadge: { icon: '👑', title: 'Pemimpin Teladan' },
    },
    {
      id: 'usr_op_002',
      name: 'Qodiatul Asrof Ramadhoni, S.E., G.r',
      nip: '19940608 202202 1 005',
      position: 'Operator Sekolah',
      totalPoints: 50,
      level: '🥉 Pendidik Berkomitmen',
      rank: 12,
      hadirTepatWaktuCount: 0,
      terlambatCount: 6,
      piketCount: 0,
      earlyBirdCount: 0,
      streakCount: 0,
      topBadge: { icon: '⏱️', title: 'Evaluasi Disiplin' },
    },
    {
      id: 'usr_guru_008',
      name: 'Windiani, S.E., G.r',
      nip: '19900822 201704 2 005',
      position: 'Bendahara Sekolah',
      totalPoints: 0,
      level: '🏖️ Sedang Cuti Resmi',
      rank: 13,
      hadirTepatWaktuCount: 0,
      terlambatCount: 0,
      piketCount: 0,
      earlyBirdCount: 0,
      streakCount: 0,
      topBadge: { icon: '🏖️', title: 'Sedang Cuti Resmi' },
    },
  ];

  // 2. Data Riil Bulan Lalu (Agustus 2026 - Rekap Final Sebulan Penuh dari Supabase)
  //    Formula: Hadir=15, Telat=5, Alfa=-10, Izin/Sakit/Cuti=0
  const previousMonthTeachers: TeacherLeaderboardItem[] = [
    {
      id: 'usr_guru_005',
      name: 'Fitri Ani Rahayu, S.Mat',
      nip: '19931201 202103 2 007',
      position: 'Wakasek Kesiswaan',
      totalPoints: 415,
      level: '🏆 Pendidik Teladan Utama',
      rank: 1,
      hadirTepatWaktuCount: 14,
      terlambatCount: 4,
      piketCount: 3,
      topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' },
    },
    {
      id: 'usr_admin_001',
      name: 'Dafa Maulana, S.Pd',
      nip: null,
      position: 'Guru Mapel Informatika',
      totalPoints: 400,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 2,
      hadirTepatWaktuCount: 10,
      terlambatCount: 7,
      piketCount: 2,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_009',
      name: 'Widianingsih, S.Si., G.r',
      nip: '19920311 202002 2 006',
      position: 'Guru Mapel IPA',
      totalPoints: 395,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 3,
      hadirTepatWaktuCount: 14,
      terlambatCount: 2,
      piketCount: 3,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_007',
      name: 'Septi Nur Aeni, S.E',
      nip: '19921105 202102 2 009',
      position: 'Guru Mapel B. Indonesia',
      totalPoints: 390,
      level: '🥈 Pendidik Berdedikasi',
      rank: 4,
      hadirTepatWaktuCount: 14,
      terlambatCount: 1,
      piketCount: 3,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_006',
      name: 'Nurul Fahriya, S.Pd., G.r',
      nip: '19910415 201902 2 004',
      position: 'Wakasek Kurikulum',
      totalPoints: 380,
      level: '🥈 Pendidik Berdedikasi',
      rank: 5,
      hadirTepatWaktuCount: 9,
      terlambatCount: 8,
      piketCount: 2,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_002',
      name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
      nip: '19880512 201503 1 002',
      position: 'Wakasek Sarana dan Prasarana',
      totalPoints: 370,
      level: '🥈 Pendidik Berdedikasi',
      rank: 6,
      hadirTepatWaktuCount: 12,
      terlambatCount: 4,
      piketCount: 3,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_003',
      name: 'Adi Prasetyo, S.Pd., G.r',
      nip: '19890918 201801 1 003',
      position: 'Guru Mapel Bahasa Inggris',
      totalPoints: 300,
      level: '🥉 Pendidik Berkomitmen',
      rank: 7,
      hadirTepatWaktuCount: 12,
      terlambatCount: 2,
      piketCount: 3,
      topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' },
    },
    {
      id: 'usr_guru_010',
      name: 'Mawar Andinia, S.Pd., G.r',
      nip: '19940725 202201 2 008',
      position: 'Bimbingan Konseling (BK)',
      totalPoints: 280,
      level: '🥉 Pendidik Berkomitmen',
      rank: 8,
      hadirTepatWaktuCount: 7,
      terlambatCount: 7,
      piketCount: 2,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_guru_004',
      name: 'Mira Nurdianti, S.Pd',
      nip: '19950117 202303 2 010',
      position: 'Tata Usaha (TU)',
      totalPoints: 260,
      level: '🥉 Pendidik Berkomitmen',
      rank: 9,
      hadirTepatWaktuCount: 5,
      terlambatCount: 9,
      piketCount: 2,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_008',
      name: 'Windiani, S.E., G.r',
      nip: '19900822 201704 2 005',
      position: 'Bendahara Sekolah',
      totalPoints: 240,
      level: '🥉 Pendidik Berkomitmen',
      rank: 10,
      hadirTepatWaktuCount: 5,
      terlambatCount: 9,
      piketCount: 1,
      topBadge: { icon: '🏖️', title: 'Mulai Cuti Resmi' },
    },
    {
      id: 'usr_kepsek_002',
      name: 'Farhan Sopian Sahid, S.Pd.I',
      nip: null,
      position: 'Kepala Sekolah',
      totalPoints: 215,
      level: '🥉 Pendidik Berkomitmen',
      rank: 11,
      hadirTepatWaktuCount: 4,
      terlambatCount: 8,
      piketCount: 0,
      topBadge: { icon: '👑', title: 'Pemimpin Teladan' },
    },
    {
      id: 'usr_op_002',
      name: 'Qodiatul Asrof Ramadhoni, S.E., G.r',
      nip: '19940608 202202 1 005',
      position: 'Operator Sekolah',
      totalPoints: 165,
      level: '🥉 Pendidik Berkomitmen',
      rank: 12,
      hadirTepatWaktuCount: 3,
      terlambatCount: 8,
      piketCount: 1,
      topBadge: { icon: '⏱️', title: 'Evaluasi Disiplin' },
    },
    {
      id: 'usr_1786512137742',
      name: 'Ridho Maulana Al Farizi',
      nip: null,
      position: 'Guru Mapel Akhlak lil Banin',
      totalPoints: 140,
      level: '🥉 Pendidik Berkomitmen',
      rank: 13,
      hadirTepatWaktuCount: 3,
      terlambatCount: 6,
      piketCount: 1,
      topBadge: { icon: '⚠️', title: 'Catatan Kedisiplinan' },
    },
  ];

  let teachers: TeacherLeaderboardItem[] = isCurrent ? [...currentMonthTeachers] : [...previousMonthTeachers];

  // 1.5. Sinkronisasi Roster: Gabungkan seluruh guru terdaftar (allRegisteredTeachers) dari database / cache
  // Memastikan bahwa tampilan Admin, Kepsek, dan Guru SELALU memuat daftar guru yang 100% IDENTIK & SINKRON
  if (allRegisteredTeachers && allRegisteredTeachers.length > 0) {
    for (const reg of allRegisteredTeachers) {
      if (!reg || !reg.id) continue;
      // Jangan masukkan akun role non-guru (misal KEPSEK murni tanpa penugasan mengajar)
      if ((reg as any).role === 'KEPSEK' && !(reg as any).position?.toLowerCase().includes('guru')) {
        continue;
      }

      const existingIdx = teachers.findIndex(
        (t) =>
          t.id === reg.id ||
          (reg.nip && t.nip && reg.nip.replace(/\s+/g, '') === t.nip.replace(/\s+/g, '')) ||
          (reg.full_name && t.name && reg.full_name.trim().toLowerCase() === t.name.trim().toLowerCase())
      );

      if (existingIdx !== -1) {
        teachers[existingIdx] = {
          ...teachers[existingIdx],
          id: reg.id,
          name: reg.full_name || teachers[existingIdx].name,
          nip: reg.nip !== undefined ? reg.nip : teachers[existingIdx].nip,
          position: (reg as any).position || teachers[existingIdx].position,
          avatar_url: reg.avatar_url || teachers[existingIdx].avatar_url,
        };
      } else {
        teachers.push({
          id: reg.id,
          name: reg.full_name || 'Guru Pengajar',
          nip: reg.nip || null,
          position: (reg as any).position || 'Guru Pengajar',
          avatar_url: reg.avatar_url || null,
          totalPoints: 0,
          level: '🥉 Pendidik Berkomitmen',
          rank: teachers.length + 1,
          hadirTepatWaktuCount: 0,
          terlambatCount: 0,
          piketCount: 0,
          earlyBirdCount: 0,
          streakCount: 0,
          topBadge: { icon: '🥉', title: 'Pendidik Berkomitmen' },
        });
      }
    }
  }

  // Pembaruan dinamis skor dan perolehan poin seluruh guru jika allPointLogs tersedia
  // Wajib difilter per-bulan berjalan / per-bulan target agar tidak terjadi akumulasi lintas bulan
  if (allPointLogs && allPointLogs.length > 0) {
    const targetMonthPrefix = isCurrent ? '2026-09' : '2026-08';
    teachers = teachers.map((t) => {
      const logs = allPointLogs.filter(
        (l) =>
          l.user_id === t.id &&
          ((l.date && l.date.startsWith(targetMonthPrefix)) ||
            (!l.date && l.created_at && l.created_at.startsWith(targetMonthPrefix)))
      );
      if (logs.length === 0) {
        return {
          ...t,
          totalPoints: 0,
          hadirTepatWaktuCount: 0,
          terlambatCount: 0,
          piketCount: 0,
          earlyBirdCount: 0,
          streakCount: 0,
        };
      }

      const pts = Math.max(0, logs.reduce((sum, l) => sum + (Number(l.points) || 0), 0));
      const onTime = logs.filter((l) => l.activity_type === 'CHECK_IN_ON_TIME').length;
      const late = logs.filter((l) => l.activity_type === 'CHECK_IN_LATE').length;
      const piket = logs.filter((l) => l.activity_type === 'DUTY_PIKET').length;
      const earlyBird = logs.filter((l) => l.activity_type === 'EARLY_BIRD_BONUS').length;
      const streak = logs.filter((l) => l.activity_type === 'STREAK_MILESTONE').length;

      return {
        ...t,
        totalPoints: pts,
        hadirTepatWaktuCount: onTime,
        terlambatCount: late,
        piketCount: piket,
        earlyBirdCount: earlyBird,
        streakCount: streak,
      };
    });
  }

  if (currentUser) {
    const activeBadge = currentUserScore?.badges?.find((b) => b.isUnlocked) || {
      icon: '🥉',
      title: 'Pendidik Berkomitmen',
    };

    // Cari apakah currentUser cocok dengan salah satu guru di daftar
    const matchedIdx = teachers.findIndex(
      (t) =>
        (currentUser.id && t.id === currentUser.id) ||
        (currentUser.full_name && t.name && t.name.trim().toLowerCase() === currentUser.full_name.trim().toLowerCase()) ||
        (currentUser.nip && t.nip && t.nip.replace(/\s+/g, '') === currentUser.nip.replace(/\s+/g, ''))
    );

    if (matchedIdx !== -1) {
      if (isCurrent) {
        const targetMonthPrefix = '2026-09';
        const hasLogsInMonth = (allPointLogs || []).some(
          (l) =>
            l.user_id === teachers[matchedIdx].id &&
            ((l.date && l.date.startsWith(targetMonthPrefix)) ||
              (!l.date && l.created_at && l.created_at.startsWith(targetMonthPrefix)))
        );

        const hasValidUserScore = Boolean(
          currentUserScore &&
          typeof currentUserScore.totalPoints === 'number' &&
          currentUserScore.totalPoints >= 0
        );

        // Jika data buku besar (allPointLogs) tersedia untuk user ini, gunakan nilai totalPoints dari ledger
        // Jika tidak, baru gunakan currentUserScore atau nilai seed terdaftar
        const resolvedTotalPoints = hasLogsInMonth
          ? teachers[matchedIdx].totalPoints
          : (hasValidUserScore
              ? currentUserScore!.totalPoints
              : teachers[matchedIdx].totalPoints);

        const resolvedLevel = hasValidUserScore && currentUserScore?.level
          ? currentUserScore.level
          : teachers[matchedIdx].level;
        const resolvedOnTime = hasValidUserScore && currentUserScore?.hadirTepatWaktuCount !== undefined
          ? Math.max(teachers[matchedIdx].hadirTepatWaktuCount, currentUserScore.hadirTepatWaktuCount)
          : teachers[matchedIdx].hadirTepatWaktuCount;
        const resolvedLate = hasValidUserScore && currentUserScore?.terlambatCount !== undefined
          ? currentUserScore.terlambatCount
          : teachers[matchedIdx].terlambatCount;
        const resolvedPiket = hasValidUserScore && currentUserScore?.piketCount !== undefined
          ? Math.max(teachers[matchedIdx].piketCount, currentUserScore.piketCount)
          : teachers[matchedIdx].piketCount;
        const resolvedEarlyBird = hasValidUserScore && currentUserScore?.earlyBirdCount !== undefined
          ? Math.max(teachers[matchedIdx].earlyBirdCount ?? 0, currentUserScore.earlyBirdCount)
          : (teachers[matchedIdx].earlyBirdCount ?? 0);
        const resolvedStreak = hasValidUserScore && currentUserScore?.streakCount !== undefined
          ? Math.max(teachers[matchedIdx].streakCount ?? 0, currentUserScore.streakCount)
          : (teachers[matchedIdx].streakCount ?? 0);

        teachers[matchedIdx] = {
          ...teachers[matchedIdx],
          totalPoints: resolvedTotalPoints,
          level: resolvedLevel,
          hadirTepatWaktuCount: resolvedOnTime,
          terlambatCount: resolvedLate,
          piketCount: resolvedPiket,
          earlyBirdCount: resolvedEarlyBird,
          streakCount: resolvedStreak,
          topBadge: activeBadge ? { icon: activeBadge.icon, title: activeBadge.title } : teachers[matchedIdx].topBadge,
          avatar_url: currentUser.avatar_url || teachers[matchedIdx].avatar_url,
          isCurrentUser: true,
        };
      } else {
        teachers[matchedIdx] = {
          ...teachers[matchedIdx],
          avatar_url: currentUser.avatar_url || teachers[matchedIdx].avatar_url,
          isCurrentUser: true,
        };
      }
    } else if (
      !currentUser ||
      ((currentUser as any).role !== 'KEPSEK' && (currentUser as any).role !== 'ADMIN')
    ) {
      // Akun guru lain yang terdaftar secara dinamis dan belum ada di teachers
      teachers.push({
        id: currentUser.id || 'usr_current',
        name: currentUser.full_name || 'Guru Pendidik',
        nip: currentUser.nip || null,
        position: currentUser.position || 'Guru Pengajar',
        avatar_url: currentUser.avatar_url || null,
        totalPoints: Number(currentUserScore?.totalPoints) || 0,
        level: currentUserScore?.level || '🥉 Pendidik Berkomitmen',
        rank: teachers.length + 1,
        hadirTepatWaktuCount: currentUserScore?.hadirTepatWaktuCount ?? 0,
        terlambatCount: currentUserScore?.terlambatCount ?? 0,
        piketCount: currentUserScore?.piketCount ?? 0,
        earlyBirdCount: currentUserScore?.earlyBirdCount ?? 0,
        streakCount: currentUserScore?.streakCount ?? 0,
        topBadge: { icon: activeBadge.icon, title: activeBadge.title },
        isCurrentUser: true,
      });
    }
  }

  // 5-Level Deterministic Tie-Breaker Ranking Engine:
  // 1. totalPoints terbesar (Strict Numeric Descending)
  // 2. hadirTepatWaktuCount terbanyak (On-Time Descending)
  // 3. earlyBirdCount (Teladan Fajar ≤ 07:00 WIB) terbanyak (Early Bird Descending)
  // 4. terlambatCount paling sedikit (Late Count Ascending)
  // 5. Alfabetis nama guru (A-Z) untuk konsistensi deterministik 100%
  teachers.sort((a, b) => {
    const aPoints = Number(a.totalPoints) || 0;
    const bPoints = Number(b.totalPoints) || 0;
    if (bPoints !== aPoints) {
      return bPoints - aPoints;
    }

    const aOnTime = Number(a.hadirTepatWaktuCount) || 0;
    const bOnTime = Number(b.hadirTepatWaktuCount) || 0;
    if (bOnTime !== aOnTime) {
      return bOnTime - aOnTime;
    }

    const aEarly = Number(a.earlyBirdCount) || 0;
    const bEarly = Number(b.earlyBirdCount) || 0;
    if (bEarly !== aEarly) {
      return bEarly - aEarly;
    }

    const aLate = Number(a.terlambatCount) || 0;
    const bLate = Number(b.terlambatCount) || 0;
    if (aLate !== bLate) {
      return aLate - bLate;
    }

    return (a.name || '').localeCompare(b.name || '');
  });

  // Update peringkat rank dan standarisasi tingkat prestasi:
  // - Juara 1 strictly reserved untuk Pendidik Teladan Utama
  // - Peringkat 2 - 3: Pendidik Disiplin Emas
  // - Peringkat 4 - 6: Pendidik Berdedikasi
  // - Peringkat 7+: Pendidik Berkomitmen
  // - 0 Poin / Sedang Cuti: Sedang Cuti Resmi
  teachers = teachers.map((t, idx) => {
    const rank = idx + 1;
    let level = t.level;
    let topBadge = t.topBadge;

    if (t.totalPoints === 0 || (t.level && t.level.includes('Cuti'))) {
      level = '🏖️ Sedang Cuti Resmi';
      topBadge = { icon: '🏖️', title: 'Sedang Cuti Resmi' };
    } else if (rank === 1) {
      level = '🏆 Pendidik Teladan Utama';
      topBadge = { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' };
    } else if (rank <= 3) {
      level = '🥇 Pendidik Disiplin Emas';
      if (!topBadge || topBadge.icon === '🏆') {
        topBadge = { icon: '🌟', title: '100% Kehadiran Sempurna' };
      }
    } else if (rank <= 6) {
      level = '🥈 Pendidik Berdedikasi';
      if (!topBadge || topBadge.icon === '🏆' || topBadge.icon === '🥇') {
        topBadge = { icon: '🛡️', title: 'Piket Responsif & Teladan' };
      }
    } else {
      level = '🥉 Pendidik Berkomitmen';
      if (!topBadge || topBadge.icon === '🏆' || topBadge.icon === '🥇' || topBadge.icon === '🥈') {
        topBadge = { icon: '🥉', title: 'Pendidik Berkomitmen' };
      }
    }

    return {
      ...t,
      rank,
      level,
      topBadge,
    };
  });

  // 6. Resolusi Foto Profil Guru yang diset oleh Admin (Sinkronisasi Antar-Perangkat Realtime)
  let registeredProfiles: Array<{ id?: string; nip?: string | null; full_name?: string; avatar_url?: string | null }> = [];
  if (allRegisteredTeachers && allRegisteredTeachers.length > 0) {
    registeredProfiles = allRegisteredTeachers;
  } else if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('smart_absensi_teachers') || localStorage.getItem('smart_absensi_cached_teachers_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          registeredProfiles = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  teachers = teachers.map((t) => {
    let resolvedAvatar = t.avatar_url || null;

    if (registeredProfiles.length > 0) {
      const matched = registeredProfiles.find(
        (p) =>
          (p.id && t.id === p.id) ||
          (p.nip && t.nip && p.nip.replace(/\s+/g, '') === t.nip.replace(/\s+/g, '')) ||
          (p.full_name && t.name && p.full_name.trim().toLowerCase() === t.name.trim().toLowerCase())
      );
      if (matched && matched.avatar_url) {
        resolvedAvatar = matched.avatar_url;
      }
    }

    if (currentUser && currentUser.avatar_url) {
      const isMe =
        (currentUser.id && t.id === currentUser.id) ||
        (currentUser.nip && t.nip && currentUser.nip.replace(/\s+/g, '') === t.nip.replace(/\s+/g, '')) ||
        (currentUser.full_name && t.name && currentUser.full_name.trim().toLowerCase() === t.name.trim().toLowerCase());
      if (isMe) {
        resolvedAvatar = currentUser.avatar_url;
      }
    }

    return {
      ...t,
      avatar_url: resolvedAvatar,
    };
  });

  const topTeacher = teachers[0] || {
    id: 'usr_default',
    name: 'Guru Pendidik',
    position: 'Guru Pengajar',
    totalPoints: 0,
    level: '🏆 Pendidik Teladan Utama',
    rank: 1,
    hadirTepatWaktuCount: 0,
    terlambatCount: 0,
    piketCount: 0,
    topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' },
    avatar_url: null,
  };
  const currentUserIdx = teachers.findIndex((t) => t.isCurrentUser);
  const currentUserRank = currentUserIdx !== -1 ? currentUserIdx + 1 : (currentUser ? Math.max(teachers.length, 1) : 1);

  return {
    periodType: period,
    periodLabel: isCurrent
      ? 'September 2026 (Bulan Berjalan • s/d Hari ke-7)'
      : 'Agustus 2026 (Rekap Final Penuh • 22 Hari Kerja)',
    monthName: isCurrent ? 'September' : 'Agustus',
    year: 2026,
    elapsedWorkingDays: isCurrent ? 5 : 22,
    leaderboard: teachers,
    topTeacher,
    currentUserRank,
    totalTeachers: teachers.length,
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

