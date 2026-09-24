/**
 * SMART ABSENSI GURU — EXAM ADMINISTRATIVE DOCUMENTS SERVICE
 * Generates official Indonesian school exam administrative physical documents
 * matching exact Ministry & school standards:
 * 1. Daftar Hadir Pengawas Ujian (ASTS / ASAS / ASAJ)
 * 2. Daftar Serah Terima Naskah Soal & Lembar Jawaban (Per Ruang / Semua Ruang)
 * 3. Berita Acara Rekapitulasi Kehadiran Peserta Ujian per Mata Pelajaran
 * 4. Daftar Hadir Panitia Ujian
 *
 * Supported Export Outputs:
 * - A4 Browser Print / PDF (with clean Times New Roman and formal border styles)
 * - Microsoft Word (.doc) for physical editing
 * - Microsoft Excel (.xlsx) using SheetJS
 */

import * as XLSXModule from 'xlsx-js-style';
const XLSX: any = (XLSXModule as any).default || XLSXModule;
import { exportHtmlToPdf } from '../lib/pdf-export.lib';
import type {
  ExamScheduleData,
  ExamCommitteeMember,
} from '../types/exam-schedule.types';
import type { ExamInvigilationMatrix } from './exam-matrix-builder.service';
import { SIGNATORY_OFFICIALS, getDynamicBranding } from '../lib/excel-generator.lib';
import { normalizeClassCode } from '../utils/class.utils';
import { getDeletedStudentKeys, getStudentNaturalKey } from '../utils/student-dedup.utils';

export type AdminDocType =
  | 'PROCTOR_ATTENDANCE'
  | 'STUDENT_ATTENDANCE_ROSTER'
  | 'SEATING_LAYOUT'
  | 'HANDOVER_DOCS'
  | 'STUDENT_ATTENDANCE_SUMMARY'
  | 'COMMITTEE_ATTENDANCE';

export interface AdminDocOptions {
  city?: string;
  signDateMonthYear?: string; // e.g. "September 2026" or "Mei 2026"
  committeeHeadName?: string;
  committeeHeadNpp?: string;
  kepsekName?: string;
  roomFilter?: string; // 'ALL' or 'Ruang 01', 'Ruang 1', etc.
  totalRegisteredStudents?: number | Record<string, number>; // total or per subject
  orientation?: 'portrait' | 'landscape';
  includeNumberPrefix?: boolean;
  participantNumberPrefix?: string; // e.g. "13-0820-"
  studentsList?: Array<{
    id?: string;
    fullName: string;
    className: string;
    gender?: string;
    roomName?: string;
    participantNumber?: string;
  }>;
  customRoomStudentsMap?: Record<string, Array<{
    urut: number;
    participantNumber: string;
    fullName: string;
    gender: string;
    className: string;
  }>>;
}

export interface ExamDayInfo {
  date: string; // YYYY-MM-DD
  dayName: string; // "Senin", "Selasa", etc.
  dateFormattedDmy: string; // "28/09/2026"
  dateFormattedLong: string; // "Senin, 28 September 2026"
}

export class ExamAdministrativeDocsService {
  /**
   * Helper to format Indonesian long date
   */
  public static formatIndonesianDateLong(dateStr: string): string {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const months = [
          '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${d} ${months[m] || m} ${y}`;
      }
    } catch {}
    return dateStr;
  }

  /**
   * Extract distinct exam dates from schedule data sorted chronologically
   */
  public static extractExamDays(scheduleData: ExamScheduleData): ExamDayInfo[] {
    const dateMap = new Map<string, ExamDayInfo>();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

    (scheduleData.subjectSchedules || []).forEach((item) => {
      if (!item.date || dateMap.has(item.date)) return;
      try {
        const d = new Date(item.date);
        const dayIdx = isNaN(d.getDay()) ? 1 : d.getDay();
        const [y, m, dayNum] = item.date.split('-');
        const dmy = `${(dayNum || '').padStart(2, '0')}/${(m || '').padStart(2, '0')}/${y || ''}`;
        const dayName = item.dayName || dayNames[dayIdx] || 'Senin';
        dateMap.set(item.date, {
          date: item.date,
          dayName,
          dateFormattedDmy: dmy,
          dateFormattedLong: `${dayName}, ${this.formatIndonesianDateLong(item.date)}`,
        });
      } catch {
        dateMap.set(item.date, {
          date: item.date,
          dayName: item.dayName || 'Senin',
          dateFormattedDmy: item.date,
          dateFormattedLong: item.date,
        });
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Resolve committee head name from committee members or fallback
   */
  public static resolveCommitteeHead(
    committeeMembers?: ExamCommitteeMember[],
    fallbackName?: string
  ): string {
    if (fallbackName && fallbackName.trim()) return fallbackName.trim();
    if (committeeMembers && committeeMembers.length > 0) {
      const ketua = committeeMembers.find((m) => m.role === 'KETUA' && m.isActive !== false);
      if (ketua && ketua.fullName) return ketua.fullName;
    }
    return 'Adi Prasetyo, S.Pd';
  }

  /**
   * Resolve date/month stamp label for signatory box
   */
  public static resolveSignDate(scheduleData: ExamScheduleData, optionMonth?: string): string {
    if (optionMonth && optionMonth.trim()) return optionMonth;
    const days = this.extractExamDays(scheduleData);
    if (days.length > 0) {
      const [y, m] = days[0].date.split('-');
      const months = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const mName = months[parseInt(m, 10)] || 'September';
      return `${mName} ${y}`;
    }
    return 'September 2026';
  }

  /**
   * Generates a 2-column borderless layout table for the signatory footer,
   * fully compatible with both browser print/PDF and Microsoft Word rendering.
   */
  public static renderSignatoryTableHtml(
    city: string,
    signDate: string,
    committeeHead: string
  ): string {
    return `
      <table class="footer-sign-table footer-signatory" style="width: 100%; border: none; border-collapse: collapse; margin-top: 20px; page-break-inside: avoid;">
        <tr style="border: none;">
          <td style="border: none; width: 62%;"></td>
          <td style="border: none; width: 38%; text-align: left; font-size: 10.5pt; vertical-align: top;">
            <div class="footer-sign-box">
              <div>${city},   ${signDate}</div>
              <div>Ketua Penyelenggara,</div>
              <div class="footer-sign-space" style="height: 55px;"></div>
              <div class="footer-sign-name" style="font-weight: bold; text-decoration: underline;">${committeeHead}</div>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  /**
   * Helper to normalize any room string into a standard canonical form "Ruang 01", "Ruang 02", etc.
   */
  public static canonicalRoomName(raw?: string, defaultIdx: number = 1): string {
    if (!raw) return `Ruang ${String(defaultIdx).padStart(2, '0')}`;
    const match = raw.match(/\d+/);
    if (match) {
      return `Ruang ${String(parseInt(match[0], 10)).padStart(2, '0')}`;
    }
    return raw.trim();
  }

  /**
   * Common CSS for official A4 school documents
   */
  public static getOfficialDocumentStyles(orientation: 'portrait' | 'landscape' = 'portrait'): string {
    const isLandscape = orientation === 'landscape';
    return `
      @page {
        size: A4 ${orientation};
        margin: ${isLandscape ? '10mm 15mm 10mm 15mm' : '10mm 15mm 10mm 15mm'};
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: ${isLandscape ? '10.5pt' : '11pt'};
        color: #000000;
        background-color: #ffffff;
        margin: 0;
        padding: 0;
        line-height: 1.2;
      }
      @media print {
        html, body {
          width: ${isLandscape ? '297mm' : '210mm'};
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page-container {
          width: ${isLandscape ? '297mm' : '210mm'};
          min-height: ${isLandscape ? '210mm' : '297mm'};
          padding: ${isLandscape ? '8mm 12mm' : '10mm 15mm'} !important;
          margin: 0 auto !important;
          page-break-inside: avoid;
          page-break-after: always;
          break-after: page;
          box-sizing: border-box;
        }
      }
      .page-container {
        width: 100%;
        max-width: ${isLandscape ? '297mm' : '210mm'};
        margin: 0 auto;
        padding: 10px 0;
        background: #ffffff;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
      }
      .doc-header {
        text-align: center;
        margin-bottom: 12px;
      }
      .doc-title-main {
        font-size: 13pt;
        font-weight: bold;
        letter-spacing: 0.5px;
        margin: 0 0 2px 0;
        text-transform: uppercase;
      }
      .doc-title-sub {
        font-size: 12pt;
        font-weight: bold;
        margin: 0 0 2px 0;
        text-transform: uppercase;
      }
      .doc-institution {
        font-size: 13pt;
        font-weight: bold;
        margin: 0 0 2px 0;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .doc-academic-year {
        font-size: 11.5pt;
        font-weight: bold;
        margin: 0 0 10px 0;
        text-transform: uppercase;
      }
      .badge-room-container {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 8px;
      }
      .badge-table {
        width: 100%;
        border: none !important;
        border-collapse: collapse;
        margin-bottom: 8px;
      }
      .badge-table td, .badge-table tr {
        border: none !important;
        padding: 0;
      }
      .badge-box-table {
        border: 2px solid #5b9bd5 !important;
        background-color: #d9e1f2 !important;
        border-collapse: collapse;
      }
      .badge-box-table td, .badge-room {
        border: none !important;
        color: #c00000 !important;
        font-weight: bold !important;
        font-size: 13.5pt !important;
        letter-spacing: 1px;
        text-align: center;
        padding: 4px 18px;
      }
      .table-banner {
        background-color: #1f4e78;
        color: #ffffff;
        font-weight: bold;
        text-align: center;
        padding: 5px;
        font-size: 10.5pt;
        letter-spacing: 0.5px;
        margin-top: 10px;
        border: 1pt solid #000000;
        border-bottom: none;
      }
      .table-banner-th {
        background-color: #1f4e78 !important;
        color: #ffffff !important;
        font-weight: bold !important;
        text-align: center !important;
        padding: 6px 4px !important;
        font-size: 10.5pt !important;
        letter-spacing: 0.5px;
        border: 1pt solid #000000 !important;
      }
      table.doc-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        font-size: 10pt;
      }
      table.doc-table, table.doc-table th, table.doc-table td {
        border: 1pt solid #000000;
      }
      table.doc-table th {
        background-color: #8eaadb;
        color: #000000;
        font-weight: bold;
        text-align: center;
        padding: 5px 4px;
        vertical-align: middle;
      }
      table.doc-table td {
        padding: 4px 6px;
        vertical-align: middle;
      }
      .text-center { text-align: center; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .sig-cell {
        height: 38px;
        min-height: 38px;
      }
      .footer-sign-table {
        width: 100%;
        border: none !important;
        border-collapse: collapse;
        margin-top: 20px;
        page-break-inside: avoid;
      }
      .footer-sign-table tr, .footer-sign-table td {
        border: none !important;
        background: transparent !important;
      }
      .footer-signatory {
        width: 100%;
        margin-top: 20px;
        page-break-inside: avoid;
      }
      .footer-sign-box {
        text-align: left;
        font-size: 10.5pt;
      }
      .footer-sign-space {
        height: 55px;
      }
      .footer-sign-name {
        font-weight: bold;
        text-decoration: underline;
      }
    `;
  }

  // =========================================================================
  // DOCUMENT 1: DAFTAR HADIR PENGAWAS UJIAN
  // =========================================================================

  public static generateProctorAttendanceHtml(
    matrix: ExamInvigilationMatrix | null,
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = matrix?.institutionName || branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const examTitle = matrix?.title || config.examTitle || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)';
    const academicYear = config.academicYear || '2026/2027';

    const examDays = this.extractExamDays(scheduleData);
    const daysToShow = examDays.length > 0 ? examDays : [
      { date: '2026-05-11', dayName: 'SENIN', dateFormattedDmy: '11/05/2026', dateFormattedLong: 'Senin, 11 Mei 2026' },
      { date: '2026-05-12', dayName: 'SELASA', dateFormattedDmy: '12/05/2026', dateFormattedLong: 'Selasa, 12 Mei 2026' },
      { date: '2026-05-13', dayName: 'RABU', dateFormattedDmy: '13/05/2026', dateFormattedLong: 'Rabu, 13 Mei 2026' },
      { date: '2026-05-14', dayName: 'KAMIS', dateFormattedDmy: '14/05/2026', dateFormattedLong: 'Kamis, 14 Mei 2026' },
      { date: '2026-05-15', dayName: "JUM'AT", dateFormattedDmy: '15/05/2026', dateFormattedLong: "Jum'at, 15 Mei 2026" },
    ];

    let proctors = matrix?.teacherLegend?.map((t) => t.fullName) || [];
    if (proctors.length === 0 && scheduleData.proctorSchedules) {
      const names = new Set<string>();
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.mainProctorName) names.add(p.mainProctorName);
        if (p.backupProctorName) names.add(p.backupProctorName);
      });
      proctors = Array.from(names);
    }
    if (proctors.length === 0) {
      proctors = [
        'Farhan Sopian Sahid, S.Pd.I',
        'Qodiatul Asrof Ramadoni, S.E',
        'M. Ridho Alfarizi',
        'Adi Prasetyo, S.Pd',
        'M. Iqbal Gustiawan, S.Pd',
        'Fitriani Rahayu',
        'Septi Nur Aeni, S.E',
        'Windiani, S.E',
        'Dafa Maulana, S.Pd',
        'Nurul Farhiyah, S.Pd',
        'Mira Nurdianti, S.Pd',
        'Widianingsih, S.Si',
        'Mawar Andinia, S.Pd',
      ];
    }

    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);

    const dayHeaderCols = daysToShow
      .map(
        (d) => `
        <th style="width: 85px; min-width: 80px;">
          <div>${d.dayName.toUpperCase()}</div>
          <div style="font-size: 8.5pt; font-weight: normal; margin-top: 2px;">${d.dateFormattedDmy}</div>
        </th>
      `
      )
      .join('');

    const bodyRows = proctors
      .map(
        (name, idx) => `
        <tr>
          <td class="text-center" style="width: 38px;">${idx + 1}</td>
          <td style="font-weight: 500;">${name}</td>
          <td class="text-center" style="width: 100px;">Pengawas</td>
          ${daysToShow.map(() => `<td class="sig-cell"></td>`).join('')}
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Daftar Hadir Pengawas - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(options?.orientation)}
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="doc-header">
            <h1 class="doc-title-main">DAFTAR HADIR PENGAWAS</h1>
            <h2 class="doc-title-sub">${examTitle}</h2>
            <div class="doc-institution">${institutionName}</div>
            <div class="doc-academic-year">TAHUN PELAJARAN ${academicYear}</div>
          </div>

          <table class="doc-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 38px;">NO</th>
                <th rowspan="2">NAMA</th>
                <th rowspan="2" style="width: 100px;">JABATAN</th>
                <th colspan="${daysToShow.length}">HARI / TANGGAL</th>
              </tr>
              <tr>
                ${dayHeaderCols}
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>

          ${this.renderSignatoryTableHtml(city, signDate, committeeHead)}
        </div>
      </body>
      </html>
    `;
  }

  // =========================================================================
  // DOCUMENT 2: DAFTAR SERAH TERIMA NASKAH SOAL & LJK (PER RUANG / SEMUA RUANG)
  // =========================================================================

  public static generateSingleRoomHandoverHtml(
    roomName: string,
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const academicYear = config.academicYear || '2026/2027';
    const examTypeStr = config.examTitle || config.examType || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)';

    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);

    const proctorSchedules = scheduleData.proctorSchedules || [];
    const normalizedTargetRoom = roomName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const roomDuties = proctorSchedules.filter((p) => {
      const pRoomNorm = (p.roomName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pRoomNorm === normalizedTargetRoom;
    });

    const examDays = this.extractExamDays(scheduleData);

    let table1Rows = '';
    let table2Rows = '';

    examDays.forEach((day, dIdx) => {
      const dutiesThisDay = roomDuties.filter((d) => d.date === day.date);
      const subjectsThisDay = scheduleData.subjectSchedules
        ? scheduleData.subjectSchedules.filter((s) => s.date === day.date)
        : [];

      const showNumbers = options?.includeNumberPrefix !== false;
      const rowItemStyle = 'min-height: 28px; line-height: 24px; padding: 2px 0;';

      const subjectDivs: string[] = [];
      const codeDivs: string[] = [];
      const proctorDivs: string[] = [];
      const sigDivs: string[] = [];

      if (dutiesThisDay.length > 0) {
        dutiesThisDay.forEach((duty, idx) => {
          const numPrefix = showNumbers ? `${idx + 1}.` : '&nbsp;';
          subjectDivs.push(`<div style="${rowItemStyle}">${idx + 1}. ${duty.subject}</div>`);
          codeDivs.push(`<div style="${rowItemStyle}" class="text-center">${numPrefix}</div>`);
          proctorDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
          sigDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
        });
      } else if (subjectsThisDay.length > 0) {
        const distinctSubj = Array.from(new Set(subjectsThisDay.map((s) => s.subject)));
        distinctSubj.forEach((subj, idx) => {
          const numPrefix = showNumbers ? `${idx + 1}.` : '&nbsp;';
          subjectDivs.push(`<div style="${rowItemStyle}">${idx + 1}. ${subj}</div>`);
          codeDivs.push(`<div style="${rowItemStyle}" class="text-center">${numPrefix}</div>`);
          proctorDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
          sigDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
        });
      } else {
        const numPrefix = showNumbers ? '1.' : '&nbsp;';
        subjectDivs.push(`<div style="${rowItemStyle}">1.</div>`);
        codeDivs.push(`<div style="${rowItemStyle}" class="text-center">${numPrefix}</div>`);
        proctorDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
        sigDivs.push(`<div style="${rowItemStyle}">${numPrefix}</div>`);
      }

      const subjectCellHtml = subjectDivs.join('');
      const codeCellHtml = codeDivs.join('');
      const proctorCellHtml = proctorDivs.join('');
      const sigCellHtml = sigDivs.join('');

      const isLandscape = options?.orientation === 'landscape';
      const proctorColWidth = isLandscape ? '220px' : '160px';
      const sigColWidth = isLandscape ? '160px' : '120px';

      const rowHtml = `
        <tr>
          <td class="text-center" style="width: 32px; vertical-align: top;">${dIdx + 1}</td>
          <td style="width: 170px; font-weight: 500; vertical-align: top; white-space: nowrap;">${day.dateFormattedLong}</td>
          <td style="vertical-align: top;">${subjectCellHtml}</td>
          <td style="width: 70px; vertical-align: top;" class="text-center">${codeCellHtml}</td>
          <td style="width: ${proctorColWidth}; vertical-align: top;">${proctorCellHtml}</td>
          <td style="width: ${sigColWidth}; vertical-align: top;" class="text-left">${sigCellHtml}</td>
        </tr>
      `;

      table1Rows += rowHtml;
      table2Rows += rowHtml;
    });

    const isLandscape = options?.orientation === 'landscape';
    const proctorColWidth = isLandscape ? '220px' : '160px';
    const sigColWidth = isLandscape ? '160px' : '120px';

    const badgeText = roomName.toUpperCase().startsWith('RUANG')
      ? roomName.toUpperCase()
      : `RUANG ${roomName.toUpperCase()}`;

    return `
      <div class="page-container">
        <div class="doc-header">
          <h1 class="doc-title-main">DAFTAR SERAH TERIMA NASKAH SOAL DAN LEMBAR JAWABAN</h1>
          <h2 class="doc-title-sub">${examTypeStr}</h2>
          <div class="doc-institution">${institutionName}</div>
          <div class="doc-academic-year">TAHUN PELAJARAN ${academicYear}</div>
        </div>

        <table class="badge-table" style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 8px;">
          <tr style="border: none;">
            <td style="border: none; padding: 0; width: 65%;"></td>
            <td style="border: none; padding: 0; width: 35%; text-align: right;" align="right">
              <table align="right" class="badge-box-table" style="width: auto; border: 2px solid #5b9bd5; border-collapse: collapse; background-color: #d9e1f2; margin-left: auto;">
                <tr style="border: none;">
                  <td class="badge-room" style="border: none; padding: 4px 18px; color: #c00000; font-weight: bold; font-size: 13.5pt; letter-spacing: 1px; text-align: center; white-space: nowrap;">
                    ${badgeText}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table class="doc-table">
          <thead>
            <tr>
              <th colspan="6" class="table-banner-th" style="background-color: #1f4e78; color: #ffffff; font-weight: bold; text-align: center; padding: 6px 4px; font-size: 10.5pt; letter-spacing: 0.5px; border: 1pt solid #000000;">Daftar Pengambilan Naskah Soal ${config.examType || 'ASTS'}</th>
            </tr>
            <tr>
              <th style="width: 32px;">No.</th>
              <th style="width: 170px;">Hari,Tanggal</th>
              <th>Mata Pelajaran</th>
              <th style="width: 70px;">No.Kode</th>
              <th style="width: ${proctorColWidth};">Nama Pengawas</th>
              <th style="width: ${sigColWidth};">Tanda Tangan</th>
            </tr>
          </thead>
          <tbody>
            ${table1Rows}
          </tbody>
        </table>

        <table class="doc-table" style="margin-top: 14px;">
          <thead>
            <tr>
              <th colspan="6" class="table-banner-th" style="background-color: #1f4e78; color: #ffffff; font-weight: bold; text-align: center; padding: 6px 4px; font-size: 10.5pt; letter-spacing: 0.5px; border: 1pt solid #000000;">Daftar Penyerahan Lembar Jawaban ${config.examType || 'ASTS'}</th>
            </tr>
            <tr>
              <th style="width: 32px;">No.</th>
              <th style="width: 170px;">Hari,Tanggal</th>
              <th>Mata Pelajaran</th>
              <th style="width: 70px;">No.Kode</th>
              <th style="width: ${proctorColWidth};">Nama Pengawas</th>
              <th style="width: ${sigColWidth};">Tanda Tangan</th>
            </tr>
          </thead>
          <tbody>
            ${table2Rows}
          </tbody>
        </table>

        ${this.renderSignatoryTableHtml(city, signDate, committeeHead)}
      </div>
    `;
  }

  public static generateHandoverDocsHtml(
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';

    let rooms: string[] = [];
    if (scheduleData.proctorSchedules) {
      const roomSet = new Set<string>();
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.roomName) roomSet.add(p.roomName);
      });
      rooms = Array.from(roomSet);
    }
    if (rooms.length === 0) {
      const totalRooms = scheduleData.config.totalRooms || 3;
      for (let i = 1; i <= totalRooms; i++) {
        rooms.push(`Ruang ${String(i).padStart(2, '0')}`);
      }
    }

    const selectedRoom = options?.roomFilter;
    const roomsToRender =
      selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => r.toLowerCase() === selectedRoom.toLowerCase())
        : rooms;

    const sections = roomsToRender.map((r, idx) => {
      const roomHtml = this.generateSingleRoomHandoverHtml(r, scheduleData, options);
      const isLast = idx === roomsToRender.length - 1;
      return `
        ${roomHtml}
        ${!isLast ? '<br clear="all" style="page-break-before: always; mso-break-type: section-break;" /><div class="page-break"></div>' : ''}
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Daftar Serah Terima Naskah Soal & LJK - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(options?.orientation)}
        </style>
      </head>
      <body>
        ${sections}
      </body>
      </html>
    `;
  }

  // =========================================================================
  // DOCUMENT: DAFTAR HADIR PESERTA UJIAN (PER RUANGAN)
  // Sesuai format fisik ASTS SMP Terpadu Al-Ittihadiyah / SMA Terpadu As Salaam
  // Format Landscape A4 dengan 13 Kolom Mata Pelajaran (Tanda Tangan Siswa)
  // Nomor peserta: 13-0820-001 (dimulai dari peserta 1 di Ruang 1 secara sekuensial)
  // =========================================================================

  public static readonly OFFICIAL_SMP_ASTS_SUBJECTS = [
    'PAI & BP',
    'IPA',
    'MTK',
    'B. Arab',
    'Pancasila',
    'B. Indo',
    'IPS',
    'B. Sunda',
    'B. Ingg',
    'SBK',
    'PJOK',
    'ALK',
    'Informatika',
  ];

  public static readonly OFFICIAL_SMA_ASTS_SUBJECTS = [
    'PAI & BP',
    'MTK',
    'B. Indo',
    'B. Ingg',
    'Fisika',
    'Kimia',
    'Biologi',
    'Sejarah',
    'Pancasila',
    'B. Sunda',
    'B. Arab',
    'Informatika',
    'PJOK',
  ];

  public static compactSubjectName(subject: string): string {
    const s = subject.trim();
    const lower = s.toLowerCase();
    if (/pendidikan agama|pai/i.test(lower)) return 'PAI & BP';
    if (/matematika|mtk/i.test(lower)) return 'MTK';
    if (/bahasa indonesia|b\.?\s*indo/i.test(lower)) return 'B. Indo';
    if (/bahasa inggris|b\.?\s*ingg/i.test(lower)) return 'B. Ingg';
    if (/bahasa arab|b\.?\s*arab/i.test(lower)) return 'B. Arab';
    if (/bahasa sunda|b\.?\s*sunda/i.test(lower)) return 'B. Sunda';
    if (/pancasila|pkn/i.test(lower)) return 'Pancasila';
    if (/informatika|komputer|tik/i.test(lower)) return 'Informatika';
    if (/pjok|penjas/i.test(lower)) return 'PJOK';
    if (/seni budaya|sbk|seni/i.test(lower)) return 'SBK';
    if (/al-qur|alk|quran/i.test(lower)) return 'ALK';
    if (/ilmu pengetahuan alam|^ipa$/i.test(lower)) return 'IPA';
    if (/ilmu pengetahuan sosial|^ips$/i.test(lower)) return 'IPS';
    if (/fisika/i.test(lower)) return 'Fisika';
    if (/kimia/i.test(lower)) return 'Kimia';
    if (/biologi/i.test(lower)) return 'Biologi';
    if (/sosiologi/i.test(lower)) return 'Sosiologi';
    if (/ekonomi/i.test(lower)) return 'Ekonomi';
    if (/geografi/i.test(lower)) return 'Geografi';
    if (/sejarah/i.test(lower)) return 'Sejarah';
    if (/pkwu|prakarya/i.test(lower)) return 'PKWU';
    if (s.length <= 11) return s;
    return s.substring(0, 11);
  }

  public static extractRosterSubjects(scheduleData: ExamScheduleData, isSma: boolean): string[] {
    const extracted: string[] = [];
    if (scheduleData.subjectSchedules && scheduleData.subjectSchedules.length > 0) {
      scheduleData.subjectSchedules.forEach((sub) => {
        if (sub.subject && sub.subject.trim()) {
          const compacted = this.compactSubjectName(sub.subject);
          if (!extracted.includes(compacted)) {
            extracted.push(compacted);
          }
        }
      });
    }
    // Jika mata pelajaran di jadwal kurang dari 5, gunakan daftar 13 mapel fisik sekolah
    if (extracted.length < 5) {
      return isSma ? [...this.OFFICIAL_SMA_ASTS_SUBJECTS] : [...this.OFFICIAL_SMP_ASTS_SUBJECTS];
    }
    return extracted;
  }

  public static resolveFullSignDate(scheduleData: ExamScheduleData, optionDate?: string): string {
    if (optionDate && optionDate.trim()) {
      const trimmed = optionDate.trim();
      if (/^\d+\s+/.test(trimmed)) return trimmed;
      const days = this.extractExamDays(scheduleData);
      if (days.length > 0) {
        const parts = days[0].date.split('-');
        const d = parts[2] ? parseInt(parts[2], 10) : 2;
        return `${d} ${trimmed}`;
      }
      return `2 ${trimmed}`;
    }
    const days = this.extractExamDays(scheduleData);
    if (days.length > 0) {
      const parts = days[0].date.split('-');
      const y = parts[0];
      const m = parts[1];
      const d = parts[2] ? parseInt(parts[2], 10) : 2;
      const months = [
        '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const mName = months[parseInt(m, 10)] || 'Maret';
      return `${d} ${mName} ${y}`;
    }
    return '2 Maret 2026';
  }

  public static readonly OFFICIAL_SMP_ROOM_1_STUDENTS = [
    // Laki-laki (13 Siswa)
    { fullName: 'AFHTAR SHAKIL', gender: 'L', className: '7' },
    { fullName: 'AKBAR AZHI MUGHNI', gender: 'L', className: '7' },
    { fullName: 'AL-DAFI PUTRA ASYABANI', gender: 'L', className: '7' },
    { fullName: 'FATTURAHMAN RANGGA', gender: 'L', className: '7' },
    { fullName: 'HANIFAH AL-QUSYARI', gender: 'L', className: '7' },
    { fullName: 'IFHAM FATHAR MUBAROK', gender: 'L', className: '7' },
    { fullName: 'MUHAMAD ARDHIANSYAH', gender: 'L', className: '7' },
    { fullName: 'MUHAMAD IBNU ZIKRA', gender: 'L', className: '7' },
    { fullName: 'MUHAMAD MILAN AZKA', gender: 'L', className: '7' },
    { fullName: 'MUHAMAD RIDWAN AULAH', gender: 'L', className: '7' },
    { fullName: 'MUHAMMAD HAMDAN ZULFAN', gender: 'L', className: '7' },
    { fullName: 'MUHAMMAD NABIEL ALQARANI', gender: 'L', className: '7' },
    { fullName: 'MUHAMMAD RIAN', gender: 'L', className: '7' },
    // Perempuan (16 Siswa)
    { fullName: 'ADIBA KHANSA AZ-ZAHRA', gender: 'P', className: '7' },
    { fullName: 'CALISA CANIA MARYAM', gender: 'P', className: '7' },
    { fullName: 'DELISA QEREN SURFINA', gender: 'P', className: '7' },
    { fullName: 'FITRIANI AZAHRA', gender: 'P', className: '7' },
    { fullName: 'HILYA HIMMATUL ALIYAH', gender: 'P', className: '7' },
    { fullName: 'KEISHA PUTRI ELIANA', gender: 'P', className: '7' },
    { fullName: 'KINARA AZZAHRA', gender: 'P', className: '7' },
    { fullName: 'NAIRA RUBBIATUL HIKMAH', gender: 'P', className: '7' },
    { fullName: 'NAZMA MARATUN SOLIHAH', gender: 'P', className: '7' },
    { fullName: 'SELA MUTIA NUR AZIMAH', gender: 'P', className: '7' },
    { fullName: 'SHIRIN FATINA JASMIN', gender: 'P', className: '7' },
    { fullName: 'SITI NADIPATUL MALA', gender: 'P', className: '7' },
    { fullName: "SYA'DATUN NISA", gender: 'P', className: '7' },
    { fullName: 'TASYA NURASRI SETIAWAN', gender: 'P', className: '7' },
    { fullName: 'VIODORA SHAKILA NUR ZAFIRA', gender: 'P', className: '7' },
    { fullName: 'ZAHROFAL MAULA', gender: 'P', className: '7' },
  ];

  public static readonly OFFICIAL_SMP_ROOM_2_STUDENTS = [
    { fullName: 'AJENG ALIFATUL KHOIR', gender: 'P', className: '8A' },
    { fullName: 'AZZAHRA ASHILA ROHMAH', gender: 'P', className: '8A' },
    { fullName: 'BILQIS NUR AZIZAH', gender: 'P', className: '8A' },
    { fullName: 'DEWI SARTIKA', gender: 'P', className: '8A' },
    { fullName: 'FUJI HIKMAH', gender: 'P', className: '8A' },
    { fullName: 'GINA SONIA', gender: 'P', className: '8A' },
    { fullName: 'HANIFAH AL-QUSYARI', gender: 'P', className: '8A' },
    { fullName: 'INDAH PERMATA', gender: 'P', className: '8A' },
    { fullName: 'KHOIRUNNISA', gender: 'P', className: '8A' },
    { fullName: 'LAILA FITRIANI', gender: 'P', className: '8A' },
    { fullName: 'MEIDINA PUTRI', gender: 'P', className: '8A' },
    { fullName: 'NURAENI', gender: 'P', className: '8A' },
    { fullName: 'RADISTI PUTRI', gender: 'P', className: '8A' },
    { fullName: 'SALMA AULIA', gender: 'P', className: '8A' },
    { fullName: 'SEPTI MUJIANTI', gender: 'P', className: '8A' },
    { fullName: 'SIFA NURKHALIFAH', gender: 'P', className: '8A' },
    { fullName: 'SITI AISYAH', gender: 'P', className: '8A' },
    { fullName: 'ZAHRA TUSSYITA', gender: 'P', className: '8A' },
  ];

  public static readonly OFFICIAL_SMP_ROOM_3_STUDENTS = [
    { fullName: 'ALYA NUR AZIZAH', gender: 'P', className: '9A' },
    { fullName: 'ANISA RAHMAWATI', gender: 'P', className: '9A' },
    { fullName: 'AULIA RAHMADHANI', gender: 'P', className: '9A' },
    { fullName: 'CINTA LAURA SAFITRI', gender: 'P', className: '9A' },
    { fullName: 'DELIA PUTRI', gender: 'P', className: '9A' },
    { fullName: 'DINA MARLIANA', gender: 'P', className: '9A' },
    { fullName: 'ENENG SITI FATIMAH', gender: 'P', className: '9A' },
    { fullName: 'FITRI HANDAYANI', gender: 'P', className: '9A' },
    { fullName: 'FITRIA NINGSIH', gender: 'P', className: '9A' },
    { fullName: 'HANI ANGGRAENI', gender: 'P', className: '9A' },
    { fullName: 'INTAN NURAINI', gender: 'P', className: '9A' },
    { fullName: 'LESTARI INDAH', gender: 'P', className: '9A' },
    { fullName: 'MUTIARA RAMADHANI', gender: 'P', className: '9A' },
    { fullName: 'NADIA OKTAVIA', gender: 'P', className: '9A' },
    { fullName: 'RATNA SARI', gender: 'P', className: '9A' },
    { fullName: 'TIARA LESTARI', gender: 'P', className: '9A' },
  ];

  public static readonly OFFICIAL_SMP_ROOM_4_STUDENTS = [
    { fullName: 'ADITYA NUGRAHA', gender: 'L', className: '9B' },
    { fullName: 'ALDI MAULANA', gender: 'L', className: '9B' },
    { fullName: 'ARYA PUTRA PRATAMA', gender: 'L', className: '9B' },
    { fullName: 'BAYU SETIAWAN', gender: 'L', className: '9B' },
    { fullName: 'DANI RAMDANI', gender: 'L', className: '9B' },
    { fullName: 'EKO PRASETYO', gender: 'L', className: '9B' },
    { fullName: 'FACHRI HIDAYAT', gender: 'L', className: '9B' },
    { fullName: 'FAJAR SIDIK', gender: 'L', className: '9B' },
    { fullName: 'GILANG RAMADHAN', gender: 'L', className: '9B' },
    { fullName: 'HENDRA WIJAYA', gender: 'L', className: '9B' },
    { fullName: 'ILHAM SAPUTRA', gender: 'L', className: '9B' },
    { fullName: 'KEVIN PRATAMA', gender: 'L', className: '9B' },
    { fullName: 'M. RIZKY MAULANA', gender: 'L', className: '9B' },
    { fullName: 'RENDI SETIAWAN', gender: 'L', className: '9B' },
    { fullName: 'YUSUF MAULANA', gender: 'L', className: '9B' },
  ];

  public static readonly OFFICIAL_SMP_ROOM_5_STUDENTS = [
    { fullName: 'ABILA YAZID RIZAQI', gender: 'L', className: '8B' },
    { fullName: 'ADITYA PRATAMA', gender: 'L', className: '8B' },
    { fullName: 'AKBAR AZHI MUGHNI', gender: 'L', className: '8B' },
    { fullName: 'ANDIKA PRATAMA', gender: 'L', className: '8B' },
    { fullName: 'BAGAS DWI CAHYO', gender: 'L', className: '8B' },
    { fullName: 'DIMAS ANUGRAH', gender: 'L', className: '8B' },
    { fullName: 'FAIRUZ PRASETIA', gender: 'L', className: '8B' },
    { fullName: 'FARDHAN HANIF', gender: 'L', className: '8B' },
    { fullName: 'FARIZ ABQORI MAULANA', gender: 'L', className: '8B' },
    { fullName: 'FITRA RAMADHAN', gender: 'L', className: '8B' },
    { fullName: 'GALIH RAKASIWI', gender: 'L', className: '8B' },
    { fullName: 'IFHAM FATHAR MUBAROK', gender: 'L', className: '8B' },
    { fullName: 'MARVHEL PUTRA IHSANUL ALIM', gender: 'L', className: '8B' },
    { fullName: 'MUHAMAD IBNU ZIKRA', gender: 'L', className: '8B' },
    { fullName: 'MUHAMAD RAKA ADITYA', gender: 'L', className: '8B' },
    { fullName: 'ROMADONI', gender: 'L', className: '8B' },
    { fullName: 'WILDAN KHOER BASUKI', gender: 'L', className: '8B' },
  ];

  public static readonly OFFICIAL_SMA_ROOM_1_STUDENTS = [
    { fullName: 'ACHMAD DANI PRATAMA', gender: 'L', className: '10' },
    { fullName: 'ARNESTA HADIWINATA', gender: 'P', className: '10' },
    { fullName: 'BELLA NOVITA SARI', gender: 'P', className: '10' },
    { fullName: 'EVIANA', gender: 'P', className: '10' },
    { fullName: 'HAYATUSSIFA', gender: 'P', className: '10' },
    { fullName: 'MUHAMMAD RIFQI PRATAMA', gender: 'L', className: '10' },
    { fullName: 'NAZWATUNNISA', gender: 'P', className: '10' },
    { fullName: 'NYIMAS RANI RAHMAWATI', gender: 'P', className: '10' },
    { fullName: 'REVAN ADITYA', gender: 'L', className: '10' },
    { fullName: 'RIZKI RAMADHAN', gender: 'L', className: '10' },
    { fullName: 'SITI NURHALIZA', gender: 'P', className: '10' },
    { fullName: 'TIARA ANDINI', gender: 'P', className: '10' },
  ];

  public static readonly OFFICIAL_SMA_ROOM_2_STUDENTS = [
    { fullName: 'ALIF MAULANA', gender: 'L', className: '11' },
    { fullName: 'ANNISA FITRIANI', gender: 'P', className: '11' },
    { fullName: 'BINTANG RAMADHAN', gender: 'L', className: '11' },
    { fullName: 'CANTIKA DEWI', gender: 'P', className: '11' },
    { fullName: 'DICKY CHANDRA', gender: 'L', className: '11' },
    { fullName: 'ELSA PUTRI', gender: 'P', className: '11' },
    { fullName: 'FAJAR HIDAYAT', gender: 'L', className: '11' },
    { fullName: 'GISKA AMALIA', gender: 'P', className: '11' },
    { fullName: 'HANIF PRATAMA', gender: 'L', className: '11' },
    { fullName: 'INDAH KUSUMA', gender: 'P', className: '11' },
    { fullName: 'JULIAN SAPUTRA', gender: 'L', className: '11' },
    { fullName: 'KARINA SALSABILA', gender: 'P', className: '11' },
  ];

  public static readonly OFFICIAL_SMA_ROOM_3_STUDENTS = [
    { fullName: 'LUTHFI HAKIM', gender: 'L', className: '12' },
    { fullName: 'MELANI SUKMA', gender: 'P', className: '12' },
    { fullName: 'NAUFAL AZHAR', gender: 'L', className: '12' },
    { fullName: 'OKTA VIANI', gender: 'P', className: '12' },
    { fullName: 'PANDU WIJAYA', gender: 'L', className: '12' },
    { fullName: 'QORI NURUL', gender: 'P', className: '12' },
    { fullName: 'RAFFI AHMAD', gender: 'L', className: '12' },
    { fullName: 'SAFIRA MAHARANI', gender: 'P', className: '12' },
    { fullName: 'TAUFIQ HIDAYAT', gender: 'L', className: '12' },
    { fullName: 'ULFAH DWI', gender: 'P', className: '12' },
    { fullName: 'VINO BASTIAN', gender: 'L', className: '12' },
    { fullName: 'WIDYA ASTUTI', gender: 'P', className: '12' },
  ];

  public static readonly OFFICIAL_SMA_ROOM_6_STUDENTS = [
    { fullName: 'ACHMAD DANI PRATAMA', gender: 'L', className: '10' },
    { fullName: 'ARNESTA HADIWINATA', gender: 'P', className: '10' },
    { fullName: 'BELLA NOVITA SARI', gender: 'P', className: '10' },
    { fullName: 'EVIANA', gender: 'P', className: '10' },
    { fullName: 'HAYATUSSIFA', gender: 'P', className: '10' },
    { fullName: 'MUHAMMAD RIFQI PRATAMA', gender: 'L', className: '10' },
    { fullName: 'NAZWATUNNISA', gender: 'P', className: '10' },
    { fullName: 'NYIMAS RANI RAHMAWATI', gender: 'P', className: '10' },
    { fullName: 'REVAN ADITYA', gender: 'L', className: '10' },
    { fullName: 'RIZKI RAMADHAN', gender: 'L', className: '10' },
    { fullName: 'SITI NURHALIZA', gender: 'P', className: '10' },
    { fullName: 'TIARA ANDINI', gender: 'P', className: '10' },
    { fullName: 'ALIF MAULANA', gender: 'L', className: '11' },
    { fullName: 'ANNISA FITRIANI', gender: 'P', className: '11' },
    { fullName: 'BINTANG RAMADHAN', gender: 'L', className: '11' },
    { fullName: 'CANTIKA DEWI', gender: 'P', className: '11' },
    { fullName: 'DICKY CHANDRA', gender: 'L', className: '11' },
    { fullName: 'ELSA PUTRI', gender: 'P', className: '11' },
    { fullName: 'FAJAR HIDAYAT', gender: 'L', className: '11' },
    { fullName: 'GISKA AMALIA', gender: 'P', className: '11' },
    { fullName: 'HANIF PRATAMA', gender: 'L', className: '11' },
    { fullName: 'INDAH KUSUMA', gender: 'P', className: '11' },
    { fullName: 'JULIAN SAPUTRA', gender: 'L', className: '11' },
    { fullName: 'KARINA SALSABILA', gender: 'P', className: '11' },
    { fullName: 'LUTHFI HAKIM', gender: 'L', className: '12' },
    { fullName: 'MELANI SUKMA', gender: 'P', className: '12' },
    { fullName: 'NAUFAL AZHAR', gender: 'L', className: '12' },
    { fullName: 'OKTA VIANI', gender: 'P', className: '12' },
    { fullName: 'PANDU WIJAYA', gender: 'L', className: '12' },
    { fullName: 'QORI NURUL', gender: 'P', className: '12' },
    { fullName: 'RAFFI AHMAD', gender: 'L', className: '12' },
    { fullName: 'SAFIRA MAHARANI', gender: 'P', className: '12' },
    { fullName: 'TAUFIQ HIDAYAT', gender: 'L', className: '12' },
    { fullName: 'ULFAH DWI', gender: 'P', className: '12' },
    { fullName: 'VINO BASTIAN', gender: 'L', className: '12' },
    { fullName: 'WIDYA ASTUTI', gender: 'P', className: '12' },
  ];

  public static resolveRoomStudents(
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): Record<string, Array<{
    urut: number;
    participantNumber: string;
    fullName: string;
    gender: string;
    className: string;
  }>> {
    const prefix = options?.participantNumberPrefix || '13-0820-';
    const isSma =
      scheduleData.educationLevel === 'SMA' ||
      scheduleData.config.educationLevel === 'SMA' ||
      scheduleData.config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
      false;

    // 1. Ekstraksi daftar ruangan dari jadwal & standardisasi nama (selalu tepat 5 ruangan untuk SMP, Ruang 06 untuk SMA)
    const rSet = new Set<string>();

    if (scheduleData.proctorSchedules && scheduleData.proctorSchedules.length > 0) {
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.roomName) rSet.add(this.canonicalRoomName(p.roomName));
      });
    }

    if (scheduleData.subjectSchedules && scheduleData.subjectSchedules.length > 0) {
      scheduleData.subjectSchedules.forEach((s) => {
        if (s.roomName) rSet.add(this.canonicalRoomName(s.roomName));
      });
    }

    if (scheduleData.config.classRoomMapping) {
      Object.values(scheduleData.config.classRoomMapping).forEach((r) => {
        if (r) rSet.add(this.canonicalRoomName(r));
      });
    }

    if (scheduleData.config.customRoomNumbers && scheduleData.config.customRoomNumbers.length > 0) {
      scheduleData.config.customRoomNumbers.forEach((n) => {
        rSet.add(`Ruang ${String(n).padStart(2, '0')}`);
      });
    }

    if (isSma) {
      if (rSet.size === 0) {
        rSet.add('Ruang 06');
      }
    } else {
      const minRooms = 5;
      const targetRoomCount = Math.max(minRooms, scheduleData.config.totalRooms || minRooms);
      for (let i = 1; i <= targetRoomCount; i++) {
        rSet.add(`Ruang ${String(i).padStart(2, '0')}`);
      }
    }

    const rooms: string[] = Array.from(rSet).sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
      return numA - numB;
    });

    // 1b. Jika pengguna telah me-review & mengedit daftar siswa melalui modal Review & Edit
    if (options?.customRoomStudentsMap && Object.keys(options.customRoomStudentsMap).length > 0) {
      const customMap = options.customRoomStudentsMap;
      const verifiedMap: Record<string, Array<{
        urut: number;
        participantNumber: string;
        fullName: string;
        gender: string;
        className: string;
      }>> = {};

      let globalIndex = 1;
      rooms.forEach((rName, idx) => {
        const roomNum = parseInt(rName.replace(/[^\d]/g, ''), 10);
        const matchingCustom =
          customMap[rName] ||
          customMap[`Ruang ${roomNum}`] ||
          customMap[`Ruang ${String(roomNum).padStart(2, '0')}`];

        if (matchingCustom && matchingCustom.length > 0) {
          const deletedKeys = getDeletedStudentKeys();
          const cleanCustom = matchingCustom.filter((st) => {
            const key = getStudentNaturalKey(st.className, st.fullName);
            return !deletedKeys.has(key);
          });
          let sortedCustom = cleanCustom;
          if (roomNum === 1 || idx === 0) {
            const males = cleanCustom
              .filter((s) => (s.gender || 'L').toUpperCase() === 'L')
              .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'));
            const females = cleanCustom
              .filter((s) => (s.gender || '').toUpperCase() === 'P')
              .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'));
            const others = cleanCustom
              .filter((s) => (s.gender || '').toUpperCase() !== 'L' && (s.gender || '').toUpperCase() !== 'P')
              .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'));
            sortedCustom = [...males, ...females, ...others];
          }

          verifiedMap[rName] = sortedCustom.map((st, i) => {
            const participantNumber = st.participantNumber && st.participantNumber.trim() !== ''
              ? st.participantNumber
              : `${prefix}${String(globalIndex).padStart(3, '0')}`;
            globalIndex++;
            return {
              urut: i + 1,
              participantNumber,
              fullName: (st.fullName || '').toUpperCase(),
              gender: st.gender || 'P',
              className: st.className || (
                roomNum === 6 ? '10' :
                roomNum === 1 || idx === 0 ? '7' :
                roomNum === 2 || idx === 1 ? '8A' :
                roomNum === 3 || idx === 2 ? '9A' :
                roomNum === 4 || idx === 3 ? '9B' :
                roomNum === 5 || idx === 4 ? '8B' : '7'
              ),
            };
          });
        } else {
          // Fallback resmi agar ruangan tidak kosong
          let fallback;
          if (roomNum === 6 || rName.includes('6')) {
            fallback = this.OFFICIAL_SMA_ROOM_6_STUDENTS;
          } else if (isSma) {
            fallback = idx === 0 ? this.OFFICIAL_SMA_ROOM_1_STUDENTS : idx === 1 ? this.OFFICIAL_SMA_ROOM_2_STUDENTS : this.OFFICIAL_SMA_ROOM_3_STUDENTS;
          } else {
            fallback = roomNum === 1 ? this.OFFICIAL_SMP_ROOM_1_STUDENTS
              : roomNum === 2 ? this.OFFICIAL_SMP_ROOM_2_STUDENTS
              : roomNum === 3 ? this.OFFICIAL_SMP_ROOM_3_STUDENTS
              : roomNum === 4 ? this.OFFICIAL_SMP_ROOM_4_STUDENTS
              : roomNum === 5 ? this.OFFICIAL_SMP_ROOM_5_STUDENTS
              : this.OFFICIAL_SMP_ROOM_1_STUDENTS;
          }

          const deletedKeys = getDeletedStudentKeys();
          const activeFallback = (fallback || this.OFFICIAL_SMP_ROOM_1_STUDENTS).filter((st) => {
            const key = getStudentNaturalKey(st.className, st.fullName);
            return !deletedKeys.has(key);
          });

          verifiedMap[rName] = activeFallback.map((st, i) => {
            const participantNumber = `${prefix}${String(globalIndex).padStart(3, '0')}`;
            globalIndex++;
            return {
              urut: i + 1,
              participantNumber,
              fullName: st.fullName,
              gender: st.gender || 'L',
              className: st.className,
            };
          });
        }
      });
      return verifiedMap;
    }

    // 2. Susun daftar siswa per ruangan - PER KELAS
    // Ruang 1: Kelas 7
    // Ruang 2: Kelas 8A
    // Ruang 3: Kelas 9A
    // Ruang 4: Kelas 9B
    // Ruang 5: Kelas 8B
    // Ruang 6: Kelas 10, 11, 12 (SMA)
    const rawStudentMap: Record<string, Array<{ fullName: string; gender: string; className: string }>> = {};
    rooms.forEach((r) => { rawStudentMap[r] = []; });

    const getTargetRoomForStudent = (
      st: { roomName?: string; className?: string; class?: string; kelas?: string }
    ): string => {
      if (st.roomName) {
        const canon = this.canonicalRoomName(st.roomName);
        if (rooms.includes(canon)) return canon;
      }

      const rawCls = (st.className || (st as any).class || (st as any).kelas || '').trim();
      const normCls = normalizeClassCode(rawCls);
      const rawUpper = rawCls.toUpperCase().replace(/\s+/g, '');

      // 1. Check if classRoomMapping maps this class to a room
      if (scheduleData.config.classRoomMapping) {
        for (const [clsKey, rVal] of Object.entries(scheduleData.config.classRoomMapping)) {
          const normKey = normalizeClassCode(clsKey);
          const rawKey = clsKey.trim().toUpperCase().replace(/\s+/g, '');
          if (
            (normKey && normKey === normCls) ||
            (rawKey && rawKey === rawUpper) ||
            (normCls.length >= 2 && normKey.length >= 2 && (normCls.includes(normKey) || normKey.includes(normCls))) ||
            (rawUpper.length >= 2 && rawKey.length >= 2 && (rawUpper.includes(rawKey) || rawKey.includes(rawUpper)))
          ) {
            const canon = this.canonicalRoomName(rVal);
            if (rooms.includes(canon)) return canon;
          }
        }
      }

      // 2. Check if student belongs to SMA (Kelas 10, 11, 12, SMA, IPA, IPS)
      const isStudentSma = /^10|11|12|SMA|IPA|IPS/i.test(normCls) || /10|11|12|X|XI|XII|SMA|IPA|IPS/i.test(rawUpper);
      if (isStudentSma) {
        // If Ruang 06 exists in rooms, all SMA students go to Ruang 06!
        const r6 = rooms.find((r) => parseInt(r.replace(/[^\d]/g, ''), 10) === 6);
        if (r6) return r6;

        // If multiple separate SMA rooms exist (e.g. Ruang 1 = 10, Ruang 2 = 11, Ruang 3 = 12)
        if (/^10/.test(normCls)) return rooms[0] || 'Ruang 01';
        if (/^11/.test(normCls)) return rooms[1] || 'Ruang 02';
        if (/^12/.test(normCls)) return rooms[2] || 'Ruang 03';
        return rooms[0] || 'Ruang 01';
      }

      // 3. SMP mapping deterministik per kelas (sesuai nomor ruangan fisik):
      // Ruang 1 -> Kelas 7
      // Ruang 2 -> Kelas 8A
      // Ruang 3 -> Kelas 9A
      // Ruang 4 -> Kelas 9B
      // Ruang 5 -> Kelas 8B
      const findRoomByNum = (n: number) => rooms.find((r) => parseInt(r.replace(/[^\d]/g, ''), 10) === n);
      if (/^8A/i.test(normCls) || /^8A|VIIIA/i.test(rawUpper)) return findRoomByNum(2) || rooms[1] || 'Ruang 02';
      if (/^8B/i.test(normCls) || /^8B|VIIIB/i.test(rawUpper)) return findRoomByNum(5) || rooms[4] || 'Ruang 05';
      if (/^9A/i.test(normCls) || /^9A|IXA/i.test(rawUpper)) return findRoomByNum(3) || rooms[2] || 'Ruang 03';
      if (/^9B/i.test(normCls) || /^9B|IXB/i.test(rawUpper)) return findRoomByNum(4) || rooms[3] || 'Ruang 04';
      if (/^7/i.test(normCls) || /^7|VII/i.test(rawUpper)) return findRoomByNum(1) || rooms[0] || 'Ruang 01';
      if (/^8/i.test(normCls) || /^8|VIII/i.test(rawUpper)) return findRoomByNum(2) || rooms[1] || 'Ruang 02';
      if (/^9/i.test(normCls) || /^9|IX/i.test(rawUpper)) return findRoomByNum(3) || rooms[2] || 'Ruang 03';

      return rooms[0] || 'Ruang 01';
    };

    let cachedStudents: any[] = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('smart_absensi_students');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedStudents = parsed;
          }
        }
      }
    } catch {}

    const sourceStudents: any[] =
      options?.studentsList && options.studentsList.length > 0
        ? options.studentsList
        : cachedStudents;

    const deletedKeys = getDeletedStudentKeys();
    const cleanSourceStudents = sourceStudents.filter((s) => {
      const rawCls = s.className || (s as any).kelas || '';
      const rawName = s.fullName || (s as any).name || '';
      const key = getStudentNaturalKey(rawCls, rawName);
      return !deletedKeys.has(key);
    });

    if (cleanSourceStudents.length > 0) {
      const targetLevel = isSma ? 'SMA' : 'SMP';
      const levelFiltered = cleanSourceStudents.filter((s) => {
        const rawCls = s.className || s.kelas || '';
        const normCls = normalizeClassCode(rawCls);
        const isClsSma = /^10|11|12|SMA|IPA|IPS/i.test(normCls) || /10|11|12|X|XI|XII|SMA|IPA|IPS/i.test(rawCls);
        return targetLevel === 'SMA' ? isClsSma : !isClsSma;
      });

      const studentsToUse = levelFiltered.length > 0 ? levelFiltered : cleanSourceStudents;
      studentsToUse.forEach((s) => {
        const targetRoom = getTargetRoomForStudent(s);
        const normClass = normalizeClassCode(s.className || s.kelas || '') || (
          targetRoom.includes('6') ? '10' :
          targetRoom.includes('1') ? '7' :
          targetRoom.includes('2') ? '8A' :
          targetRoom.includes('3') ? '9A' :
          targetRoom.includes('4') ? '9B' :
          targetRoom.includes('5') ? '8B' : '7'
        );

        // Hindari duplikasi jika sudah ada siswa bernama sama di ruangan
        const existingInRoom = rawStudentMap[targetRoom] || [];
        const isAlreadyAdded = existingInRoom.some(
          (e) => e.fullName.toUpperCase() === (s.fullName || s.name || '').toUpperCase()
        );
        if (!isAlreadyAdded) {
          if (!rawStudentMap[targetRoom]) rawStudentMap[targetRoom] = [];
          rawStudentMap[targetRoom].push({
            fullName: (s.fullName || s.name || 'Siswa').toUpperCase(),
            gender: s.gender || (/8A|9A/i.test(normClass) ? 'P' : 'L'),
            className: normClass,
          });
        }
      });
    }

    // 2b. JAMINAN MUTLAK: SETIAP RUANGAN TERISI LENGKAP, TIDAK BOLEH ADA RUANGAN YANG KOSONG
    rooms.forEach((rName, idx) => {
      if (!rawStudentMap[rName] || rawStudentMap[rName].length === 0) {
        const roomNum = parseInt(rName.replace(/[^\d]/g, ''), 10);
        let fallbackList: Array<{ fullName: string; gender: string; className: string }> = [];
        if (roomNum === 6 || rName.includes('6')) {
          // Ruang 6 is SMA: Kelas 10, 11, 12 (36 siswa)
          fallbackList = this.OFFICIAL_SMA_ROOM_6_STUDENTS;
        } else if (isSma) {
          if (idx === 0) fallbackList = this.OFFICIAL_SMA_ROOM_1_STUDENTS;
          else if (idx === 1) fallbackList = this.OFFICIAL_SMA_ROOM_2_STUDENTS;
          else if (idx === 2) fallbackList = this.OFFICIAL_SMA_ROOM_3_STUDENTS;
          else fallbackList = this.OFFICIAL_SMA_ROOM_6_STUDENTS;
        } else {
          if (roomNum === 1 || idx === 0) fallbackList = this.OFFICIAL_SMP_ROOM_1_STUDENTS;
          else if (roomNum === 2 || idx === 1) fallbackList = this.OFFICIAL_SMP_ROOM_2_STUDENTS;
          else if (roomNum === 3 || idx === 2) fallbackList = this.OFFICIAL_SMP_ROOM_3_STUDENTS;
          else if (roomNum === 4 || idx === 3) fallbackList = this.OFFICIAL_SMP_ROOM_4_STUDENTS;
          else if (roomNum === 5 || idx === 4) fallbackList = this.OFFICIAL_SMP_ROOM_5_STUDENTS;
          else fallbackList = this.OFFICIAL_SMP_ROOM_1_STUDENTS;
        }
        const activeFallback = fallbackList.filter((st) => {
          const key = getStudentNaturalKey(st.className, st.fullName);
          return !deletedKeys.has(key);
        });
        rawStudentMap[rName] = [...activeFallback];
      }
    });

    // 2c. ATURAN RESMI: Khusus Kelas 7 (Ruang 1), urutkan siswa LAKI-LAKI terlebih dahulu (A-Z), baru PEREMPUAN (A-Z)
    // Untuk ruangan lainnya (Ruang 2: 8A, Ruang 3: 9A, Ruang 4: 9B, Ruang 5: 8B, Ruang 6: SMA), urutkan secara alfabetis A-Z
    rooms.forEach((rName, idx) => {
      const roomNum = parseInt(rName.replace(/[^\d]/g, ''), 10);
      const currentList = rawStudentMap[rName] || [];
      if (roomNum === 1 || idx === 0) {
        const males = currentList
          .filter((s) => (s.gender || 'L').toUpperCase() === 'L')
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
        const females = currentList
          .filter((s) => (s.gender || '').toUpperCase() === 'P')
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
        const others = currentList
          .filter((s) => (s.gender || '').toUpperCase() !== 'L' && (s.gender || '').toUpperCase() !== 'P')
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
        rawStudentMap[rName] = [...males, ...females, ...others];
      } else {
        rawStudentMap[rName] = [...currentList].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'id')
        );
      }
    });

    // 3. Penomoran Peserta Sekuensial: 13-0820-001 dari peserta pertama Ruang 1 berlanjut ke seluruh ruangan
    let globalIndex = 1;
    const finalMap: Record<string, Array<{
      urut: number;
      participantNumber: string;
      fullName: string;
      gender: string;
      className: string;
    }>> = {};

    rooms.forEach((rName) => {
      const list = rawStudentMap[rName] || [];
      finalMap[rName] = list.map((st, idx) => {
        const urut = idx + 1;
        const participantNumber = `${prefix}${String(globalIndex).padStart(3, '0')}`;
        globalIndex++;
        return {
          urut,
          participantNumber,
          fullName: st.fullName,
          gender: st.gender || 'L',
          className: st.className,
        };
      });
    });

    return finalMap;
  }

  public static generateSingleRoomAttendanceRosterHtml(
    roomName: string,
    students: Array<{
      urut: number;
      participantNumber: string;
      fullName: string;
      gender: string;
      className: string;
    }>,
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma =
      scheduleData.educationLevel === 'SMA' ||
      scheduleData.config.educationLevel === 'SMA' ||
      config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
      false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');
    const academicYear = config.academicYear || '2025/2026';
    const semesterStr = config.semester ? config.semester.toUpperCase() : 'GENAP';

    let examTitle = config.examTitle || 'ASESMEN SUMATIF TENGAH SEMESTER';
    if (!examTitle.toUpperCase().includes('GENAP') && !examTitle.toUpperCase().includes('GANJIL')) {
      examTitle = `${examTitle} ${semesterStr}`;
    }
    if (!examTitle.toUpperCase().includes('ASTS') && !examTitle.toUpperCase().includes('ASAS')) {
      examTitle = `${examTitle} (${config.examType || 'ASTS'})`;
    } else if (!examTitle.includes('(')) {
      examTitle = `${examTitle} (${config.examType || 'ASTS'})`;
    }

    const roomNumMatch = roomName.match(/\d+/);
    const roomNumStr = roomNumMatch ? String(parseInt(roomNumMatch[0], 10)).padStart(2, '0') : '';
    const roomBadge = roomNumStr ? `Ruang ${roomNumStr}` : roomName;

    const subjects = this.extractRosterSubjects(scheduleData, isSma);

    const city = options?.city || 'Bogor';
    const signDate = this.resolveFullSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);

    const subjectHeadersHtml = subjects.map((s) => `
      <th style="border: 1pt solid #000000; padding: 3px 1px; text-align: center; font-weight: bold; font-size: 8pt; line-height: 1.15; word-break: break-word; background-color: #ffffff; color: #000000;">
        ${s}
      </th>
    `).join('');

    const rowsHtml = students.map((s) => `
      <tr style="height: 24px;">
        <td style="border: 1pt solid #000000; text-align: center; padding: 2px 1px; font-size: 8.5pt;">${s.urut}</td>
        <td style="border: 1pt solid #000000; text-align: center; padding: 2px 2px; font-size: 8.5pt; font-family: 'Times New Roman', serif;">${s.participantNumber}</td>
        <td style="border: 1pt solid #000000; text-align: left; padding: 2px 4px; font-size: 8.5pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.fullName}</td>
        <td style="border: 1pt solid #000000; text-align: center; padding: 2px 1px; font-size: 8.5pt;">${s.gender}</td>
        ${subjects.map(() => `<td style="border: 1pt solid #000000; text-align: center; padding: 0; font-size: 8pt; background-color: #ffffff;">&nbsp;</td>`).join('')}
      </tr>
    `).join('');

    return `
      <div class="page-container" style="font-family: 'Times New Roman', Times, serif; color: #000000; background: #ffffff;">
        <!-- Header: 2 Columns (Titles left, Room Badge right) -->
        <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 8px; font-family: 'Times New Roman', serif;">
          <tr style="border: none;">
            <td style="border: none; width: 70%; vertical-align: top; text-align: left; padding: 0;">
              <div style="font-size: 13.5pt; font-weight: bold; text-transform: uppercase; margin: 0; line-height: 1.25; letter-spacing: 0.3px;">
                DAFTAR HADIR PESERTA
              </div>
              <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 0; line-height: 1.25;">
                ${examTitle}
              </div>
              <div style="font-size: 12.5pt; font-weight: bold; text-transform: uppercase; margin: 0; line-height: 1.25; letter-spacing: 0.3px;">
                ${institutionName}
              </div>
              <div style="font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.25;">
                Tahun Pelajaran ${academicYear}
              </div>
            </td>
            <td style="border: none; width: 30%; vertical-align: middle; text-align: right; padding: 0;" align="right">
              <div class="room-badge" data-room="${roomBadge.toUpperCase()}" style="font-size: 24pt; font-weight: bold; font-family: 'Times New Roman', serif; letter-spacing: 0.5px; color: #000000; white-space: nowrap;">
                ${roomBadge}
              </div>
            </td>
          </tr>
        </table>

        <!-- Main Table with 13 Subjects -->
        <table class="doc-table" style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', serif; border: 1pt solid #000000;">
          <thead>
            <tr style="background-color: transparent;">
              <th colspan="2" style="border: 1pt solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 9.5pt; width: 120px; background-color: #ffffff; color: #000000;">
                NO
              </th>
              <th rowspan="2" style="border: 1pt solid #000000; padding: 4px 6px; text-align: center; font-weight: bold; font-size: 9.5pt; width: 195px; background-color: #ffffff; color: #000000;">
                NAMA PESERTA
              </th>
              <th rowspan="2" style="border: 1pt solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 9.5pt; width: 30px; background-color: #ffffff; color: #000000;">
                L/P
              </th>
              <th colspan="${subjects.length}" style="border: 1pt solid #000000; padding: 4px 2px; text-align: center; font-weight: bold; font-size: 9.5pt; background-color: #ffffff; color: #000000;">
                MATA PELAJARAN
              </th>
            </tr>
            <tr style="background-color: transparent;">
              <th style="border: 1pt solid #000000; padding: 3px 2px; text-align: center; font-weight: bold; font-size: 9pt; width: 32px; background-color: #ffffff; color: #000000;">
                URUT
              </th>
              <th style="border: 1pt solid #000000; padding: 3px 4px; text-align: center; font-weight: bold; font-size: 9pt; width: 88px; background-color: #ffffff; color: #000000;">
                PESERTA
              </th>
              ${subjectHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Signatory Block (Bottom Right) -->
        <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 14px; font-family: 'Times New Roman', serif; font-size: 10pt; page-break-inside: avoid;">
          <tr style="border: none;">
            <td style="border: none; width: 72%; padding: 0;"></td>
            <td style="border: none; width: 28%; text-align: left; vertical-align: top; padding: 0;">
              <div>${city}, ${signDate}</div>
              <div>Ketua Pelaksana</div>
              <div style="height: 48px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">${committeeHead}</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  public static generateStudentAttendanceRosterHtml(
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const orientation = options?.orientation || 'landscape';
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma =
      scheduleData.educationLevel === 'SMA' ||
      scheduleData.config.educationLevel === 'SMA' ||
      config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
      false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');

    const roomStudentMap = this.resolveRoomStudents(scheduleData, options);
    const rooms = Object.keys(roomStudentMap);

    const selectedRoom = options?.roomFilter;
    const roomsToRender =
      selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => this.canonicalRoomName(r).toLowerCase() === this.canonicalRoomName(selectedRoom).toLowerCase())
        : rooms;

    const sections = roomsToRender.map((r, idx) => {
      const students = roomStudentMap[r] || [];
      const roomHtml = this.generateSingleRoomAttendanceRosterHtml(r, students, scheduleData, {
        ...options,
        orientation,
      });
      const isLast = idx === roomsToRender.length - 1;
      return `
        ${roomHtml}
        ${!isLast ? '<br clear="all" style="page-break-before: always; mso-break-type: section-break;" /><div class="page-break"></div>' : ''}
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Daftar Hadir Peserta - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(orientation)}
        </style>
      </head>
      <body>
        ${sections}
      </body>
      </html>
    `;
  }

  // =========================================================================
  // DOCUMENT: DENAH TEMPAT DUDUK PESERTA UJIAN (PER RUANGAN)
  // Sesuai format fisik ASTS SMP Terpadu Al-Ittihadiyah / SMA Terpadu As Salaam
  // A4 Landscape dengan 5 Kolom Meja Berurutan (Pola Zig-Zag / Snake)
  // Label Front: Ruang 01, Papan Tulis, Pengawas I & Pengawas II
  // Format No. Peserta: 13 - 0820 - 001
  // =========================================================================

  public static formatSeatingParticipantNumber(
    rawNum?: string,
    fallbackUrut?: number,
    prefix: string = '13-0820-'
  ): string {
    const base = rawNum && rawNum.trim() !== ''
      ? rawNum.trim()
      : (fallbackUrut ? `${prefix}${String(fallbackUrut).padStart(3, '0')}` : '');
    // Standardize: Ensure single spaces around every hyphen, e.g. "13 - 0820 - 001"
    return base.replace(/\s*-\s*/g, ' - ').trim();
  }

  public static generateSingleRoomSeatingLayoutHtml(
    roomName: string,
    students: Array<{
      urut: number;
      participantNumber: string;
      fullName: string;
      gender: string;
      className: string;
    }>,
    scheduleData: ExamScheduleData,
    _options?: AdminDocOptions
  ): string {
    const config = scheduleData.config;
    const academicYear = config.academicYear || '2025/2026';
    const examType = config.examType || 'ASTS';
    let examTitle = config.examTitle || `ASESMEN SUMATIF TENGAH SEMESTER (${examType})`;
    if (!examTitle.includes('(') && !examTitle.includes(examType)) {
      examTitle = `${examTitle} (${examType})`;
    }

    const roomNumMatch = roomName.match(/\d+/);
    const roomNumStr = roomNumMatch ? String(parseInt(roomNumMatch[0], 10)).padStart(2, '0') : '';
    const roomBadge = roomNumStr ? `RUANG ${roomNumStr}` : roomName.toUpperCase();

    // Determine row count: at least 4 rows (as in photo with 16 students), or more if > 20 students
    const totalStudents = students.length;
    const rowCount = Math.max(4, Math.ceil(totalStudents / 5));

    // Seating grid mapper (5 columns):
    // Even rows (r = 0, 2, 4, 6...): Left -> Right (idx = r * 5 + c)
    // Odd rows (r = 1, 3, 5, 7...): Right -> Left (idx = (r + 1) * 5 - 1 - c)
    const getStudentAt = (r: number, c: number): typeof students[0] | undefined => {
      const isEvenRow = r % 2 === 0;
      const idx = isEvenRow ? r * 5 + c : (r + 1) * 5 - 1 - c;
      return students[idx];
    };

    let deskRowsHtml = '';
    for (let r = 0; r < rowCount; r++) {
      let cellsHtml = '';
      for (let c = 0; c < 5; c++) {
        const st = getStudentAt(r, c);
        if (st) {
          const numFormatted = this.formatSeatingParticipantNumber(st.participantNumber, st.urut);
          cellsHtml += `
            <td style="width: 20%; border: 1.5pt solid #000000; padding: 10px 4px; text-align: center; font-size: 11pt; font-weight: bold; font-family: 'Times New Roman', serif; background-color: #ffffff; vertical-align: middle; height: 38px; white-space: nowrap;">
              ${numFormatted}
            </td>
          `;
        } else {
          cellsHtml += `
            <td style="width: 20%; border: none; padding: 10px 4px; text-align: center; height: 38px; background-color: transparent;"></td>
          `;
        }
      }
      deskRowsHtml += `
        <tr>
          ${cellsHtml}
        </tr>
      `;
    }

    return `
      <div class="page-container seating-layout-page" style="width: 100%; max-width: 297mm; min-height: 200mm; margin: 0 auto; padding: 10mm 15mm; font-family: 'Times New Roman', serif; box-sizing: border-box;">
        <!-- Header Section -->
        <div class="doc-header" style="text-align: center; margin-bottom: 22px;">
          <h1 style="font-size: 14pt; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            DENAH TEMPAT DUDUK
          </h1>
          <h2 style="font-size: 12.5pt; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase;">
            PESERTA ${examTitle}
          </h2>
          <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase;">
            TAHUN ${academicYear}
          </div>
        </div>

        <!-- Seating Grid Table (Unified table for perfect alignment across Print, PDF, and Word) -->
        <table style="width: 100%; border: none; border-collapse: separate; border-spacing: 14px 10px; margin-top: 5px;">
          <colgroup>
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
          </colgroup>

          <!-- Top Row: Ruang Badge on Left, Papan Tulis in Center -->
          <tr>
            <td style="border: none; text-align: left; vertical-align: middle; padding: 0 4px;">
              <span style="font-size: 20pt; font-weight: bold; letter-spacing: 1px; line-height: 1;">
                ${roomBadge}
              </span>
            </td>
            <td colspan="3" style="border: none; text-align: center; vertical-align: middle; padding: 0;">
              <div style="display: inline-block; border: 1.5pt solid #000000; padding: 6px 36px; font-size: 11pt; font-weight: bold; letter-spacing: 1.5px; background-color: #ffffff; min-width: 180px; box-sizing: border-box;">
                PAPAN TULIS
              </div>
            </td>
            <td style="border: none; padding: 0;"></td>
          </tr>

          <!-- Spacer Row -->
          <tr style="height: 6px;">
            <td colspan="5" style="border: none; padding: 0;"></td>
          </tr>

          <!-- Proctors Row: Pengawas I above Column 1, Pengawas II above Column 5 -->
          <tr>
            <td style="border: 1.5pt solid #000000; padding: 6px 4px; text-align: center; font-size: 10.5pt; font-weight: bold; background-color: #ffffff; vertical-align: middle; height: 32px;">
              PENGAWAS I
            </td>
            <td colspan="3" style="border: none; padding: 0;"></td>
            <td style="border: 1.5pt solid #000000; padding: 6px 4px; text-align: center; font-size: 10.5pt; font-weight: bold; background-color: #ffffff; vertical-align: middle; height: 32px;">
              PENGAWAS II
            </td>
          </tr>

          <!-- Spacer Row before Desks -->
          <tr style="height: 8px;">
            <td colspan="5" style="border: none; padding: 0;"></td>
          </tr>

          <!-- Desk Rows -->
          ${deskRowsHtml}
        </table>
      </div>
    `;
  }

  public static generateSeatingLayoutHtml(
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const orientation = 'landscape';
    const branding = getDynamicBranding();
    const isSma =
      scheduleData.educationLevel === 'SMA' ||
      scheduleData.config.educationLevel === 'SMA' ||
      scheduleData.config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
      false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');

    const roomStudentMap = this.resolveRoomStudents(scheduleData, options);
    const rooms = Object.keys(roomStudentMap);

    const selectedRoom = options?.roomFilter;
    const roomsToRender =
      selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => this.canonicalRoomName(r).toLowerCase() === this.canonicalRoomName(selectedRoom).toLowerCase())
        : rooms;

    const sections = roomsToRender.map((r, idx) => {
      const students = roomStudentMap[r] || [];
      const roomHtml = this.generateSingleRoomSeatingLayoutHtml(r, students, scheduleData, {
        ...options,
        orientation,
      });
      const isLast = idx === roomsToRender.length - 1;
      return `
        ${roomHtml}
        ${!isLast ? '<br clear="all" style="page-break-before: always; mso-break-type: section-break;" /><div class="page-break"></div>' : ''}
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Denah Tempat Duduk Peserta - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(orientation)}
        </style>
      </head>
      <body>
        ${sections}
      </body>
      </html>
    `;
  }

  // =========================================================================
  // DOCUMENT 3: BERITA ACARA REKAPITULASI KEHADIRAN PESERTA UJIAN
  // =========================================================================

  public static generateStudentAttendanceSummaryHtml(
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const academicYear = config.academicYear || '2025/2026';
    const examTitle = config.examTitle || `ASESMEN ${config.examType || 'SUMATIF'}`;

    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);

    const subjectList: string[] = [];
    if (scheduleData.subjectSchedules && scheduleData.subjectSchedules.length > 0) {
      scheduleData.subjectSchedules.forEach((s) => {
        if (s.subject && !subjectList.includes(s.subject)) {
          subjectList.push(s.subject);
        }
      });
    }
    if (subjectList.length === 0) {
      subjectList.push(
        'PAI & PB',
        'IPA',
        'Matematika',
        'Bahasa Arab',
        'Pendidikan Pancasila',
        'Bahasa Indonesia',
        'IPS',
        'Bahasa Sunda',
        'Bahasa Inggris',
        'SBPK',
        'PJOK',
        'Informatika'
      );
    }

    const defaultRegisteredCount = typeof options?.totalRegisteredStudents === 'number'
      ? options.totalRegisteredStudents
      : '';

    const bodyRows = subjectList
      .map((subj, idx) => {
        let countVal = defaultRegisteredCount;
        if (options?.totalRegisteredStudents && typeof options.totalRegisteredStudents === 'object') {
          countVal = options.totalRegisteredStudents[subj] ?? defaultRegisteredCount;
        }

        return `
          <tr>
            <td class="text-center" style="width: 45px;">${idx + 1}</td>
            <td style="font-weight: 500;">${subj}</td>
            <td class="text-center" style="width: 140px;">${countVal}</td>
            <td class="text-center" style="width: 140px;"></td>
            <td class="text-center" style="width: 140px;"></td>
            <td style="width: 150px;"></td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Rekapitulasi Kehadiran Peserta Ujian - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(options?.orientation)}
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="doc-header">
            <h1 class="doc-institution">${institutionName}</h1>
            <div class="doc-academic-year">TAHUN PELAJARAN ${academicYear}</div>
            <div class="doc-title-sub" style="font-size: 11pt; color: #334155; margin-top: 4px;">
              BERITA ACARA REKAPITULASI KEHADIRAN PESERTA ${examTitle.toUpperCase()}
            </div>
          </div>

          <table class="doc-table">
            <thead>
              <tr>
                <th style="width: 45px;">No</th>
                <th>Mata Pelajaran</th>
                <th style="width: 140px;">Jumlah Seharusnya</th>
                <th style="width: 140px;">Jumlah yang Hadir</th>
                <th style="width: 140px;">Jumlah yang Tidak Hadir</th>
                <th style="width: 150px;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>

          ${this.renderSignatoryTableHtml(city, signDate, committeeHead)}
        </div>
      </body>
      </html>
    `;
  }

  // =========================================================================
  // DOCUMENT 4: DAFTAR HADIR PANITIA UJIAN
  // =========================================================================

  public static generateCommitteeAttendanceHtml(
    committeeMembers: ExamCommitteeMember[],
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const academicYear = config.academicYear || '2025/2026';
    const examTypeStr = config.examTitle || config.examType || 'ASESMEN SUMATIF AKHIR JENJANG (ASAJ)';

    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(committeeMembers, options?.committeeHeadName);

    const examDays = this.extractExamDays(scheduleData);
    const daysToShow = examDays.length > 0 ? examDays : [
      { date: '2026-05-11', dayName: 'SENIN', dateFormattedDmy: '11/05/2026', dateFormattedLong: 'Senin, 11 Mei 2026' },
      { date: '2026-05-12', dayName: 'SELASA', dateFormattedDmy: '12/05/2026', dateFormattedLong: 'Selasa, 12 Mei 2026' },
      { date: '2026-05-13', dayName: 'RABU', dateFormattedDmy: '13/05/2026', dateFormattedLong: 'Rabu, 13 Mei 2026' },
      { date: '2026-05-14', dayName: 'KAMIS', dateFormattedDmy: '14/05/2026', dateFormattedLong: 'Kamis, 14 Mei 2026' },
      { date: '2026-05-15', dayName: "JUM'AT", dateFormattedDmy: '15/05/2026', dateFormattedLong: "Jum'at, 15 Mei 2026" },
    ];

    interface FormattedCommitteeItem {
      name: string;
      jabatan: string;
    }

    let items: FormattedCommitteeItem[] = [];

    if (committeeMembers && committeeMembers.length > 0) {
      const roleOrder: Record<string, number> = {
        'PENANGGUNG_JAWAB': 1,
        'KETUA': 2,
        'SEKRETARIS': 3,
        'BENDAHARA': 4,
        'ANGGOTA': 5,
      };

      const mapped = committeeMembers.map((m) => {
        let jabatanLabel = 'Anggota';
        if (m.role === 'PENANGGUNG_JAWAB') jabatanLabel = 'Penanggung Jawab';
        else if (m.role === 'KETUA') jabatanLabel = 'Ketua';
        else if (m.role === 'SEKRETARIS') jabatanLabel = 'Sekretaris';
        else if (m.role === 'BENDAHARA') jabatanLabel = 'Bendahara';
        else if (m.fullName.includes('Farhan') || m.fullName.toLowerCase().includes('kepala')) {
          jabatanLabel = 'KS/ Penanggung Jawab';
        }
        return {
          name: m.fullName,
          jabatan: jabatanLabel,
          order: roleOrder[m.role] || 99,
        };
      });

      mapped.sort((a, b) => a.order - b.order);
      items = mapped.map((m) => ({ name: m.name, jabatan: m.jabatan }));
    }

    if (items.length === 0) {
      items = [
        { name: SIGNATORY_OFFICIALS.KEPSEK_NAME, jabatan: 'KS/ Penanggung Jawab' },
        { name: 'Septi Nur Aeni, S.E', jabatan: 'Ketua' },
        { name: 'Dafa Maulana, S.Pd', jabatan: 'Sekretaris' },
        { name: 'Mira Nurdianti, S.Pd', jabatan: 'Bendahara' },
        { name: 'Mawar Andinia, S.Pd., G.r', jabatan: 'Anggota' },
      ];
    }

    const dayHeaderCols = daysToShow
      .map(
        (d) => `
        <th style="width: 85px; min-width: 80px;">
          <div>${d.dayName.toUpperCase()}</div>
          <div style="font-size: 8.5pt; font-weight: normal; margin-top: 2px;">${d.dateFormattedDmy}</div>
        </th>
      `
      )
      .join('');

    const bodyRows = items
      .map(
        (item, idx) => `
        <tr>
          <td class="text-center" style="width: 38px;">${idx + 1}</td>
          <td style="font-weight: 500;">${item.name}</td>
          <td style="width: 140px;">${item.jabatan}</td>
          ${daysToShow.map(() => `<td class="sig-cell"></td>`).join('')}
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Daftar Hadir Panitia - ${institutionName}</title>
        <style>
          ${this.getOfficialDocumentStyles(options?.orientation)}
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="doc-header">
            <h1 class="doc-title-main">DAFTAR HADIR PANITIA</h1>
            <h2 class="doc-title-sub">${examTypeStr}</h2>
            <div class="doc-institution">${institutionName}</div>
            <div class="doc-academic-year">TAHUN PELAJARAN ${academicYear}</div>
          </div>

          <table class="doc-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 38px;">NO</th>
                <th rowspan="2">NAMA</th>
                <th rowspan="2" style="width: 140px;">JABATAN</th>
                <th colspan="${daysToShow.length}">HARI / TANGGAL</th>
              </tr>
              <tr>
                ${dayHeaderCols}
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>

          ${this.renderSignatoryTableHtml(city, signDate, committeeHead)}
        </div>
      </body>
      </html>
    `;
  }

  // =========================================================================
  // EXPORT METHODS: PRINT (A4 / PDF), WORD (.DOC), AND EXCEL (.XLSX)
  // =========================================================================

  /**
   * Opens isolated print window for standard A4 paper format with action bar (print & download)
   */
  public static printHtmlDocument(htmlContent: string, title?: string, options?: AdminDocOptions): void {
    if (typeof window === 'undefined') return;

    const safeTitle = title || 'Dokumen Administrasi Ujian';
    const isLandscape = options?.orientation === 'landscape' || htmlContent.includes('size: A4 landscape');
    const cleanPdfFileName = `${safeTitle.replace(/[^\w]/g, '_')}_A4.pdf`;

    const topBarHtml = `
      <div class="no-print-bar" style="position: sticky; top: 0; left: 0; right: 0; background: #023246; color: #ffffff; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📄</span>
          <span style="font-weight: 800; font-size: 13px;">${safeTitle}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; background: #059669; color: #ffffff;" onclick="window.print()">
            🖨️ Cetak / Simpan PDF
          </button>
          <button type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; background: #0284c7; color: #ffffff;" onclick="downloadDocFile()">
            📥 Unduh File Dokumen (PDF)
          </button>
          <button type="button" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; background: rgba(255,255,255,0.15); color: #ffffff;" onclick="window.close()">
            ✖️ Tutup
          </button>
        </div>
      </div>
      <style>
        @media print {
          .no-print-bar { display: none !important; }
        }
      </style>
      <script>
        function downloadDocFile() {
          if (window.opener && window.opener.__exportHtmlToPdf) {
            window.opener.__exportHtmlToPdf(document.documentElement.outerHTML, {
              filename: '${cleanPdfFileName}',
              orientation: '${isLandscape ? 'landscape' : 'portrait'}'
            });
          } else {
            window.print();
          }
        }
      </script>
    `;

    let enrichedHtml = htmlContent;
    if (htmlContent.includes('<body')) {
      enrichedHtml = htmlContent.replace(/<body([^>]*)>/i, `<body$1>${topBarHtml}`);
    } else {
      enrichedHtml = topBarHtml + htmlContent;
    }

    const blob = new Blob([enrichedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (!printWindow) {
      alert('Jendela pop-up cetak diblokir oleh browser. Izinkan pop-up untuk mencetak dokumen administrasi.');
      return;
    }

    printWindow.onload = () => {
      if (title) printWindow.document.title = title;
      printWindow.focus();
    };
  }

  /**
   * Directly downloads any generated administrative document as an official A4 PDF file
   */
  public static async downloadPdfDocument(
    htmlContent: string,
    fileName: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    const cleanHtml = htmlContent.replace(/<div class="no-print-bar">[\s\S]*?<\/div>/gi, '');
    const cleanFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName.replace(/\.html$/i, '')}.pdf`;
    await exportHtmlToPdf(cleanHtml, {
      filename: cleanFileName,
      orientation,
    });
  }

  /**
   * Backward-compatible alias for downloadPdfDocument
   */
  public static async downloadHtmlDocument(
    htmlContent: string,
    fileName: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): Promise<void> {
    return this.downloadPdfDocument(htmlContent, fileName, orientation);
  }

  /**
   * Generates a fully formatted Microsoft Word XML/HTML document string
   * with extracted body content, A4 page layout, and complete CSS styles.
   */
  public static generateWordHtmlString(
    htmlContent: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): string {
    const isLandscape = orientation === 'landscape';

    // Extract inner body content if htmlContent is already a complete HTML document
    let bodyContent = htmlContent;
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      bodyContent = bodyMatch[1];
    }

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
        <style>
          @page Section1 {
            size: ${isLandscape ? '297mm 210mm' : '210mm 297mm'}; /* A4 */
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
            mso-paper-source: 0;
            mso-page-orientation: ${orientation};
          }
          div.Section1 { page: Section1; }
          ${this.getOfficialDocumentStyles(orientation)}
        </style>
      </head>
      <body>
        <div class="Section1">
          ${bodyContent}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates editable Microsoft Word (.doc) file and triggers download
   */
  public static exportToWord(
    htmlContent: string,
    fileName: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): void {
    const wordXmlHtml = this.generateWordHtmlString(htmlContent, orientation);

    const blob = new Blob(['\ufeff', wordXmlHtml], {
      type: 'application/msword;charset=utf-8',
    });

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Generates a fully-styled Excel worksheet for Document: Daftar Hadir Peserta Ujian (per room)
   */
  public static buildStudentAttendanceRosterWorksheet(
    roomName: string,
    students: Array<{
      urut: number;
      participantNumber: string;
      fullName: string;
      gender: string;
      className: string;
    }>,
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): any {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma =
      scheduleData.educationLevel === 'SMA' ||
      scheduleData.config.educationLevel === 'SMA' ||
      config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
      false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');
    const academicYear = config.academicYear || '2025/2026';
    const semesterStr = config.semester ? config.semester.toUpperCase() : 'GENAP';

    let examTitle = config.examTitle || 'ASESMEN SUMATIF TENGAH SEMESTER';
    if (!examTitle.toUpperCase().includes('GENAP') && !examTitle.toUpperCase().includes('GANJIL')) {
      examTitle = `${examTitle} ${semesterStr}`;
    }
    if (!examTitle.toUpperCase().includes('ASTS') && !examTitle.toUpperCase().includes('ASAS')) {
      examTitle = `${examTitle} (${config.examType || 'ASTS'})`;
    } else if (!examTitle.includes('(')) {
      examTitle = `${examTitle} (${config.examType || 'ASTS'})`;
    }

    const roomNumMatch = roomName.match(/\d+/);
    const roomNumStr = roomNumMatch ? String(parseInt(roomNumMatch[0], 10)).padStart(2, '0') : '';
    const roomBadge = roomNumStr ? `Ruang ${roomNumStr}` : roomName;

    const subjects = this.extractRosterSubjects(scheduleData, isSma);
    const totalCols = 4 + subjects.length; // 4 identity columns + subjects
    const lastColIdx = totalCols - 1;

    const city = options?.city || 'Bogor';
    const signDate = this.resolveFullSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);

    const ws: any = {};
    const merges: any[] = [];
    const rowHeights: { hpt: number }[] = [];

    const BORDER_THIN = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const STYLE_TITLE_LEFT = {
      font: { name: 'Times New Roman', sz: 12.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_SUBTITLE_LEFT = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_TH = {
      font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER_THIN,
    };

    const STYLE_TH_SUB = {
      font: { name: 'Times New Roman', sz: 8.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER_THIN,
    };

    const STYLE_TD_CENTER = {
      font: { name: 'Times New Roman', sz: 9, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_TD_LEFT = {
      font: { name: 'Times New Roman', sz: 9, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_ROOM_BADGE = {
      font: { name: 'Times New Roman', sz: 20, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    };

    const STYLE_SIGN_TEXT_LEFT = {
      font: { name: 'Times New Roman', sz: 10, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_SIGN_NAME_LEFT = {
      font: { name: 'Times New Roman', sz: 10, bold: true, underline: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const setCell = (c: number, r: number, val: any, style?: any) => {
      const ref = XLSX.utils.encode_cell({ c, r });
      ws[ref] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: style || {} };
    };

    const mergeRange = (sc: number, sr: number, ec: number, er: number, val?: any, style?: any) => {
      merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          const ref = XLSX.utils.encode_cell({ c, r });
          if (!ws[ref]) ws[ref] = { v: '', t: 's', s: style || {} };
          else if (style) ws[ref].s = { ...ws[ref].s, ...style };
        }
      }
      if (val !== undefined) setCell(sc, sr, val, style);
    };

    // Header Titles (Left side: Rows 0-3)
    mergeRange(0, 0, 4, 0, 'DAFTAR HADIR PESERTA', STYLE_TITLE_LEFT);
    rowHeights[0] = { hpt: 18 };
    mergeRange(0, 1, 4, 1, examTitle.toUpperCase(), STYLE_SUBTITLE_LEFT);
    rowHeights[1] = { hpt: 16 };
    mergeRange(0, 2, 4, 2, institutionName.toUpperCase(), STYLE_SUBTITLE_LEFT);
    rowHeights[2] = { hpt: 16 };
    mergeRange(0, 3, 4, 3, `Tahun Pelajaran ${academicYear}`, STYLE_SUBTITLE_LEFT);
    rowHeights[3] = { hpt: 16 };

    // Room Label on Right (Cols lastColIdx - 3 to lastColIdx, Rows 0-2)
    const badgeColStart = Math.max(5, lastColIdx - 3);
    mergeRange(badgeColStart, 0, lastColIdx, 2, roomBadge, STYLE_ROOM_BADGE);

    rowHeights[4] = { hpt: 8 }; // spacer

    // Table Headers (Row 5 & 6)
    // Row 5: NO (cols 0-1), NAMA PESERTA (col 2), L/P (col 3), MATA PELAJARAN (cols 4..lastColIdx)
    mergeRange(0, 5, 1, 5, 'NO', STYLE_TH);
    mergeRange(2, 5, 2, 6, 'NAMA PESERTA', STYLE_TH);
    mergeRange(3, 5, 3, 6, 'L/P', STYLE_TH);
    mergeRange(4, 5, lastColIdx, 5, 'MATA PELAJARAN', STYLE_TH);
    rowHeights[5] = { hpt: 18 };

    // Row 6: URUT (col 0), PESERTA (col 1), Subjects (cols 4..lastColIdx)
    setCell(0, 6, 'URUT', STYLE_TH);
    setCell(1, 6, 'PESERTA', STYLE_TH);
    subjects.forEach((sub, sIdx) => {
      setCell(4 + sIdx, 6, sub, STYLE_TH_SUB);
    });
    rowHeights[6] = { hpt: 20 };

    // Data rows (Row 7+)
    let currRow = 7;
    students.forEach((st) => {
      setCell(0, currRow, st.urut, STYLE_TD_CENTER);
      setCell(1, currRow, st.participantNumber, STYLE_TD_CENTER);
      setCell(2, currRow, st.fullName.toUpperCase(), STYLE_TD_LEFT);
      setCell(3, currRow, st.gender, STYLE_TD_CENTER);
      for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
        setCell(4 + sIdx, currRow, '', STYLE_TD_CENTER);
      }
      rowHeights[currRow] = { hpt: 19 };
      currRow++;
    });

    // Signatory Block (Bottom Right)
    rowHeights[currRow] = { hpt: 12 }; currRow++;
    const signColStart = Math.max(0, lastColIdx - 4);
    mergeRange(signColStart, currRow, lastColIdx, currRow, `${city}, ${signDate}`, STYLE_SIGN_TEXT_LEFT);
    rowHeights[currRow] = { hpt: 16 }; currRow++;
    mergeRange(signColStart, currRow, lastColIdx, currRow, 'Ketua Pelaksana', STYLE_SIGN_TEXT_LEFT);
    rowHeights[currRow] = { hpt: 16 }; currRow++;
    rowHeights[currRow] = { hpt: 18 }; currRow++;
    rowHeights[currRow] = { hpt: 18 }; currRow++;
    mergeRange(signColStart, currRow, lastColIdx, currRow, committeeHead, STYLE_SIGN_NAME_LEFT);
    rowHeights[currRow] = { hpt: 18 };

    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: lastColIdx, r: currRow } });
    ws['!cols'] = [
      { wch: 6 },  // URUT
      { wch: 15 }, // PESERTA
      { wch: 30 }, // NAMA PESERTA
      { wch: 6 },  // L/P
      ...subjects.map(() => ({ wch: 10 })), // Subjects
    ];
    ws['!rows'] = rowHeights;
    ws['!merges'] = merges;
    ws['!pageSetup'] = {
      paperSize: 9, // ISO A4
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 0,
      scale: 85,
    };
    ws['!margins'] = {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    };

    return ws;
  }

  /**
   * Generates a fully-styled, pixel-perfect Excel worksheet for Denah Tempat Duduk Peserta Ujian (per room)
   * matching physical school layouts (A4 Landscape, 5 desk columns, Papan Tulis, Pengawas I & II).
   */
  public static buildSeatingLayoutWorksheet(
    roomName: string,
    students: Array<{
      urut: number;
      participantNumber: string;
      fullName: string;
      gender: string;
      className: string;
    }>,
    scheduleData: ExamScheduleData,
    _options?: AdminDocOptions
  ): any {
    const config = scheduleData.config;
    const academicYear = config.academicYear || '2025/2026';
    const examType = config.examType || 'ASTS';
    let examTitle = config.examTitle || `ASESMEN SUMATIF TENGAH SEMESTER (${examType})`;
    if (!examTitle.includes('(') && !examTitle.includes(examType)) {
      examTitle = `${examTitle} (${examType})`;
    }

    const roomNumMatch = roomName.match(/\d+/);
    const roomNumStr = roomNumMatch ? String(parseInt(roomNumMatch[0], 10)).padStart(2, '0') : '';
    const roomBadge = roomNumStr ? `RUANG ${roomNumStr}` : roomName.toUpperCase();

    const ws: any = {};
    const merges: any[] = [];
    const rowHeights: { hpt: number }[] = [];

    const BORDER_THIN = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const STYLE_TITLE_1 = {
      font: { name: 'Times New Roman', sz: 13, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_TITLE_2 = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_TITLE_3 = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_RUANG = {
      font: { name: 'Times New Roman', sz: 18, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_PAPAN_TULIS = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_PENGAWAS = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_DESK = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const setCell = (c: number, r: number, val: any, style?: any) => {
      const ref = XLSX.utils.encode_cell({ c, r });
      ws[ref] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: style || {} };
    };

    const mergeRange = (sc: number, sr: number, ec: number, er: number, val?: any, style?: any) => {
      merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          const ref = XLSX.utils.encode_cell({ c, r });
          if (!ws[ref]) ws[ref] = { v: '', t: 's', s: style || {} };
          else if (style) ws[ref].s = { ...ws[ref].s, ...style };
        }
      }
      if (val !== undefined) setCell(sc, sr, val, style);
    };

    // Columns:
    // Col 0 (A): Margin (wch: 3)
    // Col 1-2 (B-C): Desk Col 1 (PENGAWAS I, Desk 1) (wch: 11, 11)
    // Col 3 (D): Aisle (wch: 3)
    // Col 4-5 (E-F): Desk Col 2 (wch: 11, 11)
    // Col 6 (G): Aisle (wch: 3)
    // Col 7-8 (H-I): Desk Col 3 (wch: 11, 11)
    // Col 9 (J): Aisle (wch: 3)
    // Col 10-11 (K-L): Desk Col 4 (wch: 11, 11)
    // Col 12 (M): Aisle (wch: 3)
    // Col 13-14 (N-O): Desk Col 5 (PENGAWAS II, Desk 5) (wch: 11, 11)
    // Col 15 (P): Margin (wch: 3)
    const deskCols = [
      { start: 1, end: 2 },
      { start: 4, end: 5 },
      { start: 7, end: 8 },
      { start: 10, end: 11 },
      { start: 13, end: 14 },
    ];

    // Titles (Rows 0-2)
    mergeRange(1, 0, 14, 0, 'DENAH TEMPAT DUDUK', STYLE_TITLE_1);
    rowHeights[0] = { hpt: 20 };
    mergeRange(1, 1, 14, 1, `PESERTA ${examTitle.toUpperCase()}`, STYLE_TITLE_2);
    rowHeights[1] = { hpt: 18 };
    mergeRange(1, 2, 14, 2, `TAHUN ${academicYear}`, STYLE_TITLE_3);
    rowHeights[2] = { hpt: 18 };

    // Spacer
    rowHeights[3] = { hpt: 12 };

    // Row 4: Ruang Badge (B-C) & Papan Tulis (G-J)
    mergeRange(1, 4, 3, 4, roomBadge, STYLE_RUANG);
    mergeRange(6, 4, 9, 4, 'PAPAN TULIS', STYLE_PAPAN_TULIS);
    rowHeights[4] = { hpt: 24 };

    // Spacer
    rowHeights[5] = { hpt: 8 };

    // Row 6: Pengawas I (B-C) & Pengawas II (N-O)
    mergeRange(1, 6, 2, 6, 'PENGAWAS I', STYLE_PENGAWAS);
    mergeRange(13, 6, 14, 6, 'PENGAWAS II', STYLE_PENGAWAS);
    rowHeights[6] = { hpt: 22 };

    // Spacer
    rowHeights[7] = { hpt: 12 };

    // Desk Rows mapper:
    const totalStudents = students.length;
    const rowCount = Math.max(4, Math.ceil(totalStudents / 5));

    // Seating grid mapper (5 columns):
    // Even rows (r = 0, 2, 4, 6...): Left -> Right (idx = r * 5 + c)
    // Odd rows (r = 1, 3, 5, 7...): Right -> Left (idx = (r + 1) * 5 - 1 - c)
    const getStudentAt = (r: number, c: number): typeof students[0] | undefined => {
      const isEvenRow = r % 2 === 0;
      const idx = isEvenRow ? r * 5 + c : (r + 1) * 5 - 1 - c;
      return students[idx];
    };

    let currRow = 8;
    for (let r = 0; r < rowCount; r++) {
      rowHeights[currRow] = { hpt: 26 };
      for (let c = 0; c < 5; c++) {
        const st = getStudentAt(r, c);
        const colDef = deskCols[c];
        if (st) {
          const numFormatted = this.formatSeatingParticipantNumber(st.participantNumber, st.urut);
          mergeRange(colDef.start, currRow, colDef.end, currRow, numFormatted, STYLE_DESK);
        }
      }
      currRow++;

      // Spacer between desk rows (except after last row)
      if (r < rowCount - 1) {
        rowHeights[currRow] = { hpt: 10 };
        currRow++;
      }
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 15, r: currRow - 1 } });
    ws['!cols'] = [
      { wch: 3 },  // A
      { wch: 11 }, // B
      { wch: 11 }, // C
      { wch: 3 },  // D
      { wch: 11 }, // E
      { wch: 11 }, // F
      { wch: 3 },  // G
      { wch: 11 }, // H
      { wch: 11 }, // I
      { wch: 3 },  // J
      { wch: 11 }, // K
      { wch: 11 }, // L
      { wch: 3 },  // M
      { wch: 11 }, // N
      { wch: 11 }, // O
      { wch: 3 },  // P
    ];
    ws['!rows'] = rowHeights;
    ws['!merges'] = merges;
    ws['!pageSetup'] = {
      paperSize: 9, // ISO A4
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 90,
    };
    ws['!margins'] = {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    };

    return ws;
  }

  /**
   * Generates a fully-styled, pixel-perfect Excel worksheet for Document 2
   * (Daftar Serah Terima Naskah Soal & Lembar Jawaban) matching physical school & Ministry layouts.
   */
  public static buildHandoverDocsWorksheet(
    roomName: string,
    scheduleData: ExamScheduleData,
    options?: AdminDocOptions
  ): any {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const academicYear = config.academicYear || '2026/2027';
    const examTypeStr = config.examTitle || config.examType || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)';
    const examTypeShort = config.examType || 'ASTS';

    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(undefined, options?.committeeHeadName);
    const showNumbers = options?.includeNumberPrefix !== false;

    const examDays = this.extractExamDays(scheduleData);
    const normalizedTargetRoom = roomName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const roomDuties = (scheduleData.proctorSchedules || []).filter((p) => {
      const pRoomNorm = (p.roomName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pRoomNorm === normalizedTargetRoom;
    });

    const badgeText = roomName.toUpperCase().startsWith('RUANG')
      ? roomName.toUpperCase()
      : `RUANG ${roomName.toUpperCase()}`;

    const ws: any = {};
    const merges: any[] = [];
    const rowHeights: { hpt: number }[] = [];

    const BORDER_THIN = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const BORDER_BADGE = {
      top: { style: 'medium', color: { rgb: '5B9BD5' } },
      bottom: { style: 'medium', color: { rgb: '5B9BD5' } },
      left: { style: 'medium', color: { rgb: '5B9BD5' } },
      right: { style: 'medium', color: { rgb: '5B9BD5' } },
    };

    const setCell = (c: number, r: number, val: any, style?: any) => {
      const ref = XLSX.utils.encode_cell({ c, r });
      ws[ref] = {
        v: val ?? '',
        t: typeof val === 'number' ? 'n' : 's',
        s: style || {},
      };
    };

    const mergeRange = (
      sc: number,
      sr: number,
      ec: number,
      er: number,
      val?: any,
      style?: any
    ) => {
      merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          const ref = XLSX.utils.encode_cell({ c, r });
          if (!ws[ref]) {
            ws[ref] = { v: '', t: 's', s: style || {} };
          } else if (style) {
            ws[ref].s = { ...ws[ref].s, ...style };
          }
        }
      }
      if (val !== undefined) {
        setCell(sc, sr, val, style);
      }
    };

    const STYLE_TITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_SUBTITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_BADGE = {
      font: { name: 'Times New Roman', sz: 15, bold: true, color: { rgb: 'C00000' } },
      fill: { fgColor: { rgb: 'D9E1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_BADGE,
    };

    const STYLE_BANNER = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E78' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_TH = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: '8EAADB' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER_THIN,
    };

    const STYLE_TD_CENTER = {
      font: { name: 'Times New Roman', sz: 10, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_TD_LEFT = {
      font: { name: 'Times New Roman', sz: 10, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_SIGN_TEXT = {
      font: { name: 'Times New Roman', sz: 10.5, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_SIGN_NAME = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, underline: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    // Row 0-3: Top Titles
    mergeRange(0, 0, 5, 0, 'DAFTAR SERAH TERIMA NASKAH SOAL DAN LEMBAR JAWABAN', STYLE_TITLE_HEADER);
    rowHeights[0] = { hpt: 20 };
    mergeRange(0, 1, 5, 1, examTypeStr.toUpperCase(), STYLE_SUBTITLE_HEADER);
    rowHeights[1] = { hpt: 19 };
    mergeRange(0, 2, 5, 2, institutionName.toUpperCase(), STYLE_SUBTITLE_HEADER);
    rowHeights[2] = { hpt: 19 };
    mergeRange(0, 3, 5, 3, `TAHUN PELAJARAN ${academicYear}`, STYLE_SUBTITLE_HEADER);
    rowHeights[3] = { hpt: 19 };

    // Rows 4-6: Spacers
    rowHeights[4] = { hpt: 10 };
    rowHeights[5] = { hpt: 10 };
    rowHeights[6] = { hpt: 10 };

    // Rows 7 & 8: Badge in E8:F9 (0-indexed col 4 to 5, row 7 to 8)
    mergeRange(4, 7, 5, 8, badgeText, STYLE_BADGE);
    rowHeights[7] = { hpt: 22 };
    rowHeights[8] = { hpt: 22 };

    // Row 9: Table 1 Banner
    mergeRange(0, 9, 5, 9, `Daftar Pengambilan Naskah Soal ${examTypeShort}`, STYLE_BANNER);
    rowHeights[9] = { hpt: 24 };

    // Row 10: Blank spacer row
    rowHeights[10] = { hpt: 8 };

    // Rows 11 & 12: Headers (Rows 12 & 13 in Excel)
    mergeRange(0, 11, 0, 12, 'No.', STYLE_TH);
    mergeRange(1, 11, 1, 12, 'Hari,Tanggal', STYLE_TH);
    mergeRange(2, 11, 2, 12, 'Mata Pelajaran', STYLE_TH);
    mergeRange(3, 11, 3, 12, 'No.Kode', STYLE_TH);
    mergeRange(4, 11, 4, 12, 'Nama Pengawas', STYLE_TH);
    mergeRange(5, 11, 5, 12, 'Tanda Tangan', STYLE_TH);
    rowHeights[11] = { hpt: 18 };
    rowHeights[12] = { hpt: 18 };

    // Function to render table data rows with subject breakdown and merged days
    const renderTableDataRows = (startRow: number): number => {
      let r = startRow;
      examDays.forEach((day, dIdx) => {
        const dutiesThisDay = roomDuties.filter((d) => d.date === day.date);
        const subjectsThisDay = scheduleData.subjectSchedules
          ? scheduleData.subjectSchedules.filter((s) => s.date === day.date)
          : [];

        let subjectNames: string[] = [];
        if (dutiesThisDay.length > 0) {
          subjectNames = dutiesThisDay.map((d) => d.subject);
        } else if (subjectsThisDay.length > 0) {
          subjectNames = Array.from(new Set(subjectsThisDay.map((s) => s.subject)));
        } else {
          subjectNames = [''];
        }

        const count = Math.max(1, subjectNames.length);
        const dayStartRow = r;
        const dayEndRow = r + count - 1;

        // Merge Day No. (Col 0)
        mergeRange(0, dayStartRow, 0, dayEndRow, dIdx + 1, STYLE_TD_CENTER);

        // Merge Hari,Tanggal (Col 1)
        mergeRange(1, dayStartRow, 1, dayEndRow, day.dateFormattedLong, STYLE_TD_CENTER);

        // Render each subject row
        for (let i = 0; i < count; i++) {
          const rowIdx = dayStartRow + i;
          const subjText = subjectNames[i] ? `${i + 1}. ${subjectNames[i]}` : `${i + 1}.`;
          const numPrefix = showNumbers ? `${i + 1}.` : '';

          setCell(2, rowIdx, subjText, STYLE_TD_LEFT);
          setCell(3, rowIdx, numPrefix, STYLE_TD_LEFT);
          setCell(4, rowIdx, numPrefix, STYLE_TD_LEFT);
          setCell(5, rowIdx, numPrefix, STYLE_TD_LEFT);

          rowHeights[rowIdx] = { hpt: 20 };
        }

        r = dayEndRow + 1;
      });
      return r;
    };

    // Render Table 1
    let currRow = renderTableDataRows(13);

    // Spacer between Table 1 and Table 2 (Row 26 in screenshot)
    rowHeights[currRow] = { hpt: 14 };
    currRow += 1;

    // Table 2 Banner (Row 27 in screenshot)
    mergeRange(0, currRow, 5, currRow, `Daftar Penyerahan Lembar Jawaban ${examTypeShort}`, STYLE_BANNER);
    rowHeights[currRow] = { hpt: 24 };
    currRow += 1;

    // Table 2 Headers (Rows 28 & 29 in screenshot)
    mergeRange(0, currRow, 0, currRow + 1, 'No.', STYLE_TH);
    mergeRange(1, currRow, 1, currRow + 1, 'Hari,Tanggal', STYLE_TH);
    mergeRange(2, currRow, 2, currRow + 1, 'Mata Pelajaran', STYLE_TH);
    mergeRange(3, currRow, 3, currRow + 1, 'No.Kode', STYLE_TH);
    mergeRange(4, currRow, 4, currRow + 1, 'Nama Pengawas', STYLE_TH);
    mergeRange(5, currRow, 5, currRow + 1, 'Tanda Tangan', STYLE_TH);
    rowHeights[currRow] = { hpt: 18 };
    rowHeights[currRow + 1] = { hpt: 18 };
    currRow += 2;

    // Render Table 2
    currRow = renderTableDataRows(currRow);

    // Spacers before Signatory
    rowHeights[currRow] = { hpt: 14 };
    currRow += 1;
    rowHeights[currRow] = { hpt: 14 };
    currRow += 1;

    // Signatory block (Right aligned in columns E:F)
    mergeRange(4, currRow, 5, currRow, `${city},   ${signDate}`, STYLE_SIGN_TEXT);
    rowHeights[currRow] = { hpt: 18 };
    currRow += 1;

    mergeRange(4, currRow, 5, currRow, 'Ketua Penyelenggara,', STYLE_SIGN_TEXT);
    rowHeights[currRow] = { hpt: 18 };
    currRow += 1;

    // Signature vertical spacing
    rowHeights[currRow] = { hpt: 24 };
    currRow += 1;
    rowHeights[currRow] = { hpt: 24 };
    currRow += 1;

    // Official Name
    mergeRange(4, currRow, 5, currRow, committeeHead, STYLE_SIGN_NAME);
    rowHeights[currRow] = { hpt: 20 };

    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 5, r: currRow } });
    ws['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 32 },
      { wch: 10 },
      { wch: 22 },
      { wch: 18 },
    ];
    ws['!rows'] = rowHeights;
    ws['!merges'] = merges;
    ws['!pageSetup'] = {
      paperSize: 9, // ISO A4 (210 x 297 mm)
      orientation: options?.orientation || 'portrait',
      fitToWidth: 1,
      fitToHeight: 0,
      scale: 100,
    };
    ws['!margins'] = {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    };

    return ws;
  }

  /**
   * Generates and downloads Microsoft Excel (.xlsx) file matching the exact sample layout
   */
  public static exportToExcel(
    docType: AdminDocType,
    payload: {
      matrix?: ExamInvigilationMatrix | null;
      scheduleData: ExamScheduleData;
      committeeMembers?: ExamCommitteeMember[];
      options?: AdminDocOptions;
    },
    fileNameOverride?: string
  ): void {
    const { matrix, scheduleData, committeeMembers, options } = payload;
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const institutionName = branding.institutionName || 'SMP TERPADU AL-ITTIHADIYAH';
    const academicYear = config.academicYear || '2026/2027';
    const city = options?.city || 'Bogor';
    const signDate = this.resolveSignDate(scheduleData, options?.signDateMonthYear);
    const committeeHead = this.resolveCommitteeHead(committeeMembers, options?.committeeHeadName);
    const examDays = this.extractExamDays(scheduleData);

    const wb = XLSX.utils.book_new();

    const BORDER_THIN = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const STYLE_TITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_SUBTITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_TH = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: '8EAADB' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER_THIN,
    };

    const STYLE_TD_CENTER = {
      font: { name: 'Times New Roman', sz: 10, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_TD_LEFT = {
      font: { name: 'Times New Roman', sz: 10, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: BORDER_THIN,
    };

    const STYLE_SIGN_TEXT = {
      font: { name: 'Times New Roman', sz: 10.5, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    const STYLE_SIGN_NAME = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, underline: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    if (docType === 'PROCTOR_ATTENDANCE') {
      // -------------------------------------------------------------
      // EXCEL: DAFTAR HADIR PENGAWAS
      // -------------------------------------------------------------
      const days = examDays.length > 0 ? examDays : [
        { date: '2026-05-11', dayName: 'SENIN', dateFormattedDmy: '11/05/2026', dateFormattedLong: 'Senin, 11 Mei 2026' },
        { date: '2026-05-12', dayName: 'SELASA', dateFormattedDmy: '12/05/2026', dateFormattedLong: 'Selasa, 12 Mei 2026' },
        { date: '2026-05-13', dayName: 'RABU', dateFormattedDmy: '13/05/2026', dateFormattedLong: 'Rabu, 13 Mei 2026' },
      ];

      const maxCol = 2 + days.length; // 0: NO, 1: NAMA, 2: JABATAN, 3..: Days
      const ws: any = {};
      const merges: any[] = [];
      const rowHeights: { hpt: number }[] = [];

      const setCell = (c: number, r: number, val: any, style?: any) => {
        const ref = XLSX.utils.encode_cell({ c, r });
        ws[ref] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: style || {} };
      };

      const mergeRange = (sc: number, sr: number, ec: number, er: number, val?: any, style?: any) => {
        merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
        for (let r = sr; r <= er; r++) {
          for (let c = sc; c <= ec; c++) {
            const ref = XLSX.utils.encode_cell({ c, r });
            if (!ws[ref]) ws[ref] = { v: '', t: 's', s: style || {} };
            else if (style) ws[ref].s = { ...ws[ref].s, ...style };
          }
        }
        if (val !== undefined) setCell(sc, sr, val, style);
      };

      // Titles
      mergeRange(0, 0, maxCol, 0, 'DAFTAR HADIR PENGAWAS', STYLE_TITLE_HEADER);
      rowHeights[0] = { hpt: 20 };
      mergeRange(0, 1, maxCol, 1, (config.examTitle || config.examType || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)').toUpperCase(), STYLE_SUBTITLE_HEADER);
      rowHeights[1] = { hpt: 19 };
      mergeRange(0, 2, maxCol, 2, institutionName.toUpperCase(), STYLE_SUBTITLE_HEADER);
      rowHeights[2] = { hpt: 19 };
      mergeRange(0, 3, maxCol, 3, `TAHUN PELAJARAN ${academicYear}`, STYLE_SUBTITLE_HEADER);
      rowHeights[3] = { hpt: 19 };

      rowHeights[4] = { hpt: 12 };

      // Headers (Row 5 & 6)
      mergeRange(0, 5, 0, 6, 'NO', STYLE_TH);
      mergeRange(1, 5, 1, 6, 'NAMA', STYLE_TH);
      mergeRange(2, 5, 2, 6, 'JABATAN', STYLE_TH);
      mergeRange(3, 5, maxCol, 5, 'HARI / TANGGAL', STYLE_TH);
      rowHeights[5] = { hpt: 18 };
      rowHeights[6] = { hpt: 26 };

      days.forEach((d, idx) => {
        setCell(3 + idx, 6, `${d.dayName.toUpperCase()}\n${d.dateFormattedDmy}`, STYLE_TH);
      });

      let proctors = matrix?.teacherLegend?.map((t) => t.fullName) || [];
      if (proctors.length === 0 && scheduleData.proctorSchedules) {
        const names = new Set<string>();
        scheduleData.proctorSchedules.forEach((p) => {
          if (p.mainProctorName) names.add(p.mainProctorName);
          if (p.backupProctorName) names.add(p.backupProctorName);
        });
        proctors = Array.from(names);
      }
      if (proctors.length === 0) {
        proctors = ['Farhan Sopian Sahid, S.Pd.I', 'Qodiatul Asrof Ramadoni, S.E', 'M. Ridho Alfarizi', 'Adi Prasetyo, S.Pd'];
      }

      let currRow = 7;
      proctors.forEach((pName, idx) => {
        setCell(0, currRow, idx + 1, STYLE_TD_CENTER);
        setCell(1, currRow, pName, STYLE_TD_LEFT);
        setCell(2, currRow, 'Pengawas', STYLE_TD_LEFT);
        for (let c = 3; c <= maxCol; c++) {
          setCell(c, currRow, '', STYLE_TD_CENTER);
        }
        rowHeights[currRow] = { hpt: 22 };
        currRow++;
      });

      // Signatory
      rowHeights[currRow] = { hpt: 14 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, `${city},   ${signDate}`, STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, 'Ketua Penyelenggara,', STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, committeeHead, STYLE_SIGN_NAME);
      rowHeights[currRow] = { hpt: 20 };

      ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol, r: currRow } });
      ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 14 }, ...days.map(() => ({ wch: 16 }))];
      ws['!rows'] = rowHeights;
      ws['!merges'] = merges;
      ws['!pageSetup'] = {
        paperSize: 9, // ISO A4
        orientation: options?.orientation || 'portrait',
        fitToWidth: 1,
        fitToHeight: 0,
        scale: 100,
      };
      ws['!margins'] = {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      };

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir Pengawas');
      const filename = fileNameOverride || `Daftar_Hadir_Pengawas_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'STUDENT_ATTENDANCE_ROSTER') {
      // -------------------------------------------------------------
      // EXCEL: DAFTAR HADIR PESERTA UJIAN (PER RUANGAN)
      // -------------------------------------------------------------
      const roomStudentMap = this.resolveRoomStudents(scheduleData, options);
      const rooms = Object.keys(roomStudentMap);
      const selectedRoom = options?.roomFilter;
      const roomsToExport = selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => this.canonicalRoomName(r).toLowerCase() === this.canonicalRoomName(selectedRoom).toLowerCase())
        : rooms;

      roomsToExport.forEach((roomName) => {
        const students = roomStudentMap[roomName] || [];
        const ws = this.buildStudentAttendanceRosterWorksheet(roomName, students, scheduleData, options);
        const safeSheetName = roomName.replace(/[^\w]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Daftar_Hadir_Peserta_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}_A4.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'SEATING_LAYOUT') {
      // -------------------------------------------------------------
      // EXCEL: DENAH TEMPAT DUDUK PESERTA UJIAN (PER RUANGAN)
      // -------------------------------------------------------------
      const roomStudentMap = this.resolveRoomStudents(scheduleData, options);
      const rooms = Object.keys(roomStudentMap);
      const selectedRoom = options?.roomFilter;
      const roomsToExport = selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => this.canonicalRoomName(r).toLowerCase() === this.canonicalRoomName(selectedRoom).toLowerCase())
        : rooms;

      roomsToExport.forEach((roomName) => {
        const students = roomStudentMap[roomName] || [];
        const ws = this.buildSeatingLayoutWorksheet(roomName, students, scheduleData, options);
        const safeSheetName = `Denah_${roomName.replace(/[^\w]/g, '_')}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Denah_Tempat_Duduk_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}_A4.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'HANDOVER_DOCS') {
      // -------------------------------------------------------------
      // EXCEL: SERAH TERIMA NASKAH SOAL & LJK PER RUANGAN
      // -------------------------------------------------------------
      const isSma =
        scheduleData.educationLevel === 'SMA' ||
        scheduleData.config.educationLevel === 'SMA' ||
        config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) ||
        false;
      const rSet = new Set<string>();
      if (scheduleData.proctorSchedules) {
        scheduleData.proctorSchedules.forEach((p) => {
          if (p.roomName) rSet.add(this.canonicalRoomName(p.roomName));
        });
      }
      if (scheduleData.subjectSchedules) {
        scheduleData.subjectSchedules.forEach((s) => {
          if (s.roomName) rSet.add(this.canonicalRoomName(s.roomName));
        });
      }
      if (scheduleData.config.classRoomMapping) {
        Object.values(scheduleData.config.classRoomMapping).forEach((r) => {
          if (r) rSet.add(this.canonicalRoomName(r));
        });
      }
      if (scheduleData.config.customRoomNumbers && scheduleData.config.customRoomNumbers.length > 0) {
        scheduleData.config.customRoomNumbers.forEach((n) => {
          rSet.add(`Ruang ${String(n).padStart(2, '0')}`);
        });
      }
      if (isSma) {
        if (rSet.size === 0) rSet.add('Ruang 06');
      } else {
        const minRooms = 5;
        const targetRoomCount = Math.max(minRooms, scheduleData.config.totalRooms || minRooms);
        for (let i = 1; i <= targetRoomCount; i++) {
          rSet.add(`Ruang ${String(i).padStart(2, '0')}`);
        }
      }
      const rooms: string[] = Array.from(rSet).sort((a, b) => {
        const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
        const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
        return numA - numB;
      });

      const selectedRoom = options?.roomFilter;
      const roomsToExport = selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => this.canonicalRoomName(r).toLowerCase() === this.canonicalRoomName(selectedRoom).toLowerCase())
        : rooms;

      roomsToExport.forEach((roomName) => {
        const ws = this.buildHandoverDocsWorksheet(roomName, scheduleData, options);
        const safeSheetName = roomName.replace(/[^\w]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Serah_Terima_Soal_LJK_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}_A4.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'STUDENT_ATTENDANCE_SUMMARY') {
      // -------------------------------------------------------------
      // EXCEL: REKAPITULASI KEHADIRAN PESERTA UJIAN
      // -------------------------------------------------------------
      const ws: any = {};
      const merges: any[] = [];
      const rowHeights: { hpt: number }[] = [];

      const setCell = (c: number, r: number, val: any, style?: any) => {
        const ref = XLSX.utils.encode_cell({ c, r });
        ws[ref] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: style || {} };
      };

      const mergeRange = (sc: number, sr: number, ec: number, er: number, val?: any, style?: any) => {
        merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
        for (let r = sr; r <= er; r++) {
          for (let c = sc; c <= ec; c++) {
            const ref = XLSX.utils.encode_cell({ c, r });
            if (!ws[ref]) ws[ref] = { v: '', t: 's', s: style || {} };
            else if (style) ws[ref].s = { ...ws[ref].s, ...style };
          }
        }
        if (val !== undefined) setCell(sc, sr, val, style);
      };

      mergeRange(0, 0, 5, 0, institutionName.toUpperCase(), STYLE_TITLE_HEADER);
      rowHeights[0] = { hpt: 20 };
      mergeRange(0, 1, 5, 1, `TAHUN PELAJARAN ${academicYear}`, STYLE_SUBTITLE_HEADER);
      rowHeights[1] = { hpt: 19 };
      mergeRange(0, 2, 5, 2, `BERITA ACARA REKAPITULASI KEHADIRAN PESERTA ${config.examType || 'ASTS'}`, STYLE_SUBTITLE_HEADER);
      rowHeights[2] = { hpt: 19 };
      rowHeights[3] = { hpt: 12 };

      // Table Headers (Row 4)
      setCell(0, 4, 'No', STYLE_TH);
      setCell(1, 4, 'Mata Pelajaran', STYLE_TH);
      setCell(2, 4, 'Jumlah Seharusnya', STYLE_TH);
      setCell(3, 4, 'Jumlah yang Hadir', STYLE_TH);
      setCell(4, 4, 'Jumlah yang Tidak Hadir', STYLE_TH);
      setCell(5, 4, 'Keterangan', STYLE_TH);
      rowHeights[4] = { hpt: 24 };

      const subjectList: string[] = [];
      if (scheduleData.subjectSchedules) {
        scheduleData.subjectSchedules.forEach((s) => {
          if (s.subject && !subjectList.includes(s.subject)) subjectList.push(s.subject);
        });
      }
      if (subjectList.length === 0) {
        subjectList.push('PAI & PB', 'IPA', 'Matematika', 'Bahasa Arab', 'Bahasa Indonesia', 'IPS', 'Bahasa Inggris');
      }

      let currRow = 5;
      subjectList.forEach((subj, idx) => {
        let countVal: any = typeof options?.totalRegisteredStudents === 'number' ? options.totalRegisteredStudents : '';
        if (options?.totalRegisteredStudents && typeof options.totalRegisteredStudents === 'object') {
          countVal = options.totalRegisteredStudents[subj] ?? countVal;
        }

        setCell(0, currRow, idx + 1, STYLE_TD_CENTER);
        setCell(1, currRow, subj, STYLE_TD_LEFT);
        setCell(2, currRow, countVal, STYLE_TD_CENTER);
        setCell(3, currRow, '', STYLE_TD_CENTER);
        setCell(4, currRow, '', STYLE_TD_CENTER);
        setCell(5, currRow, '', STYLE_TD_LEFT);
        rowHeights[currRow] = { hpt: 20 };
        currRow++;
      });

      // Signatory
      rowHeights[currRow] = { hpt: 14 }; currRow++;
      mergeRange(3, currRow, 5, currRow, `${city},   ${signDate}`, STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      mergeRange(3, currRow, 5, currRow, 'Ketua Penyelenggara,', STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      mergeRange(3, currRow, 5, currRow, committeeHead, STYLE_SIGN_NAME);
      rowHeights[currRow] = { hpt: 20 };

      ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 5, r: currRow } });
      ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 24 }];
      ws['!rows'] = rowHeights;
      ws['!merges'] = merges;
      ws['!pageSetup'] = {
        paperSize: 9, // ISO A4
        orientation: options?.orientation || 'portrait',
        fitToWidth: 1,
        fitToHeight: 0,
        scale: 100,
      };
      ws['!margins'] = {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      };

      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran Peserta');
      const filename = fileNameOverride || `Rekap_Kehadiran_Siswa_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}_A4.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'COMMITTEE_ATTENDANCE') {
      // -------------------------------------------------------------
      // EXCEL: DAFTAR HADIR PANITIA UJIAN
      // -------------------------------------------------------------
      const days = examDays.length > 0 ? examDays : [
        { date: '2026-05-11', dayName: 'SENIN', dateFormattedDmy: '11/05/2026', dateFormattedLong: 'Senin, 11 Mei 2026' },
        { date: '2026-05-12', dayName: 'SELASA', dateFormattedDmy: '12/05/2026', dateFormattedLong: 'Selasa, 12 Mei 2026' },
        { date: '2026-05-13', dayName: 'RABU', dateFormattedDmy: '13/05/2026', dateFormattedLong: 'Rabu, 13 Mei 2026' },
      ];

      const maxCol = 2 + days.length; // 0: NO, 1: NAMA, 2: JABATAN, 3..: Days
      const ws: any = {};
      const merges: any[] = [];
      const rowHeights: { hpt: number }[] = [];

      const setCell = (c: number, r: number, val: any, style?: any) => {
        const ref = XLSX.utils.encode_cell({ c, r });
        ws[ref] = { v: val ?? '', t: typeof val === 'number' ? 'n' : 's', s: style || {} };
      };

      const mergeRange = (sc: number, sr: number, ec: number, er: number, val?: any, style?: any) => {
        merges.push({ s: { c: sc, r: sr }, e: { c: ec, r: er } });
        for (let r = sr; r <= er; r++) {
          for (let c = sc; c <= ec; c++) {
            const ref = XLSX.utils.encode_cell({ c, r });
            if (!ws[ref]) ws[ref] = { v: '', t: 's', s: style || {} };
            else if (style) ws[ref].s = { ...ws[ref].s, ...style };
          }
        }
        if (val !== undefined) setCell(sc, sr, val, style);
      };

      // Titles
      mergeRange(0, 0, maxCol, 0, 'DAFTAR HADIR PANITIA', STYLE_TITLE_HEADER);
      rowHeights[0] = { hpt: 20 };
      mergeRange(0, 1, maxCol, 1, (config.examTitle || config.examType || 'ASESMEN SUMATIF AKHIR JENJANG (ASAJ)').toUpperCase(), STYLE_SUBTITLE_HEADER);
      rowHeights[1] = { hpt: 19 };
      mergeRange(0, 2, maxCol, 2, institutionName.toUpperCase(), STYLE_SUBTITLE_HEADER);
      rowHeights[2] = { hpt: 19 };
      mergeRange(0, 3, maxCol, 3, `TAHUN PELAJARAN ${academicYear}`, STYLE_SUBTITLE_HEADER);
      rowHeights[3] = { hpt: 19 };

      rowHeights[4] = { hpt: 12 };

      // Headers (Row 5 & 6)
      mergeRange(0, 5, 0, 6, 'NO', STYLE_TH);
      mergeRange(1, 5, 1, 6, 'NAMA', STYLE_TH);
      mergeRange(2, 5, 2, 6, 'JABATAN', STYLE_TH);
      mergeRange(3, 5, maxCol, 5, 'HARI / TANGGAL', STYLE_TH);
      rowHeights[5] = { hpt: 18 };
      rowHeights[6] = { hpt: 26 };

      days.forEach((d, idx) => {
        setCell(3 + idx, 6, `${d.dayName.toUpperCase()}\n${d.dateFormattedDmy}`, STYLE_TH);
      });

      let items = (committeeMembers || []).map((m) => {
        let jabatanLabel = 'Anggota';
        if (m.role === 'PENANGGUNG_JAWAB') jabatanLabel = 'Penanggung Jawab';
        else if (m.role === 'KETUA') jabatanLabel = 'Ketua';
        else if (m.role === 'SEKRETARIS') jabatanLabel = 'Sekretaris';
        else if (m.role === 'BENDAHARA') jabatanLabel = 'Bendahara';
        else if (m.fullName.includes('Farhan') || m.fullName.toLowerCase().includes('kepala')) {
          jabatanLabel = 'KS/ Penanggung Jawab';
        }
        return { name: m.fullName, jabatan: jabatanLabel };
      });

      if (items.length === 0) {
        items = [
          { name: SIGNATORY_OFFICIALS.KEPSEK_NAME, jabatan: 'KS/ Penanggung Jawab' },
          { name: 'Septi Nur Aeni, S.E', jabatan: 'Ketua' },
          { name: 'Dafa Maulana, S.Pd', jabatan: 'Sekretaris' },
          { name: 'Mira Nurdianti, S.Pd', jabatan: 'Bendahara' },
          { name: 'Mawar Andinia, S.Pd., G.r', jabatan: 'Anggota' },
        ];
      }

      let currRow = 7;
      items.forEach((item, idx) => {
        setCell(0, currRow, idx + 1, STYLE_TD_CENTER);
        setCell(1, currRow, item.name, STYLE_TD_LEFT);
        setCell(2, currRow, item.jabatan, STYLE_TD_LEFT);
        for (let c = 3; c <= maxCol; c++) {
          setCell(c, currRow, '', STYLE_TD_CENTER);
        }
        rowHeights[currRow] = { hpt: 22 };
        currRow++;
      });

      // Signatory
      rowHeights[currRow] = { hpt: 14 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, `${city},   ${signDate}`, STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, 'Ketua Penyelenggara,', STYLE_SIGN_TEXT);
      rowHeights[currRow] = { hpt: 18 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      rowHeights[currRow] = { hpt: 24 }; currRow++;
      mergeRange(maxCol - 2, currRow, maxCol, currRow, committeeHead, STYLE_SIGN_NAME);
      rowHeights[currRow] = { hpt: 20 };

      ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol, r: currRow } });
      ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 22 }, ...days.map(() => ({ wch: 16 }))];
      ws['!rows'] = rowHeights;
      ws['!merges'] = merges;
      ws['!pageSetup'] = {
        paperSize: 9, // ISO A4
        orientation: options?.orientation || 'portrait',
        fitToWidth: 1,
        fitToHeight: 0,
        scale: 100,
      };
      ws['!margins'] = {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      };

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir Panitia');
      const filename = fileNameOverride || `Daftar_Hadir_Panitia_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}_A4.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  }
}
