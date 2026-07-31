/**
 * SMART ABSENSI GURU - AUDIT LOG & WHATSAPP TEST SUITE
 */

import { NotificationTemplateEngine } from '../notification-template.service';
import { WhatsAppService } from '../whatsapp.service';
import { AuditLogger } from '../audit-logger.service';

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

  return { passed, failed, results };
};
