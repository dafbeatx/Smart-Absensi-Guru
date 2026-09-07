/**
 * SMART ABSENSI GURU - AUDIT LOG & WHATSAPP TEST SUITE
 */

import { NotificationTemplateEngine } from '../notification-template.service';
import { WhatsAppService } from '../whatsapp.service';
import { AuditLogger } from '../audit-logger.service';
import { TelegramService } from '../telegram.service';

export const runAuditWhatsAppTestSuite = async (): Promise<{
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

  // Test 1: Notification Template Engine Variable Replacement
  const rendered = NotificationTemplateEngine.render('LEAVE_SUBMIT', {
    nama: 'Ahmad Hidayat',
    jenis: 'Izin Sakit',
    tanggal: '30 Juli 2026',
    waktu: '08:00 WIB',
    alasan: 'Demam tinggi',
    link: 'https://smartabsensi.app/dashboard',
  });
  assert(
    'Notification Template Engine - Render Variable Replacement',
    rendered.includes('Ahmad Hidayat') && rendered.includes('Izin Sakit') && rendered.includes('Demam tinggi')
  );

  // Test 2: WhatsApp Phone Number International Formatting
  const formattedPhone = WhatsAppService.formatPhoneNumber('081234567890');
  assert(
    'WhatsApp Service - Phone Formatting 08xx -> 628xx',
    formattedPhone === '6281234567890'
  );

  // Test 3: WhatsApp Deep Link URL Generation
  const deepLinkUrl = WhatsAppService.generateDeepLinkUrl(
    '081234567890',
    'LEAVE_APPROVE',
    {
      nama: 'Budi Santoso',
      jenis: 'Dinas Luar',
      tanggal: '31 Juli 2026',
      alasan: 'Disetujui Kepsek',
      link: 'https://smartabsensi.app',
    }
  );
  assert(
    'WhatsApp Service - Deep Link URL Encoded Properly',
    deepLinkUrl.startsWith('https://wa.me/6281234567890?text=') && deepLinkUrl.includes('%20')
  );

  // Test 4: Immutable Audit Logger Entry Creation
  const auditLog = await AuditLogger.log({
    actorId: 'usr_uuid_1001',
    actorRole: 'OPERATOR',
    actionType: 'EDIT_ATTENDANCE',
    targetEntity: 'Attendance',
    oldValue: { status: 'BELUM_ABSEN' },
    newValue: { status: 'HADIR' },
    reason: 'Koreksi jaringan HP Guru',
  });
  assert(
    'Audit Logger - Immutable Audit Entry Generated',
    auditLog.action_type === 'EDIT_ATTENDANCE' && (auditLog.request_id ? auditLog.request_id.startsWith('req_') : true)
  );

  // Test 5: Telegram Service - Unconfigured credentials handled safely
  const tgRes = await TelegramService.sendMessage('Test Message');
  assert(
    'Telegram Service - Unconfigured Credentials Handled Gracefully',
    typeof tgRes.success === 'boolean'
  );

  // Test 6: Telegram Service - Attendance notification execution
  const attRes = await TelegramService.sendAttendanceNotification({
    teacherName: 'Dafa Maulana, S.Pd',
    nip: '198501012010011001',
    role: 'GURU',
    type: 'CHECK_IN',
    timeStr: '06:55:00 WIB',
    method: 'BIOMETRIC_GPS',
    distanceMeters: 15,
    status: 'HADIR',
  });
  assert(
    'Telegram Service - Attendance Notification Execution Safe',
    typeof attRes === 'boolean'
  );

  // Test 7: Telegram Service - Web login notification execution
  const loginRes = await TelegramService.sendWebLoginNotification({
    teacherName: 'Fitri Ani Rahayu, S.Mat',
    nip: '199002022015022002',
    role: 'GURU',
    device: 'Mobile Android Chrome',
  });
  assert(
    'Telegram Service - Web Login Notification Execution Safe',
    typeof loginRes === 'boolean'
  );

  // Test 8: Telegram Service - Audit Log notification execution
  const auditTgRes = await TelegramService.sendAuditLog({
    actorId: 'usr_admin_001',
    actorRole: 'ADMIN',
    actionType: 'UPDATE_DUTY_SCHEDULE',
    targetEntity: 'DutySchedule',
    reason: 'Pembaruan Jadwal Piket Hari Senin',
  });
  assert(
    'Telegram Service - Audit Log Notification Execution Safe',
    typeof auditTgRes === 'boolean'
  );

  return { passed, failed, results };
};
