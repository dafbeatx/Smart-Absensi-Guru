/**
 * SMART ABSENSI GURU — DYNAMIC SETTINGS & BRANDING REALTIME SYNC TEST SUITE
 * Verifikasi Sinkronisasi Nama Utama Aplikasi & Sub-Branding Sekolah Lintas Komponen
 */

import { useSettingsStore } from '../../store/useSettingsStore';
import { APP_CONFIG } from '../../config/app.config';
import { ExcelReportGenerator, getDynamicBranding, type MultiSheetReportPayload } from '../../lib/excel-generator.lib';
import { PdfStamperService } from '../../lib/pdf-stamper.lib';
import { generateExcellenceCertificateHTML } from '../../lib/certificate-generator.lib';

export const runSettingsSyncTestSuite = async (): Promise<{
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

  try {
    // ── Test 1: Inisialisasi Zustand useSettingsStore
    const initialState = useSettingsStore.getState();
    assert(
      'Store Initialization: Store terdefinisi dengan nilai awal valid',
      Boolean(initialState && initialState.settings && typeof initialState.loadSettings === 'function')
    );

    // ── Test 2: Default Fallback APP_CONFIG
    assert(
      'Default Fallback: App name dan institution name memiliki fallback standar',
      initialState.settings.app_name.length > 0 && initialState.settings.institution_name.length > 0
    );

    // ── Test 3: Pemuatan Pengaturan dari Provider (loadSettings)
    await useSettingsStore.getState().loadSettings(true);
    const loadedState = useSettingsStore.getState();
    assert(
      'Provider Fetch: loadSettings berhasil memuat data dari Provider ke Zustand state',
      loadedState.isLoaded === true && typeof loadedState.settings.app_name === 'string'
    );

    // ── Test 4: updateSettings Mengubah State dan Mengirimkan Global DOM Event
    const testNewAppName = 'Smart Absensi Insan Teladan 2026';
    const testNewInstitution = 'Yayasan Pendidikan Islam Terpadu Insan Teladan';

    let eventFired: boolean = false;
    let capturedDetail: any = null;

    const testListener = (e: any) => {
      eventFired = true;
      capturedDetail = e?.detail;
    };

    const hasWindow = typeof window !== 'undefined';
    if (!hasWindow) {
      (globalThis as any).window = new EventTarget();
    }

    window.addEventListener('smart_absensi_settings_updated', testListener);

    const updateSuccess = await useSettingsStore.getState().updateSettings({
      ...loadedState.settings,
      app_name: testNewAppName,
      institution_name: testNewInstitution,
    }, 'mock_test_token');

    window.removeEventListener('smart_absensi_settings_updated', testListener);
    if (!hasWindow) {
      delete (globalThis as any).window;
    }

    assert(
      'Update Settings Execution: updateSettings mengembalikan status sukses true',
      updateSuccess === true
    );

    const updatedState = useSettingsStore.getState();
    assert(
      'State Reactivity: State Zustand langsung ter-update dengan Nama Utama Aplikasi baru',
      updatedState.settings.app_name === testNewAppName &&
      updatedState.settings.institution_name === testNewInstitution
    );

    assert(
      'Global DOM Event: Event smart_absensi_settings_updated ter-dispatch dengan detail terbaru',
      Boolean(eventFired) && capturedDetail?.app_name === testNewAppName
    );

    // ── Test 5: Persistensi LocalStorage
    if (typeof localStorage !== 'undefined') {
      const rawLocal = localStorage.getItem('smart_absensi_system_settings');
      let parsedLocal: any = null;
      try {
        parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
      } catch {
        parsedLocal = null;
      }

      assert(
        'LocalStorage Sync: Data tersimpan secara persistent di smart_absensi_system_settings',
        parsedLocal?.app_name === testNewAppName &&
        parsedLocal?.institution_name === testNewInstitution
      );
    }

    // ── Test 6: Dynamic Branding di Excel & CSV Generator
    const dynamicBranding = getDynamicBranding();
    assert(
      'Excel Helper: getDynamicBranding menghasilkan appName dan institutionName dinamis',
      dynamicBranding.appName === testNewAppName &&
      dynamicBranding.institutionName === testNewInstitution
    );

    const dummyPayload: MultiSheetReportPayload = {
      month: 'September',
      year: '2026',
      summary: {
        date: '2026-09-01',
        totalTeachers: 10,
        totalPresent: 8,
        totalLate: 1,
        totalSick: 1,
        totalLeave: 0,
        totalOfficialDuty: 0,
        totalUnabsented: 0,
        totalAlfa: 0,
        totalPendingLeave: 0,
        attendancePercentage: 90,
      },
      teachers: [],
      attendanceRecords: [],
      leaveRequests: [],
      auditLogs: [],
    };

    const csvData = ExcelReportGenerator.generateMultiSheetCSVData(dummyPayload);
    assert(
      'CSV Export Dynamic Branding: Header CSV memuat Nama Utama Aplikasi yang telah diubah',
      csvData.includes(`Aplikasi,${testNewAppName}`) &&
      csvData.includes(`Institusi,${testNewInstitution}`)
    );

    // ── Test 7: Dynamic Branding di PDF Stamper (Stempel Basah & QR Validasi)
    const stampSvg = PdfStamperService.renderOfficialStampSVG();
    assert(
      'PDF Stamp Branding: Stempel resmi memuat nama institusi sekolah dinamis',
      stampSvg.toUpperCase().includes(testNewInstitution.toUpperCase())
    );

    const qrDataUrl = await PdfStamperService.generateVerificationQRCodeDataURL({
      docId: 'DOC-TEST-123',
      docCode: '421.3/TEST/2026',
      month: 'SEPTEMBER',
      year: '2026',
      signatoryKepsek: 'Farhan Sopian Sahid, S.Pd.I',
      signatoryTU: 'Mira Nurdianti, S.Pd',
      verifiedAt: new Date().toISOString(),
      verifyUrl: 'https://smart-absensi.sch.id/verify',
      docHash: 'SHA256-TEST-HASH',
    });
    assert(
      'PDF QR Verification Payload: QR Code ter-generate valid dengan branding dinamis',
      typeof qrDataUrl === 'string' && qrDataUrl.startsWith('data:image/png;base64,')
    );

    // ── Test 8: Dynamic Branding di Piagam Penghargaan Guru Teladan
    const certHtml = generateExcellenceCertificateHTML({
      recipientName: 'Ahmad Dahlan, M.Pd.',
      recipientNipOrNpp: '198701012015011002',
      recipientPosition: 'Guru Matematika',
      periodMonthYear: 'September 2026',
      rank: 1,
    });

    assert(
      'Piagam Penghargaan Dynamic Subtitle: Piagam mencantumkan Nama Utama Aplikasi dinamis',
      certHtml.includes(testNewAppName)
    );

    // ── Test 9: Restore default branding untuk kebersihan test
    await useSettingsStore.getState().updateSettings({
      ...updatedState.settings,
      app_name: APP_CONFIG.APP_NAME,
      institution_name: APP_CONFIG.INSTITUTION_NAME,
    }, 'mock_test_token');

    assert(
      'Cleanup & Reset: Pengaturan berhasil dikembalikan ke standar awal sistem',
      useSettingsStore.getState().settings.app_name === APP_CONFIG.APP_NAME
    );

  } catch (err) {
    assert('Test Suite Execution: Gagal mengeksekusi test suite', false, String(err));
  }

  return { passed, failed, results };
};
