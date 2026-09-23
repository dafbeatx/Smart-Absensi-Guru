/**
 * SMART ABSENSI GURU — EXAM WORD EXPORTER SERVICE
 * Exports the official Indonesian school invigilation matrix into a clean, editable
 * Microsoft Word (.doc) document that matches the school physical paper layout.
 */

import type { ExamInvigilationMatrix } from './exam-matrix-builder.service';
import { SIGNATORY_OFFICIALS } from '../lib/excel-generator.lib';

export class ExamWordExporterService {
  /**
   * Generates Microsoft Word document (.doc) HTML string.
   */
  public static generateWordHtml(matrix: ExamInvigilationMatrix): string {
    const { title, subTitle, institutionName, rooms, days, teacherLegend } = matrix;

    // Build Table 1 (Matrix) Header
    // Header Row 1: No, Hari/Tanggal, Waktu, Mata Pelajaran, Kode Pengawas (colspan = rooms.length)
    // Header Row 2: subheaders for each room (R 01, R 02, ...)
    const roomSubHeaders = rooms
      .map((r) => `<th class="text-center room-col" style="white-space: nowrap; width: 48px; min-width: 48px;">${r.label}</th>`)
      .join('');

    // Build Table 1 Body Rows
    let matrixBodyRows = '';
    days.forEach((day) => {
      const rowSpan = day.sessions.length || 1;

      day.sessions.forEach((sess, sIdx) => {
        const isFirstInDay = sIdx === 0;
        const roomTds = rooms
          .map((r) => `<td class="text-center font-bold font-code" style="white-space: nowrap;">${sess.roomCodes[r.key] || '-'}</td>`)
          .join('');

        if (isFirstInDay) {
          matrixBodyRows += `
            <tr>
              <td class="text-center" rowspan="${rowSpan}">${day.dayNumber}</td>
              <td class="day-col font-bold" rowspan="${rowSpan}">${day.dayFormatted}</td>
              <td class="text-center">${sess.timeRange}</td>
              <td class="subject-col">${sess.subjectNumber}. ${sess.subjectTitle}</td>
              ${roomTds}
            </tr>
          `;
        } else {
          matrixBodyRows += `
            <tr>
              <td class="text-center">${sess.timeRange}</td>
              <td class="subject-col">${sess.subjectNumber}. ${sess.subjectTitle}</td>
              ${roomTds}
            </tr>
          `;
        }
      });
    });

    // Build Table 2 (Teacher Legend) Rows
    const legendBodyRows = teacherLegend
      .map(
        (t) => `
          <tr>
            <td class="text-center">${t.no}</td>
            <td class="teacher-col font-bold">${t.fullName.toUpperCase()}</td>
            <td class="subject-col">${t.subject}</td>
            <td class="text-center font-bold font-code">${t.code}</td>
          </tr>
        `
      )
      .join('');

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <title>${title} - ${institutionName}</title>
        <style>
          @page Section1 {
            size: 210mm 297mm; /* A4 Portrait */
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000000;
            line-height: 1.15;
            background: #ffffff;
          }
          .header-container {
            text-align: center;
            margin-bottom: 14px;
          }
          .header-title {
            font-size: 12pt;
            font-weight: bold;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .header-subtitle {
            font-size: 11pt;
            font-weight: bold;
            margin: 2px 0;
          }
          .header-school {
            font-size: 12pt;
            font-weight: bold;
            margin: 0;
            letter-spacing: 0.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          table, th, td {
            border: 1pt solid #000000;
          }
          th, td {
            padding: 4px 6px;
            font-size: 10pt;
            vertical-align: middle;
          }
          th {
            font-weight: bold;
            text-align: center;
            background-color: #f7f7f7;
          }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-code { font-family: 'Times New Roman', Times, serif; font-size: 10pt; font-weight: bold; }
          .room-col { width: 48px; min-width: 48px; white-space: nowrap; text-align: center; }
          .day-col { padding-left: 8px; white-space: nowrap; }
          .subject-col { padding-left: 8px; }
          .teacher-col { padding-left: 8px; }
          .legend-table {
            width: 100%;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <!-- Document Header -->
          <div class="header-container">
            <h1 class="header-title">${title}</h1>
            <h2 class="header-subtitle">${subTitle}</h2>
            <h2 class="header-school">${institutionName.toUpperCase()}</h2>
          </div>

          <!-- Table 1: Matrix Jadwal Pengawas -->
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 28px;">No</th>
                <th rowspan="2" style="width: 150px;">Hari/Tanggal</th>
                <th rowspan="2" style="width: 100px;">Waktu</th>
                <th rowspan="2">Mata Pelajaran</th>
                <th colspan="${rooms.length}">Kode Pengawas</th>
              </tr>
              <tr>
                ${roomSubHeaders}
              </tr>
            </thead>
            <tbody>
              ${matrixBodyRows}
            </tbody>
          </table>

          <!-- Table 2: Daftar / Legenda Kode Pengawas -->
          <table class="legend-table">
            <thead>
              <tr>
                <th style="width: 32px;">No</th>
                <th style="width: 240px;">Nama Guru</th>
                <th>Mata Pelajaran</th>
                <th style="width: 110px;">Kode Pengawas</th>
              </tr>
            </thead>
            <tbody>
              ${legendBodyRows}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Triggers download of the generated Word document in the browser.
   */
  public static exportToWord(
    matrix: ExamInvigilationMatrix,
    fileNameOverride?: string
  ): void {
    const htmlContent = this.generateWordHtml(matrix);
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8',
    });

    const defaultFileName = `Jadwal_Pengawas_${matrix.subTitle.replace(/[^\w]/g, '_')}.doc`;
    const fileName = fileNameOverride || defaultFileName;

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Generates clean, print-ready HTML for standard A4 paper format without application UI.
   */
  public static generateOfficialA4PrintHtml(
    matrix: ExamInvigilationMatrix,
    options?: {
      kepsekName?: string;
      kepsekNip?: string;
      kepsekNpp?: string;
      committeeHeadName?: string;
      committeeHeadNip?: string;
      committeeHeadNpp?: string;
    }
  ): string {
    const { title, subTitle, institutionName, rooms, days, teacherLegend } = matrix;
    void options; // Signatures are omitted from official invigilation matrix per requirements

    const roomSubHeaders = rooms
      .map((r) => `<th class="text-center room-col" style="white-space: nowrap; width: 48px; min-width: 48px;">${r.label}</th>`)
      .join('');

    let matrixBodyRows = '';
    days.forEach((day) => {
      const rowSpan = day.sessions.length || 1;
      day.sessions.forEach((sess, sIdx) => {
        const isFirstInDay = sIdx === 0;
        const roomTds = rooms
          .map((r) => `<td class="text-center font-code font-bold" style="white-space: nowrap;">${sess.roomCodes[r.key] || '-'}</td>`)
          .join('');

        if (isFirstInDay) {
          matrixBodyRows += `
            <tr>
              <td class="text-center" rowspan="${rowSpan}">${day.dayNumber}</td>
              <td class="day-col font-bold" rowspan="${rowSpan}">${day.dayFormatted}</td>
              <td class="text-center" style="white-space: nowrap;">${sess.timeRange}</td>
              <td class="subject-col">${sess.subjectNumber}. ${sess.subjectTitle}</td>
              ${roomTds}
            </tr>
          `;
        } else {
          matrixBodyRows += `
            <tr>
              <td class="text-center" style="white-space: nowrap;">${sess.timeRange}</td>
              <td class="subject-col">${sess.subjectNumber}. ${sess.subjectTitle}</td>
              ${roomTds}
            </tr>
          `;
        }
      });
    });

    const legendBodyRows = teacherLegend
      .map(
        (t) => `
          <tr>
            <td class="text-center">${t.no}</td>
            <td class="teacher-col font-bold">${t.fullName}</td>
            <td class="subject-col">${t.subject}</td>
            <td class="text-center font-bold font-code" style="white-space: nowrap;">${t.code}</td>
          </tr>
        `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${institutionName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 10pt;
      line-height: 1.25;
      color: #000000;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .no-print-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #023246;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-print {
      background: #059669;
      color: #ffffff;
    }
    .btn-print:hover { background: #047857; }
    .btn-close {
      background: rgba(255,255,255,0.15);
      color: #ffffff;
    }
    .btn-close:hover { background: rgba(255,255,255,0.25); }

    .paper-page {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: 12mm 14mm;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      position: relative;
    }

    .doc-header {
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 12px;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    .doc-header h1 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 13pt;
      font-weight: bold;
      margin: 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #000000;
    }
    .doc-header h2 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 11pt;
      font-weight: bold;
      margin: 2px 0;
      text-transform: uppercase;
      color: #000000;
    }
    .doc-header h3 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12pt;
      font-weight: bold;
      margin: 0;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #000000;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      page-break-inside: avoid;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    table, th, td {
      border: 1px solid #000000;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    th, td {
      padding: 4px 6px;
      font-size: 9.5pt;
      vertical-align: middle;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    th {
      background-color: #f8fafc;
      font-weight: bold;
      text-align: center;
      color: #000000;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-code {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      font-size: 10pt;
    }
    .room-col {
      width: 48px;
      min-width: 48px;
      white-space: nowrap !important;
      text-align: center;
    }
    .day-col { padding-left: 6px; width: 135px; white-space: nowrap; }
    .subject-col { padding-left: 6px; }
    .teacher-col { padding-left: 6px; }

    .legend-section {
      margin-top: 10px;
      page-break-inside: avoid;
      font-family: 'Times New Roman', Times, Georgia, serif;
    }
    .legend-title {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 10.5pt;
      font-weight: bold;
      margin: 0 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #000000;
    }
    .legend-table {
      width: 100%;
      margin-bottom: 14px;
    }

    @media print {
      body {
        background: #ffffff !important;
      }
      .no-print-bar {
        display: none !important;
      }
      .paper-page {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        min-height: auto !important;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action Bar (Disembunyikan 100% saat dicetak) -->
  <div class="no-print-bar">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">📄</span>
      <span style="font-weight: 800; font-size: 13px;">Format Cetak Resmi A4 — ${institutionName}</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="button" class="btn-action btn-print" onclick="window.print()">
        🖨️ Cetak ke Kertas A4 / Simpan PDF
      </button>
      <button type="button" class="btn-action btn-close" onclick="window.close()">
        ✖️ Tutup Pratinjau
      </button>
    </div>
  </div>

  <!-- Lembar Kertas A4 Resmi -->
  <div class="paper-page">
    <div class="doc-header">
      <h1>${title}</h1>
      <h2>${subTitle}</h2>
      <h3>${institutionName.toUpperCase()}</h3>
    </div>

    <!-- Tabel 1: Matriks Jadwal Pengawas Ruang -->
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width: 32px; white-space: nowrap;">No</th>
          <th rowspan="2" style="width: 140px; white-space: nowrap;">Hari / Tanggal</th>
          <th rowspan="2" style="width: 90px; white-space: nowrap;">Waktu</th>
          <th rowspan="2">Mata Pelajaran</th>
          <th colspan="${rooms.length}" style="white-space: nowrap;">Kode Pengawas</th>
        </tr>
        <tr>
          ${roomSubHeaders}
        </tr>
      </thead>
      <tbody>
        ${matrixBodyRows}
      </tbody>
    </table>

    <!-- Tabel 2: Daftar Kode Pengawas Ruang -->
    <div class="legend-section">
      <div class="legend-title">Daftar Kode Pengawas Ruang:</div>
      <table class="legend-table">
        <thead>
          <tr>
            <th style="width: 32px; white-space: nowrap;">No</th>
            <th style="width: 260px; text-align: left; padding-left: 8px;">Nama Guru Pengawas</th>
            <th style="text-align: left; padding-left: 8px;">Mata Pelajaran</th>
            <th style="width: 100px; white-space: nowrap; text-align: center;">Kode Pengawas</th>
          </tr>
        </thead>
        <tbody>
          ${legendBodyRows}
        </tbody>
      </table>
    </div>
  </div>

</body>
</html>`;
  }

  /**
   * Generates and opens a printable personal invigilation duty card on A4 paper for an individual teacher.
   */
  public static printTeacherDutySlip(
    teacherName: string,
    teacherCode: string | undefined = '-',
    duties: Array<{
      date: string;
      dayName: string;
      sessionNumber: number;
      startTime: string;
      endTime: string;
      roomName: string;
      subject: string;
    }>,
    institutionName = 'SMA TERPADU AS SALAAM',
    examTitle = 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)',
    kepsekName?: string,
    kepsekNpp?: string
  ): void {
    if (typeof window === 'undefined') return;

    const safeCode = teacherCode || '-';
    const actualKepsekName = kepsekName || SIGNATORY_OFFICIALS.KEPSEK_NAME || 'Farhan Sopian Sahid, S.Pd.I';
    const formattedKepsekNpp = kepsekNpp && kepsekNpp !== '-'
      ? (kepsekNpp.startsWith('NPP') ? kepsekNpp : `NPP. ${kepsekNpp}`)
      : 'NPP. -';

    const dutyRows = duties
      .map(
        (d, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td class="font-bold">${d.dayName}, ${d.date}</td>
            <td class="text-center font-code">${d.startTime} - ${d.endTime} (Sesi ${d.sessionNumber})</td>
            <td>${d.subject}</td>
            <td class="text-center font-bold" style="background-color: #f1f5f9;">${d.roomName}</td>
            <td class="text-center font-code font-bold">${safeCode}</td>
          </tr>
        `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Kartu Tugas Mengawas - ${teacherName}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #0f172a; margin: 0; padding: 0; background: #f8fafc; }
    .no-print-bar { position: sticky; top: 0; background: #023246; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; }
    .btn-action { padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; font-size: 13px; }
    .btn-print { background: #059669; color: white; }
    .btn-close { background: rgba(255,255,255,0.15); color: white; }
    .paper-page { background: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 16mm 18mm; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
    .doc-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px; }
    .doc-header h1 { font-size: 13pt; margin: 0; font-weight: 900; }
    .doc-header h2 { font-size: 11pt; margin: 3px 0; color: #1e293b; }
    .doc-header h3 { font-size: 12.5pt; margin: 0; color: #0369a1; }
    .teacher-badge { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; }
    table, th, td { border: 1px solid #1e293b; }
    th, td { padding: 6px 8px; font-size: 9.5pt; vertical-align: middle; }
    th { background: #f1f5f9; font-weight: 800; text-align: center; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .font-code { font-family: monospace; font-size: 10pt; }
    .rules-box { background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 10px 14px; font-size: 8.5pt; margin-top: 14px; line-height: 1.4; }
    .sig-area { display: flex; justify-content: space-between; margin-top: 24px; font-size: 9.5pt; }
    @media print {
      body { background: white !important; }
      .no-print-bar { display: none !important; }
      .paper-page { margin: 0 !important; padding: 0 !important; box-shadow: none !important; width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Pratinjau Kartu Tugas Mengawas</strong> • ${teacherName}</div>
    <div style="display: flex; gap: 8px;">
      <button class="btn-action btn-print" onclick="window.print()">🖨️ Cetak Kartu Tugas</button>
      <button class="btn-action btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>
  <div class="paper-page">
    <div class="doc-header">
      <h1>SURAT TUGAS MENGAWAS ASESMEN SEKOLAH</h1>
      <h2>${institutionName}</h2>
      <h3>${examTitle}</h3>
    </div>
    <div class="teacher-badge">
      <div>
        <div style="font-size: 12pt; font-weight: 800;">${teacherName}</div>
        <div style="color: #64748b; font-size: 9pt;">Pendidik / Pengawas Ruangan Ujian</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11pt; font-weight: 900; color: #0284c7;">Kode Pengawas: ${safeCode}</div>
        <div style="color: #64748b; font-size: 9pt;">Total Tugas: ${duties.length} Sesi</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th style="width: 130px;">Hari / Tanggal</th>
          <th style="width: 120px;">Waktu / Sesi</th>
          <th>Mata Pelajaran</th>
          <th style="width: 80px;">Ruangan</th>
          <th style="width: 65px;">Kode</th>
        </tr>
      </thead>
      <tbody>
        ${dutyRows}
      </tbody>
    </table>
    <div class="rules-box">
      <strong>Tata Tertib Pengawas:</strong>
      <ol style="margin: 4px 0 0 16px; padding: 0;">
        <li>Hadir di ruang sekretariat panitia minimal 15 menit sebelum waktu asesmen dimulai.</li>
        <li>Memastikan ketertiban ruang ujian dan memverifikasi kehadiran peserta didik.</li>
        <li>Menandatangani berita acara pelaksanaan asesmen setelah sesi berakhir.</li>
      </ol>
    </div>
    <div class="sig-area">
      <div style="text-align: center; min-width: 240px;">
        <div>Mengetahui,</div>
        <div style="font-weight: 800;">Kepala Sekolah</div>
        <div style="height: 50px;"></div>
        <div style="font-weight: 800; text-decoration: underline; white-space: nowrap;">${actualKepsekName}</div>
        <div style="font-size: 8.5pt; color: #64748b;">${formattedKepsekNpp}</div>
      </div>
      <div style="text-align: center; min-width: 240px;">
        <div>Bogor, September 2026</div>
        <div style="font-weight: 800;">Guru Pengawas,</div>
        <div style="height: 50px;"></div>
        <div style="font-weight: 800; text-decoration: underline; white-space: nowrap;">${teacherName}</div>
        <div style="font-size: 8.5pt; color: #64748b;">Kode Pengawas: ${safeCode}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak kartu tugas mengawas.');
    }
  }

  /**
   * Generates printable HTML optimized for A4 paper and triggers browser print dialog via isolated tab.
   */
  public static printOfficialMatrix(
    matrix: ExamInvigilationMatrix,
    options?: {
      kepsekName?: string;
      kepsekNip?: string;
      kepsekNpp?: string;
      committeeHeadName?: string;
      committeeHeadNip?: string;
      committeeHeadNpp?: string;
    }
  ): void {
    if (typeof window === 'undefined') return;

    const htmlContent = this.generateOfficialA4PrintHtml(matrix, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (!printWindow) {
      alert('Jendela pop-up pratinjau cetak diblokir oleh browser. Mohon izinkan pop-up untuk mencetak jadwal A4.');
    }
  }
}
