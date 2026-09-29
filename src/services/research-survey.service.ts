import { ProviderFactory } from '../providers/provider-factory';
import type {
  SubmitWeeklySurveyDTO,
  WeeklySurveyResponse,
  WeeklySurveySummary,
  SurveyHypothesisResult,
  SurveyAnonymousEvaluation,
} from '../types/database.types';
import { getJakartaDayOfWeek, getTodayDateInJakarta } from '../utils/time.utils';

const memStorage = new Map<string, string>();

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return memStorage.get(key) || null;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memStorage.set(key, value);
}

/**
 * Checks whether the current or specified date is Friday in Asia/Jakarta timezone.
 */
export function isFridayToday(dateOrStr?: Date | string): boolean {
  return getJakartaDayOfWeek(dateOrStr) === 5;
}

/**
 * Checks whether the user has completed the Friday survey for the given or current date.
 * Uses a blind local storage flag so the user is never repeatedly prompted on the same day.
 */
export function hasCompletedFridaySurvey(userId: string, dateStr?: string): boolean {
  const today = dateStr || getTodayDateInJakarta();
  const perUserKey = `smart_absensi_friday_survey_${today}_${userId || 'anon'}`;
  const deviceKey = `smart_absensi_friday_survey_${today}`;
  return safeGetStorage(perUserKey) === '1' || safeGetStorage(deviceKey) === '1';
}

/**
 * Marks the Friday survey as completed locally for the user and device.
 */
export function markFridaySurveyCompleted(userId: string, dateStr?: string): void {
  const today = dateStr || getTodayDateInJakarta();
  const perUserKey = `smart_absensi_friday_survey_${today}_${userId || 'anon'}`;
  const deviceKey = `smart_absensi_friday_survey_${today}`;
  safeSetStorage(perUserKey, '1');
  safeSetStorage(deviceKey, '1');
}

export interface ShouldTriggerSurveyParams {
  userId: string;
  action?: 'CHECK_IN' | 'CHECK_OUT';
  hasCheckedInToday?: boolean;
}

/**
 * Decides whether the mandatory Friday survey must be triggered:
 * 1. Must be Friday in Jakarta timezone.
 * 2. Must NOT have completed today's survey yet.
 * 3. Trigger condition: User just checked in (action === 'CHECK_IN') OR already checked in earlier today.
 */
export function shouldTriggerFridaySurvey(params: ShouldTriggerSurveyParams): boolean {
  if (!isFridayToday()) {
    return false;
  }
  if (hasCompletedFridaySurvey(params.userId)) {
    return false;
  }
  // Only trigger after check-in, never on check-out
  if (params.action === 'CHECK_IN' || params.hasCheckedInToday) {
    return true;
  }
  return false;
}

/**
 * Computes quantitative research summary, indicators, and hypothesis verification.
 */
export function calculateSurveySummary(
  surveys: WeeklySurveyResponse[],
  month: number,
  year: number
): WeeklySurveySummary {
  const filtered = surveys.filter((s) => s.month === month && s.year === year);
  const totalRespondents = filtered.length;

  const roleBreakdown = {
    guru: filtered.filter((s) => s.role === 'GURU').length,
    admin: filtered.filter((s) => s.role === 'ADMIN' || s.role === 'OPERATOR').length,
    kepsek: filtered.filter((s) => s.role === 'KEPSEK').length,
  };

  const calcIndicator = (
    key: 'q1_usefulness' | 'q2_motivation' | 'q3_ease_of_use' | 'q4_fairness' | 'q5_impact',
    title: string
  ) => {
    if (totalRespondents === 0) {
      return { mean: 0, positivePercentage: 0, title };
    }
    const sum = filtered.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    const mean = Number((sum / totalRespondents).toFixed(2));
    const positiveCount = filtered.filter((s) => (s[key] || 0) >= 4).length;
    const positivePercentage = Math.round((positiveCount / totalRespondents) * 100);
    return { mean, positivePercentage, title };
  };

  const indicators = {
    q1_usefulness: calcIndicator('q1_usefulness', 'Kemanfaatan Aplikasi (Perceived Usefulness)'),
    q2_motivation: calcIndicator('q2_motivation', 'Motivasi & Semangat Hadir (Extrinsic Motivation)'),
    q3_ease_of_use: calcIndicator('q3_ease_of_use', 'Kemudahan Antarmuka & Sistem (Ease of Use)'),
    q4_fairness: calcIndicator('q4_fairness', 'Keadilan & Transparansi Presensi (Fairness & Trust)'),
    q5_impact: calcIndicator('q5_impact', 'Dampak Budaya Disiplin Sekolah (Institutional Impact)'),
  };

  const overallMean =
    totalRespondents === 0
      ? 0
      : Number(
          (
            (indicators.q1_usefulness.mean +
              indicators.q2_motivation.mean +
              indicators.q3_ease_of_use.mean +
              indicators.q4_fairness.mean +
              indicators.q5_impact.mean) /
            5
          ).toFixed(2)
        );

  const hypotheses: SurveyHypothesisResult[] = [
    {
      code: 'H1',
      title: 'Hipotesis 1: Perceived Usefulness (Kemanfaatan Aplikasi)',
      description:
        'Penerapan Smart Absensi Guru secara signifikan mempermudah dan mengefektifkan pencatatan kehadiran serta operasional sekolah.',
      targetMetric: 'Rerata Q1 (Kemanfaatan) ≥ 3.80',
      meanScore: indicators.q1_usefulness.mean,
      threshold: 3.8,
      isConfirmed: indicators.q1_usefulness.mean >= 3.8,
      statusText:
        indicators.q1_usefulness.mean >= 3.8
          ? 'TERKONFIRMASI / DITERIMA (Efektivitas Tinggi)'
          : 'BELUM TERKONFIRMASI (Perlu Peningkatan Kemanfaatan)',
    },
    {
      code: 'H2',
      title: 'Hipotesis 2: Motivation & Gamification (Motivasi Kehadiran)',
      description:
        'Sistem poin kedisiplinan, reward, dan challenge memotivasi guru untuk hadir tepat waktu secara konsisten.',
      targetMetric: 'Rerata Q2 (Motivasi) ≥ 3.80',
      meanScore: indicators.q2_motivation.mean,
      threshold: 3.8,
      isConfirmed: indicators.q2_motivation.mean >= 3.8,
      statusText:
        indicators.q2_motivation.mean >= 3.8
          ? 'TERKONFIRMASI / DITERIMA (Motivasi Signifikan)'
          : 'BELUM TERKONFIRMASI (Perlu Evaluasi Skema Reward)',
    },
    {
      code: 'H3',
      title: 'Hipotesis 3: Institutional Impact (Transformasi Budaya Disiplin)',
      description:
        'Presensi digital yang transparan berdampak positif nyata terhadap kedisiplinan dan budaya kerja institusi sekolah.',
      targetMetric: 'Rerata Q5 (Dampak Budaya) ≥ 3.80',
      meanScore: indicators.q5_impact.mean,
      threshold: 3.8,
      isConfirmed: indicators.q5_impact.mean >= 3.8,
      statusText:
        indicators.q5_impact.mean >= 3.8
          ? 'TERKONFIRMASI / DITERIMA (Dampak Positif Nyata)'
          : 'BELUM TERKONFIRMASI (Perlu Pendampingan Kedisiplinan)',
    },
  ];

  const evaluations: SurveyAnonymousEvaluation[] = filtered
    .filter((s) => s.next_week_evaluation && s.next_week_evaluation.trim())
    .map((s) => ({
      id: s.id,
      role: s.role,
      date: s.date,
      evaluationText: s.next_week_evaluation.trim(),
      createdAt: s.created_at,
    }))
    .reverse();

  return {
    month,
    year,
    totalRespondents,
    roleBreakdown,
    indicators,
    overallMean,
    hypotheses,
    evaluations,
  };
}

export class ResearchSurveyService {
  /**
   * Submits anonymous weekly survey to active provider.
   */
  public static async submitSurvey(dto: SubmitWeeklySurveyDTO): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return provider.submitWeeklySurvey(dto);
  }

  /**
   * Fetches aggregated monthly survey summary & hypotheses validation.
   */
  public static async getMonthlySummary(month: number, year: number): Promise<WeeklySurveySummary> {
    const provider = ProviderFactory.getProvider();
    return provider.getMonthlySurveySummary(month, year);
  }
}
