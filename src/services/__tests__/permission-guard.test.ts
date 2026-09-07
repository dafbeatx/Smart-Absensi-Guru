import { PermissionGuardService } from '../permission-guard.service';
import type { TestSuiteResult } from '../test-runner.service';

/**
 * Suite 12: Permission Guard & Attendance Blocking Tests
 * Memastikan absensi diblokir secara deterministik jika guru belum memberikan izin notifikasi, GPS, atau kamera.
 * Memastikan penanganan pesan error transparan (anti hide error).
 */
export async function runPermissionGuardTestSuite(): Promise<TestSuiteResult> {
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

  // Simpan instance global asli
  const originalNotification = (globalThis as any).Notification;

  try {
    // 1. Cek fallback ketika Notification API tidak ada / unsupported
    (globalThis as any).Notification = undefined;
    const unsuppNotif = PermissionGuardService.checkNotificationPermission();
    assert(
      'Permission Guard - Detects unsupported Notification API gracefully',
      unsuppNotif.status === 'unsupported' && typeof unsuppNotif.error === 'string'
    );

    // 2. Cek status ketika Notification berstatus 'granted'
    (globalThis as any).Notification = { permission: 'granted' };
    const grantedNotif = PermissionGuardService.checkNotificationPermission();
    assert(
      'Permission Guard - Detects granted Notification status correctly',
      grantedNotif.status === 'granted' && grantedNotif.error === undefined
    );

    // 3. Cek status ketika Notification berstatus 'default' (prompt)
    (globalThis as any).Notification = { permission: 'default' };
    const promptNotif = PermissionGuardService.checkNotificationPermission();
    assert(
      'Permission Guard - Detects unconfirmed/prompt Notification status',
      promptNotif.status === 'prompt' && promptNotif.error !== undefined
    );

    // 4. Cek status ketika Notification berstatus 'denied' (diblokir)
    (globalThis as any).Notification = { permission: 'denied' };
    const deniedNotif = PermissionGuardService.checkNotificationPermission();
    assert(
      'Permission Guard - Detects denied/blocked Notification status',
      deniedNotif.status === 'denied' && deniedNotif.error !== undefined
    );

    // 5. Evaluasi Pemblokiran Absensi: Notifikasi ditolak memblokir absensi
    (globalThis as any).Notification = { permission: 'denied' };
    const reportBlocked = await PermissionGuardService.evaluatePermissions(false);
    assert(
      'Permission Guard - Blocks attendance when notification permission is denied',
      reportBlocked.isReadyForAttendance === false
    );
    assert(
      'Permission Guard - Captures transparent error without hiding error message',
      reportBlocked.rawErrors.length > 0 && reportBlocked.rawErrors[0].includes('[Notifikasi]')
    );

    // 6. Evaluasi Pemblokiran Kamera: requiresCamera memicu syarat kamera
    (globalThis as any).Notification = { permission: 'granted' };
    const reportNoCam = await PermissionGuardService.evaluatePermissions(false);
    assert(
      'Permission Guard - Camera is not mandatory when requiresCamera is false',
      reportNoCam.permissions.camera.isRequiredForAttendance === false
    );

    const reportWithCam = await PermissionGuardService.evaluatePermissions(true);
    assert(
      'Permission Guard - Camera is mandatory when requiresCamera is true',
      reportWithCam.permissions.camera.isRequiredForAttendance === true
    );

    // 7. Request Notification Safety
    (globalThis as any).Notification = {
      permission: 'default',
      requestPermission: async () => 'granted',
    };
    const reqResult = await PermissionGuardService.requestNotificationPermission();
    assert(
      'Permission Guard - requestNotificationPermission resolves granted correctly',
      reqResult.success === true && reqResult.status === 'granted'
    );

    // 8. Request Notification Denied Transparency (Jangan Hide Error)
    (globalThis as any).Notification = {
      permission: 'default',
      requestPermission: async () => 'denied',
    };
    const reqDenied = await PermissionGuardService.requestNotificationPermission();
    assert(
      'Permission Guard - requestNotificationPermission surfaces rejection error detail',
      reqDenied.success === false && typeof reqDenied.error === 'string' && reqDenied.error.includes('denied')
    );

  } finally {
    // Restore global
    if (originalNotification !== undefined) {
      (globalThis as any).Notification = originalNotification;
    } else {
      delete (globalThis as any).Notification;
    }
  }

  return {
    suiteName: 'Permission Guard & Attendance Blocking Engine',
    passed,
    failed,
    results,
  };
}
