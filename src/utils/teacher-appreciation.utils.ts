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
  const basePoints = 50; // Initial commitment bonus
  const attendancePoints = hadirTepatWaktuCount * 15 + terlambatCount * 5;
  const dutyPoints = piketCount * 20;
  const moodPoints = moodCheckinCount * 15;

  const totalPoints = basePoints + attendancePoints + dutyPoints + moodPoints;

  // Level Determination
  let level = '🥉 Pendidik Berkomitmen (Level 1)';
  let nextLevelPoints = 100;
  let levelProgressPercent = Math.min(100, Math.round((totalPoints / 100) * 100));

  if (totalPoints >= 300) {
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
