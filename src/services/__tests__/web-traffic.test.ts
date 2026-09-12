/**
 * SMART ABSENSI GURU - WEB TRAFFIC & ACTIVITY TRACKING TEST SUITE
 */

import {
  WebTrafficService,
  extractDomain,
  inferCategoryFromUrl,
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
    // Test 1: Extract domain helper
    const domain1 = extractDomain('https://guru.kemdikbud.go.id/pelatihan-mandiri');
    const domain2 = extractDomain('https://www.canva.com/education/');
    const domain3 = extractDomain('classroom.google.com/u/0/h');
    assert(
      'Traffic - Extracts Clean Domain from URLs',
      domain1 === 'guru.kemdikbud.go.id' &&
      domain2 === 'canva.com' &&
      domain3 === 'classroom.google.com',
      `Got: ${domain1}, ${domain2}, ${domain3}`
    );

    // Test 2: Infer Category From URL / Website Name
    const cat1 = inferCategoryFromUrl('https://guru.kemdikbud.go.id/', 'Platform Merdeka Mengajar');
    const cat2 = inferCategoryFromUrl('https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/', 'Input Nilai');
    const cat3 = inferCategoryFromUrl('https://canva.com', 'Canva Edukasi');
    const cat4 = inferCategoryFromUrl('https://dapodik.kemdikbud.go.id', 'Dapodik Kemdikbud');
    const cat5 = inferCategoryFromUrl('https://belajar.kemdikbud.go.id', 'Rumah Belajar');
    assert(
      'Traffic - Infers Correct Educational Categories',
      cat1 === 'KURIKULUM_PMM' &&
      cat2 === 'PENILAIAN_RAPOR' &&
      cat3 === 'MEDIA_KBM' &&
      cat4 === 'ADMINISTRASI' &&
      cat5 === 'REFERENSI',
      `Categories: ${cat1}, ${cat2}, ${cat3}, ${cat4}, ${cat5}`
    );

    // Test 3: Record Visit & NPP Formatting
    const recorded = WebTrafficService.recordVisit({
      user_id: 'usr_test_99',
      user_name: 'Dewi Sartika, S.Pd.',
      user_npp: '199001012015012001',
      user_role: 'GURU',
      website_name: 'Platform Merdeka Mengajar (PMM)',
      url: 'https://guru.kemdikbud.go.id/',
      category: 'KURIKULUM_PMM',
      device: 'Desktop Windows (Chrome)',
    });

    assert(
      'Traffic - Records Visit with Formatted NPP Standard',
      recorded.user_npp.startsWith('NPP. ') &&
      recorded.domain === 'guru.kemdikbud.go.id' &&
      recorded.category === 'KURIKULUM_PMM',
      `Recorded: ${JSON.stringify(recorded)}`
    );

    // Test 4: Seed and Analytics Aggregation
    const analytics = WebTrafficService.getAnalytics();
    assert(
      'Traffic - Calculates Analytics Summary Accurately',
      analytics.totalVisits > 0 &&
      analytics.topWebsites.length > 0 &&
      analytics.categoryDistribution.length > 0 &&
      analytics.hourlyTrend.length === 11,
      `Total: ${analytics.totalVisits}, Top: ${analytics.topWebsite?.website_name}`
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

    // Test 6: Search Query Filter (Domain / Name / NPP)
    const searchLogs = WebTrafficService.getFilteredLogs({
      dateRange: 'ALL',
      searchQuery: 'Dewi Sartika',
    });
    assert(
      'Traffic - Filters Logs by Search Query',
      searchLogs.length >= 1 &&
      searchLogs.every((l) => l.user_name.includes('Dewi Sartika')),
      `Search count: ${searchLogs.length}`
    );

    // Test 7: Export to CSV
    const csv = WebTrafficService.exportToCSV([recorded]);
    assert(
      'Traffic - Generates Valid CSV Export Content',
      csv.includes('ID Kunjungan') &&
      csv.includes('NPP Pegawai') &&
      csv.includes('Dewi Sartika') &&
      csv.includes('guru.kemdikbud.go.id'),
      'CSV header and row verified'
    );
  } catch (err: any) {
    assert('Traffic - Test Execution Error', false, err?.message || String(err));
  }

  return { passed, failed, results };
};
