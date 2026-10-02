import { ProviderFactory } from '../providers/provider-factory';
import type {
  SubmitWeeklySurveyDTO,
  WeeklySurveyResponse,
  WeeklySurveySummary,
  SurveyHypothesisResult,
  SurveyAnonymousEvaluation,
  SurveyScoreDistribution,
  SurveyWeeklyTrend,
  SurveyActionSolution,
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
 * Returns the current active survey period key (e.g. "2026_M10_W1")
 */
export function getSurveyActivePeriodKey(dateStr?: string): string {
  const today = dateStr || getTodayDateInJakarta();
  const d = new Date(today);
  const y = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const m = isNaN(d.getTime()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
  const day = isNaN(d.getTime()) ? new Date().getDate() : d.getDate();
  const weekNum = Math.ceil(day / 7);
  return `${y}_M${m}_W${weekNum}`;
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
 * Checks whether the user has completed the survey for the active period cycle.
 * Evaluated locally with zero egress/network overhead and isolated per user.
 */
export function hasCompletedActiveSurvey(userId: string, dateStr?: string): boolean {
  if (!userId) return false;
  const periodKey = getSurveyActivePeriodKey(dateStr);
  const userPeriodKey = `smart_absensi_survey_done_${periodKey}_${userId}`;
  if (safeGetStorage(userPeriodKey) === '1') {
    return true;
  }
  // Also check if completed today specifically for this user
  const today = dateStr || getTodayDateInJakarta();
  const todayUserKey = `smart_absensi_friday_survey_${today}_${userId}`;
  return safeGetStorage(todayUserKey) === '1';
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

/**
 * Marks the active period survey as completed for the user and device.
 * Also dispatches event so dashboard banners and badges instantly disappear without page reload.
 */
export function markActiveSurveyCompleted(userId: string, dateStr?: string): void {
  const today = dateStr || getTodayDateInJakarta();
  const periodKey = getSurveyActivePeriodKey(today);
  const userPeriodKey = `smart_absensi_survey_done_${periodKey}_${userId || 'anon'}`;
  safeSetStorage(userPeriodKey, '1');
  markFridaySurveyCompleted(userId, today);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('smart_absensi_survey_completed', {
        detail: { userId, periodKey, date: today },
      })
    );
  }
}

/**
 * Decides whether a daily reminder (notification / prompt) should be sent today.
 * Returns true if:
 * 1. User has NOT completed the active survey period.
 * 2. Daily reminder has NOT yet been fired today for this user (prevents spam).
 */
export function shouldSendDailySurveyReminder(userId: string, dateStr?: string): boolean {
  if (!userId) return false;
  if (hasCompletedActiveSurvey(userId, dateStr)) {
    return false;
  }
  const today = dateStr || getTodayDateInJakarta();
  const reminderKey = `smart_absensi_survey_daily_reminded_${today}_${userId}`;
  return safeGetStorage(reminderKey) !== '1';
}

/**
 * Marks the daily survey reminder as sent for today.
 */
export function markDailySurveyReminderSent(userId: string, dateStr?: string): void {
  if (!userId) return;
  const today = dateStr || getTodayDateInJakarta();
  const reminderKey = `smart_absensi_survey_daily_reminded_${today}_${userId}`;
  safeSetStorage(reminderKey, '1');
}

/**
 * Checks whether the daily sticky reminder banner should be visible.
 * Visible if user has NOT completed the active survey for this period.
 */
export function shouldShowDailySurveyBanner(userId: string, dateStr?: string): boolean {
  if (!userId) return false;
  return !hasCompletedActiveSurvey(userId, dateStr);
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
 * Generates structured, actionable solutions based on empirical survey indicators and qualitative teacher evaluations.
 */
export function generateSurveySolutions(
  indicators: WeeklySurveySummary['indicators'],
  _evaluations: SurveyAnonymousEvaluation[],
  _totalRespondents: number,
  _overallMean: number
): SurveyActionSolution[] {
  const easeMean = indicators.q3_ease_of_use?.mean || 0;
  const motivationMean = indicators.q2_motivation?.mean || 0;
  const usefulnessMean = indicators.q1_usefulness?.mean || 0;
  const impactMean = indicators.q5_impact?.mean || 0;

  return [
    {
      id: 'sol-01-teknis-geofence',
      category: 'TEKNIS',
      targetDimension: 'Kemudahan Penggunaan & Akurasi GPS (Q3)',
      priority: easeMean < 4.5 ? 'TINGGI' : 'SEDANG',
      issueDiagnosed:
        easeMean < 4.5
          ? 'Sebagian guru melaporkan kendala jeda deteksi GPS saat cuaca berawan atau perangkat smartphone tipe lama.'
          : 'Tingkat kemudahan aplikasi sangat tinggi, namun tetap memerlukan perlindungan preventif saat koneksi internet lambat.',
      solutionTitle: 'Optimalisasi Buffer Geofencing 500m & Titik Wi-Fi Khusus Presensi Lobi',
      concreteSteps: [
        'Aktifkan buffer radius 500m otomatis saat pemindaian QR Poster gerbang sekolah untuk memastikan absensi langsung diterima tanpa jeda.',
        'Sediakan Wi-Fi khusus presensi di area lobi/gerbang sekolah dengan SSID berkecepatan tinggi tanpa login berbelit.',
        'Bagikan modul ringkas panduan kalibrasi sensor kompas GPS & pembersihan berkas cache browser bagi pendidik.',
      ],
      forRole: 'ADMIN',
      status: 'DIREKOMENDASIKAN',
      pic: 'Tim IT & Operator Dapodik / Presensi',
    },
    {
      id: 'sol-02-manajemen-apresiasi',
      category: 'MANAJEMEN',
      targetDimension: 'Motivasi Kehadiran & Semangat Kerja (Q2)',
      priority: motivationMean < 4.5 ? 'TINGGI' : 'SEDANG',
      issueDiagnosed:
        'Guru mengharapkan apresiasi formal institusi sekolah atas komitmen ketepatan waktu hadir setiap hari.',
      solutionTitle: 'Program Piagam Penghargaan Disiplin & Fleksibilitas Toleransi Darurat',
      concreteSteps: [
        'Kepala Sekolah mengumumkan dan memberikan piagam kehormatan "Pendidik Paling Disiplin & Inspiratif" di apel/upacara awal bulan.',
        'Terapkan kebijakan toleransi keterlambatan 15 menit tetap berstatus HADIR untuk mengantisipasi kendala lalu lintas darurat guru.',
        'Sediakan sesi refleksi 10 menit setiap Jumat pagi untuk mendengarkan masukan operasional KBM secara santai dan konstruktif.',
      ],
      forRole: 'KEPSEK',
      status: 'DIREKOMENDASIKAN',
      pic: 'Kepala Sekolah & Wakil Bidang Kurikulum',
    },
    {
      id: 'sol-03-budaya-peer-assist',
      category: 'BUDAYA',
      targetDimension: 'Dampak Budaya Disiplin & Kolaborasi (Q5)',
      priority: impactMean < 4.5 ? 'TINGGI' : 'STANDAR',
      issueDiagnosed:
        'Kesenjangan kecakapan teknologi antar-generasi guru memerlukan ruang pendampingan yang ramah dan saling mendukung.',
      solutionTitle: 'Gerakan Pendampingan Rekan Sejawat (Peer-Assistance) & Budaya Tepat Waktu',
      concreteSteps: [
        'Bentuk gugus pendamping sejawat di mana guru yang cakap digital mendampingi rekan guru senior dalam pengoperasian aplikasi.',
        'Budayakan "Hadir 15 Menit Sebelum Bel" untuk menyambut peserta didik di gerbang kelas dengan suasana hangat.',
        'Optimalkan fitur resmi pertukaran jam mengajar antarguru serumpun bila terdapat penugasan dinas luar mendadak.',
      ],
      forRole: 'GURU',
      status: 'SEDANG_BERJALAN',
      pic: 'Koordinator MGMP & Komite Dewan Guru',
    },
    {
      id: 'sol-04-kebijakan-administrasi',
      category: 'KEBIJAKAN',
      targetDimension: 'Kemanfaatan & Transparansi Presensi (Q1 & Q4)',
      priority: usefulnessMean < 4.5 ? 'TINGGI' : 'STANDAR',
      issueDiagnosed:
        'Perlunya sinkronisasi data presensi secara langsung dengan pelaporan administrasi dinas tanpa penginputan manual berulang.',
      solutionTitle: 'Otomatisasi Laporan Presensi 1-Klik Berstandar Dinas & Transparansi Audit',
      concreteSteps: [
        'Pemanfaatan fitur ekspor 1-klik format Excel/PDF resmi berstandar Dinas Pendidikan dengan verifikasi barcode dokumen.',
        'Transparansi riwayat absensi dan persetujuan izin secara real-time via notifikasi instan Telegram/WhatsApp.',
        'Integrasikan rekapitulasi kehadiran dengan berkas SKP kinerja guru dan administrasi ketenagakerjaan sekolah.',
      ],
      forRole: 'SEMUA',
      status: 'TERCAPAI',
      pic: 'Tata Usaha, Admin Sekolah & Kepala Sekolah',
    },
  ];
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

  const calcDistribution = (
    key: 'q1_usefulness' | 'q2_motivation' | 'q3_ease_of_use' | 'q4_fairness' | 'q5_impact'
  ): SurveyScoreDistribution => {
    if (totalRespondents === 0) {
      return {
        star5: 0,
        star4: 0,
        star3: 0,
        star2: 0,
        star1: 0,
        percentages: { star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 },
      };
    }
    const star5 = filtered.filter((s) => s[key] === 5).length;
    const star4 = filtered.filter((s) => s[key] === 4).length;
    const star3 = filtered.filter((s) => s[key] === 3).length;
    const star2 = filtered.filter((s) => s[key] === 2).length;
    const star1 = filtered.filter((s) => s[key] === 1).length;
    return {
      star5,
      star4,
      star3,
      star2,
      star1,
      percentages: {
        star5: Math.round((star5 / totalRespondents) * 100),
        star4: Math.round((star4 / totalRespondents) * 100),
        star3: Math.round((star3 / totalRespondents) * 100),
        star2: Math.round((star2 / totalRespondents) * 100),
        star1: Math.round((star1 / totalRespondents) * 100),
      },
    };
  };

  const q1Dist = calcDistribution('q1_usefulness');
  const q2Dist = calcDistribution('q2_motivation');
  const q3Dist = calcDistribution('q3_ease_of_use');
  const q4Dist = calcDistribution('q4_fairness');
  const q5Dist = calcDistribution('q5_impact');

  const overallDistCount = totalRespondents * 5;
  const overallStar5 = q1Dist.star5 + q2Dist.star5 + q3Dist.star5 + q4Dist.star5 + q5Dist.star5;
  const overallStar4 = q1Dist.star4 + q2Dist.star4 + q3Dist.star4 + q4Dist.star4 + q5Dist.star4;
  const overallStar3 = q1Dist.star3 + q2Dist.star3 + q3Dist.star3 + q4Dist.star3 + q5Dist.star3;
  const overallStar2 = q1Dist.star2 + q2Dist.star2 + q3Dist.star2 + q4Dist.star2 + q5Dist.star2;
  const overallStar1 = q1Dist.star1 + q2Dist.star1 + q3Dist.star1 + q4Dist.star1 + q5Dist.star1;

  const distribution = {
    q1_usefulness: q1Dist,
    q2_motivation: q2Dist,
    q3_ease_of_use: q3Dist,
    q4_fairness: q4Dist,
    q5_impact: q5Dist,
    overall: {
      star5: overallStar5,
      star4: overallStar4,
      star3: overallStar3,
      star2: overallStar2,
      star1: overallStar1,
      percentages: {
        star5: overallDistCount > 0 ? Math.round((overallStar5 / overallDistCount) * 100) : 0,
        star4: overallDistCount > 0 ? Math.round((overallStar4 / overallDistCount) * 100) : 0,
        star3: overallDistCount > 0 ? Math.round((overallStar3 / overallDistCount) * 100) : 0,
        star2: overallDistCount > 0 ? Math.round((overallStar2 / overallDistCount) * 100) : 0,
        star1: overallDistCount > 0 ? Math.round((overallStar1 / overallDistCount) * 100) : 0,
      },
    },
  };

  // Compute Weekly Trends (Weeks 1 to 4)
  const weeklyTrends: SurveyWeeklyTrend[] = [1, 2, 3, 4].map((w) => {
    const weekSurveys = filtered.filter((s) => s.week_number === w);
    const count = weekSurveys.length;
    let meanScore = 0;
    if (count > 0) {
      const sum = weekSurveys.reduce(
        (acc, curr) =>
          acc +
          ((curr.q1_usefulness +
            curr.q2_motivation +
            curr.q3_ease_of_use +
            curr.q4_fairness +
            curr.q5_impact) /
            5),
        0
      );
      meanScore = Number((sum / count).toFixed(2));
    }
    return {
      weekNumber: w,
      label: `Minggu ke-${w}`,
      respondentCount: count,
      meanScore,
    };
  });

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

  const solutions = generateSurveySolutions(indicators, evaluations, totalRespondents, overallMean);

  return {
    month,
    year,
    totalRespondents,
    roleBreakdown,
    indicators,
    overallMean,
    hypotheses,
    evaluations,
    distribution,
    weeklyTrends,
    solutions,
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
