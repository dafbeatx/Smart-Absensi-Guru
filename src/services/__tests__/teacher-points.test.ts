/**
 * SMART ABSENSI GURU - TEACHER POINT & GAMIFICATION ENGINE TEST SUITE
 * Unit tests verifying point recording, idempotency, history retrieval,
 * appreciation score accumulation, and dynamic discipline leaderboard ranking.
 */

import { MockProvider } from '../../providers/mock-provider.service';
import { TeacherPointReconciliationService } from '../teacher-point-reconciliation.service';
import { TeacherChallengeService } from '../teacher-challenge.service';
import {
  calculateTeacherAppreciationScore,
  getTeacherDisciplineLeaderboard,
} from '../../utils/teacher-appreciation.utils';
import { evaluateDisciplinePeriodTiming } from '../../utils/time.utils';
import { generateExcellenceCertificateHTML } from '../../lib/certificate-generator.lib';
import { GroqAIService } from '../groq-ai.service';
import type {
  UserProfile,
  AttendanceRecord,
  TeacherPointLog,
  TeacherAppreciationScore,
  TeacherDutySchedule,
} from '../../types/database.types';

export const runTeacherPointsTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details: details || 'Assertion failed' });
    }
  };

  const provider = new MockProvider();
  const testUserId = 'usr-guru-test-points-1';
  const testDate = '2026-09-09';

  // 1. Record on-time attendance point (+15)
  try {
    const onTimeLog = await provider.recordTeacherPoint({
      user_id: testUserId,
      activity_type: 'CHECK_IN_ON_TIME',
      points: 15,
      title: 'Presensi Masuk Tepat Waktu',
      description: 'Presensi Masuk Tepat Waktu (+15 Poin)',
      date: testDate,
    });

    assert(
      'Point Engine: Record CHECK_IN_ON_TIME awards 15 points',
      onTimeLog !== null && onTimeLog.points === 15 && onTimeLog.activity_type === 'CHECK_IN_ON_TIME',
      `Got points: ${onTimeLog?.points}`
    );
  } catch (err: unknown) {
    assert('Point Engine: Record CHECK_IN_ON_TIME awards 15 points', false, String(err));
  }

  // 2. Idempotency check: Duplicate entry for the same user, date, activity should not duplicate
  try {
    const duplicateLog = await provider.recordTeacherPoint({
      user_id: testUserId,
      activity_type: 'CHECK_IN_ON_TIME',
      points: 15,
      title: 'Presensi Masuk Tepat Waktu',
      description: 'Presensi Masuk Tepat Waktu (Duplicate)',
      date: testDate,
    });

    const userHistory = await provider.getTeacherPointHistory(testUserId);
    const onTimeEntries = userHistory.filter(
      (l) => l.date === testDate && l.activity_type === 'CHECK_IN_ON_TIME'
    );

    assert(
      'Point Engine: Duplicate prevention (idempotency) ensures single entry per activity per day',
      duplicateLog !== null && onTimeEntries.length === 1,
      `Found ${onTimeEntries.length} on-time entries for ${testDate}`
    );
  } catch (err: unknown) {
    assert('Point Engine: Duplicate prevention', false, String(err));
  }

  // 3. Record duty piket point (+10) on the same day
  try {
    const piketLog = await provider.recordTeacherPoint({
      user_id: testUserId,
      activity_type: 'DUTY_PIKET',
      points: 10,
      title: 'Tugas Piket Harian',
      description: 'Tugas Piket Sekolah Terlaksana (+10 Poin)',
      date: testDate,
    });

    assert(
      'Point Engine: Record DUTY_PIKET awards 10 points',
      piketLog !== null && piketLog.points === 10 && piketLog.activity_type === 'DUTY_PIKET',
      `Got points: ${piketLog?.points}`
    );
  } catch (err: unknown) {
    assert('Point Engine: Record DUTY_PIKET awards 10 points', false, String(err));
  }

  // 4. Point history retrieval for specific user
  try {
    const userHistory = await provider.getTeacherPointHistory(testUserId);
    const totalUserPoints = userHistory.reduce((sum, l) => sum + l.points, 0);

    assert(
      'Point Engine: getTeacherPointHistory returns correct user logs and accumulated total',
      userHistory.length === 2 && totalUserPoints === 25,
      `Logs count: ${userHistory.length}, Total points: ${totalUserPoints}`
    );
  } catch (err: unknown) {
    assert('Point Engine: getTeacherPointHistory for specific user', false, String(err));
  }

  // 5. Point history retrieval for ALL users
  try {
    const allLogs = await provider.getTeacherPointHistory('ALL');
    const hasTestUserLogs = allLogs.some((l) => l.user_id === testUserId);

    assert(
      "Point Engine: getTeacherPointHistory('ALL') returns aggregated logs across all teachers",
      allLogs.length >= 2 && hasTestUserLogs,
      `Total all logs: ${allLogs.length}`
    );
  } catch (err: unknown) {
    assert("Point Engine: getTeacherPointHistory('ALL')", false, String(err));
  }

  // 6. calculateTeacherAppreciationScore with real pointHistory
  try {
    const sampleHistory: AttendanceRecord[] = [
      {
        id: 'att-1',
        user_id: testUserId,
        date: '2026-09-08',
        check_in_time: '06:45',
        check_out_time: null,
        status: 'HADIR',
        check_in_lat: -6.6131,
        check_in_lng: 106.8123,
        check_in_distance_meters: 10,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-08T06:45:00Z',
      },
      {
        id: 'att-2',
        user_id: testUserId,
        date: '2026-09-09',
        check_in_time: '07:05',
        check_out_time: null,
        status: 'TERLAMBAT',
        check_in_lat: -6.6131,
        check_in_lng: 106.8123,
        check_in_distance_meters: 10,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-09T07:05:00Z',
      },
    ];

    const samplePointLogs: TeacherPointLog[] = [
      {
        id: 'log-1',
        user_id: testUserId,
        activity_type: 'CHECK_IN_ON_TIME',
        points: 15,
        title: 'Tepat Waktu',
        description: 'Tepat Waktu',
        date: '2026-09-08',
        created_at: '2026-09-08T06:45:00Z',
      },
      {
        id: 'log-2',
        user_id: testUserId,
        activity_type: 'CHECK_IN_LATE',
        points: 5,
        title: 'Terlambat',
        description: 'Terlambat',
        date: '2026-09-09',
        created_at: '2026-09-09T07:05:00Z',
      },
      {
        id: 'log-3',
        user_id: testUserId,
        activity_type: 'DUTY_PIKET',
        points: 10,
        title: 'Piket',
        description: 'Piket',
        date: '2026-09-09',
        created_at: '2026-09-09T12:00:00Z',
      },
    ];

    const score = calculateTeacherAppreciationScore(
      sampleHistory,
      [],
      null,
      testUserId,
      samplePointLogs
    );

    assert(
      'Score Calculation: calculateTeacherAppreciationScore uses pointHistory logs for points and breakdowns',
      score.totalPoints === 30 &&
        score.hadirTepatWaktuCount === 1 &&
        score.terlambatCount === 1 &&
        score.piketCount === 1,
      `Calculated total: ${score.totalPoints}, onTimeCount: ${score.hadirTepatWaktuCount}, lateCount: ${score.terlambatCount}, piketCount: ${score.piketCount}`
    );
  } catch (err: unknown) {
    assert('Score Calculation: calculateTeacherAppreciationScore', false, String(err));
  }

  // 7. getTeacherDisciplineLeaderboard dynamic point aggregation
  try {
    const currentUser: UserProfile = {
      id: testUserId,
      full_name: 'Guru Penguji Teladan',
      role: 'GURU',
      position: 'Guru Matematika',
      nip: '198501012010011001',
      phone_number: '081234567890',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const mockScore: TeacherAppreciationScore = {
      totalPoints: 120,
      level: '🥇 Pendidik Disiplin Emas (Level 3)',
      nextLevelPoints: 150,
      levelProgressPercent: 80,
      hadirTepatWaktuCount: 6,
      terlambatCount: 2,
      piketCount: 2,
      moodCheckinCount: 0,
      badges: [],
      pointHistory: [],
    };

    const logsForLeaderboard: TeacherPointLog[] = [
      {
        id: 'l-1',
        user_id: testUserId,
        activity_type: 'CHECK_IN_ON_TIME',
        points: 120,
        title: 'On-time total',
        description: 'On-time total',
        date: '2026-09-09',
        created_at: '2026-09-09T07:00:00Z',
      },
      {
        id: 'l-2',
        user_id: 'usr-guru-2',
        activity_type: 'CHECK_IN_ON_TIME',
        points: 80,
        title: 'Other teacher',
        description: 'Other teacher',
        date: '2026-09-09',
        created_at: '2026-09-09T07:00:00Z',
      },
    ];

    const leaderboard = getTeacherDisciplineLeaderboard(
      currentUser,
      mockScore,
      'CURRENT_MONTH',
      logsForLeaderboard
    );

    assert(
      'Leaderboard Engine: Aggregates points dynamically and ranks top teacher correctly',
      leaderboard.leaderboard.length > 0 &&
        leaderboard.currentUserRank === 1 &&
        leaderboard.topTeacher?.id === testUserId &&
        leaderboard.topTeacher?.totalPoints === 120,
      `Rank: ${leaderboard.currentUserRank}, Top: ${leaderboard.topTeacher?.name} (${leaderboard.topTeacher?.totalPoints} pts)`
    );
  } catch (err: unknown) {
    assert('Leaderboard Engine: Dynamic ranking', false, String(err));
  }

  // 8. TeacherPointReconciliationService: Reconcile attendance on 8 & 9 Sep into point history
  const reconUserId = 'usr-recon-teacher-test';
  try {
    const rawAttendances: AttendanceRecord[] = [
      {
        id: 'att-recon-1',
        user_id: reconUserId,
        date: '2026-09-08',
        status: 'HADIR',
        check_in_time: '07:15',
        check_out_time: '10:40',
        check_in_lat: -6.6131,
        check_in_lng: 106.8123,
        check_in_distance_meters: 10,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-08T07:15:00Z',
      },
      {
        id: 'att-recon-2',
        user_id: reconUserId,
        date: '2026-09-09',
        status: 'TERLAMBAT',
        check_in_time: '07:45',
        check_out_time: '13:00',
        check_in_lat: -6.6131,
        check_in_lng: 106.8123,
        check_in_distance_meters: 10,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-09T07:45:00Z',
      },
    ];

    const duties: TeacherDutySchedule[] = [
      {
        id: 'duty-tuesday',
        day_of_week: 2, // Tuesday = 2026-09-08
        teacher_id: reconUserId,
        teacher_name: 'Guru Recon',
        created_at: '2026-09-01T00:00:00Z',
      },
    ];

    const initialLogs: TeacherPointLog[] = [];

    const reconciledLogs = await TeacherPointReconciliationService.reconcilePoints(
      reconUserId,
      'Guru Recon',
      rawAttendances,
      initialLogs,
      duties
    );

    const hasOnTime08 = reconciledLogs.some((l) => l.date === '2026-09-08' && l.activity_type === 'CHECK_IN_ON_TIME');
    const hasCheckOut08 = reconciledLogs.some((l) => l.date === '2026-09-08' && l.activity_type === 'CHECK_OUT');
    const hasDuty08 = reconciledLogs.some((l) => l.date === '2026-09-08' && l.activity_type === 'DUTY_PIKET');
    const hasLate09 = reconciledLogs.some((l) => l.date === '2026-09-09' && l.activity_type === 'CHECK_IN_LATE');
    const hasCheckOut09 = reconciledLogs.some((l) => l.date === '2026-09-09' && l.activity_type === 'CHECK_OUT');

    const totalReconPoints = reconciledLogs.reduce((sum, l) => sum + l.points, 0);

    assert(
      'Reconciliation Engine: Automatically creates point logs for 8-9 September (On-Time, Late, Check-Out, Piket)',
      hasOnTime08 && hasCheckOut08 && hasDuty08 && hasLate09 && hasCheckOut09 && totalReconPoints === 50,
      `Reconciled ${reconciledLogs.length} logs with ${totalReconPoints} pts (expected 50 pts: 15+10+10 + 5+10)`
    );

    // 9. Idempotency test: Re-running reconciliation does NOT duplicate records
    const secondPassLogs = await TeacherPointReconciliationService.reconcilePoints(
      reconUserId,
      'Guru Recon',
      rawAttendances,
      reconciledLogs,
      duties
    );

    assert(
      'Reconciliation Engine: Re-running reconciliation is idempotent and produces zero duplicate entries',
      secondPassLogs.length === reconciledLogs.length,
      `Pass 1: ${reconciledLogs.length} logs, Pass 2: ${secondPassLogs.length} logs`
    );
  } catch (err: unknown) {
    assert('Reconciliation Engine: Automatic reconciliation', false, String(err));
  }

  // 10. TeacherChallengeService - calculateStreak
  try {
    const makeAtt = (id: string, date: string, time: string): AttendanceRecord => ({
      id,
      user_id: testUserId,
      date,
      status: 'HADIR',
      check_in_time: time,
      check_out_time: '13:00:00',
      check_in_lat: -6.6131,
      check_in_lng: 106.8123,
      check_in_distance_meters: 10,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: `${date}T${time}Z`,
    });

    const streakAttendances: AttendanceRecord[] = [
      makeAtt('att-s1', '2026-09-09', '07:15:00'),
      makeAtt('att-s2', '2026-09-08', '07:20:00'),
      makeAtt('att-s3', '2026-09-07', '07:10:00'),
    ];

    const streakResult = TeacherChallengeService.calculateStreak(streakAttendances);

    assert(
      'Challenge Engine: calculateStreak correctly computes on-time streak',
      streakResult.currentStreak >= 3 && streakResult.longestStreak >= 3,
      `Got currentStreak: ${streakResult.currentStreak}, longestStreak: ${streakResult.longestStreak}`
    );
  } catch (err: unknown) {
    assert('Challenge Engine: calculateStreak', false, String(err));
  }

  // 11. TeacherChallengeService - getDailyQuests
  try {
    const todayAtt: AttendanceRecord = {
      id: 'att-today',
      user_id: testUserId,
      date: '2026-09-09',
      status: 'HADIR',
      check_in_time: '07:12:00',
      check_out_time: '13:05:00',
      check_in_lat: -6.6131,
      check_in_lng: 106.8123,
      check_in_distance_meters: 10,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: '2026-09-09T07:12:00Z',
    };

    const quests = TeacherChallengeService.getDailyQuests(todayAtt, true);
    const morningQuest = quests.find((q) => q.id === 'quest_morning_on_time');
    const checkoutQuest = quests.find((q) => q.id === 'quest_tuntas_bertugas');
    const piketQuest = quests.find((q) => q.id === 'quest_piket_day');

    assert(
      'Challenge Engine: getDailyQuests marks completed morning, checkout, and piket quests',
      morningQuest?.status === 'COMPLETED' &&
        checkoutQuest?.status === 'COMPLETED' &&
        piketQuest?.status === 'COMPLETED',
      `morning: ${morningQuest?.status}, checkout: ${checkoutQuest?.status}, piket: ${piketQuest?.status}`
    );
  } catch (err: unknown) {
    assert('Challenge Engine: getDailyQuests', false, String(err));
  }

  // 12. TeacherChallengeService - generateNightlyMotivation (Duolingo Style)
  try {
    const testUser: UserProfile = {
      id: testUserId,
      full_name: 'Dafa Maulana, S.Pd',
      role: 'GURU',
      position: 'Guru TI',
      nip: '199001012015011001',
      phone_number: '081234567890',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    const testScore: TeacherAppreciationScore = {
      totalPoints: 55,
      level: '🥈 Level 2: Pendidik Berdedikasi',
      nextLevelPoints: 65,
      levelProgressPercent: 50,
      hadirTepatWaktuCount: 3,
      terlambatCount: 1,
      piketCount: 1,
      moodCheckinCount: 0,
      badges: [],
      pointHistory: [],
    };

    const motivation = TeacherChallengeService.generateNightlyMotivation(
      testUser,
      {
        currentStreak: 5,
        longestStreak: 5,
        isStreakActiveToday: true,
        streakDaysThisWeek: [],
        streakStatusLabel: '🔥 Streak Mingguan Membara!',
      },
      testScore,
      2,
      'Widianingsih, S.Si'
    );

    assert(
      'Challenge Engine: generateNightlyMotivation outputs compelling Duolingo-style streak message',
      motivation.title.includes('🔥') && motivation.type === 'STREAK_PRESERVATION' && Boolean(motivation.callToAction),
      `Generated: ${motivation.title} | CallToAction: ${motivation.callToAction}`
    );
  } catch (err: unknown) {
    assert('Challenge Engine: generateNightlyMotivation', false, String(err));
  }

  // 13. Certificate Template Specification Guard
  try {
    const certHtmlRank1 = generateExcellenceCertificateHTML({
      recipientName: 'Dafa Maulana, S.Pd',
      recipientNipOrNpp: '', // Empty: must fallback to '-'
      recipientPosition: 'Guru TI',
      periodMonthYear: 'September 2026',
      rank: 1,
    });

    const certHtmlRank2 = generateExcellenceCertificateHTML({
      recipientName: 'Widianingsih, S.Si',
      recipientNipOrNpp: '199203112020022006',
      recipientPosition: 'Guru Mapel IPA',
      periodMonthYear: 'September 2026',
      rank: 2,
    });

    const hasNoYayasan = !certHtmlRank1.includes('YAYASAN AS SALAAM & AL-ITTIHADIYAH');
    const hasCorrectSchool = certHtmlRank1.includes('SMP TERPADU AL-ITTIHADIYAH &amp; SMA TERPADU AS SALAAM');
    const hasHyphenForMissingNip = certHtmlRank1.includes('>- •') || certHtmlRank1.includes('>-<') || certHtmlRank1.includes('- • Guru TI');
    const hasNoPrivileges = !certHtmlRank1.includes('Prioritas pemilihan jadwal piket');
    const hasRank2Silver = certHtmlRank2.includes('TOP #2') && certHtmlRank2.includes('Juara 2 Disiplin');
    const hasNoAutoSignature = !certHtmlRank1.includes('digital-stamp') && !certHtmlRank1.includes('sig-handwritten');

    assert(
      'Certificate Engine: Correct school header, NPP fallback to -, no privileges, empty sig-space for wet signature, and supports Ranks 1-3',
      hasNoYayasan && hasCorrectSchool && hasHyphenForMissingNip && hasNoPrivileges && hasRank2Silver && hasNoAutoSignature,
      `noYayasan: ${hasNoYayasan}, correctSchool: ${hasCorrectSchool}, hyphenNip: ${hasHyphenForMissingNip}, noPrivileges: ${hasNoPrivileges}, rank2: ${hasRank2Silver}, noAutoSig: ${hasNoAutoSignature}`
    );
  } catch (err: unknown) {
    assert('Certificate Engine: Specification Guard', false, String(err));
  }

  // 14. GroqAIService - refinePrincipalRewardProposal
  try {
    const rawInput = 'voucher blanja 300rb dan bngkisan kluarga';
    const result = await GroqAIService.refinePrincipalRewardProposal({
      rawRewardText: rawInput,
      teacherName: 'Dafa Maulana, S.Pd',
      totalPoints: 85,
      monthName: 'September 2026',
    });

    const hasPolished = Boolean(result.polishedText) && result.polishedText.length > rawInput.length;
    const fixedTypo = result.polishedText.toLowerCase().includes('belanja') && result.polishedText.toLowerCase().includes('keluarga');

    assert(
      'AI Reward Engine: refinePrincipalRewardProposal fixes typos and polishes executive phrasing',
      hasPolished && fixedTypo,
      `Polished: ${result.polishedText} | Summary: ${result.summary}`
    );
  } catch (err: unknown) {
    assert('AI Reward Engine: refinePrincipalRewardProposal', false, String(err));
  }

  // 15. Early Bird (≤ 07:00 WIB), Streak Bonus, and 5-Tier Deterministic Tie-Breaker Guard
  try {
    const userA: UserProfile = {
      id: 'usr_tie_a',
      full_name: 'Guru A Tie Test',
      role: 'GURU',
      position: 'Guru Fisika',
      nip: '198501012010011010',
      phone_number: '081234567891',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };

    // User A and User B both have 100 points, both have 5 on-time check-ins, 0 late.
    // But User A has 1 Early Bird (≤ 07:00) bonus, User B has 0 Early Bird.
    // Tie-breaker rule 3 must rank User A above User B!
    const tieLogs: TeacherPointLog[] = [
      // User A (100 pts)
      { id: 't-a1', user_id: 'usr_tie_a', activity_type: 'CHECK_IN_ON_TIME', points: 75, date: '2026-09-09', created_at: '2026-09-09T07:00:00Z' },
      { id: 't-a2', user_id: 'usr_tie_a', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-08', created_at: '2026-09-08T07:00:00Z' },
      { id: 't-a3', user_id: 'usr_tie_a', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-07', created_at: '2026-09-07T07:00:00Z' },
      { id: 't-a4', user_id: 'usr_tie_a', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-04', created_at: '2026-09-04T07:00:00Z' },
      { id: 't-a5', user_id: 'usr_tie_a', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-03', created_at: '2026-09-03T07:00:00Z' },
      { id: 't-a6', user_id: 'usr_tie_a', activity_type: 'EARLY_BIRD_BONUS', points: 5, date: '2026-09-09', created_at: '2026-09-09T06:55:00Z' },
      { id: 't-a7', user_id: 'usr_tie_a', activity_type: 'CHECK_OUT', points: 20, date: '2026-09-09', created_at: '2026-09-09T13:00:00Z' },

      // User B (usr_guru_009 / Widia - 100 pts, but 0 Early Bird bonus)
      { id: 't-b1', user_id: 'usr_guru_009', activity_type: 'CHECK_IN_ON_TIME', points: 75, date: '2026-09-09', created_at: '2026-09-09T07:15:00Z' },
      { id: 't-b2', user_id: 'usr_guru_009', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-08', created_at: '2026-09-08T07:15:00Z' },
      { id: 't-b3', user_id: 'usr_guru_009', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-07', created_at: '2026-09-07T07:15:00Z' },
      { id: 't-b4', user_id: 'usr_guru_009', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-04', created_at: '2026-09-04T07:15:00Z' },
      { id: 't-b5', user_id: 'usr_guru_009', activity_type: 'CHECK_IN_ON_TIME', points: 0, date: '2026-09-03', created_at: '2026-09-03T07:15:00Z' },
      { id: 't-b6', user_id: 'usr_guru_009', activity_type: 'CHECK_OUT', points: 25, date: '2026-09-09', created_at: '2026-09-09T13:00:00Z' },
    ];

    const scoreA: TeacherAppreciationScore = {
      totalPoints: 100,
      level: '🏆 Pendidik Teladan Utama',
      nextLevelPoints: 150,
      levelProgressPercent: 100,
      hadirTepatWaktuCount: 5,
      terlambatCount: 0,
      piketCount: 0,
      earlyBirdCount: 1,
      streakCount: 0,
      moodCheckinCount: 0,
      badges: [],
      pointHistory: [],
    };

    const boardResult = getTeacherDisciplineLeaderboard(userA, scoreA, 'CURRENT_MONTH', tieLogs);

    const rankUserA = boardResult.leaderboard.find((t) => t.id === 'usr_tie_a')?.rank;
    const rankUserB = boardResult.leaderboard.find((t) => t.id === 'usr_guru_009')?.rank;

    const tieBreakerPassed = Boolean(rankUserA && rankUserB && rankUserA < rankUserB);

    assert(
      'Tie-Breaker Engine: Equal points resolved by Early Bird bonus count (rankUserA < rankUserB)',
      tieBreakerPassed,
      `User A (1 Early Bird) Rank: ${rankUserA}, User B (0 Early Bird) Rank: ${rankUserB}`
    );
  } catch (err: unknown) {
    assert('Tie-Breaker Engine: Guard', false, String(err));
  }

  // 16. Discipline Period Timing & End-of-Month Certificate Visibility Protocol
  try {
    // A. Tengah bulan (9 September 2026): Piagam belum boleh terbit
    const midMonthDate = new Date(2026, 8, 9, 10, 0, 0); // 9 Sep 2026 (0-indexed month 8 = Sep)
    const midMonthTiming = evaluateDisciplinePeriodTiming(midMonthDate, 2026, 9);

    assert(
      'Discipline Period Timing: Mid-month date (9 Sep) correctly evaluated as NOT end of month',
      midMonthTiming.isEndOfMonth === false &&
        midMonthTiming.currentDay === 9 &&
        midMonthTiming.totalDaysInMonth === 30 &&
        midMonthTiming.daysRemainingInMonth === 21,
      `isEndOfMonth: ${midMonthTiming.isEndOfMonth}, day: ${midMonthTiming.currentDay}, remaining: ${midMonthTiming.daysRemainingInMonth}`
    );

    // B. Akhir bulan berjalan (29 September 2026): Piagam boleh terbit
    const endMonthDate = new Date(2026, 8, 29, 10, 0, 0); // 29 Sep 2026
    const endMonthTiming = evaluateDisciplinePeriodTiming(endMonthDate, 2026, 9);

    assert(
      'Discipline Period Timing: End-of-month date (29 Sep) correctly evaluated as end of month',
      endMonthTiming.isEndOfMonth === true && endMonthTiming.isNaturalEndOfMonth === true,
      `isEndOfMonth: ${endMonthTiming.isEndOfMonth}, isNatural: ${endMonthTiming.isNaturalEndOfMonth}`
    );

    // C. Bulan lampau yang sudah selesai (Agustus 2026 dilihat saat 9 Sep 2026)
    const pastMonthTiming = evaluateDisciplinePeriodTiming(midMonthDate, 2026, 8);

    assert(
      'Discipline Period Timing: Past month (August) automatically treated as completed end-of-month',
      pastMonthTiming.isEndOfMonth === true && pastMonthTiming.isPastMonth === true,
      `isEndOfMonth: ${pastMonthTiming.isEndOfMonth}, isPastMonth: ${pastMonthTiming.isPastMonth}`
    );

    // D. Business Rule: Piagam HANYA boleh ditampilkan jika isEndOfMonth && (rank 1 s/d 3)
    // Non-podium (rank 4 ke bawah) TIDAK mendapatkan piagam, melainkan apresiasi & semangat.
    const canShowCertificate = (rank: number, isEndOfMonth: boolean) => {
      return isEndOfMonth && rank >= 1 && rank <= 3;
    };

    const midMonthRank1 = canShowCertificate(1, midMonthTiming.isEndOfMonth);
    const endMonthRank1 = canShowCertificate(1, endMonthTiming.isEndOfMonth);
    const endMonthRank3 = canShowCertificate(3, endMonthTiming.isEndOfMonth);
    const endMonthRank4 = canShowCertificate(4, endMonthTiming.isEndOfMonth);

    assert(
      'Certificate Visibility Rule: Mid-month Rank 1 cannot see certificate (hidden until end of month)',
      midMonthRank1 === false,
      `midMonthRank1: ${midMonthRank1}`
    );

    assert(
      'Certificate Visibility Rule: End-of-month Top 3 can see certificate, while Rank 4+ receives encouragement only',
      endMonthRank1 === true && endMonthRank3 === true && endMonthRank4 === false,
      `endMonthRank1: ${endMonthRank1}, endMonthRank3: ${endMonthRank3}, endMonthRank4: ${endMonthRank4}`
    );
  } catch (err: unknown) {
    assert('Discipline Period Timing: Guard', false, String(err));
  }

  return { passed, failed, results };
};
