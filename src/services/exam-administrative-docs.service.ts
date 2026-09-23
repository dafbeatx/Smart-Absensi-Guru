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

import * as XLSX from 'xlsx';
import type {
  ExamScheduleData,
  ExamCommitteeMember,
} from '../types/exam-schedule.types';
import type { ExamInvigilationMatrix } from './exam-matrix-builder.service';
import { SIGNATORY_OFFICIALS, getDynamicBranding } from '../lib/excel-generator.lib';

export type AdminDocType =
  | 'PROCTOR_ATTENDANCE'
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
      .badge-room {
        border: 2px solid #5b9bd5;
        background-color: #d9e1f2;
        color: #c00000;
        font-weight: bold;
        font-size: 14pt;
        padding: 4px 20px;
        letter-spacing: 1px;
        text-align: center;
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
      .footer-signatory {
        width: 100%;
        margin-top: 24px;
        display: flex;
        justify-content: flex-end;
        page-break-inside: avoid;
      }
      .footer-sign-box {
        width: 250px;
        text-align: left;
        font-size: 10.5pt;
      }
      .footer-sign-space {
        height: 60px;
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

          <div class="footer-signatory">
            <div class="footer-sign-box">
              <div>${city},   ${signDate}</div>
              <div>Ketua Penyelenggara,</div>
              <div class="footer-sign-space"></div>
              <div class="footer-sign-name">${committeeHead}</div>
            </div>
          </div>
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

        <div class="badge-room-container">
          <div class="badge-room">${badgeText}</div>
        </div>

        <div class="table-banner">Daftar Pengambilan Naskah Soal ${config.examType || 'ASTS'}</div>
        <table class="doc-table">
          <thead>
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

        <div class="table-banner">Daftar Penyerahan Lembar Jawaban ${config.examType || 'ASTS'}</div>
        <table class="doc-table">
          <thead>
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

        <div class="footer-signatory">
          <div class="footer-sign-box">
            <div>${city},   ${signDate}</div>
            <div>Ketua Penyelenggara,</div>
            <div class="footer-sign-space"></div>
            <div class="footer-sign-name">${committeeHead}</div>
          </div>
        </div>
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
        ${!isLast ? '<div class="page-break"></div>' : ''}
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

          <div class="footer-signatory">
            <div class="footer-sign-box">
              <div>${city},   ${signDate}</div>
              <div>Ketua Penyelenggara,</div>
              <div class="footer-sign-space"></div>
              <div class="footer-sign-name">${committeeHead}</div>
            </div>
          </div>
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

          <div class="footer-signatory">
            <div class="footer-sign-box">
              <div>${city},   ${signDate}</div>
              <div>Ketua Penyelenggara,</div>
              <div class="footer-sign-space"></div>
              <div class="footer-sign-name">${committeeHead}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // =========================================================================
  // EXPORT METHODS: PRINT (A4 / PDF), WORD (.DOC), AND EXCEL (.XLSX)
  // =========================================================================

  /**
   * Opens isolated print window for standard A4 paper format
   */
  public static printHtmlDocument(htmlContent: string, title?: string): void {
    if (typeof window === 'undefined') return;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (!printWindow) {
      alert('Jendela pop-up cetak diblokir oleh browser. Izinkan pop-up untuk mencetak dokumen administrasi.');
      return;
    }

    printWindow.onload = () => {
      if (title) printWindow.document.title = title;
      printWindow.focus();
      printWindow.print();
    };
  }

  /**
   * Generates editable Microsoft Word (.doc) file and triggers download
   */
  public static exportToWord(
    htmlContent: string,
    fileName: string,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): void {
    const isLandscape = orientation === 'landscape';
    const wordXmlHtml = `
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
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: ${isLandscape ? '10.5pt' : '11pt'};
            color: #000000;
          }
          table { border-collapse: collapse; width: 100%; }
          table, th, td { border: 1pt solid #000000; }
          th { background-color: #8eaadb; font-weight: bold; text-align: center; }
          td { padding: 4px 6px; }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

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

    if (docType === 'PROCTOR_ATTENDANCE') {
      // -------------------------------------------------------------
      // EXCEL: DAFTAR HADIR PENGAWAS
      // -------------------------------------------------------------
      const headerRows: (string | number)[][] = [
        ['DAFTAR HADIR PENGAWAS'],
        [(config.examTitle || config.examType || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)').toUpperCase()],
        [institutionName.toUpperCase()],
        [`TAHUN PELAJARAN ${academicYear}`],
        [''],
      ];

      const rowHeader1: (string | number)[] = ['NO', 'NAMA', 'JABATAN', 'HARI / TANGGAL'];
      for (let i = 1; i < examDays.length; i++) {
        rowHeader1.push('');
      }

      const rowHeader2: (string | number)[] = ['', '', ''];
      examDays.forEach((d) => {
        rowHeader2.push(`${d.dayName.toUpperCase()}\n${d.dateFormattedDmy}`);
      });

      const bodyRows: (string | number)[][] = [];
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

      proctors.forEach((pName, idx) => {
        const row: (string | number)[] = [idx + 1, pName, 'Pengawas'];
        examDays.forEach(() => row.push('')); // Blank signature spaces
        bodyRows.push(row);
      });

      const footerRows: (string | number)[][] = [
        [''],
        ['', '', '', '', '', `${city},   ${signDate}`],
        ['', '', '', '', '', 'Ketua Penyelenggara,'],
        [''],
        [''],
        ['', '', '', '', '', committeeHead],
      ];

      const allRows = [...headerRows, rowHeader1, rowHeader2, ...bodyRows, ...footerRows];
      const ws = XLSX.utils.aoa_to_sheet(allRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 14 },
        ...examDays.map(() => ({ wch: 16 })),
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir Pengawas');
      const filename = fileNameOverride || `Daftar_Hadir_Pengawas_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
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
        const roomHeaderRows: (string | number)[][] = [
          ['DAFTAR SERAH TERIMA NASKAH SOAL DAN LEMBAR JAWABAN'],
          [(config.examTitle || config.examType || 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)').toUpperCase()],
          [institutionName.toUpperCase()],
          [`TAHUN PELAJARAN ${academicYear}`],
          ['', '', '', '', '', roomName.toUpperCase()],
          [''],
          [`Daftar Pengambilan Naskah Soal ${config.examType || 'ASTS'}`],
          ['No.', 'Hari,Tanggal', 'Mata Pelajaran', 'No.Kode', 'Nama Pengawas', 'Tanda Tangan'],
        ];

        const roomDuties = (scheduleData.proctorSchedules || []).filter(
          (p) => (p.roomName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === roomName.toLowerCase().replace(/[^a-z0-9]/g, '')
        );

        const table1Rows: (string | number)[][] = [];
        examDays.forEach((day, dIdx) => {
          const dutiesThisDay = roomDuties.filter((d) => d.date === day.date);
          const subjStr = dutiesThisDay.map((d, i) => `${i + 1}. ${d.subject}`).join('\n') || '-';
          const codeStr = dutiesThisDay.map((_, i) => `${i + 1}.`).join('\n') || '1.';
          const proctorStr = dutiesThisDay.map((_, i) => `${i + 1}.`).join('\n') || '1.';
          const sigStr = dutiesThisDay.map((_, i) => `${i + 1}.`).join('\n') || '1.';

          table1Rows.push([
            dIdx + 1,
            day.dateFormattedLong,
            subjStr,
            codeStr,
            proctorStr,
            sigStr,
          ]);
        });

        const table2HeaderRows: (string | number)[][] = [
          [''],
          [`Daftar Penyerahan Lembar Jawaban ${config.examType || 'ASTS'}`],
          ['No.', 'Hari,Tanggal', 'Mata Pelajaran', 'No.Kode', 'Nama Pengawas', 'Tanda Tangan'],
        ];

        const footerRows: (string | number)[][] = [
          [''],
          ['', '', '', '', `${city},   ${signDate}`],
          ['', '', '', '', 'Ketua Penyelenggara,'],
          [''],
          [''],
          ['', '', '', '', committeeHead],
        ];

        const allSheetRows = [
          ...roomHeaderRows,
          ...table1Rows,
          ...table2HeaderRows,
          ...table1Rows,
          ...footerRows,
        ];

        const ws = XLSX.utils.aoa_to_sheet(allSheetRows);
        ws['!cols'] = [
          { wch: 6 },
          { wch: 26 },
          { wch: 30 },
          { wch: 10 },
          { wch: 28 },
          { wch: 18 },
        ];

        const safeSheetName = roomName.replace(/[^\w]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const filename = fileNameOverride || `Serah_Terima_Soal_LJK_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'STUDENT_ATTENDANCE_SUMMARY') {
      // -------------------------------------------------------------
      // EXCEL: REKAPITULASI KEHADIRAN PESERTA UJIAN
      // -------------------------------------------------------------
      const headerRows: (string | number)[][] = [
        [institutionName.toUpperCase()],
        [`TAHUN PELAJARAN ${academicYear}`],
        [`BERITA ACARA REKAPITULASI KEHADIRAN PESERTA ${config.examType || 'ASTS'}`],
        [''],
        ['No', 'Mata Pelajaran', 'Jumlah Seharusnya', 'Jumlah yang Hadir', 'Jumlah yang Tidak Hadir', 'Keterangan'],
      ];

      const subjectList: string[] = [];
      if (scheduleData.subjectSchedules) {
        scheduleData.subjectSchedules.forEach((s) => {
          if (s.subject && !subjectList.includes(s.subject)) subjectList.push(s.subject);
        });
      }
      if (subjectList.length === 0) {
        subjectList.push('PAI & PB', 'IPA', 'Matematika', 'Bahasa Arab', 'Bahasa Indonesia', 'IPS', 'Bahasa Inggris');
      }

      const bodyRows = subjectList.map((subj, idx) => [
        idx + 1,
        subj,
        typeof options?.totalRegisteredStudents === 'number' ? options.totalRegisteredStudents : '',
        '',
        '',
        '',
      ]);

      const footerRows: (string | number)[][] = [
        [''],
        ['', '', '', '', `${city},   ${signDate}`],
        ['', '', '', '', 'Ketua Penyelenggara,'],
        [''],
        [''],
        ['', '', '', '', committeeHead],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...bodyRows, ...footerRows]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 20 },
        { wch: 20 },
        { wch: 22 },
        { wch: 24 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran Peserta');
      const filename = fileNameOverride || `Rekap_Kehadiran_Siswa_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);

    } else if (docType === 'COMMITTEE_ATTENDANCE') {
      // -------------------------------------------------------------
      // EXCEL: DAFTAR HADIR PANITIA UJIAN
      // -------------------------------------------------------------
      const headerRows: (string | number)[][] = [
        ['DAFTAR HADIR PANITIA'],
        [(config.examTitle || config.examType || 'ASESMEN SUMATIF AKHIR JENJANG (ASAJ)').toUpperCase()],
        [institutionName.toUpperCase()],
        [`TAHUN PELAJARAN ${academicYear}`],
        [''],
      ];

      const rowHeader1: (string | number)[] = ['NO', 'NAMA', 'JABATAN', 'HARI / TANGGAL'];
      for (let i = 1; i < examDays.length; i++) {
        rowHeader1.push('');
      }

      const rowHeader2: (string | number)[] = ['', '', ''];
      examDays.forEach((d) => {
        rowHeader2.push(`${d.dayName.toUpperCase()}\n${d.dateFormattedDmy}`);
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

      const bodyRows: (string | number)[][] = items.map((item, idx) => {
        const row: (string | number)[] = [idx + 1, item.name, item.jabatan];
        examDays.forEach(() => row.push('')); // Blank signature spaces
        return row;
      });

      const footerRows: (string | number)[][] = [
        [''],
        ['', '', '', '', `${city},   ${signDate}`],
        ['', '', '', '', 'Ketua Penyelenggara,'],
        [''],
        [''],
        ['', '', '', '', committeeHead],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...headerRows, rowHeader1, rowHeader2, ...bodyRows, ...footerRows]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 22 },
        ...examDays.map(() => ({ wch: 16 })),
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir Panitia');
      const filename = fileNameOverride || `Daftar_Hadir_Panitia_${config.examType || 'ASTS'}_${academicYear.replace('/', '-')}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  }
}
