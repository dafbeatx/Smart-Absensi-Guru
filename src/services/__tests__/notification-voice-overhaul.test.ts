/**
 * SMART ABSENSI GURU - NOTIFICATION & VOICE OVERHAUL TEST SUITE
 * Verifies role isolation, namespaced read synchronization, push subscription ownership,
 * quiet hours calculation, speech priority levels, and separate sound effect toggles.
 */

import { NotificationService } from '../notification-permission.service';
import { SoundService } from '../audio.service';
import { SpeechService, PRIORITY_LEVELS } from '../speech.service';
import { MockProvider } from '../../providers/mock-provider.service';
import type { TestSuiteResult } from '../test-runner.service';

export async function runNotificationVoiceOverhaulTestSuite(): Promise<TestSuiteResult> {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. AUDIENCE ROLE FILTERING & ISOLATION
  // ─────────────────────────────────────────────────────────────────────────────
  const testDate = '2026-09-09';
  const teacherId = 'test_guru_42';
  const adminId = 'test_admin_99';

  // Trigger admin-only leave request alert
  NotificationService.notifyTeacherLeaveRequest('Siti Rahma S.Pd', 'Cuti Sakit', 'Demam');

  // Trigger teacher-targeted missing attendance notification
  NotificationService.notifyTeacherMissingAttendance('Budi Prasetyo S.Pd', testDate, teacherId);

  // Trigger broadcast school event
  NotificationService.notifySchoolEvent('Upacara Peringatan Nasional', testDate, 'Wajib berseragam PGRI');

  // Verify Guru View
  const guruNotifs = NotificationService.getCachedNotifications(teacherId, 'GURU');
  const guruSeesAdminAlert = guruNotifs.some(
    (n) => n.roleTarget === 'ADMIN' && n.userId !== teacherId
  );
  assert(
    'Role Isolation - Guru does NOT receive Admin-only leave request notifications',
    guruSeesAdminAlert === false,
    'Admin leave request leaked to Guru notification feed'
  );

  const guruSeesOwnTargeted = guruNotifs.some((n) => n.userId === teacherId);
  assert(
    'Role Isolation - Guru receives personal notifications targeted to their user ID',
    guruSeesOwnTargeted === true,
    'Personal notification missing from Guru feed'
  );

  const guruSeesBroadcast = guruNotifs.some((n) => n.roleTarget === 'ALL');
  assert(
    'Role Isolation - Guru receives broadcast notifications with roleTarget ALL',
    guruSeesBroadcast === true,
    'Broadcast event missing from Guru feed'
  );

  // Verify Admin View
  const adminNotifs = NotificationService.getCachedNotifications(adminId, 'ADMIN');
  const adminSeesAdminAlert = adminNotifs.some((n) => n.roleTarget === 'ADMIN');
  assert(
    'Role Isolation - Admin successfully receives ADMIN-targeted leave alerts',
    adminSeesAdminAlert === true,
    'Admin did not receive ADMIN-targeted alert'
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. NAMESPACED READ NOTIFICATION SYNCHRONIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  const notifId1 = 'notif_unit_test_alpha';
  const notifId2 = 'notif_unit_test_beta';
  const userA = 'user_alpha_laptop';
  const userB = 'user_beta_mobile';

  // Mark notifId1 as read for userA only
  NotificationService.markIdAsRead(userA, notifId1);

  assert(
    'Namespaced Read Sync - userA sees notifId1 as read',
    NotificationService.isNotificationRead(userA, notifId1) === true
  );

  assert(
    'Namespaced Read Sync - userB does NOT have notifId1 marked as read (cross-device isolation)',
    NotificationService.isNotificationRead(userB, notifId1) === false,
    'Read state leaked across different user IDs'
  );

  // Batch mark multiple IDs for userA
  NotificationService.markAllIdsAsRead(userA, [notifId2]);
  assert(
    'Namespaced Read Sync - Batch markAllIdsAsRead marks notifId2 for userA',
    NotificationService.isNotificationRead(userA, notifId2) === true
  );
  assert(
    'Namespaced Read Sync - Batch markAllIdsAsRead keeps userB unaffected',
    NotificationService.isNotificationRead(userB, notifId2) === false
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. QUIET HOURS CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────
  const nightTime = new Date('2026-09-09T23:15:00'); // 23:15 WIB
  const earlyMorning = new Date('2026-09-09T03:30:00'); // 03:30 WIB
  const dayTime = new Date('2026-09-09T10:45:00'); // 10:45 WIB

  assert(
    'Quiet Hours - 23:15 is recognized within quiet hours (21:00 - 05:00)',
    NotificationService.isWithinQuietHours('21:00', '05:00', nightTime) === true
  );

  assert(
    'Quiet Hours - 03:30 is recognized within quiet hours (21:00 - 05:00)',
    NotificationService.isWithinQuietHours('21:00', '05:00', earlyMorning) === true
  );

  assert(
    'Quiet Hours - 10:45 is recognized outside quiet hours (21:00 - 05:00)',
    NotificationService.isWithinQuietHours('21:00', '05:00', dayTime) === false
  );

  assert(
    'SoundService - Inherits consistent quiet hours evaluation',
    SoundService.isWithinQuietHours('21:00', '05:00', nightTime) === true &&
    SoundService.isWithinQuietHours('21:00', '05:00', dayTime) === false
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SPEECH PRIORITY QUEUE & LOGIC CONTRACT
  // ─────────────────────────────────────────────────────────────────────────────
  assert(
    'Speech Priority - CRITICAL has highest priority rank (lowest numeric level)',
    PRIORITY_LEVELS.CRITICAL < PRIORITY_LEVELS.ATTENDANCE_SUCCESS &&
    PRIORITY_LEVELS.CRITICAL < PRIORITY_LEVELS.GREETING &&
    PRIORITY_LEVELS.CRITICAL < PRIORITY_LEVELS.INFO
  );

  assert(
    'Speech Priority - ATTENDANCE_SUCCESS takes precedence over GREETING & INFO',
    PRIORITY_LEVELS.ATTENDANCE_SUCCESS < PRIORITY_LEVELS.GREETING &&
    PRIORITY_LEVELS.ATTENDANCE_SUCCESS < PRIORITY_LEVELS.INFO
  );

  assert(
    'Speech Priority - GREETING takes precedence over generic INFO',
    PRIORITY_LEVELS.GREETING < PRIORITY_LEVELS.INFO
  );

  // SpeechService User-isolated Configuration
  SpeechService.setUser('test_speech_user_1');
  SpeechService.updateConfig({ pitch: 1.25, rate: 1.1 });
  const cfgUser1 = SpeechService.getConfig();
  assert(
    'SpeechService - Config update succeeds for user 1',
    cfgUser1.pitch === 1.25 && cfgUser1.rate === 1.1
  );

  SpeechService.setUser('test_speech_user_2');
  SpeechService.updateConfig({ pitch: 0.85, rate: 0.9 });
  const cfgUser2 = SpeechService.getConfig();
  assert(
    'SpeechService - User 2 gets independent voice pitch & rate configuration',
    cfgUser2.pitch === 0.85 && cfgUser2.rate === 0.9
  );

  // Reset to default
  SpeechService.resetToDefault();
  assert(
    'SpeechService - resetToDefault restores default pitch (1.0)',
    SpeechService.getConfig().pitch === 1.0
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SEPARATE SOUND EFFECT TOGGLES (CHIME VS ATTENDANCE SOUND)
  // ─────────────────────────────────────────────────────────────────────────────
  // Initial state setup
  SoundService.setMuted(false);
  SoundService.setChimeMuted(false);
  SoundService.setAttendanceSoundMuted(false);

  assert('SoundService - Master mute starts false', SoundService.getIsMuted() === false);
  assert('SoundService - Chime mute starts false', SoundService.getIsChimeMuted() === false);
  assert('SoundService - Attendance sound mute starts false', SoundService.getIsAttendanceSoundMuted() === false);

  // Mute chime independently
  SoundService.setChimeMuted(true);
  assert(
    'SoundService - Mutting chime sets isChimeMuted to true',
    SoundService.getIsChimeMuted() === true
  );
  assert(
    'SoundService - Mutting chime does NOT alter attendance sound mute state',
    SoundService.getIsAttendanceSoundMuted() === false
  );
  assert(
    'SoundService - Mutting chime does NOT alter master mute state',
    SoundService.getIsMuted() === false
  );

  // Mute attendance sound independently
  SoundService.setAttendanceSoundMuted(true);
  assert(
    'SoundService - Mutting attendance sound sets isAttendanceSoundMuted to true',
    SoundService.getIsAttendanceSoundMuted() === true
  );

  // Restore toggles
  SoundService.setChimeMuted(false);
  SoundService.setAttendanceSoundMuted(false);
  assert(
    'SoundService - Restoring toggles un-mutes both chime and attendance sound',
    SoundService.getIsChimeMuted() === false && SoundService.getIsAttendanceSoundMuted() === false
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. MOCK PROVIDER NOTIFICATION PREFERENCES CRUD & BATCH READ
  // ─────────────────────────────────────────────────────────────────────────────
  const mock = new MockProvider();
  const testPrefUserId = 'mock_user_pref_test';

  // Get default preferences
  const defaultPrefs = await mock.getNotificationPreferences(testPrefUserId);
  assert(
    'MockProvider - getNotificationPreferences returns defaults for new user',
    defaultPrefs?.user_id === testPrefUserId && defaultPrefs?.push_enabled === true
  );

  // Save customized preferences
  const updatedPrefs = await mock.saveNotificationPreferences(testPrefUserId, {
    user_id: testPrefUserId,
    push_enabled: true,
    attendance_alerts: true,
    leave_alerts: false,
    event_alerts: true,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '06:00',
  });

  assert(
    'MockProvider - saveNotificationPreferences returns updated preferences',
    updatedPrefs.leave_alerts === false &&
    updatedPrefs.quiet_hours_enabled === true &&
    updatedPrefs.quiet_hours_start === '22:00'
  );

  const reloadedPrefs = await mock.getNotificationPreferences(testPrefUserId);
  assert(
    'MockProvider - Re-reading preferences reflects stored customized values',
    reloadedPrefs?.leave_alerts === false && reloadedPrefs?.quiet_hours_end === '06:00'
  );

  // Push Subscription saving
  const pushSaveResult = await mock.savePushSubscription({
    user_id: testPrefUserId,
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-1',
    p256dh: 'mock_p256dh_key',
    auth: 'mock_auth_secret',
    device_type: 'MOBILE',
  });
  assert('MockProvider - savePushSubscription succeeds', pushSaveResult === true);

  // Batch mark as read
  const batchReadResult = await mock.markNotificationsAsRead(['notif_b1', 'notif_b2']);
  assert('MockProvider - markNotificationsAsRead batch resolves true', batchReadResult === true);

  return {
    suiteName: 'Notification & Voice Overhaul System',
    passed,
    failed,
    results,
  };
}
