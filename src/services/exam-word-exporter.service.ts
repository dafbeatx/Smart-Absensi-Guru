/**
 * SMART ABSENSI GURU — EXAM WORD EXPORTER SERVICE
 * Exports the official Indonesian school invigilation matrix into a clean, editable
 * Microsoft Word (.doc) document that matches the school physical paper layout.
 */

import type { ExamInvigilationMatrix } from './exam-matrix-builder.service';

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
      .map((r) => `<th class="text-center room-col">${r.label}</th>`)
      .join('');

    // Build Table 1 Body Rows
    let matrixBodyRows = '';
    days.forEach((day) => {
      const rowSpan = day.sessions.length || 1;

      day.sessions.forEach((sess, sIdx) => {
        const isFirstInDay = sIdx === 0;
        const roomTds = rooms
          .map((r) => `<td class="text-center font-bold font-code">${sess.roomCodes[r.key] || '-'}</td>`)
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
          .font-code { font-family: 'Courier New', Courier, monospace; font-size: 10pt; }
          .room-col { width: 32px; }
          .day-col { padding-left: 8px; }
          .subject-col { padding-left: 8px; }
          .teacher-col { padding-left: 8px; }
          .legend-table {
            width: 75%;
            margin-top: 8px;
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
   * Generates printable HTML optimized for A4 paper and triggers browser print dialog.
   */
  public static printOfficialMatrix(matrix: ExamInvigilationMatrix): void {
    if (typeof window === 'undefined') return;

    const htmlContent = this.generateWordHtml(matrix);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 350);
  }
}
