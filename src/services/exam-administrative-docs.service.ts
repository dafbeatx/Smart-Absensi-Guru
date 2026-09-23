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

export type AdminDocType =
  | 'PROCTOR_ATTENDANCE'
  | 'STUDENT_ATTENDANCE_ROSTER'
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
   * Common CSS for official A4 school documents
   */
  public static getOfficialDocumentStyles(orientation: 'portrait' | 'landscape' = 'portrait'): string {
    const isLandscape = orientation === 'landscape';
    return `
      @page {
        size: A4 ${orientation};
        margin: ${isLandscape ? '10mm 15mm 10mm 15mm' : '12mm 15mm 12mm 15mm'};
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
  // Nomor peserta: 13-0820-001 (dimulai dari peserta 1 di Ruang 1 secara sekuensial)
  // =========================================================================

  public static readonly OFFICIAL_SMP_ROOM_1_STUDENTS = [
    { fullName: 'AMANDA HASNA MIRZA', gender: 'P', className: '7' },
    { fullName: 'BILQIS AINUN NISSA', gender: 'P', className: '7' },
    { fullName: 'CASKIA APRILIA', gender: 'P', className: '7' },
    { fullName: 'DONA', gender: 'P', className: '7' },
    { fullName: 'KIRANA AURA ANWARUDIN', gender: 'P', className: '7' },
    { fullName: 'NAJWA NUR FADILLAH', gender: 'P', className: '7' },
    { fullName: 'NENG KASIH', gender: 'P', className: '7' },
    { fullName: 'NATASYA HOLIVAH', gender: 'P', className: '7' },
    { fullName: 'RADISTI PUTRI RIANTI', gender: 'P', className: '7' },
    { fullName: 'RIZKA LIANA HAKIM', gender: 'P', className: '7' },
    { fullName: 'SANTIKA', gender: 'P', className: '7' },
    { fullName: 'SUCI RAHMAWATI', gender: 'P', className: '7' },
    { fullName: 'TASYIRA AFIFA', gender: 'P', className: '7' },
    { fullName: 'WANDA INDRIANI', gender: 'P', className: '7' },
    { fullName: 'YOLA AULIA SANTOSO', gender: 'P', className: '7' },
    { fullName: 'YUNA HANDAYANI', gender: 'P', className: '7' },
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

  public static readonly OFFICIAL_SMP_ROOM_4_STUDENTS = [
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

  public static readonly OFFICIAL_SMP_ROOM_5_STUDENTS = [
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
    const isSma = scheduleData.config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) || false;

    // 1. Ekstraksi daftar ruangan dari jadwal
    let rooms: string[] = [];
    if (scheduleData.proctorSchedules) {
      const rSet = new Set<string>();
      scheduleData.proctorSchedules.forEach((p) => {
        if (p.roomName) rSet.add(p.roomName);
      });
      rooms = Array.from(rSet);
    }

    // Untuk SMP, wajib sediakan minimal 5 ruangan (Ruang 1 : Kelas 7, Ruang 2 : Kelas 8A, dst sampai Ruang 5 : Kelas 9B)
    // Untuk SMA, minimal 3 ruangan (Kelas 10, Kelas 11, Kelas 12)
    const minRooms = isSma ? 3 : 5;
    const targetRoomCount = Math.max(minRooms, scheduleData.config.totalRooms || minRooms, rooms.length);
    for (let i = 1; i <= targetRoomCount; i++) {
      const standardName = `Ruang ${String(i).padStart(2, '0')}`;
      if (!rooms.some((r) => r.toLowerCase().replace(/[^a-z0-9]/g, '') === standardName.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
        rooms.push(standardName);
      }
    }

    rooms.sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
      return numA - numB;
    });

    // 2. Susun daftar siswa per ruangan - PER KELAS (BUKAN 16-16 PER RUANGAN)
    // Ruang 1: Kelas 7
    // Ruang 2: Kelas 8A
    // Ruang 3: Kelas 8B
    // Ruang 4: Kelas 9A
    // Ruang 5: Kelas 9B
    const rawStudentMap: Record<string, Array<{ fullName: string; gender: string; className: string }>> = {};
    rooms.forEach((r) => { rawStudentMap[r] = []; });

    const getTargetRoomForStudent = (
      st: { roomName?: string; className?: string; class?: string; kelas?: string }
    ): string => {
      if (st.roomName) {
        const found = rooms.find(
          (r) => r.toLowerCase().replace(/[^a-z0-9]/g, '') === st.roomName!.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (found) return found;
      }

      const rawCls = (st.className || (st as any).class || (st as any).kelas || '').trim().toUpperCase();
      const clsNorm = rawCls.replace(/\s+/g, '');

      if (isSma) {
        if (/^10|X$|X[A-Z]/.test(clsNorm)) return rooms[0] || 'Ruang 01';
        if (/^11|XI$|XI[A-Z]/.test(clsNorm)) return rooms[1] || 'Ruang 02';
        if (/^12|XII$|XII[A-Z]/.test(clsNorm)) return rooms[2] || 'Ruang 03';
        return rooms[0] || 'Ruang 01';
      }

      // SMP mapping deterministik per kelas:
      // Ruang 1 -> Kelas 7
      // Ruang 2 -> Kelas 8A
      // Ruang 3 -> Kelas 8B
      // Ruang 4 -> Kelas 9A
      // Ruang 5 -> Kelas 9B
      if (/^8A|VIIIA/.test(clsNorm)) return rooms[1] || 'Ruang 02';
      if (/^8B|VIIIB/.test(clsNorm)) return rooms[2] || 'Ruang 03';
      if (/^9A|IXA/.test(clsNorm)) return rooms[3] || 'Ruang 04';
      if (/^9B|IXB/.test(clsNorm)) return rooms[4] || 'Ruang 05';
      if (/^7|VII/.test(clsNorm)) return rooms[0] || 'Ruang 01';
      if (/^8|VIII/.test(clsNorm)) return rooms[1] || 'Ruang 02';
      if (/^9|IX/.test(clsNorm)) return rooms[3] || 'Ruang 04';

      return rooms[0] || 'Ruang 01';
    };

    if (options?.studentsList && options.studentsList.length > 0) {
      options.studentsList.forEach((st) => {
        const targetRoom = getTargetRoomForStudent(st);
        if (!rawStudentMap[targetRoom]) rawStudentMap[targetRoom] = [];
        rawStudentMap[targetRoom].push({
          fullName: st.fullName,
          gender: st.gender || 'L',
          className: st.className,
        });
      });
    } else {
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

      if (cachedStudents.length > 0) {
        const targetLevel = isSma ? 'SMA' : 'SMP';
        const levelFiltered = cachedStudents.filter((s) => {
          const cls = s.className || s.kelas || '';
          const isClsSma = /10|11|12|sma|ipa|ips/i.test(cls);
          return targetLevel === 'SMA' ? isClsSma : !isClsSma;
        });

        const studentsToUse = levelFiltered.length > 0 ? levelFiltered : cachedStudents;
        studentsToUse.forEach((s) => {
          const targetRoom = getTargetRoomForStudent(s);
          if (!rawStudentMap[targetRoom]) rawStudentMap[targetRoom] = [];
          rawStudentMap[targetRoom].push({
            fullName: s.fullName || s.name || 'Siswa',
            gender: s.gender || (/8A|9A/i.test(s.className || '') ? 'P' : 'L'),
            className: s.className || s.kelas || (targetRoom === rooms[0] ? '7' : '8A'),
          });
        });
      }

      // Pastikan setiap ruangan terisi lengkap dengan daftar resmi per kelas (bukan 16-16)
      if (isSma) {
        if (!rawStudentMap[rooms[0]] || rawStudentMap[rooms[0]].length === 0) {
          rawStudentMap[rooms[0]] = this.OFFICIAL_SMA_ROOM_1_STUDENTS;
        }
        if (rooms[1] && (!rawStudentMap[rooms[1]] || rawStudentMap[rooms[1]].length === 0)) {
          rawStudentMap[rooms[1]] = this.OFFICIAL_SMA_ROOM_2_STUDENTS;
        }
        if (rooms[2] && (!rawStudentMap[rooms[2]] || rawStudentMap[rooms[2]].length === 0)) {
          rawStudentMap[rooms[2]] = this.OFFICIAL_SMA_ROOM_3_STUDENTS;
        }
      } else {
        if (!rawStudentMap[rooms[0]] || rawStudentMap[rooms[0]].length === 0) {
          rawStudentMap[rooms[0]] = this.OFFICIAL_SMP_ROOM_1_STUDENTS;
        }
        if (rooms[1] && (!rawStudentMap[rooms[1]] || rawStudentMap[rooms[1]].length === 0)) {
          rawStudentMap[rooms[1]] = this.OFFICIAL_SMP_ROOM_2_STUDENTS;
        }
        if (rooms[2] && (!rawStudentMap[rooms[2]] || rawStudentMap[rooms[2]].length === 0)) {
          rawStudentMap[rooms[2]] = this.OFFICIAL_SMP_ROOM_3_STUDENTS;
        }
        if (rooms[3] && (!rawStudentMap[rooms[3]] || rawStudentMap[rooms[3]].length === 0)) {
          rawStudentMap[rooms[3]] = this.OFFICIAL_SMP_ROOM_4_STUDENTS;
        }
        if (rooms[4] && (!rawStudentMap[rooms[4]] || rawStudentMap[rooms[4]].length === 0)) {
          rawStudentMap[rooms[4]] = this.OFFICIAL_SMP_ROOM_5_STUDENTS;
        }
      }
    }

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
    _options?: AdminDocOptions
  ): string {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma = config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) || false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');
    const academicYear = config.academicYear || '2025/2026';
    const semesterStr = config.semester ? config.semester.toUpperCase() : 'GENAP';

    let examTitle = config.examTitle || `ASESMEN SUMATIF TENGAH SEMESTER (${config.examType || 'ASTS'})`;
    if (!examTitle.toUpperCase().includes('GENAP') && !examTitle.toUpperCase().includes('GANJIL')) {
      examTitle = `${examTitle} ${semesterStr}`;
    }

    const roomNumMatch = roomName.match(/\d+/);
    const roomNumStr = roomNumMatch ? String(parseInt(roomNumMatch[0], 10)).padStart(2, '0') : '';
    const roomBadge = roomNumStr ? `RUANG ${roomNumStr}` : roomName.toUpperCase();

    const rowsHtml = students.map((s) => `
      <tr>
        <td style="border: 1pt solid #000000; text-align: center; padding: 4px; font-size: 10pt;">${s.urut}</td>
        <td style="border: 1pt solid #000000; text-align: center; padding: 4px 6px; font-size: 10pt; font-family: 'Times New Roman', serif; font-weight: 500;">${s.participantNumber}</td>
        <td style="border: 1pt solid #000000; text-align: left; padding: 4px 8px; font-size: 10pt; text-transform: uppercase;">${s.fullName}</td>
        <td style="border: 1pt solid #000000; text-align: center; padding: 4px; font-size: 10pt;">${s.gender}</td>
        <td style="border: 1pt solid #000000; text-align: center; padding: 4px 6px; font-size: 10pt;">${s.className}</td>
      </tr>
    `).join('');

    return `
      <div class="page-container" style="font-family: 'Times New Roman', Times, serif; color: #000000; background: #ffffff;">
        <div class="doc-header" style="text-align: center; margin-bottom: 16px;">
          <h1 style="font-size: 13.5pt; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; font-family: 'Times New Roman', serif; letter-spacing: 0.3px;">
            DAFTAR HADIR PESERTA
          </h1>
          <h2 style="font-size: 12.5pt; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; font-family: 'Times New Roman', serif;">
            ${examTitle}
          </h2>
          <div style="font-size: 13pt; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; font-family: 'Times New Roman', serif; letter-spacing: 0.3px;">
            ${institutionName}
          </div>
          <div style="font-size: 11.5pt; font-weight: bold; margin: 0; font-family: 'Times New Roman', serif;">
            Tahun Pelajaran ${academicYear}
          </div>
        </div>

        <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 6px;">
          <tr style="border: none;">
            <td style="border: none; width: 60%; padding: 0;"></td>
            <td style="border: none; width: 40%; text-align: right; padding: 0;" align="right">
              <span style="font-size: 17pt; font-weight: bold; font-family: 'Times New Roman', serif; letter-spacing: 0.5px; color: #000000;">
                ${roomBadge}
              </span>
            </td>
          </tr>
        </table>

        <table class="doc-table" style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', serif; border: 1pt solid #000000;">
          <thead>
            <tr style="background-color: transparent;">
              <th colspan="2" style="border: 1pt solid #000000; padding: 5px 4px; text-align: center; font-weight: bold; font-size: 10.5pt; width: 190px;">
                NOMOR
              </th>
              <th rowspan="2" style="border: 1pt solid #000000; padding: 5px 8px; text-align: center; font-weight: bold; font-size: 10.5pt;">
                NAMA PESERTA
              </th>
              <th rowspan="2" style="border: 1pt solid #000000; padding: 5px 4px; text-align: center; font-weight: bold; font-size: 10.5pt; width: 55px;">
                L/P
              </th>
              <th rowspan="2" style="border: 1pt solid #000000; padding: 5px 6px; text-align: center; font-weight: bold; font-size: 10.5pt; width: 85px;">
                KELAS
              </th>
            </tr>
            <tr style="background-color: transparent;">
              <th style="border: 1pt solid #000000; padding: 4px; text-align: center; font-weight: bold; font-size: 10pt; width: 48px;">
                URUT
              </th>
              <th style="border: 1pt solid #000000; padding: 4px; text-align: center; font-weight: bold; font-size: 10pt; width: 142px;">
                PESERTA
              </th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Proctor Signatory Block -->
        <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 24px; font-family: 'Times New Roman', serif; font-size: 10.5pt; page-break-inside: avoid;">
          <tr style="border: none;">
            <td style="border: none; width: 60%; vertical-align: top; padding: 0;"></td>
            <td style="border: none; width: 40%; text-align: center; vertical-align: top; padding: 0;">
              <div>Pengawas Ruang,</div>
              <div style="height: 52px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">( .................................................... )</div>
              <div style="font-size: 9.5pt; margin-top: 2px;">NPP. ........................................</div>
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
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma = config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) || false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');

    const roomStudentMap = this.resolveRoomStudents(scheduleData, options);
    const rooms = Object.keys(roomStudentMap);

    const selectedRoom = options?.roomFilter;
    const roomsToRender =
      selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => r.toLowerCase() === selectedRoom.toLowerCase())
        : rooms;

    const sections = roomsToRender.map((r, idx) => {
      const students = roomStudentMap[r] || [];
      const roomHtml = this.generateSingleRoomAttendanceRosterHtml(r, students, scheduleData, options);
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
        if (m.role === 'KETUA') jabatanLabel = 'Ketua';
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
    _options?: AdminDocOptions
  ): any {
    const branding = getDynamicBranding();
    const config = scheduleData.config;
    const isSma = config.selectedClasses?.some((c) => /10|11|12|sma|ipa|ips/i.test(c)) || false;
    const institutionName = branding.institutionName || (isSma ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL-ITTIHADIYAH');
    const academicYear = config.academicYear || '2025/2026';
    const semesterStr = config.semester ? config.semester.toUpperCase() : 'GENAP';

    let examTitle = config.examTitle || `ASESMEN SUMATIF TENGAH SEMESTER (${config.examType || 'ASTS'})`;
    if (!examTitle.toUpperCase().includes('GENAP') && !examTitle.toUpperCase().includes('GANJIL')) {
      examTitle = `${examTitle} ${semesterStr}`;
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

    const STYLE_TITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 13, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_SUBTITLE_HEADER = {
      font: { name: 'Times New Roman', sz: 12, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_TH = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
      fill: { fgColor: { rgb: 'FFFFFF' } },
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

    const STYLE_ROOM_BADGE = {
      font: { name: 'Times New Roman', sz: 16, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    };

    const STYLE_SIGN_TEXT = {
      font: { name: 'Times New Roman', sz: 10.5, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const STYLE_SIGN_NAME = {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, underline: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
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

    // Header Titles (Rows 0-3)
    mergeRange(0, 0, 4, 0, 'DAFTAR HADIR PESERTA', STYLE_TITLE_HEADER);
    rowHeights[0] = { hpt: 20 };
    mergeRange(0, 1, 4, 1, examTitle.toUpperCase(), STYLE_SUBTITLE_HEADER);
    rowHeights[1] = { hpt: 19 };
    mergeRange(0, 2, 4, 2, institutionName.toUpperCase(), STYLE_SUBTITLE_HEADER);
    rowHeights[2] = { hpt: 19 };
    mergeRange(0, 3, 4, 3, `Tahun Pelajaran ${academicYear}`, STYLE_SUBTITLE_HEADER);
    rowHeights[3] = { hpt: 19 };

    rowHeights[4] = { hpt: 10 }; // spacer

    // Room Label on Right (Column 3-4, Row 5)
    mergeRange(3, 5, 4, 5, roomBadge, STYLE_ROOM_BADGE);
    rowHeights[5] = { hpt: 22 };

    // Table Headers (Rows 6 & 7)
    mergeRange(0, 6, 1, 6, 'NOMOR', STYLE_TH);
    mergeRange(2, 6, 2, 7, 'NAMA PESERTA', STYLE_TH);
    mergeRange(3, 6, 3, 7, 'L/P', STYLE_TH);
    mergeRange(4, 6, 4, 7, 'KELAS', STYLE_TH);
    rowHeights[6] = { hpt: 18 };

    setCell(0, 7, 'URUT', STYLE_TH);
    setCell(1, 7, 'PESERTA', STYLE_TH);
    rowHeights[7] = { hpt: 18 };

    // Data rows (Row 8+)
    let currRow = 8;
    students.forEach((st) => {
      setCell(0, currRow, st.urut, STYLE_TD_CENTER);
      setCell(1, currRow, st.participantNumber, STYLE_TD_CENTER);
      setCell(2, currRow, st.fullName.toUpperCase(), STYLE_TD_LEFT);
      setCell(3, currRow, st.gender, STYLE_TD_CENTER);
      setCell(4, currRow, st.className, STYLE_TD_CENTER);
      rowHeights[currRow] = { hpt: 20 };
      currRow++;
    });

    // Proctor Signatory
    rowHeights[currRow] = { hpt: 16 }; currRow++;
    mergeRange(3, currRow, 4, currRow, 'Pengawas Ruang,', STYLE_SIGN_TEXT);
    rowHeights[currRow] = { hpt: 18 }; currRow++;
    rowHeights[currRow] = { hpt: 22 }; currRow++;
    rowHeights[currRow] = { hpt: 22 }; currRow++;
    mergeRange(3, currRow, 4, currRow, '( .................................................... )', STYLE_SIGN_NAME);
    rowHeights[currRow] = { hpt: 18 }; currRow++;
    mergeRange(3, currRow, 4, currRow, 'NPP. ........................................', STYLE_SIGN_TEXT);
    rowHeights[currRow] = { hpt: 18 };

    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 4, r: currRow } });
    ws['!cols'] = [
      { wch: 8 },  // URUT
      { wch: 18 }, // PESERTA
      { wch: 36 }, // NAMA PESERTA
      { wch: 8 },  // L/P
      { wch: 14 }, // KELAS
    ];
    ws['!rows'] = rowHeights;
    ws['!merges'] = merges;

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
        ? rooms.filter((r) => r.toLowerCase() === selectedRoom.toLowerCase())
        : rooms;

      roomsToExport.forEach((roomName) => {
        const students = roomStudentMap[roomName] || [];
        const ws = this.buildStudentAttendanceRosterWorksheet(roomName, students, scheduleData, options);
        const safeSheetName = roomName.replace(/[^\w]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Daftar_Hadir_Peserta_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'HANDOVER_DOCS') {
      // -------------------------------------------------------------
      // EXCEL: SERAH TERIMA NASKAH SOAL & LJK PER RUANGAN
      // -------------------------------------------------------------
      let rooms: string[] = [];
      if (scheduleData.proctorSchedules) {
        const rSet = new Set<string>();
        scheduleData.proctorSchedules.forEach((p) => {
          if (p.roomName) rSet.add(p.roomName);
        });
        rooms = Array.from(rSet);
      }
      if (rooms.length === 0) rooms = ['Ruang 01', 'Ruang 02', 'Ruang 03'];

      const selectedRoom = options?.roomFilter;
      const roomsToExport = selectedRoom && selectedRoom !== 'ALL'
        ? rooms.filter((r) => r.toLowerCase() === selectedRoom.toLowerCase())
        : rooms;

      roomsToExport.forEach((roomName) => {
        const ws = this.buildHandoverDocsWorksheet(roomName, scheduleData, options);
        const safeSheetName = roomName.replace(/[^\w]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Serah_Terima_Soal_LJK_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
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

      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran Peserta');
      const filename = fileNameOverride || `Rekap_Kehadiran_Siswa_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
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
        if (m.role === 'KETUA') jabatanLabel = 'Ketua';
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

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir Panitia');
      const filename = fileNameOverride || `Daftar_Hadir_Panitia_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  }
}
