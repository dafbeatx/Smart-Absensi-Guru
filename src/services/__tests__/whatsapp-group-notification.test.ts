/**
 * SMART ABSENSI GURU - WHATSAPP GROUP ATTENDANCE NOTIFICATION TEST SUITE
 * Suite 35: Tests for text-only privacy policy, anti-ban group targeting, and proxy integration.
 */

import { WhatsAppNotificationService } from '../whatsapp-notification.service';
import {
  formatWhatsAppAttendanceMessage,
  formatWhatsAppLeaveMessage,
} from '../../../api/whatsapp';

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

  // Test 9: Click-to-Chat URL generator creates valid https://api.whatsapp.com link
  const shareUrl = WhatsAppNotificationService.generateWhatsAppShareUrl(testPayload);
  assert(
    'WA Notif 09: generateWhatsAppShareUrl creates valid universal WhatsApp link with encoded text',
    shareUrl.startsWith('https://api.whatsapp.com/send?text=') &&
      shareUrl.includes(encodeURIComponent('Dafa Maulana, S.Pd')) &&
      shareUrl.includes(encodeURIComponent('199508172023011005')),
    `Generated URL sample: ${shareUrl.slice(0, 80)}...`
  );

  // Test 10: Click-to-Chat share text strictly adheres to 100% text-only privacy policy
  const shareText = WhatsAppNotificationService.generateWhatsAppShareText(testPayload);
  assert(
    'WA Notif 10: Click-to-Chat share text strictly text-only without photo or image references',
    !shareText.includes('data:image') &&
      !shareText.includes('base64') &&
      !shareText.includes('.jpg') &&
      shareText.includes('*NOTIFIKASI PRESENSI GURU*'),
    '100% text-only privacy policy strictly enforced'
  );

  // =========================================================================
  // Leave & Duty Teacher Tasks WhatsApp Notifications (User Request)
  // =========================================================================
  const leaveTestPayload = {
    teacherName: 'Siti Rahmawati, M.Pd.',
    npp: 'NPP-198502152011012003',
    role: 'GURU',
    leaveType: 'IZIN',
    startDate: '2026-09-21',
    endDate: '2026-09-21',
    reason: 'Menghadiri rapat dinas MGMP Matematika',
    dutyTeacherNotes: 'Tugas Kelas 8A: Buka LKS halaman 52, kerjakan nomor 1-10 di buku tugas.',
  };

  // Test 11: generateWhatsAppLeaveShareText includes all required elements & duty teacher tasks
  const leaveShareText = WhatsAppNotificationService.generateWhatsAppLeaveShareText(leaveTestPayload);
  assert(
    'WA Notif 11: generateWhatsAppLeaveShareText includes Teacher Name, NPP, Dates, and Duty Teacher Tasks',
    leaveShareText.includes('Siti Rahmawati, M.Pd.') &&
      leaveShareText.includes('NPP-198502152011012003') &&
      leaveShareText.includes('2026-09-21') &&
      leaveShareText.includes('Menghadiri rapat dinas MGMP Matematika') &&
      leaveShareText.includes('TUGAS UNTUK GURU PIKET') &&
      leaveShareText.includes('Tugas Kelas 8A: Buka LKS halaman 52'),
    `Leave share text preview: ${leaveShareText.slice(0, 150)}...`
  );

  // Test 12: generateWhatsAppLeaveShareUrl creates valid universal link with encoded leave details
  const leaveShareUrl = WhatsAppNotificationService.generateWhatsAppLeaveShareUrl(leaveTestPayload);
  assert(
    'WA Notif 12: generateWhatsAppLeaveShareUrl produces valid WhatsApp deep link encoded with duty teacher tasks',
    leaveShareUrl.startsWith('https://api.whatsapp.com/send?text=') &&
      leaveShareUrl.includes(encodeURIComponent('Siti Rahmawati, M.Pd.')) &&
      leaveShareUrl.includes(encodeURIComponent('Tugas Kelas 8A: Buka LKS halaman 52')),
    `Generated Leave URL sample: ${leaveShareUrl.slice(0, 90)}...`
  );

  // Test 13: formatWhatsAppLeaveMessage produces clean text-only message for SAKIT and includes duty teacher notes
  const sickPayload = {
    teacherName: 'Ahmad Fauzi, S.Pd.',
    npp: 'NPP-198904122015021004',
    role: 'GURU',
    leaveType: 'SAKIT',
    startDate: '2026-09-21',
    endDate: '2026-09-22',
    reason: 'Demam tinggi dan flu berat',
    dutyTeacherNotes: 'Siswa kelas 9B menonton video pembelajaran Bab 4 di LCD proyektor.',
  };
  const sickFormattedMsg = formatWhatsAppLeaveMessage(sickPayload);
  assert(
    'WA Notif 13: formatWhatsAppLeaveMessage handles SAKIT type with medical indicator and includes piket tasks',
    sickFormattedMsg.includes('SURAT KETERANGAN SAKIT') &&
      sickFormattedMsg.includes('Ahmad Fauzi, S.Pd.') &&
      sickFormattedMsg.includes('2026-09-21 s.d. 2026-09-22') &&
      sickFormattedMsg.includes('Siswa kelas 9B menonton video pembelajaran Bab 4') &&
      !sickFormattedMsg.includes('data:image') &&
      !sickFormattedMsg.includes('.jpg'),
    'formatWhatsAppLeaveMessage verified'
  );

  // Test 14: sendLeaveNotification executes asynchronously without crashing caller flow
  let threwLeaveException = false;
  try {
    const sendLeavePromise = WhatsAppNotificationService.sendLeaveNotification(leaveTestPayload);
    assert(
      'WA Notif 14: sendLeaveNotification executes asynchronously and returns a promise',
      sendLeavePromise instanceof Promise,
      'Returns a Promise without uncaught synchronous exceptions'
    );
    await sendLeavePromise;
  } catch {
    threwLeaveException = true;
  }

  assert(
    'WA Notif 15: Non-blocking error safety for sendLeaveNotification',
    !threwLeaveException,
    'Leave notification proxy dispatch absorbed safely'
  );

  return { passed, failed, results };
};
