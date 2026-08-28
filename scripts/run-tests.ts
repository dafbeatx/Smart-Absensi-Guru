/**
 * SMART ABSENSI GURU — CLI TEST RUNNER SCRIPT
 * Run via: npm test / npx tsx scripts/run-tests.ts
 */

import { MasterTestRunner } from '../src/services/test-runner.service';

async function main() {
  console.log('\n============================================================');
  console.log('🧪 SMART ABSENSI GURU — EXECUTING MASTER TEST SUITE');
  console.log('============================================================\n');

  const summary = await MasterTestRunner.runAll();

  summary.suites.forEach((suite, idx) => {
    console.log(`📦 [Suite ${idx + 1}/${summary.totalSuites}] ${suite.suiteName}`);
    console.log(`   Passed: ${suite.passed} | Failed: ${suite.failed}`);
    suite.results.forEach((res) => {
      const icon = res.status === 'PASS' ? '✅' : '❌';
      console.log(`   ${icon} ${res.testName}${res.details ? ` (${res.details})` : ''}`);
    });
    console.log('');
  });

  console.log('============================================================');
  console.log(`📊 SUMMARY: ${summary.totalPassed} Passed, ${summary.totalFailed} Failed (${summary.durationMs} ms)`);
  console.log('============================================================\n');

  if (summary.totalFailed > 0) {
    console.log('❌ FAILED TESTS SUMMARY:');
    summary.suites.forEach((suite) => {
      suite.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`- [${suite.suiteName}] ${r.testName}: ${r.details || 'Assertion failed'}`);
        });
    });
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Test execution error:', err);
  process.exit(1);
});
