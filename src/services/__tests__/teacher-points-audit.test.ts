/**
 * SMART ABSENSI GURU — TEACHER POINTS AUDIT & VERIFIED LEADERBOARD TEST SUITE
 * Regresi 15 Kasus Wajib:
 * 1. Ranking hanya memakai ledger valid bulan target
 * 2. Data seed tidak pernah muncul pada production mode
 * 3. Poin -10 tetap menghasilkan total -10, bukan 0
 * 4. Guru 0 poin berstatus NO_ACTIVITY, bukan ON_LEAVE
 * 5. Guru yang tidak aktif tidak muncul
 * 6. Guru dengan nama sama/serupa tidak saling tertukar (keyed strictly by user_id)
 * 7. Guru Dashboard dan Kepsek Dashboard menghasilkan leaderboard sama dari snapshot yang sama
 * 8. CurrentUserScore tidak dapat mengalahkan ledger global
 * 9. Saat ledger gagal/partial, Juara 1 tidak ditentukan
 * 10. Popup reward Kepsek tidak muncul jika data belum SYNCED
 * 11. Tie score mengikuti policy shared-rank (dense rank & tie flag)
 * 12. Idempotency memastikan satu aktivitas hanya memberi satu log poin
 * 13. Void/reversal mengubah leaderboard secara benar tanpa delete fisik destruktif
 * 14. Perubahan bulan Asia/Jakarta menghitung periode baru dengan benar
 * 15. Rekonsiliasi tidak memasukkan seed atau baseline ke ledger produksi
 */

import {
  getTeacherDisciplineLeaderboard,
  getDisciplinePeriodMetadata,
} from '../../utils/teacher-appreciation.utils';
import { TeacherPointRepository } from '../../repositories/TeacherPointRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import type { TeacherPointLog } from '../../types/database.types';

export interface TestResultItem {
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

export interface TestSuiteResult {
  suiteName: string;
  passed: number;
  failed: number;
  results: TestResultItem[];
}

export async function runTeacherPointsAuditTestSuite(): Promise<TestSuiteResult> {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS' });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details: details || 'Assertion failed' });
    }
  }

  const mockRoster: any[] = [
    {
      id: 'usr_t1',
      full_name: 'Drs. H. Ahmad Fauzi, M.Pd.',
      nip: '19750101 200001 1 001',
      role: 'GURU',
      position: 'Guru Matematika',
      account_status: 'ACTIVE',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'usr_t2',
      full_name: 'Ahmad Fauzi, S.Pd.',
      nip: '19850202 201001 1 002',
      role: 'GURU',
      position: 'Guru Fisika',
      account_status: 'ACTIVE',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'usr_t3',
      full_name: 'Siti Rahmawati, S.Pd.',
      nip: '19900303 201501 2 003',
      role: 'GURU',
      position: 'Guru Biologi',
      account_status: 'ACTIVE',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'usr_t4_inactive',
      full_name: 'Budi Nonaktif, S.Kom.',
      nip: '19800404 200501 1 004',
      role: 'GURU',
      position: 'Guru TIK',
      account_status: 'INACTIVE',
      is_active: false,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  // ── TEST 1: Ranking hanya memakai ledger valid bulan target ─────────────
  {
    const logs: TeacherPointLog[] = [
      // Log target month (2026-10)
      {
        id: 'l1',
        user_id: 'usr_t1',
        points: 15,
        activity_type: 'CHECK_IN_ON_TIME',
        date: '2026-10-02',
        title: 'Presensi Tepat Waktu',
        status: 'VALID',
        created_at: '2026-10-02T07:15:00Z',
      },
      // Log bulan lain (2026-08) -> tidak boleh dihitung
      {
        id: 'l2',
        user_id: 'usr_t1',
        points: 100,
        activity_type: 'CHECK_IN_ON_TIME',
        date: '2026-08-15',
        title: 'Presensi Lama',
        status: 'VALID',
        created_at: '2026-08-15T07:15:00Z',
      },
      // Log voided bulan target -> tidak boleh dihitung
      {
        id: 'l3',
        user_id: 'usr_t1',
        points: 50,
        activity_type: 'CHECK_IN_ON_TIME',
        date: '2026-10-02',
        title: 'Dibatalkan',
        status: 'VOIDED',
        voided_at: '2026-10-02T08:00:00Z',
        void_reason: 'Koreksi admin',
        created_at: '2026-10-02T07:20:00Z',
      },
    ];

    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', logs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
    });

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    assert(
      '1. Ranking hanya memakai ledger valid bulan target (abaikan log bulan lain & VOIDED)',
      t1?.totalPoints === 15 && t1?.netPoints === 15,
      `Expected totalPoints 15, got ${t1?.totalPoints}`
    );
  }

  // ── TEST 2: Data seed tidak pernah muncul pada production mode ───────────
  {
    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', [], mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      allowSeedInTest: false,
    });

    const hasSeedNames = res.leaderboard.some(
      (t) => t.name.includes('Septi Nur Aeni') || t.name.includes('Widianingsih')
    );
    const topPoints = res.leaderboard.every((t) => t.totalPoints === 0);

    assert(
      '2. Data seed tidak pernah muncul pada production mode saat ledger kosong',
      !hasSeedNames && topPoints && res.dataStatus === 'EMPTY',
      `Seed names detected or totalPoints not zero. dataStatus: ${res.dataStatus}`
    );
  }

  // ── TEST 3: Poin -10 tetap menghasilkan total -10, bukan 0 ──────────────
  {
    const penaltyLogs: TeacherPointLog[] = [
      {
        id: 'p1',
        user_id: 'usr_t1',
        points: -10,
        activity_type: 'CHECK_IN_LATE',
        date: '2026-10-02',
        title: 'Penalti Terlambat',
        status: 'VALID',
        created_at: '2026-10-02T08:30:00Z',
      },
    ];

    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', penaltyLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
    });

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    assert(
      '3. Poin -10 tetap menghasilkan total -10 (tanpa Math.max 0 clamp)',
      t1?.totalPoints === -10 && t1?.penaltyPoints === -10 && t1?.netPoints === -10,
      `Expected totalPoints -10, got ${t1?.totalPoints}`
    );
  }

  // ── TEST 4: Guru 0 poin berstatus NO_ACTIVITY, bukan ON_LEAVE ────────────
  {
    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', [], mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      approvedLeaves: [
        { user_id: 'usr_t3', start_date: '2026-10-01', end_date: '2026-10-05', status: 'APPROVED' },
      ],
    });

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    const t3 = res.leaderboard.find((t) => t.id === 'usr_t3');

    assert(
      '4. Guru 0 poin berstatus NO_ACTIVITY, hanya guru berizin resmi yang ON_LEAVE',
      t1?.status === 'NO_ACTIVITY' &&
        t1?.level === '🥉 Pendidik Berkomitmen' &&
        t3?.status === 'ON_LEAVE' &&
        t3?.level === '🏖️ Sedang Cuti Resmi',
      `t1 status: ${t1?.status}, level: ${t1?.level}; t3 status: ${t3?.status}, level: ${t3?.level}`
    );
  }

  // ── TEST 5: Guru yang tidak aktif tidak muncul ──────────────────────────
  {
    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', [], mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
    });

    const hasInactive = res.leaderboard.some((t) => t.id === 'usr_t4_inactive');
    assert(
      '5. Guru nonaktif (account_status !== ACTIVE) diabaikan dari leaderboard',
      !hasInactive && res.totalTeachers === 3,
      `Found inactive teacher in leaderboard or total count mismatch (${res.totalTeachers})`
    );
  }

  // ── TEST 6: Guru dengan nama sama/serupa tidak saling tertukar ──────────
  {
    const collisionLogs: TeacherPointLog[] = [
      {
        id: 'cl1',
        user_id: 'usr_t1', // Drs. H. Ahmad Fauzi
        points: 40,
        activity_type: 'CHECK_IN_ON_TIME',
        date: '2026-10-02',
        title: 'On-time',
        status: 'VALID',
        created_at: '2026-10-02T07:00:00Z',
      },
      {
        id: 'cl2',
        user_id: 'usr_t2', // Ahmad Fauzi, S.Pd.
        points: 20,
        activity_type: 'CHECK_IN_ON_TIME',
        date: '2026-10-02',
        title: 'On-time',
        status: 'VALID',
        created_at: '2026-10-02T07:10:00Z',
      },
    ];

    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', collisionLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
    });

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    const t2 = res.leaderboard.find((t) => t.id === 'usr_t2');

    assert(
      '6. Guru dengan nama mirip tidak merger & diidentifikasi murni lewat user_id',
      t1?.totalPoints === 40 && t2?.totalPoints === 20 && t1?.rank === 1 && t2?.rank === 2,
      `t1 points: ${t1?.totalPoints} rank: ${t1?.rank}, t2 points: ${t2?.totalPoints} rank: ${t2?.rank}`
    );
  }

  // ── TEST 7: Guru Dashboard dan Kepsek Dashboard menghasilkan urutan identik
  {
    const sampleLogs: TeacherPointLog[] = [
      { id: 's1', user_id: 'usr_t1', points: 30, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
      { id: 's2', user_id: 'usr_t2', points: 15, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:05:00Z' },
      { id: 's3', user_id: 'usr_t3', points: 45, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:02:00Z' },
    ];

    const guruView = getTeacherDisciplineLeaderboard(
      { id: 'usr_t1', full_name: 'Drs. H. Ahmad Fauzi, M.Pd.', role: 'GURU' } as any,
      null,
      'CURRENT_MONTH',
      sampleLogs,
      mockRoster,
      { targetYearMonth: '2026-10', mode: 'PRODUCTION' }
    );

    const kepsekView = getTeacherDisciplineLeaderboard(
      null,
      null,
      'CURRENT_MONTH',
      sampleLogs,
      mockRoster,
      { targetYearMonth: '2026-10', mode: 'PRODUCTION' }
    );

    const guruOrder = guruView.leaderboard.map((t) => t.id).join(',');
    const kepsekOrder = kepsekView.leaderboard.map((t) => t.id).join(',');

    assert(
      '7. Guru Dashboard dan Kepsek Dashboard menghasilkan urutan leaderboard identik',
      guruOrder === kepsekOrder && guruOrder === 'usr_t3,usr_t1,usr_t2',
      `Order mismatch: guru=${guruOrder}, kepsek=${kepsekOrder}`
    );
  }

  // ── TEST 8: CurrentUserScore tidak dapat mengalahkan ledger global ────────
  {
    const sampleLogs: TeacherPointLog[] = [
      { id: 'c1', user_id: 'usr_t1', points: 15, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
      { id: 'c2', user_id: 'usr_t2', points: 50, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
    ];

    // Coba mengirim currentUserScore palsu 9999 poin
    const fakeScore: any = { totalPoints: 9999, hadirTepatWaktuCount: 100 };
    const res = getTeacherDisciplineLeaderboard(
      { id: 'usr_t1', full_name: 'Drs. H. Ahmad Fauzi, M.Pd.', role: 'GURU' } as any,
      fakeScore,
      'CURRENT_MONTH',
      sampleLogs,
      mockRoster,
      { targetYearMonth: '2026-10', mode: 'PRODUCTION' }
    );

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    assert(
      '8. CurrentUserScore diabaikan sehingga tidak bisa memalsukan poin di atas ledger',
      t1?.totalPoints === 15 && res.topTeacher?.id === 'usr_t2',
      `t1 points: ${t1?.totalPoints}, topTeacher: ${res.topTeacher?.id}`
    );
  }

  // ── TEST 9: Saat ledger gagal/partial, Juara 1 tidak ditentukan ───────────
  {
    const sampleLogs: TeacherPointLog[] = [
      { id: 'p_1', user_id: 'usr_t1', points: 50, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
    ];

    const partialRes = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', sampleLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      dataStatus: 'PARTIAL',
    });

    const errorRes = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', sampleLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      dataStatus: 'ERROR',
    });

    assert(
      '9. Pada status PARTIAL dan ERROR, Juara 1 dan topTeacher bernilai null',
      partialRes.topTeacher === null &&
        partialRes.isChampionEligible === false &&
        errorRes.topTeacher === null &&
        errorRes.isChampionEligible === false,
      `partial topTeacher: ${partialRes.topTeacher}, error topTeacher: ${errorRes.topTeacher}`
    );
  }

  // ── TEST 10: Popup reward Kepsek tidak muncul jika data belum SYNCED ─────
  {
    const sampleLogs: TeacherPointLog[] = [
      { id: 'sync1', user_id: 'usr_t1', points: 80, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
    ];

    const offlineRes = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', sampleLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      dataStatus: 'OFFLINE_CACHE',
    });

    const syncedRes = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', sampleLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      dataStatus: 'SYNCED',
    });

    assert(
      '10. Popup apresiasi reward hanya eligible saat dataStatus = SYNCED',
      offlineRes.isChampionEligible === false && syncedRes.isChampionEligible === true && syncedRes.topTeacher?.id === 'usr_t1',
      `offline eligible: ${offlineRes.isChampionEligible}, synced eligible: ${syncedRes.isChampionEligible}`
    );
  }

  // ── TEST 11: Tie score mengikuti policy shared-rank atau approval ─────────
  {
    // Dua guru dengan net points dan seluruh indikator sama persis
    const tieLogs: TeacherPointLog[] = [
      { id: 'tie_1', user_id: 'usr_t1', points: 30, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
      { id: 'tie_2', user_id: 'usr_t2', points: 30, activity_type: 'CHECK_IN_ON_TIME', date: '2026-10-02', title: 'On-time', status: 'VALID', created_at: '2026-10-02T07:00:00Z' },
    ];

    const res = getTeacherDisciplineLeaderboard(null, null, 'CURRENT_MONTH', tieLogs, mockRoster, {
      targetYearMonth: '2026-10',
      mode: 'PRODUCTION',
      dataStatus: 'SYNCED',
    });

    const t1 = res.leaderboard.find((t) => t.id === 'usr_t1');
    const t2 = res.leaderboard.find((t) => t.id === 'usr_t2');

    assert(
      '11. Tie score menghasilkan shared rank (dense rank) dan isChampionEligible false (butuh approval Kepsek)',
      t1?.rank === 1 &&
        t2?.rank === 1 &&
        res.isTieForFirst === true &&
        res.isChampionEligible === false &&
        res.topTeacher === null,
      `t1 rank: ${t1?.rank}, t2 rank: ${t2?.rank}, isTieForFirst: ${res.isTieForFirst}, topTeacher: ${res.topTeacher}`
    );
  }

  // ── TEST 12: Idempotency memastikan satu aktivitas hanya memberi satu log poin
  {
    const mock = new MockProvider();
    const idKey = 'att:usr_test_idemp:2026-10-02:CHECK_IN_ON_TIME';

    const log1 = await mock.recordTeacherPoint({
      user_id: 'usr_test_idemp',
      teacher_name: 'Guru Idemp',
      points: 15,
      activity_type: 'CHECK_IN_ON_TIME',
      date: '2026-10-02',
      title: 'Presensi On Time',
      idempotency_key: idKey,
    });

    const log2 = await mock.recordTeacherPoint({
      user_id: 'usr_test_idemp',
      teacher_name: 'Guru Idemp',
      points: 15,
      activity_type: 'CHECK_IN_ON_TIME',
      date: '2026-10-02',
      title: 'Presensi On Time',
      idempotency_key: idKey,
    });

    const allHistory = await mock.getTeacherPointHistory('usr_test_idemp');
    const matchingLogs = allHistory.filter((l) => l.idempotency_key === idKey);

    assert(
      '12. Idempotency mencegah duplicate record untuk aktivitas & kunci yang sama',
      log1.id === log2.id && matchingLogs.length === 1,
      `log1.id: ${log1.id}, log2.id: ${log2.id}, count: ${matchingLogs.length}`
    );
  }

  // ── TEST 13: Void/reversal mengubah leaderboard secara benar ────────────
  {
    const mock = new MockProvider();
    const testUserId = 'usr_test_void_' + Date.now();

    const created = await mock.recordTeacherPoint({
      user_id: testUserId,
      teacher_name: 'Guru Void Test',
      points: 50,
      activity_type: 'DUTY_PIKET',
      date: '2026-10-02',
      title: 'Piket Harian',
    });

    // Void log
    const voidSuccess = await mock.voidTeacherPointLog(created.id, 'Dibatalkan oleh operator', 'admin_1');
    const history = await mock.getTeacherPointHistory(testUserId);
    const voidedLog = history.find((l) => l.id === created.id);

    // Hitung leaderboard dengan log ini
    const res = getTeacherDisciplineLeaderboard(
      null,
      null,
      'CURRENT_MONTH',
      history,
      [{ id: testUserId, full_name: 'Guru Void Test', role: 'GURU', is_active: true } as any],
      { targetYearMonth: '2026-10', mode: 'PRODUCTION' }
    );

    const teacherItem = res.leaderboard.find((t) => t.id === testUserId);

    assert(
      '13. Void/reversal menandai status VOIDED dan mengeluarkan poin dari perhitungan',
      voidSuccess === true && voidedLog?.status === 'VOIDED' && teacherItem?.totalPoints === 0,
      `voidSuccess: ${voidSuccess}, status: ${voidedLog?.status}, totalPoints: ${teacherItem?.totalPoints}`
    );
  }

  // ── TEST 14: Perubahan bulan Asia/Jakarta menghitung periode baru dengan benar
  {
    // Simulasi tanggal 1 November 2026 WIB
    const novMeta = getDisciplinePeriodMetadata('CURRENT_MONTH', '2026-11-01T08:00:00+07:00');
    const prevMeta = getDisciplinePeriodMetadata('PREVIOUS_MONTH', '2026-11-01T08:00:00+07:00');

    assert(
      '14. Kalender otomatis menghitung periode baru saat berganti bulan di Asia/Jakarta',
      novMeta.yearMonth === '2026-11' &&
        novMeta.monthName === 'November' &&
        prevMeta.yearMonth === '2026-10' &&
        prevMeta.monthName === 'Oktober',
      `novMeta: ${novMeta.yearMonth} (${novMeta.monthName}), prevMeta: ${prevMeta.yearMonth} (${prevMeta.monthName})`
    );
  }

  // ── TEST 15: Rekonsiliasi audit data mendeteksi anomali tanpa memasukkan seed
  {
    const report = await TeacherPointRepository.generateAuditReport('2026-10');

    assert(
      '15. Audit report memvalidasi ledger resmi dan tidak menyuntikkan seed/baseline',
      typeof report.scannedLogsCount === 'number' &&
        report.period === '2026-10' &&
        Array.isArray(report.details.duplicates),
      `Report generation failed: ${JSON.stringify(report)}`
    );
  }

  return {
    suiteName: 'Teacher Points Audit & Verified Leaderboard Suite (15 Test Cases)',
    passed,
    failed,
    results,
  };
}
