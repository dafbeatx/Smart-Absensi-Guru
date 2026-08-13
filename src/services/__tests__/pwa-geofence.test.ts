import { pwaService } from '../pwa.service';
import { getEffectiveAllowedRadius, calculateDistanceMeters } from '../../utils/geofence.utils';
import type { TestSuiteResult } from '../test-runner.service';

export async function runPWAGeofenceTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];
  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS' });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  }

  // 1. PWA Standalone check
  const standalone = pwaService.isStandalone();
  assert('PWA Service - isStandalone returns boolean value', typeof standalone === 'boolean');

  // 2. PWA iOS check
  const isIOS = pwaService.isIOS();
  assert('PWA Service - isIOS returns boolean value', typeof isIOS === 'boolean');

  // 3. PWA canPromptInstall check
  assert('PWA Service - canPromptInstall initially returns false', pwaService.canPromptInstall() === false);

  // 4. Geofence Safe Radius Enforcer
  assert('Geofence Safe Radius - Enforces minimum 100m radius', getEffectiveAllowedRadius(50) === 100);
  assert('Geofence Safe Radius - Preserves configured 500m radius', getEffectiveAllowedRadius(500) === 500);

  // 5. Geofence Distance Math
  const schoolLat = -6.175392;
  const schoolLng = 106.827153;
  const distZero = calculateDistanceMeters(schoolLat, schoolLng, schoolLat, schoolLng);
  assert('Geofence Distance Math - Identical coords return 0m distance', distZero === 0);

  const nearLat = -6.176392;
  const distNear = calculateDistanceMeters(schoolLat, schoolLng, nearLat, schoolLng);
  assert('Geofence Distance Math - 0.001 deg offset measures ~111m', distNear > 100 && distNear < 120);

  // 6. Reminder scheduling safety
  let scheduleSafe = true;
  try {
    pwaService.scheduleAttendanceReminder('Test', 'Body', 1000);
  } catch (e) {
    scheduleSafe = false;
  }
  assert('PWA Service - scheduleAttendanceReminder executes without error in non-browser env', scheduleSafe);

  return {
    suiteName: 'PWA & Interactive Geofence Map',
    passed,
    failed,
    results,
  };
}
