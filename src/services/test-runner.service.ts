/**
 * SMART ABSENSI GURU - MASTER TEST RUNNER SERVICE
 * Centralized test executor aggregating all 5 system test suites.
 */

import { runAttendanceEngineTestSuite } from './__tests__/attendance-engine.test';
import { runLeaveApprovalTestSuite } from './__tests__/leave-approval-engine.test';
import { runAnalyticsReportTestSuite } from './__tests__/analytics-report.test';
import { runAuditWhatsAppTestSuite } from './__tests__/audit-whatsapp.test';
import { runFeatureFlagsTestSuite } from '../config/__tests__/feature-flags.test';

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

export interface MasterTestSummary {
  totalPassed: number;
  totalFailed: number;
  totalSuites: number;
  durationMs: number;
  suites: TestSuiteResult[];
}

import { ProviderFactory } from '../providers/provider-factory';
import { MockProvider } from '../providers/mock-provider.service';

export class MasterTestRunner {
  public static async runAll(): Promise<MasterTestSummary> {
    ProviderFactory.setProvider(new MockProvider());
    const startTime = Date.now();
    const suites: TestSuiteResult[] = [];

    const suitesToRun = [
      { name: 'Attendance Engine & State Machine', fn: runAttendanceEngineTestSuite },
      { name: 'Leave & Approval State Machine', fn: runLeaveApprovalTestSuite },
      { name: 'Analytics & Multi-Sheet Report Engine', fn: runAnalyticsReportTestSuite },
      { name: 'Audit Log & WhatsApp Integration', fn: runAuditWhatsAppTestSuite },
      { name: 'Feature Flag System', fn: runFeatureFlagsTestSuite },
    ];

    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of suitesToRun) {
      try {
        const res = await suite.fn();
        totalPassed += res.passed;
        totalFailed += res.failed;
        suites.push({
          suiteName: suite.name,
          passed: res.passed,
          failed: res.failed,
          results: res.results,
        });
      } catch (err: unknown) {
        totalFailed += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        suites.push({
          suiteName: suite.name,
          passed: 0,
          failed: 1,
          results: [{ testName: `${suite.name} (Crash Error)`, status: 'FAIL', details: errMsg }],
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      totalPassed,
      totalFailed,
      totalSuites: suitesToRun.length,
      durationMs,
      suites,
    };
  }
}
