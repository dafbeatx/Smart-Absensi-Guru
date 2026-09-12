/**
 * SMART ABSENSI GURU - IN-APP FEATURE & MENU USAGE TRAFFIC TEST SUITE
 */

import {
  WebTrafficService,
  INTERNAL_APP_FEATURES,
  getFeatureById,
  inferCategoryFromFeatureId,
} from '../web-traffic.service';

export const runWebTrafficTestSuite = async (): Promise<{
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
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    // Test 1: 18 Internal App Features Catalog
    const featKoreksi = getFeatureById('koreksi_soal');
    assert(
      'Traffic - Contains 18 Internal In-App Features Catalog',
      INTERNAL_APP_FEATURES.length === 18 &&
      featKoreksi !== undefined &&
      featKoreksi.name === 'Koreksi Soal & Input Nilai' &&
      INTERNAL_APP_FEATURES.some((f) => f.id === 'presensi') &&
      INTERNAL_APP_FEATURES.some((f) => f.id === 'student_good') &&
      INTERNAL_APP_FEATURES.some((f) => f.id === 'complaint'),
      `Features count: ${INTERNAL_APP_FEATURES.length}`
    );

    // Test 2: Category Inference from Feature ID
    const cat1 = inferCategoryFromFeatureId('koreksi_soal');
    const cat2 = inferCategoryFromFeatureId('presensi');
    const cat3 = inferCategoryFromFeatureId('student_discipline');
    const cat4 = inferCategoryFromFeatureId('emergency');
    assert(
      'Traffic - Infers Correct Internal Categories from Feature IDs',
      cat1 === 'AKADEMIK_NILAI' &&
      cat2 === 'PRESENSI_ABSENSI' &&
      cat3 === 'KESISWAAN_KARAKTER' &&
      cat4 === 'KOMUNIKASI_LAYANAN',
      `Categories: ${cat1}, ${cat2}, ${cat3}, ${cat4}`
    );

    // Test 3: Record In-App Feature Visit (Anonymous by Default)
    const recorded = WebTrafficService.recordFeatureVisit({
      user_id: 'usr_test_99',
      user_name: 'Dewi Sartika, S.Pd.',
      user_npp: '199001012015012001',
      user_role: 'GURU',
      feature_id: 'koreksi_soal',
      device: 'Desktop Windows (Chrome)',
    });

    assert(
      'Traffic - Records Feature Visit with Anonymized Display Identity',
      recorded.user_name === 'Guru Anonim' &&
      recorded.user_npp.startsWith('NPP.') &&
      recorded.feature_id === 'koreksi_soal' &&
      recorded.category === 'AKADEMIK_NILAI',
      `Recorded: ${JSON.stringify(recorded)}`
    );

    // Test 4: Analytics Aggregation (Top Feature, Category, Hourly Trend)
    const analytics = WebTrafficService.getAnalytics();
    assert(
      'Traffic - Calculates In-App Analytics Summary Accurately',
      analytics.totalVisits > 0 &&
      analytics.topFeatures.length > 0 &&
      analytics.categoryDistribution.length > 0 &&
      analytics.hourlyTrend.length === 11,
      `Total: ${analytics.totalVisits}, Top Feature: ${analytics.topFeature?.feature_name}`
    );

    // Test 5: Filter by Teacher
    const filteredByTeacher = WebTrafficService.getFilteredLogs({
      dateRange: 'ALL',
      teacherId: 'usr_test_99',
    });
    assert(
      'Traffic - Filters Logs by Teacher ID Correctly',
      filteredByTeacher.length >= 1 &&
      filteredByTeacher.every((l) => l.user_id === 'usr_test_99'),
      `Filtered count: ${filteredByTeacher.length}`
    );

    // Test 6: Search Query Filter (Feature Name / Keyword)
    const searchLogs = WebTrafficService.getFilteredLogs({
      dateRange: 'ALL',
      searchQuery: 'Koreksi Soal',
    });
    assert(
      'Traffic - Filters Logs by Feature Search Query',
      searchLogs.length >= 1 &&
      searchLogs.every((l) => l.feature_name.includes('Koreksi Soal')),
      `Search count: ${searchLogs.length}`
    );

    // Test 7: Export to CSV (Anonymous: No Teacher Personal Names)
    const csv = WebTrafficService.exportToCSV([recorded]);
    assert(
      'Traffic - Generates Valid Anonymous CSV Export Content',
      csv.includes('ID Aktivitas') &&
      csv.includes('Fitur / Menu Dibuka') &&
      csv.includes('Koreksi Soal') &&
      !csv.includes('Dewi Sartika'),
      'CSV header and row verified without personal names'
    );

    // Test 8: Admin Registered Teachers Mapping & Participation Rate
    const mockAdminTeachers: any[] = [
      { id: 'usr_test_99', name: 'Dewi Sartika, S.Pd.', npp: '199001012015012001' },
      { id: 'usr_active_teacher_2', name: 'Ahmad Dahlan, M.Pd.', npp: '198805052012011002' },
    ];
    const analyticsWithTeachers = WebTrafficService.getAnalytics(undefined, mockAdminTeachers);

    assert(
      'Traffic - Calculates Anonymous Teacher Participation Metrics Accurately',
      analyticsWithTeachers.uniqueTeachersCount === 1 &&
      analyticsWithTeachers.totalRegisteredTeachers === 2 &&
      analyticsWithTeachers.participationRate === 50,
      `Unique: ${analyticsWithTeachers.uniqueTeachersCount}, Total: ${analyticsWithTeachers.totalRegisteredTeachers}, Rate: ${analyticsWithTeachers.participationRate}%`
    );

    // Test 9: Legacy Seed Data Purging
    WebTrafficService.saveLogs([
      { id: 'traf_seed_fake_1', user_name: 'Fake Teacher', feature_name: 'Fake Feature' } as any,
      recorded,
    ]);
    const cleanLogs = WebTrafficService.getAllLogs();
    assert(
      'Traffic - Automatically Purges Legacy Fake Seed Logs',
      cleanLogs.every((l) => !l.id.startsWith('traf_seed_')) &&
      cleanLogs.some((l) => l.id === recorded.id),
      `Clean logs count: ${cleanLogs.length}`
    );
  } catch (err: any) {
    assert('Traffic - Test Execution Error', false, err?.message || String(err));
  }

  return { passed, failed, results };
};
