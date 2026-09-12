/**
 * SMART ABSENSI GURU - PDF-LIB DIGITAL STAMP & DOCUMENT VERIFICATION TEST SUITE
 */

import { PDFDocument } from 'pdf-lib';
import { PdfStamperService } from '../../lib/pdf-stamper.lib';
import { ExcelReportGenerator, SIGNATORY_OFFICIALS, type MultiSheetReportPayload } from '../../lib/excel-generator.lib';
import { ReportService } from '../report.service';
import type { UserProfile, AttendanceRecord, LeaveRequest, HolidayRecord } from '../../types/database.types';

export const runPdfStamperTestSuite = async (): Promise<{
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
    const mockTeachers: UserProfile[] = [
      {
        id: 'usr_t1',
        nip: '198501012010011001',
        full_name: 'Drs. Suparman, M.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Fisika Senior',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_t2',
        nip: '199002022015022002',
        full_name: 'Siti Aminah, S.Pd.',
        phone_number: '081234567891',
        role: 'GURU',
        position: 'Guru Biologi',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    const mockAttendance: AttendanceRecord[] = [
      {
        id: 'att_1',
        user_id: 'usr_t1',
        date: '2026-09-01',
        check_in_time: '06:55:00',
        check_out_time: '14:05:00',
        status: 'HADIR',
        verification_method: 'QR_GPS',
        check_in_distance_meters: 12,
        check_in_lat: -6.613144,
        check_in_lng: 106.812345,
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-01T06:55:00Z',
      },
      {
        id: 'att_2',
        user_id: 'usr_t2',
        date: '2026-09-01',
        check_in_time: '07:18:00',
        check_out_time: '14:10:00',
        status: 'TERLAMBAT',
        verification_method: 'QR_GPS',
        check_in_distance_meters: 25,
        check_in_lat: -6.613144,
        check_in_lng: 106.812345,
        attendance_source: 'QR',
        is_offline: false,
        created_at: '2026-09-01T07:18:00Z',
      },
    ];

    const mockLeaves: LeaveRequest[] = [];
    const mockHolidays: HolidayRecord[] = [];

    const mockPayload: MultiSheetReportPayload = ReportService.preparePayload(
      'September',
      '2026',
      mockTeachers,
      mockAttendance,
      mockLeaves,
      [],
      mockHolidays
    );

    // Test 1: Document Verification Metadata Generation
    const metadata = PdfStamperService.generateVerificationMetadata('September', '2026');
    assert(
      'PDF-Lib - Generates Deterministic Document Verification Metadata',
      Boolean(
        metadata.docId.startsWith('DOC-SAG-2026-SEP-') &&
        metadata.docCode.includes('421.3/SAG-BOGOR/SEP/2026') &&
        metadata.signatoryKepsek === SIGNATORY_OFFICIALS.KEPSEK_NAME &&
        metadata.signatoryTU === SIGNATORY_OFFICIALS.TU_NAME &&
        metadata.verifyUrl.includes('verify-document') &&
        metadata.docHash.startsWith('SHA256-')
      ),
      `DocCode: ${metadata.docCode}, Kepsek: ${metadata.signatoryKepsek}`
    );

    // Test 2: Verification QR Code Generation
    const qrDataUrl = await PdfStamperService.generateVerificationQRCodeDataURL(metadata);
    assert(
      'PDF-Lib - Generates Base64 PNG QR Code for Verification',
      qrDataUrl.startsWith('data:image/png;base64,'),
      `QR DataURL length: ${qrDataUrl.length} chars`
    );

    // Test 3: Official Wet Ink Stamp SVG Generation
    const stampSVG = PdfStamperService.renderOfficialStampSVG();
    assert(
      'PDF-Lib - Renders Official Wet Ink Stamp SVG with Circular Geometry & Royal Blue Color',
      Boolean(
        stampSVG.includes('<svg') &&
        stampSVG.includes('TERVERIFIKASI RESMI') &&
        stampSVG.includes('#1e40af') &&
        stampSVG.includes('CABANG DINAS PENDIDIKAN WIL. I') &&
        stampSVG.includes('★')
      ),
      'SVG stamp validated with double ring, stars, and official seal styling'
    );

    // Test 4: PDF-Lib Binary Document Compilation
    const pdfBytes = await PdfStamperService.generateCertifiedSchoolReportPDF(mockPayload);
    const isUint8Array = pdfBytes instanceof Uint8Array;
    const hasPdfHeader =
      pdfBytes.length > 5 &&
      pdfBytes[0] === 0x25 && // %
      pdfBytes[1] === 0x50 && // P
      pdfBytes[2] === 0x44 && // D
      pdfBytes[3] === 0x46 && // F
      pdfBytes[4] === 0x2d;   // -

    assert(
      'PDF-Lib - Successfully Compiles Binary PDF Document with Magic Number %PDF-',
      isUint8Array && hasPdfHeader && pdfBytes.length > 5000,
      `Binary size: ${pdfBytes.length} bytes, Header: %PDF- verified`
    );

    // Test 5: Signatory & Metadata Consistency in Generated PDF
    const parsedPdf = await PDFDocument.load(pdfBytes);
    const pageCount = parsedPdf.getPageCount();
    const title = parsedPdf.getTitle();
    const author = parsedPdf.getAuthor();
    const producer = parsedPdf.getProducer();

    assert(
      'PDF-Lib - Document Contains Valid Embedded Pages & Metadata Integrity',
      pageCount >= 1 &&
      Boolean(title?.includes('Laporan Presensi')) &&
      author === SIGNATORY_OFFICIALS.KEPSEK_NAME &&
      Boolean(producer?.includes('Hopding/pdf-lib')),
      `Pages: ${pageCount}, Author: "${author}", Producer: "${producer}"`
    );

    // Test 6: HTML Template Stamp & Verification QR Integration
    const masterHtml = ExcelReportGenerator.getPrintablePDFHTML(mockPayload);
    const individualHtml = ExcelReportGenerator.getIndividualTeacherPDFHTML(
      mockTeachers[0],
      'September',
      '2026',
      mockAttendance,
      mockLeaves,
      mockHolidays
    );

    assert(
      'PDF-Lib - Master & Individual HTML Reports Embed Wet Stamp & Validation QR Badges',
      Boolean(
        masterHtml.includes('TERVERIFIKASI RESMI') &&
        masterHtml.includes('VALIDASI DOKUMEN RESMI') &&
        individualHtml.includes('TERVERIFIKASI RESMI') &&
        individualHtml.includes('VALIDASI DOKUMEN RESMI')
      ),
      'Official wet stamps & validation QR elements verified in both reports'
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    assert('PDF-Lib - Test Execution Error', false, errMsg);
  }

  return { passed, failed, results };
};
