/**
 * TEST SUITE: EXAM PERIOD TOGGLE & AUTO-EXPIRATION SYSTEM
 * Validates manual toggle on-off and deterministic auto-expiration by date & time.
 */

import { ExamPeriodRepository } from '../../repositories/ExamPeriodRepository';
import type { ExamPeriodSettings } from '../../types/exam-schedule.types';
import { ProviderFactory } from '../../providers/provider-factory';

export const runExamPeriodToggleTestSuite = async (): Promise<{
  suiteName: string;
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  const testYear = '2026/2027';

  // 1. computePeriodStatus: Manual ON without auto-deactivate
  const manualOnSettings: ExamPeriodSettings = {
    isEnabled: true,
    autoDeactivateEnabled: false,
    endDate: '2026-10-15',
    endTime: '17:00',
    academicYear: testYear,
    updatedAt: new Date().toISOString(),
  };
  const status1 = ExamPeriodRepository.computePeriodStatus(manualOnSettings, new Date('2026-10-20T10:00:00Z'));
  assert(
    status1.isActive === true && status1.statusLabel === 'AKTIF' && status1.isExpiredByTime === false,
    'Status 01: Manual ON without auto-deactivate remains active regardless of date',
    `Got: isActive=${status1.isActive}, statusLabel=${status1.statusLabel}`
  );

  // 2. computePeriodStatus: Manual OFF (Toggle turned off)
  const manualOffSettings: ExamPeriodSettings = {
    isEnabled: false,
    autoDeactivateEnabled: true,
    endDate: '2026-10-15',
    endTime: '17:00',
    academicYear: testYear,
    updatedAt: new Date().toISOString(),
  };
  const status2 = ExamPeriodRepository.computePeriodStatus(manualOffSettings, new Date('2026-10-10T10:00:00Z'));
  assert(
    status2.isActive === false && status2.isManuallyDisabled === true && status2.statusLabel === 'NONAKTIF_MANUAL',
    'Status 02: Manual OFF disables exam period even if before end date',
    `Got: isActive=${status2.isActive}, isManuallyDisabled=${status2.isManuallyDisabled}`
  );

  // 3. computePeriodStatus: Auto-deactivate BEFORE end time (Still Active)
  const autoActiveSettings: ExamPeriodSettings = {
    isEnabled: true,
    autoDeactivateEnabled: true,
    endDate: '2026-10-15',
    endTime: '17:00',
    academicYear: testYear,
    updatedAt: new Date().toISOString(),
  };
  // Reference date: 15 Oct 2026 at 10:00 AM (local time before 17:00)
  const refDateBefore = new Date(2026, 9, 15, 10, 0, 0); // Month is 0-indexed: 9 = Oct
  const status3 = ExamPeriodRepository.computePeriodStatus(autoActiveSettings, refDateBefore);
  assert(
    status3.isActive === true && status3.isExpiredByTime === false && status3.statusLabel === 'AKTIF',
    'Status 03: Auto-deactivate is active when reference date/time is before expiry',
    `Got: isActive=${status3.isActive}, statusLabel=${status3.statusLabel}`
  );

  // 4. computePeriodStatus: Auto-deactivate AFTER end time (Automatically Expired)
  // Reference date: 15 Oct 2026 at 18:00 (1 hour after 17:00)
  const refDateAfter = new Date(2026, 9, 15, 18, 0, 0);
  const status4 = ExamPeriodRepository.computePeriodStatus(autoActiveSettings, refDateAfter);
  assert(
    status4.isActive === false && status4.isExpiredByTime === true && status4.statusLabel === 'TELAH_USAI_WAKTU',
    'Status 04: Auto-deactivate marks exam as ended when reference date/time has passed',
    `Got: isActive=${status4.isActive}, isExpiredByTime=${status4.isExpiredByTime}, label=${status4.statusLabel}`
  );

  // 5. computePeriodStatus: Default null settings returns safe active state
  const statusDefault = ExamPeriodRepository.computePeriodStatus(null);
  assert(
    statusDefault.isActive === true && statusDefault.statusLabel === 'AKTIF',
    'Status 05: Null settings safely defaults to active',
    `Got: isActive=${statusDefault.isActive}`
  );

  // 6. Persistence: savePeriodSettings and getPeriodStatus via Provider and LocalStorage
  const testSettingsToSave: ExamPeriodSettings = {
    isEnabled: true,
    autoDeactivateEnabled: true,
    endDate: '2026-10-25',
    endTime: '16:30',
    examTitle: 'ASTS Gasal 2026/2027',
    academicYear: testYear,
    hideCommitteeBanner: true,
    hideExamDutiesCard: true,
    hideAdministrationModules: true,
    updatedAt: new Date().toISOString(),
  };

  const saveOk = await ExamPeriodRepository.savePeriodSettings(testSettingsToSave);
  assert(saveOk === true, 'Persistence 01: savePeriodSettings completes successfully');

  const loadedSettings = await ExamPeriodRepository.getPeriodSettings(testYear);
  assert(
    loadedSettings.endDate === '2026-10-25' &&
    loadedSettings.endTime === '16:30' &&
    loadedSettings.isEnabled === true &&
    loadedSettings.examTitle === 'ASTS Gasal 2026/2027',
    'Persistence 02: getPeriodSettings retrieves saved settings with exact matching values',
    `Got: endDate=${loadedSettings.endDate}, endTime=${loadedSettings.endTime}`
  );

  // 7. Toggle method: togglePeriod(false) immediately disables
  const toggledOff = await ExamPeriodRepository.togglePeriod(false, testYear);
  assert(
    toggledOff.isEnabled === false,
    'Toggle 01: togglePeriod(false) turns master switch OFF',
    `Got: isEnabled=${toggledOff.isEnabled}`
  );

  const statusAfterToggleOff = await ExamPeriodRepository.getPeriodStatus(testYear);
  assert(
    statusAfterToggleOff.isActive === false && statusAfterToggleOff.statusLabel === 'NONAKTIF_MANUAL',
    'Toggle 02: getPeriodStatus returns isActive=false after togglePeriod(false)',
    `Got: isActive=${statusAfterToggleOff.isActive}, statusLabel=${statusAfterToggleOff.statusLabel}`
  );

  // 8. Toggle method: togglePeriod(true) turns it back ON
  const toggledOn = await ExamPeriodRepository.togglePeriod(true, testYear);
  assert(
    toggledOn.isEnabled === true,
    'Toggle 03: togglePeriod(true) turns master switch back ON',
    `Got: isEnabled=${toggledOn.isEnabled}`
  );

  // 9. MockProvider / Provider integration direct check
  const provider = ProviderFactory.getProvider();
  const providerSettings = await provider.getExamPeriodSettings(testYear);
  assert(
    providerSettings !== null && providerSettings.isEnabled === true,
    'Provider 01: ProviderFactory directly retrieves exam period settings',
    `Got: isEnabled=${providerSettings?.isEnabled}`
  );

  // 10. Auto-expiration remainingText formatting check
  const expiryDateFormatted = status4.remainingText || '';
  assert(
    expiryDateFormatted.includes('Ujian telah usai'),
    'Formatting 01: remainingText informs clearly when exam has ended',
    `Got: remainingText=${expiryDateFormatted}`
  );

  return {
    suiteName: 'Exam Period Toggle & Auto-Expiration Suite (10 Kasus)',
    passed,
    failed,
    results,
  };
};
