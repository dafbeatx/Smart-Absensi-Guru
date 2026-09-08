import { pwaService } from '../pwa.service';
import { NotificationService } from '../notification-permission.service';
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

  // 7. Day-of-Week Checkout Target Schedule Rule (Senin-Kamis 13.00 vs Jumat 11.00)
  const mondayThursdayDate = new Date('2026-08-13T08:00:00'); // Thursday (day 4)
  const fridayDate = new Date('2026-08-14T08:00:00'); // Friday (day 5)

  const monThuTarget = NotificationService.getCheckoutTargetTimeForDate(mondayThursdayDate);
  const friTarget = NotificationService.getCheckoutTargetTimeForDate(fridayDate);

  assert('Checkout Schedule - Monday-Thursday target time is 13:00', monThuTarget.hours === 13 && monThuTarget.minutes === 0);
  assert('Checkout Schedule - Friday target time is 11:00', friTarget.hours === 11 && friTarget.minutes === 0);

  // 8. NotificationService Schedule & Cancel Checkout Reminder Safety
  let notifScheduleSafe = true;
  try {
    NotificationService.scheduleCheckoutReminder('Guru Test', 'user-123');
    NotificationService.cancelScheduledCheckoutReminder();
  } catch (e) {
    notifScheduleSafe = false;
  }
  assert('NotificationService - scheduleCheckoutReminder and cancel execute safely', notifScheduleSafe);

  // 9. VAPID Key URL-Safe Base64 to Uint8Array conversion
  const { urlBase64ToUint8Array } = await import('../notification-permission.service');
  const sampleVapid = 'BJxAOVY7XCFiipXVppN_IPu5rWUzXaLzhM33dytmGI6oQ0SES9Qspm3sTPYcz9euG1NhSOSZb8BHLShozXnotnI';
  const uint8Vapid = urlBase64ToUint8Array(sampleVapid);
  assert(
    'Web Push VAPID - urlBase64ToUint8Array converts P-256 public key (65 bytes uncompressed point)',
    uint8Vapid.length === 65 && uint8Vapid[0] === 4
  );

  // 10. Provider Push Subscription Save & Delete Lifecycle
  const { ProviderFactory } = await import('../../providers/provider-factory');
  const provider = ProviderFactory.getProvider();
  const testSub = {
    user_id: 'usr_test_push_123',
    endpoint: 'https://fcm.googleapis.com/fcm/send/test_sub_endpoint_456',
    p256dh: 'BNcRdreALRF8FsII...',
    auth: 'tBHItDaAhsTBHig...',
    device_type: 'MOBILE' as const,
    user_agent: 'Test Browser',
  };

  const saveSubSuccess = await provider.savePushSubscription(testSub);
  assert('Push Subscription - Provider saves subscription payload successfully', saveSubSuccess === true);

  const deleteSubSuccess = await provider.deletePushSubscription(testSub.endpoint);
  assert('Push Subscription - Provider deletes subscription endpoint successfully', deleteSubSuccess === true);

  return {
    suiteName: 'PWA & Interactive Geofence Map',
    passed,
    failed,
    results,
  };
}
