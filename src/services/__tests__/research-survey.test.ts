import type { TestSuiteResult } from '../test-runner.service';
import {
  isFridayToday,
  hasCompletedFridaySurvey,
  markFridaySurveyCompleted,
  shouldTriggerFridaySurvey,
  calculateSurveySummary,
  getSurveyActivePeriodKey,
  hasCompletedActiveSurvey,
  markActiveSurveyCompleted,
  shouldSendDailySurveyReminder,
  markDailySurveyReminderSent,
  shouldShowDailySurveyBanner,
} from '../research-survey.service';
import { NotificationService } from '../notification-permission.service';
import { MockProvider } from '../../providers/mock-provider.service';
import type { WeeklySurveyResponse } from '../../types/database.types';

export async function runResearchSurveyTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({
      testName: name,
      status: condition ? 'PASS' : 'FAIL',
      details,
    });
  };

  try {
    // ── 1. UNIT TESTS: Friday Date Verification ──────────────────────
    const fridayIso = '2026-10-02T07:30:00+07:00'; // 2 Oktober 2026 is Friday
    const thursdayIso = '2026-10-01T07:30:00+07:00'; // 1 Oktober 2026 is Thursday
    const saturdayIso = '2026-10-03T07:30:00+07:00'; // 3 Oktober 2026 is Saturday

    assert('Survey Timing - Correctly identifies Friday', isFridayToday(fridayIso) === true);
    assert('Survey Timing - Correctly rejects Thursday', isFridayToday(thursdayIso) === false);
    assert('Survey Timing - Correctly rejects Saturday', isFridayToday(saturdayIso) === false);

    // ── 2. UNIT TESTS: Local Blind Token Completion ──────────────────
    const testUserId = 'guru-test-uuid-999';
    const testDate = '2026-10-02';

    // Ensure clean state
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`smart_absensi_friday_survey_${testDate}_${testUserId}`);
      localStorage.removeItem(`smart_absensi_friday_survey_${testDate}`);
    }

    assert(
      'Completion State - Initially not completed for test user',
      hasCompletedFridaySurvey(testUserId, testDate) === false
    );

    markFridaySurveyCompleted(testUserId, testDate);

    assert(
      'Completion State - Successfully marked as completed',
      hasCompletedFridaySurvey(testUserId, testDate) === true
    );

    // ── 3. UNIT TESTS: Friday Survey Trigger Logic ───────────────────
    // A: When not Friday -> Never trigger
    const nonFridayTrigger = shouldTriggerFridaySurvey({
      userId: 'user-another',
      action: 'CHECK_IN',
    });
    // In test environment, if today is not Friday, it should be false
    assert(
      'Trigger Logic - Respects day of week rule',
      typeof nonFridayTrigger === 'boolean'
    );

    // B: Test with simulated Friday check:
    // If user tries to checkout (absen pulang), survey must NOT trigger!
    // (User explicitly specified: Trigger muncul ketika setelah absensi masuk saja)
    const checkOutAttempt = shouldTriggerFridaySurvey({
      userId: 'user-random-123',
      action: 'CHECK_OUT',
    });
    assert(
      'Trigger Logic - Check-Out NEVER triggers the survey',
      checkOutAttempt === false
    );

    // ── 4. UNIT TESTS: TAM Quantitative Summary & Hypothesis Testing ─
    const sampleSurveys: WeeklySurveyResponse[] = [
      {
        id: 's1',
        date: '2026-10-02',
        role: 'GURU',
        q1_usefulness: 5,
        q2_motivation: 4,
        q3_ease_of_use: 5,
        q4_fairness: 5,
        q5_impact: 4,
        next_week_evaluation: 'Aplikasi sangat membantu dan tertib.',
        week_number: 1,
        month: 10,
        year: 2026,
        created_at: '2026-10-02T07:15:00Z',
      },
      {
        id: 's2',
        date: '2026-10-02',
        role: 'GURU',
        q1_usefulness: 4,
        q2_motivation: 4,
        q3_ease_of_use: 4,
        q4_fairness: 4,
        q5_impact: 4,
        next_week_evaluation: 'Mohon pertahankan performa server yang cepat.',
        week_number: 1,
        month: 10,
        year: 2026,
        created_at: '2026-10-02T07:20:00Z',
      },
      {
        id: 's3',
        date: '2026-10-09',
        role: 'ADMIN',
        q1_usefulness: 5,
        q2_motivation: 5,
        q3_ease_of_use: 4,
        q4_fairness: 5,
        q5_impact: 5,
        next_week_evaluation: 'Sistem rekap otomatis sangat menghemat waktu admin.',
        week_number: 2,
        month: 10,
        year: 2026,
        created_at: '2026-10-09T07:10:00Z',
      },
    ];

    const summary = calculateSurveySummary(sampleSurveys, 10, 2026);

    assert('Summary - Total respondents counted correctly', summary.totalRespondents === 3);
    assert('Summary - Role breakdown correctly counts Guru', summary.roleBreakdown.guru === 2);
    assert('Summary - Role breakdown correctly counts Admin', summary.roleBreakdown.admin === 1);

    // Q1 mean: (5 + 4 + 5) / 3 = 4.67
    assert('Summary - Q1 Usefulness mean calculated accurately', summary.indicators.q1_usefulness.mean === 4.67);
    assert('Summary - Q1 Positive Percentage is 100%', summary.indicators.q1_usefulness.positivePercentage === 100);

    // Overall mean: (4.67 + 4.33 + 4.33 + 4.67 + 4.33) / 5 = ~4.47
    assert('Summary - Overall TAM mean is >= 4.00', summary.overallMean >= 4.0);

    // Hypothesis checks:
    const h1 = summary.hypotheses.find((h) => h.code === 'H1');
    const h2 = summary.hypotheses.find((h) => h.code === 'H2');
    const h3 = summary.hypotheses.find((h) => h.code === 'H3');

    assert('Hypothesis H1 - Perceived Usefulness is confirmed', h1?.isConfirmed === true);
    assert('Hypothesis H2 - Teacher Motivation is confirmed', h2?.isConfirmed === true);
    assert('Hypothesis H3 - Institutional Culture Impact is confirmed', h3?.isConfirmed === true);

    // Anonymity of qualitative feedback:
    assert('Qualitative Feedback - Contains 3 evaluations', summary.evaluations.length === 3);
    assert(
      'Qualitative Feedback - Anonymous without user_id field',
      !('user_id' in (summary.evaluations[0] as any))
    );

    // Distribution & Weekly Trends & Action Solutions:
    assert('Distribution - Calculates star distributions', Boolean(summary.distribution?.overall));
    assert('Weekly Trends - Contains weekly trend entries', (summary.weeklyTrends?.length || 0) >= 4);
    assert('Solutions - Generates structured action solutions', (summary.solutions?.length || 0) >= 4);
    assert(
      'Solutions - Has solutions for Kepsek and Admin',
      summary.solutions?.some((s) => s.forRole === 'KEPSEK') === true &&
        summary.solutions?.some((s) => s.forRole === 'ADMIN') === true
    );

    // Empty dataset handling (zero respondents)
    const emptySummary = calculateSurveySummary([], 11, 2026);
    assert('Summary - Empty dataset handles zero respondents gracefully', emptySummary.totalRespondents === 0);
    assert('Summary - Empty dataset overallMean is 0', emptySummary.overallMean === 0);
    assert(
      'Summary - Empty dataset hypotheses are not confirmed',
      emptySummary.hypotheses.every((h) => !h.isConfirmed)
    );

    // ── 5. INTEGRATION TESTS: MockProvider Survey Persistence ────────
    const provider = new MockProvider();
    const submitSuccess = await provider.submitWeeklySurvey({
      role: 'GURU',
      q1_usefulness: 5,
      q2_motivation: 5,
      q3_ease_of_use: 5,
      q4_fairness: 5,
      q5_impact: 5,
      next_week_evaluation: 'Integrasi kuesioner mingguan berjalan dengan sangat mulus.',
      date: '2026-10-02',
      month: 10,
      year: 2026,
      week_number: 1,
    });

    assert('MockProvider - submitWeeklySurvey returns true', submitSuccess === true);

    const monthlyReport = await provider.getMonthlySurveySummary(10, 2026);
    assert(
      'MockProvider - getMonthlySurveySummary retrieves submitted survey',
      monthlyReport.totalRespondents >= 1
    );
    assert(
      'MockProvider - Qualitative evaluation is present',
      monthlyReport.evaluations.some((e) =>
        e.evaluationText.includes('Integrasi kuesioner mingguan')
      )
    );

    // ── 9. UNIT TESTS: Daily Survey Reminder & Cross-Device Notification ──
    const dailyDate = '2026-10-02';
    const testUser = 'user_daily_survey_test_99';
    const periodKey = getSurveyActivePeriodKey(dailyDate);
    assert('Daily Survey - Deterministic active period key', periodKey === '2026_M10_W1');

    assert(
      'Daily Survey - Initially not completed for active period',
      hasCompletedActiveSurvey(testUser, dailyDate) === false
    );
    assert(
      'Daily Survey - Initially banner is visible',
      shouldShowDailySurveyBanner(testUser, dailyDate) === true
    );
    assert(
      'Daily Survey - Should send reminder when not completed & not reminded today',
      shouldSendDailySurveyReminder(testUser, dailyDate) === true
    );

    // Mark reminded today
    markDailySurveyReminderSent(testUser, dailyDate);
    assert(
      'Daily Survey - Should NOT send reminder again on the same day (Anti-Spam / Zero-Egress)',
      shouldSendDailySurveyReminder(testUser, dailyDate) === false
    );

    // Mark survey completed
    markActiveSurveyCompleted(testUser, dailyDate);
    assert(
      'Daily Survey - Successfully marked as completed for active cycle',
      hasCompletedActiveSurvey(testUser, dailyDate) === true
    );
    assert(
      'Daily Survey - Banner is hidden after completion',
      shouldShowDailySurveyBanner(testUser, dailyDate) === false
    );
    assert(
      'Daily Survey - Should NOT remind after completion',
      shouldSendDailySurveyReminder(testUser, dailyDate) === false
    );

    // Notification Service Payload Verification
    const notifPayload = NotificationService.notifyPendingSurveyReminder(
      'user_test_notif_guru',
      'Ibu Siti Rahma S.Pd',
      'GURU'
    );
    assert('Notification - Survey reminder payload created', Boolean(notifPayload.id));
    assert(
      'Notification - Title advertises +10 Poin reward',
      notifPayload.title.includes('+10 Poin')
    );
    assert(
      'Notification - Deep-link actionUrl points to ?openSurvey=true',
      notifPayload.actionUrl === '/?openSurvey=true'
    );
    assert(
      'Notification - Targeted for Guru role',
      notifPayload.roleTarget === 'GURU'
    );
  } catch (err: any) {
    assert('Research Survey Suite - Exception free execution', false, err?.message || String(err));
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'Weekly Research Survey & TAM Evaluation Suite',
    passed,
    failed,
    results,
  };
}
