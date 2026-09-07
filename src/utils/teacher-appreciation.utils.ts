import type {
  AttendanceRecord,
  TeacherDutySchedule,
  TeacherMoodLog,
  TeacherBadge,
  TeacherAppreciationScore,
} from '../types/database.types';

export function calculateTeacherAppreciationScore(
  attendanceHistory: AttendanceRecord[] = [],
  dutySchedules: TeacherDutySchedule[] = [],
  todayMood: TeacherMoodLog | null = null,
  userId?: string
): TeacherAppreciationScore {
  const totalRecords = attendanceHistory.length;
  const hadirTepatWaktuCount = attendanceHistory.filter((r) => r.status === 'HADIR').length;
  const terlambatCount = attendanceHistory.filter((r) => r.status === 'TERLAMBAT').length;

  const isUserDuty = dutySchedules.some(
    (d) => d && (d.teacher_id === userId || (userId && d.teacher_id?.includes(userId)))
  );
  const piketCount = isUserDuty ? 1 : 0;
  const moodCheckinCount = todayMood ? 1 : 0;

  // Points Formula
  // Jika sedang Cuti/Izin resmi (tidak ada catatan hadir fisik & tidak ada tugas piket):
  const isCutiOrIzin = totalRecords > 0 && hadirTepatWaktuCount === 0 && terlambatCount === 0 && piketCount === 0;
  const basePoints = isCutiOrIzin ? 0 : 50; // Guru yang sedang cuti tidak mendapat poin komitmen dasar
  const attendancePoints = hadirTepatWaktuCount * 15 + terlambatCount * 5;
  const dutyPoints = piketCount * 20;
  const moodPoints = isCutiOrIzin ? 0 : moodCheckinCount * 15;

  const totalPoints = basePoints + attendancePoints + dutyPoints + moodPoints;

  // Level Determination
  let level = '🥉 Pendidik Berkomitmen (Level 1)';
  let nextLevelPoints = 100;
  let levelProgressPercent = Math.min(100, Math.round((totalPoints / 100) * 100));

  if (totalPoints === 0) {
    level = '🏖️ Sedang Cuti / Izin Resmi';
    nextLevelPoints = 100;
    levelProgressPercent = 0;
  } else if (totalPoints >= 300) {
    level = '🏆 Pendidik Teladan Utama (Level 4)';
    nextLevelPoints = 500;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 300) / 200) * 100));
  } else if (totalPoints >= 200) {
    level = '🥇 Pendidik Disiplin Emas (Level 3)';
    nextLevelPoints = 300;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 200) / 100) * 100));
  } else if (totalPoints >= 100) {
    level = '🥈 Pendidik Berdedikasi (Level 2)';
    nextLevelPoints = 200;
    levelProgressPercent = Math.min(100, Math.round(((totalPoints - 100) / 100) * 100));
  }

  // Badges Calculation
  const onTimePercentage = totalRecords > 0 ? (hadirTepatWaktuCount / totalRecords) * 100 : 100;
  const isDisciplineUnlocked = hadirTepatWaktuCount >= 1 && onTimePercentage >= 70;
  const isDutyUnlocked = piketCount > 0;
  const isPerfectMonthUnlocked = totalRecords > 0 && terlambatCount === 0 && hadirTepatWaktuCount > 0;
  const isResilienceUnlocked = todayMood !== null;

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
      progressPercent: terlambatCount === 0 ? 100 : Math.max(0, 100 - terlambatCount * 20),
    },
    {
      id: 'badge_resilience',
      title: 'Kesejahteraan & Self-Care',
      category: 'RESILIENCE',
      icon: '💚',
      description: 'Rutin memperbarui catatan Mood Check-in harian untuk evaluasi kenyamanan kerja.',
      isUnlocked: isResilienceUnlocked,
      progressPercent: isResilienceUnlocked ? 100 : 0,
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
    moodCheckinCount,
    badges,
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
 * Mendukung filter periode real-time:
 * 1. CURRENT_MONTH: Bulan Berjalan (September 2026, hari ke-7 • ~5 hari kerja efektif, poin proporsional 95-185)
 * 2. PREVIOUS_MONTH: Rekap Final Bulan Penuh (Agustus 2026 • 22 hari kerja efektif, poin 305-520)
 */
export function getTeacherDisciplineLeaderboard(
  currentUser: { id?: string; full_name?: string; nip?: string | null; position?: string; avatar_url?: string | null; phone_number?: string } | null,
  currentUserScore: TeacherAppreciationScore,
  period: DisciplinePeriodType = 'CURRENT_MONTH'
): TeacherDisciplineLeaderboardResult {
  const isCurrent = period === 'CURRENT_MONTH';

  // 1. Baseline Bulan Berjalan (September 2026, hari ke-7 • 5 hari kerja efektif berlalu)
  //    Nilai poin realistis dan proporsional (Base 50 + kehadiran 5 hari + piket/mood)
  const currentMonthTeachers: TeacherLeaderboardItem[] = [
    {
      id: 'usr_guru_002',
      name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
      nip: '19880512 201503 1 002',
      position: 'Wakasek Sarana dan Prasarana',
      totalPoints: 185,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 1,
      hadirTepatWaktuCount: 5,
      terlambatCount: 0,
      piketCount: 1,
      topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' },
    },
    {
      id: 'usr_guru_006',
      name: 'Nurul Fahriya, S.Pd., G.r',
      nip: '19910415 201902 2 004',
      position: 'Wakasek Kurikulum',
      totalPoints: 165,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 2,
      hadirTepatWaktuCount: 5,
      terlambatCount: 0,
      piketCount: 0,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_003',
      name: 'Adi Prasetyo, S.Pd., G.r',
      nip: '19890918 201801 1 003',
      position: 'Guru Mapel Bahasa Inggris',
      totalPoints: 150,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 3,
      hadirTepatWaktuCount: 4,
      terlambatCount: 0,
      piketCount: 1,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_009',
      name: 'Widianingsih, S.Si., G.r',
      nip: '19920311 202002 2 006',
      position: 'Guru Mapel IPA',
      totalPoints: 135,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 4,
      hadirTepatWaktuCount: 4,
      terlambatCount: 1,
      piketCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_005',
      name: 'Fitri Ani Rahayu',
      nip: '19931201 202103 2 007',
      position: 'Guru Mapel Matematika',
      totalPoints: 120,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 5,
      hadirTepatWaktuCount: 3,
      terlambatCount: 1,
      piketCount: 0,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_007',
      name: 'Septi Nur Aeni, S.E',
      nip: '19921105 202102 2 009',
      position: 'Guru Mapel B. Indonesia',
      totalPoints: 115,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 6,
      hadirTepatWaktuCount: 3,
      terlambatCount: 0,
      piketCount: 0,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_guru_010',
      name: 'Mawar Andinia, S.Pd., G.r',
      nip: '19940725 202201 2 008',
      position: 'Bimbingan Konseling (BK)',
      totalPoints: 110,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 7,
      hadirTepatWaktuCount: 3,
      terlambatCount: 0,
      piketCount: 0,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_guru_004',
      name: 'Mira Nurdianti, S.Pd',
      nip: '19950117 202303 2 010',
      position: 'Tata Usaha (TU)',
      totalPoints: 105,
      level: '🥈 Pendidik Berdedikasi (Level 2)',
      rank: 8,
      hadirTepatWaktuCount: 3,
      terlambatCount: 0,
      piketCount: 0,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_op_002',
      name: 'Qodiatul Asrof Ramadhoni, S.E., G.r',
      nip: '19940608 202202 1 005',
      position: 'Operator Sekolah',
      totalPoints: 95,
      level: '🥉 Pendidik Berkomitmen (Level 1)',
      rank: 9,
      hadirTepatWaktuCount: 2,
      terlambatCount: 1,
      piketCount: 0,
      topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' },
    },
    {
      id: 'usr_guru_008',
      name: 'Windiani, S.E., G.r',
      nip: '19900822 201704 2 005',
      position: 'Bendahara Sekolah',
      totalPoints: 0, // 0 poin karena sedang Cuti Resmi (tidak ada akumulasi poin kehadiran/komitmen)
      level: '🏖️ Sedang Cuti Resmi',
      rank: 10,
      hadirTepatWaktuCount: 0, // Sedang Cuti Resmi (0 Hadir)
      terlambatCount: 0,
      piketCount: 0,
      topBadge: { icon: '🏖️', title: 'Sedang Cuti Resmi' },
    },
  ];

  // 2. Baseline Bulan Lalu (Agustus 2026 - Rekap Final Sebulan Penuh, 22 hari kerja efektif)
  const previousMonthTeachers: TeacherLeaderboardItem[] = [
    {
      id: 'usr_guru_002',
      name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
      nip: '19880512 201503 1 002',
      position: 'Wakasek Sarana dan Prasarana',
      totalPoints: 520,
      level: '🏆 Pendidik Teladan Utama',
      rank: 1,
      hadirTepatWaktuCount: 22,
      terlambatCount: 0,
      piketCount: 4,
      topBadge: { icon: '🏆', title: 'Pendidik Teladan Utama Kepsek' },
    },
    {
      id: 'usr_guru_006',
      name: 'Nurul Fahriya, S.Pd., G.r',
      nip: '19910415 201902 2 004',
      position: 'Wakasek Kurikulum',
      totalPoints: 485,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 2,
      hadirTepatWaktuCount: 21,
      terlambatCount: 1,
      piketCount: 3,
      topBadge: { icon: '🎖️', title: 'Garda Disiplin Waktu' },
    },
    {
      id: 'usr_guru_003',
      name: 'Adi Prasetyo, S.Pd., G.r',
      nip: '19890918 201801 1 003',
      position: 'Guru Mapel Bahasa Inggris',
      totalPoints: 460,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 3,
      hadirTepatWaktuCount: 20,
      terlambatCount: 0,
      piketCount: 3,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_009',
      name: 'Widianingsih, S.Si., G.r',
      nip: '19920311 202002 2 006',
      position: 'Guru Mapel IPA',
      totalPoints: 430,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 4,
      hadirTepatWaktuCount: 19,
      terlambatCount: 1,
      piketCount: 3,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_guru_008',
      name: 'Windiani, S.E., G.r',
      nip: '19900822 201704 2 005',
      position: 'Bendahara Sekolah',
      totalPoints: 410,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 5,
      hadirTepatWaktuCount: 18,
      terlambatCount: 2,
      piketCount: 2,
      topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' },
    },
    {
      id: 'usr_guru_005',
      name: 'Fitri Ani Rahayu',
      nip: '19931201 202103 2 007',
      position: 'Guru Mapel Matematika',
      totalPoints: 390,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 6,
      hadirTepatWaktuCount: 17,
      terlambatCount: 1,
      piketCount: 2,
      topBadge: { icon: '🌟', title: '100% Kehadiran Sempurna' },
    },
    {
      id: 'usr_guru_007',
      name: 'Septi Nur Aeni, S.E',
      nip: '19921105 202102 2 009',
      position: 'Guru Mapel B. Indonesia',
      totalPoints: 365,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 7,
      hadirTepatWaktuCount: 16,
      terlambatCount: 2,
      piketCount: 2,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_guru_010',
      name: 'Mawar Andinia, S.Pd., G.r',
      nip: '19940725 202201 2 008',
      position: 'Bimbingan Konseling (BK)',
      totalPoints: 345,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 8,
      hadirTepatWaktuCount: 15,
      terlambatCount: 1,
      piketCount: 2,
      topBadge: { icon: '💚', title: 'Kesejahteraan & Self-Care' },
    },
    {
      id: 'usr_guru_004',
      name: 'Mira Nurdianti, S.Pd',
      nip: '19950117 202303 2 010',
      position: 'Tata Usaha (TU)',
      totalPoints: 320,
      level: '🥇 Pendidik Disiplin Emas',
      rank: 9,
      hadirTepatWaktuCount: 14,
      terlambatCount: 2,
      piketCount: 2,
      topBadge: { icon: '🛡️', title: 'Piket Responsif & Teladan' },
    },
    {
      id: 'usr_op_002',
      name: 'Qodiatul Asrof Ramadhoni, S.E., G.r',
      nip: '19940608 202202 1 005',
      position: 'Operator Sekolah',
      totalPoints: 305,
      level: '🏆 Pendidik Teladan Utama',
      rank: 10,
      hadirTepatWaktuCount: 13,
      terlambatCount: 2,
      piketCount: 1,
      topBadge: { icon: '🎖️', title: 'Guru Terdisiplin Waktu' },
    },
  ];

  let teachers = isCurrent ? [...currentMonthTeachers] : [...previousMonthTeachers];

  if (currentUser) {
    const activeBadge = currentUserScore.badges.find((b) => b.isUnlocked) || {
      icon: '🥉',
      title: 'Pendidik Berkomitmen',
    };

    // Cari apakah currentUser cocok dengan salah satu guru di daftar
    const matchedIdx = teachers.findIndex(
      (t) =>
        (currentUser.id && t.id === currentUser.id) ||
        (currentUser.full_name && t.name.toLowerCase() === currentUser.full_name.toLowerCase()) ||
        (currentUser.nip && t.nip && t.nip.replace(/\s+/g, '') === currentUser.nip.replace(/\s+/g, ''))
    );

    if (matchedIdx !== -1) {
      if (isCurrent) {
        teachers[matchedIdx] = {
          ...teachers[matchedIdx],
          totalPoints: currentUserScore.totalPoints,
          level: currentUserScore.level,
          hadirTepatWaktuCount: currentUserScore.hadirTepatWaktuCount,
          terlambatCount: currentUserScore.terlambatCount,
          piketCount: currentUserScore.piketCount,
          topBadge: { icon: activeBadge.icon, title: activeBadge.title },
          avatar_url: currentUser.avatar_url || teachers[matchedIdx].avatar_url,
          isCurrentUser: true,
        };
      } else {
        teachers[matchedIdx] = {
          ...teachers[matchedIdx],
          isCurrentUser: true,
        };
      }
    } else {
      // Akun guru lain yang terdaftar secara dinamis
      teachers.push({
        id: currentUser.id || 'usr_current',
        name: currentUser.full_name || 'Guru Pendidik',
        nip: currentUser.nip || null,
        position: currentUser.position || 'Guru Pengajar',
        avatar_url: currentUser.avatar_url || null,
        totalPoints: isCurrent ? currentUserScore.totalPoints : 380,
        level: isCurrent ? currentUserScore.level : '🥇 Pendidik Disiplin Emas',
        rank: 0,
        hadirTepatWaktuCount: isCurrent ? currentUserScore.hadirTepatWaktuCount : 17,
        terlambatCount: isCurrent ? currentUserScore.terlambatCount : 1,
        piketCount: isCurrent ? currentUserScore.piketCount : 2,
        topBadge: { icon: activeBadge.icon, title: activeBadge.title },
        isCurrentUser: true,
      });
    }
  }

  // Urutkan berdasarkan totalPoints terbesar secara deterministik
  teachers.sort((a, b) => b.totalPoints - a.totalPoints);

  // Update peringkat rank
  teachers = teachers.map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));

  const topTeacher = teachers[0];
  const currentUserIdx = teachers.findIndex((t) => t.isCurrentUser);
  const currentUserRank = currentUserIdx !== -1 ? currentUserIdx + 1 : 1;

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
