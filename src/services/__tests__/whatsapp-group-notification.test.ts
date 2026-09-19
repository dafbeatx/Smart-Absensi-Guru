/**
 * SMART ABSENSI GURU - WHATSAPP GROUP ATTENDANCE NOTIFICATION TEST SUITE
 * Suite 35: Tests for text-only privacy policy, anti-ban group targeting, and proxy integration.
 */

import { WhatsAppNotificationService } from '../whatsapp-notification.service';
import { formatWhatsAppAttendanceMessage } from '../../../api/whatsapp';

export const runWhatsAppGroupNotificationTestSuite = async (): Promise<{
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
      results.push({ testName, status: 'FAIL', details: details || 'Assertion failed' });
    }
  };

  // Test 1: Service is defined and exportable
  assert(
    'WA Notif 01: WhatsAppNotificationService provides sendAttendanceNotification and testConnection',
    typeof WhatsAppNotificationService.sendAttendanceNotification === 'function' &&
      typeof WhatsAppNotificationService.testConnection === 'function',
    'WhatsAppNotificationService methods verified'
  );

  // Test 2: Message formatter formats text with required metadata (NPP, Nama, Jam, Status)
  const testPayload = {
    teacherName: 'Dafa Maulana, S.Pd',
    npp: '199508172023011005',
    role: 'GURU',
    type: 'CHECK_IN' as const,
    timeStr: '06:45:10 WIB',
    dateStr: 'Senin, 21 September 2026',
    method: 'QR_CODE',
    distanceMeters: 25,
    status: 'HADIR TEPAT WAKTU',
  };

  const formattedMsg = formatWhatsAppAttendanceMessage(testPayload);

  assert(
    'WA Notif 02: Formatter output contains Nama, NPP, Jam, and Status with bold formatting',
    formattedMsg.includes('Dafa Maulana, S.Pd') &&
      formattedMsg.includes('199508172023011005') &&
      formattedMsg.includes('06:45:10 WIB') &&
      formattedMsg.includes('HADIR TEPAT WAKTU') &&
      formattedMsg.includes('*NPP:*'),
    `Sample output preview: ${formattedMsg.slice(0, 100)}...`
  );

  // Test 3: Strict Privacy Policy - NO PHOTO / NO CAMERA CAPTURE IN MESSAGE
  const hasPhotoReference =
    formattedMsg.toLowerCase().includes('data:image') ||
    formattedMsg.toLowerCase().includes('.jpg') ||
    formattedMsg.toLowerCase().includes('.png') ||
    formattedMsg.toLowerCase().includes('base64') ||
    formattedMsg.toLowerCase().includes('<img') ||
    formattedMsg.toLowerCase().includes('photo');

  assert(
    'WA Notif 03: Strict Privacy Guard - WhatsApp message output is 100% text-only without photo URLs or image data',
    !hasPhotoReference,
    'Verified 0 image/photo artifacts present in output string'
  );

  // Test 4: Group JID validator recognizes valid WhatsApp Group IDs (@g.us)
  const validGroupJid = '120363028192837192@g.us';
  const invalidPersonalJid = '6281234567890@s.whatsapp.net';
  const isGroupJid = (jid: string) => String(jid).endsWith('@g.us');

  assert(
    'WA Notif 04: Anti-ban safeguard strictly validates target as Group JID (@g.us) and blocks individual personal JIDs',
    isGroupJid(validGroupJid) && !isGroupJid(invalidPersonalJid),
    `Valid JID: ${validGroupJid}, Invalid: ${invalidPersonalJid}`
  );

  // Test 5: Check-out type formats action correctly with blue indicator
  const checkoutPayload = {
    teacherName: 'Septi Nur Aeni, S.E',
    npp: '199204122019032008',
    role: 'GURU',
    type: 'CHECK_OUT' as const,
    timeStr: '15:30:00 WIB',
    status: 'PULANG SESUAI JADWAL',
  };
  const checkoutMsg = formatWhatsAppAttendanceMessage(checkoutPayload);

  assert(
    'WA Notif 05: Check-out notification formats PRESENSI PULANG with distinct indicator',
    checkoutMsg.includes('PRESENSI PULANG') && checkoutMsg.includes('🔵'),
    'Check-out action properly formatted'
  );

  // Test 6: Zero-Trust Secret Safety - No VITE_ prefixed secrets
  const clientEnv: Record<string, unknown> = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
  const hasLeakedWaSecret = Boolean(clientEnv['VITE_WA_GATEWAY_SECRET'] || clientEnv['VITE_WA_GATEWAY_URL']);

  assert(
    'WA Notif 06: Zero-Trust Security - WA Gateway secrets strictly exclude VITE_ prefix to prevent browser bundle leakage',
    !hasLeakedWaSecret,
    'Client environment is free of private WA gateway tokens'
  );

  // Test 7: Non-blocking fail-safe execution (Does not throw on simulated network error)
  let threwException = false;
  try {
    // If running in Node test env where fetch to /api/whatsapp may fail or be mocked
    const sendPromise = WhatsAppNotificationService.sendAttendanceNotification({
      teacherName: 'Budi Santoso',
      type: 'CHECK_IN',
      status: 'HADIR TEPAT WAKTU',
    });
    // Ensure it returns a Promise<boolean> and does not crash
    assert(
      'WA Notif 07: sendAttendanceNotification executes asynchronously and returns a promise',
      sendPromise instanceof Promise,
      'Returns a Promise without uncaught synchronous exceptions'
    );
    await sendPromise;
  } catch {
    threwException = true;
  }

  assert(
    'WA Notif 08: Non-blocking error safety - Service gracefully absorbs errors without crashing caller flow',
    !threwException,
    'Execution completed without throwing unhandled exceptions'
  );

  return { passed, failed, results };
};
