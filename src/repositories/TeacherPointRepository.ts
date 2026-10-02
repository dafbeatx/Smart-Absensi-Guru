import { ProviderFactory } from '../providers/provider-factory';
import type {
  TeacherPointLog,
  TeacherRewardDecision,
  TeacherPointAuditReport,
  TeacherLeaderboardDataStatus,
  UserProfile,
} from '../types/database.types';
import {
  getTeacherDisciplineLeaderboard,
  type TeacherDisciplineLeaderboardResult,
  type DisciplinePeriodType,
} from '../utils/teacher-appreciation.utils';
import { getTodayDateInJakarta } from '../utils/time.utils';
import { logger } from '../utils/logger.utils';

export interface VerifiedLeaderboardFetchOptions {
  period?: DisciplinePeriodType;
  targetYearMonth?: string;
  referenceDate?: Date | string;
  allowSeedInTest?: boolean;
  token?: string;
  currentUser?: UserProfile | null;
}

export class TeacherPointRepository {
  /**
   * Mengambil leaderboard disiplin guru terverifikasi dari satu-satunya buku besar resmi (ledger).
   * Menjamin urutan identik untuk seluruh role (Guru, Admin, Operator, Kepsek).
   */
  public static async getVerifiedLeaderboard(
    options: VerifiedLeaderboardFetchOptions = {}
  ): Promise<TeacherDisciplineLeaderboardResult> {
    const period = options.period || 'CURRENT_MONTH';
    const provider = ProviderFactory.getProvider();

    let allPointLogs: TeacherPointLog[] = [];
    let registeredTeachers: UserProfile[] = [];
    let approvedLeaves: Array<{ user_id: string; start_date: string; end_date: string; status: string }> = [];
    let dataStatus: TeacherLeaderboardDataStatus = 'SYNCED';
    let errorMessage: string | undefined;

    try {
      // 1. Ambil seluruh buku besar poin (ledger) resmi
      allPointLogs = await provider.getTeacherPointHistory('ALL', options.token);

      // 2. Ambil roster guru aktif terdaftar
      try {
        let users: UserProfile[] = [];
        if (typeof (provider as any).getRegisteredTeachers === 'function') {
          users = await (provider as any).getRegisteredTeachers(options.token);
        } else if (typeof (provider as any).getAllUsers === 'function') {
          users = await (provider as any).getAllUsers(options.token || '');
        }
        if (Array.isArray(users)) {
          registeredTeachers = users;
        }
      } catch (errUsers) {
        logger.warn('TeacherPointRepository', 'Failed to fetch registered teachers from cloud:', errUsers);
      }

      // 3. Ambil data izin/cuti resmi yang disetujui (untuk status ON_LEAVE riil)
      try {
        let leaves: any[] = [];
        if (typeof (provider as any).getAllLeaves === 'function') {
          leaves = await (provider as any).getAllLeaves(options.token || '');
        } else if (typeof (provider as any).getLeaves === 'function') {
          leaves = await (provider as any).getLeaves(options.token);
        }
        if (Array.isArray(leaves)) {
          approvedLeaves = leaves
            .filter((l) => l.approval_status === 'APPROVED' || l.status === 'APPROVED')
            .map((l) => ({
              user_id: l.user_id,
              start_date: l.start_date,
              end_date: l.end_date,
              status: 'APPROVED',
            }));
        }
      } catch (errLeaves) {
        logger.warn('TeacherPointRepository', 'Failed to fetch approved leaves:', errLeaves);
      }

      if (!allPointLogs || allPointLogs.length === 0) {
        dataStatus = 'EMPTY';
      }
    } catch (err: any) {
      logger.error('TeacherPointRepository', 'Error fetching point history ledger:', err);
      dataStatus = 'ERROR';
      errorMessage = err?.message || 'Gagal memuat buku besar poin dari server.';
    }

    // Resolusi Target YearMonth
    let resolvedYearMonth = options.targetYearMonth;
    if (!resolvedYearMonth) {
      const todayWib = getTodayDateInJakarta(options.referenceDate);
      const currYear = parseInt(todayWib.substring(0, 4), 10);
      const currMonth = parseInt(todayWib.substring(5, 7), 10);

      if (period === 'CURRENT_MONTH') {
        resolvedYearMonth = `${currYear}-${String(currMonth).padStart(2, '0')}`;
      } else {
        const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
        const prevYear = currMonth === 1 ? currYear - 1 : currYear;
        resolvedYearMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      }
    }

    return getTeacherDisciplineLeaderboard(
      options.currentUser || null,
      null, // DILARANG mengirim currentUserScore untuk mengoverride ledger global!
      period,
      allPointLogs,
      registeredTeachers,
      {
        targetYearMonth: resolvedYearMonth,
        referenceDate: options.referenceDate,
        mode: options.allowSeedInTest ? 'TEST' : 'PRODUCTION',
        allowSeedInTest: options.allowSeedInTest,
        dataStatus,
        errorMessage,
        approvedLeaves,
      }
    );
  }

  /**
   * Mengambil keputusan apresiasi/hadiah juara dari Kepala Sekolah
   */
  public static async getRewardDecision(
    period: string,
    token?: string
  ): Promise<TeacherRewardDecision | null> {
    const provider = ProviderFactory.getProvider();
    if (typeof provider.getTeacherRewardDecision === 'function') {
      return await provider.getTeacherRewardDecision(period, token);
    }
    // Fallback toleran jika provider belum implementasi
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const key = `smart_absensi_reward_decision_${period.replace(/\s+/g, '_')}`;
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  /**
   * Menyimpan keputusan apresiasi/hadiah juara dari Kepala Sekolah secara resmi
   */
  public static async saveRewardDecision(
    decision: TeacherRewardDecision,
    token?: string
  ): Promise<TeacherRewardDecision> {
    if (!decision.period || !decision.teacher_user_id || !decision.reward_detail) {
      throw new Error('VALIDATION_ERROR: Periode, Guru Juara, dan Rincian Hadiah wajib diisi.');
    }

    const provider = ProviderFactory.getProvider();
    if (typeof provider.saveTeacherRewardDecision === 'function') {
      return await provider.saveTeacherRewardDecision(decision, token);
    }

    // Fallback lokal jika mock provider tanpa method
    const saved: TeacherRewardDecision = {
      ...decision,
      id: decision.id || 'rew_' + Date.now(),
      approved_at: decision.approved_at || new Date().toISOString(),
    };
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const key = `smart_absensi_reward_decision_${decision.period.replace(/\s+/g, '_')}`;
      localStorage.setItem(key, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent('smart_absensi_reward_decision_updated', { detail: saved }));
    }
    return saved;
  }

  /**
   * Membatalkan/void log poin guru secara aman tanpa penghapusan fisik destruktif
   */
  public static async voidPointLog(
    logId: string,
    reason: string,
    actorId: string,
    token?: string
  ): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    if (typeof provider.voidTeacherPointLog === 'function') {
      return await provider.voidTeacherPointLog(logId, reason, actorId, token);
    }
    return false;
  }

  /**
   * Mengaudit konsistensi data buku besar poin guru untuk periode tertentu
   */
  public static async generateAuditReport(
    yearMonth: string,
    token?: string
  ): Promise<TeacherPointAuditReport> {
    const provider = ProviderFactory.getProvider();
    const allLogs = await provider.getTeacherPointHistory('ALL', token);
    let users: UserProfile[] = [];
    if (typeof (provider as any).getRegisteredTeachers === 'function') {
      users = await (provider as any).getRegisteredTeachers(token);
    } else if (typeof (provider as any).getAllUsers === 'function') {
      users = await (provider as any).getAllUsers(token || '');
    }

    const userMap = new Map<string, UserProfile>();
    users.forEach((u) => {
      if (u.id) userMap.set(u.id, u);
    });

    const duplicates: string[] = [];
    const unrecognizedUsers = new Set<string>();
    const inactiveUsers = new Set<string>();
    const wrongMonthLogs: string[] = [];
    const userTotals = new Map<string, number>();

    const seenIdempotency = new Set<string>();

    for (const log of allLogs) {
      const logMonth = (log.date || log.created_at || '').substring(0, 7);
      if (logMonth !== yearMonth) {
        wrongMonthLogs.push(`Log ID ${log.id} (${log.date}) berada di luar bulan target ${yearMonth}`);
        continue;
      }

      // Cek duplikasi
      const key = log.idempotency_key || `${log.user_id}:${log.date}:${log.activity_type}`;
      if (seenIdempotency.has(key)) {
        duplicates.push(key);
      } else {
        seenIdempotency.add(key);
      }

      // Cek apakah user_id valid
      const user = userMap.get(log.user_id);
      if (!user) {
        unrecognizedUsers.add(log.user_id);
      } else if ((user as any).account_status && (user as any).account_status !== 'ACTIVE') {
        inactiveUsers.add(log.user_id);
      }

      // Akumulasi poin
      const current = userTotals.get(log.user_id) || 0;
      userTotals.set(log.user_id, current + (Number(log.points) || 0));
    }

    const negativeTotals: { userId: string; netPoints: number }[] = [];
    userTotals.forEach((total, uid) => {
      if (total < 0) {
        negativeTotals.push({ userId: uid, netPoints: total });
      }
    });

    return {
      period: yearMonth,
      scannedLogsCount: allLogs.length,
      duplicateLogsCount: duplicates.length,
      unrecognizedUserIdsCount: unrecognizedUsers.size,
      inactiveUsersWithLogsCount: inactiveUsers.size,
      wrongMonthLogsCount: wrongMonthLogs.length,
      negativeTotalUsersCount: negativeTotals.length,
      mismatchedScoreUsersCount: 0,
      ambiguousIdentitiesCount: 0,
      details: {
        duplicates,
        unrecognizedUsers: Array.from(unrecognizedUsers),
        inactiveUsers: Array.from(inactiveUsers),
        wrongMonthLogs,
        negativeTotals,
        ambiguousIdentities: [],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
