/**
 * SMART ABSENSI GURU - ORAL EXAM EXPORT SERVICE (PDF & EXCEL)
 * Menghasilkan berkas cetak PDF resmi berstandar A4 dan file Excel (.xlsx)
 * berbasis 3 kriteria penilaian langsung (skala 0–100 & rata-rata otomatis predikat A/B/C/D).
 */

import * as XLSXModule from 'xlsx-js-style';
const XLSX: any = (XLSXModule as any).default || XLSXModule;
import { exportHtmlToPdf } from './pdf-export.lib';
import { resolveSchoolLevel } from '../utils/class.utils';
import { escapeHtml, formatNppHtmlLine, getLevelSchoolBranding } from '../utils/html.utils';
import {
  getEffectiveSubjectScope,
  getOralExamSessionTrack,
  resolveCriteriaLabels,
  type OralExamCriteriaScores,
  type OralExamGrade,
  type OralExamSession,
  type OralExamTrack,
} from '../types/oral-exam.types';
import {
  calculateCriteriaAverageAndPredicate,
  calculateDirectScorePredicate,
} from '../utils/oral-exam-scoring.utils';

interface SubjectExportData {
  c1: number | string;
  c2: number | string;
  c3: number | string;
  finalScore: number | string;
  predicate: string;
}

function resolveSubjectExportData(
  criteria: OralExamCriteriaScores | undefined,
  storedScore: number | null | undefined,
  storedPredicate: OralExamGrade | null | undefined,
  assessedFlag: boolean | undefined,
  allowLegacyZeroWithoutFlag: boolean
): SubjectExportData {
  const calc = calculateCriteriaAverageAndPredicate(criteria);
  if (calc.filledCount > 0) {
    return {
      c1: calc.scores[0] ?? '-',
      c2: calc.scores[1] ?? '-',
      c3: calc.scores[2] ?? '-',
      finalScore: calc.averageScore ?? '-',
      predicate: calc.predicate || '-',
    };
  }

  const hasLegacyScore =
    assessedFlag !== false &&
    typeof storedScore === 'number' &&
    !Number.isNaN(storedScore) &&
    (allowLegacyZeroWithoutFlag || assessedFlag === true || storedScore > 0);

  if (hasLegacyScore) {
    return {
      c1: '-',
      c2: '-',
      c3: '-',
      finalScore: storedScore as number,
      predicate: storedPredicate || calculateDirectScorePredicate(storedScore) || '-',
    };
  }

  return {
    c1: '-',
    c2: '-',
    c3: '-',
    finalScore: '-',
    predicate: '-',
  };
}

export class OralExamExportService {
  /**
   * Menghasilkan string HTML dokumen cetak A4 resmi untuk ujian lisan berbasis 3 kriteria
   */
  public static generatePrintHtml(session: OralExamSession): string {
    const isBahasa = session.templateType === 'BAHASA_INGGRIS_ARAB';
    const scope = getEffectiveSubjectScope(session);
    const criteriaLabels = resolveCriteriaLabels(session.criteriaLabels, getOralExamSessionTrack(session));
    const showEnglish = isBahasa && scope !== 'ARABIC_ONLY';
    const showArabic = isBahasa && scope !== 'ENGLISH_ONLY';
    const showBtq = !isBahasa && scope !== 'HAFALAN_ONLY';
    const showHafalan = !isBahasa && scope !== 'BTQ_ONLY';

    const level = resolveSchoolLevel(session.className);
    const levelBranding = getLevelSchoolBranding(level);
    const parsedDate = session.date ? new Date(`${session.date}T12:00:00+07:00`) : new Date();
    const dateFormatted = (isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const accentBorder = isBahasa ? '#1e40af' : '#0d9488';
    const accentBg = isBahasa ? '#eff6ff' : '#f0fdfa';
    const accentText = isBahasa ? '#1e3a8a' : '#115e59';

    // Kriteria Box HTML (3 Kriteria + Konversi Predikat Skala 0 - 100)
    const kriteriaHtml = `
      <div style="border: 1px solid ${accentBorder}; border-radius: 8px; padding: 10px 14px; background-color: ${accentBg}; margin-bottom: 14px; font-size: 11px;">
        <div style="margin-bottom: 6px; color: ${accentText};">
          <strong style="display: block; font-size: 11.5px; margin-bottom: 2px;">KRITERIA PENILAIAN UJIAN LISAN (3 KRITERIA • SKALA 0 – 100):</strong>
          <span style="font-size: 10.5px; font-weight: 600;">
            1. ${escapeHtml(criteriaLabels[0])} &nbsp;|&nbsp; 2. ${escapeHtml(criteriaLabels[1])} &nbsp;|&nbsp; 3. ${escapeHtml(criteriaLabels[2])} &nbsp;(Nilai Akhir = Rata-rata 3 Kriteria)
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
          <div style="background: #ffffff; border: 1px solid #86efac; padding: 4px 6px; border-radius: 4px; text-align: center;">
            <strong style="color: #166534;">A (91 – 100)</strong><br><span style="font-size: 10px; color: #4b5563;">Sangat Baik</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #93c5fd; padding: 4px 6px; border-radius: 4px; text-align: center;">
            <strong style="color: #1e40af;">B (81 – 90)</strong><br><span style="font-size: 10px; color: #4b5563;">Baik</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #fde047; padding: 4px 6px; border-radius: 4px; text-align: center;">
            <strong style="color: #854d0e;">C (61 – 80)</strong><br><span style="font-size: 10px; color: #4b5563;">Cukup</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #fca5a5; padding: 4px 6px; border-radius: 4px; text-align: center;">
            <strong style="color: #991b1b;">D (0 – 60)</strong><br><span style="font-size: 10px; color: #4b5563;">Perlu Bimbingan</span>
          </div>
        </div>
      </div>
    `;

    const buildMetricSubHeaders = () => `
      <th style="border: 1px solid #000; font-size: 9px; padding: 4px 3px; min-width: 44px;">${escapeHtml(criteriaLabels[0])}</th>
      <th style="border: 1px solid #000; font-size: 9px; padding: 4px 3px; min-width: 44px;">${escapeHtml(criteriaLabels[1])}</th>
      <th style="border: 1px solid #000; font-size: 9px; padding: 4px 3px; min-width: 44px;">${escapeHtml(criteriaLabels[2])}</th>
      <th style="border: 1px solid #000; font-size: 9px; padding: 4px 3px; width: 38px; background: #f3f4f6;">Nilai Akhir</th>
      <th style="border: 1px solid #000; font-size: 9px; padding: 4px 3px; width: 32px; background: #f3f4f6;">Pred</th>
    `;

    const renderSubjectCells = (data: SubjectExportData) => `
      <td style="border: 1px solid #000; text-align: center; font-size: 10px;">${escapeHtml(String(data.c1))}</td>
      <td style="border: 1px solid #000; text-align: center; font-size: 10px;">${escapeHtml(String(data.c2))}</td>
      <td style="border: 1px solid #000; text-align: center; font-size: 10px;">${escapeHtml(String(data.c3))}</td>
      <td style="border: 1px solid #000; text-align: center; font-size: 10.5px; font-weight: bold; background: #f9fafb;">${escapeHtml(String(data.finalScore))}</td>
      <td style="border: 1px solid #000; text-align: center; font-size: 10.5px; font-weight: bold;">${escapeHtml(data.predicate)}</td>
    `;

    let rowsHtml = '';
    session.students.forEach((s, idx) => {
      const engData = resolveSubjectExportData(s.englishCriteria, s.englishScore, s.englishPredicate, s.englishAssessed, false);
      const araData = resolveSubjectExportData(s.arabicCriteria, s.arabicScore, s.arabicPredicate, s.arabicAssessed, false);
      const btqData = resolveSubjectExportData(s.btqCriteria, s.btqScore, s.btqPredicate, undefined, true);
      const hafData = resolveSubjectExportData(s.hafalanCriteria, s.hafalanScore, s.hafalanPredicate, undefined, true);

      rowsHtml += `
        <tr style="height: 24px;">
          <td style="border: 1px solid #000; text-align: center; font-size: 10px;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 3px 6px; font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${escapeHtml(s.studentName)}</td>
          ${showEnglish ? renderSubjectCells(engData) : ''}
          ${showArabic ? renderSubjectCells(araData) : ''}
          ${showBtq ? renderSubjectCells(btqData) : ''}
          ${showHafalan ? renderSubjectCells(hafData) : ''}
          <td style="border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; font-style: italic; color: #4b5563;">${escapeHtml(s.notes || '-')}</td>
        </tr>
      `;
    });

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10px; border: 1px solid #000;">
        <thead>
          <tr style="background-color: #f3f4f6; text-align: center;">
            <th rowspan="2" style="border: 1px solid #000; width: 26px; padding: 4px;">No</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; min-width: 140px;">Nama Peserta</th>
            ${showEnglish ? '<th colspan="5" style="border: 1px solid #000; padding: 4px; background: #eff6ff;">🇬🇧 BAHASA INGGRIS (3 KRITERIA)</th>' : ''}
            ${showArabic ? '<th colspan="5" style="border: 1px solid #000; padding: 4px; background: #f0fdf4;">🇸🇦 BAHASA ARAB (3 KRITERIA)</th>' : ''}
            ${showBtq ? '<th colspan="5" style="border: 1px solid #000; padding: 4px; background: #ecfdf5;">📖 BTQ (3 KRITERIA)</th>' : ''}
            ${showHafalan ? '<th colspan="5" style="border: 1px solid #000; padding: 4px; background: #eff6ff;">📖 HAFALAN (3 KRITERIA)</th>' : ''}
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; min-width: 90px;">Keterangan</th>
          </tr>
          <tr style="background-color: #f9fafb; text-align: center;">
            ${showEnglish ? buildMetricSubHeaders() : ''}
            ${showArabic ? buildMetricSubHeaders() : ''}
            ${showBtq ? buildMetricSubHeaders() : ''}
            ${showHafalan ? buildMetricSubHeaders() : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    const defaultDocTitle = isBahasa
      ? (showEnglish && showArabic
        ? 'DAFTAR PENILAIAN UJIAN LISAN BAHASA INGGRIS & BAHASA ARAB'
        : showEnglish
          ? 'DAFTAR PENILAIAN UJIAN LISAN BAHASA INGGRIS'
          : 'DAFTAR PENILAIAN UJIAN LISAN BAHASA ARAB')
      : (showBtq && showHafalan
        ? 'DAFTAR PENILAIAN BTQ DAN HAFALAN'
        : showBtq
          ? 'DAFTAR PENILAIAN UJIAN BTQ'
          : 'DAFTAR PENILAIAN UJIAN HAFALAN');

    const examinerNppHtml = formatNppHtmlLine(session.examinerNpp, {
      style: 'margin: 2px 0 0 0; font-size: 10px; color: #6b7280;',
    });

    return `
      <div style="font-family: Arial, sans-serif; padding: 24px 30px; color: #111827; background: #ffffff; line-height: 1.4;">
        <!-- KOP SURAT RESMI -->
        <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 14px;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(levelBranding.institutionName)}</h2>
          <p style="margin: 2px 0 0 0; font-size: 10.5px; color: #374151;">${escapeHtml(level === 'SMA' ? 'Bogor, Jawa Barat' : 'Jl. Raya Ciampea No. 12, Ciampea, Kab. Bogor, Jawa Barat 16620')}</p>
        </div>

        <!-- JUDUL DOKUMEN -->
        <div style="text-align: center; margin-bottom: 14px;">
          <h1 style="margin: 0; font-size: 15px; font-weight: 900; text-transform: uppercase; text-decoration: underline;">
            ${escapeHtml(session.title || defaultDocTitle)}
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #4b5563;">
            Tahun Ajaran ${escapeHtml(session.academicYear)} • Semester ${escapeHtml(session.semester)}
          </p>
        </div>

        <!-- METADATA PENGUJI & RUANG -->
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div>
            <span>Penguji : </span><strong style="color: #0f172a;">${escapeHtml(session.examinerName)}</strong>
          </div>
          <div style="display: flex; gap: 16px;">
            <span>Kelas : <strong>${escapeHtml(session.className)}</strong></span>
            ${session.roomNumber ? `<span>Ruang : <strong>${escapeHtml(session.roomNumber)}</strong></span>` : ''}
            <span>Tanggal : <strong>${escapeHtml(dateFormatted)}</strong></span>
          </div>
        </div>

        <!-- BOX KRITERIA -->
        ${kriteriaHtml}

        <!-- TABEL PENILAIAN SISWA -->
        <div style="margin-bottom: 24px;">
          ${tableHtml}
        </div>

        <!-- TANDA TANGAN PENGUJI -->
        <div style="display: flex; justify-content: flex-end; margin-top: 24px; page-break-inside: avoid;">
          <div style="text-align: center; width: 240px; font-size: 11px;">
            <p style="margin: 0 0 4px 0;">Bogor, ${escapeHtml(dateFormatted)}</p>
            <p style="margin: 0 0 60px 0; font-weight: 600;">Mengetahui,<br>Guru Penguji,</p>
            <p style="margin: 0; font-weight: 800; text-decoration: underline;">${escapeHtml(session.examinerName)}</p>
            ${examinerNppHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Mengunduh berkas PDF A4 siap cetak
   */
  public static async exportToPdf(session: OralExamSession): Promise<void> {
    const scope = getEffectiveSubjectScope(session);
    const html = this.generatePrintHtml(session);
    const filename = `Penilaian_Lisan_${session.className}_${session.templateType}_${scope}_${session.academicYear.replace('/', '-')}`;

    await exportHtmlToPdf(html, {
      filename,
      orientation: scope === 'BOTH' ? 'landscape' : 'portrait',
      format: 'a4',
      scale: 2,
    });
  }

  /**
   * Mengunduh rekap Excel (.xlsx) rapi dengan rincian 3 kriteria per mata uji
   */
  public static exportToExcel(session: OralExamSession): void {
    const isBahasa = session.templateType === 'BAHASA_INGGRIS_ARAB';
    const scope = getEffectiveSubjectScope(session);
    const criteriaLabels = resolveCriteriaLabels(session.criteriaLabels, getOralExamSessionTrack(session));
    const showEnglish = isBahasa && scope !== 'ARABIC_ONLY';
    const showArabic = isBahasa && scope !== 'ENGLISH_ONLY';
    const showBtq = !isBahasa && scope !== 'HAFALAN_ONLY';
    const showHafalan = !isBahasa && scope !== 'BTQ_ONLY';

    const level = resolveSchoolLevel(session.className);
    const levelBranding = getLevelSchoolBranding(level);
    const headerSchoolLine = level === 'SMA'
      ? `${levelBranding.institutionName} - BOGOR`
      : `${levelBranding.institutionName} CIAMPEA - BOGOR`;
    const wb = XLSX.utils.book_new();

    const makeSubjectHeaders = (prefix: string) => [
      `${prefix} - ${criteriaLabels[0]}`,
      `${prefix} - ${criteriaLabels[1]}`,
      `${prefix} - ${criteriaLabels[2]}`,
      `${prefix} - Nilai Akhir`,
      `${prefix} - Predikat`,
    ];

    const rows: any[] = [];
    rows.push([headerSchoolLine]);
    rows.push([session.title || (isBahasa ? 'DAFTAR PENILAIAN UJIAN LISAN BAHASA' : 'DAFTAR PENILAIAN BTQ DAN HAFALAN')]);
    rows.push([`Tahun Ajaran: ${session.academicYear}`, `Semester: ${session.semester}`, `Kelas: ${session.className}`, `Ruang: ${session.roomNumber || '-'}`]);
    rows.push([`Penguji: ${session.examinerName}`, `Tanggal: ${session.date}`]);
    rows.push([`3 Kriteria: 1) ${criteriaLabels[0]}, 2) ${criteriaLabels[1]}, 3) ${criteriaLabels[2]}`]);
    rows.push([]);

    rows.push([
      'No',
      'Nama Siswa',
      'NISN',
      'Kelas',
      ...(showEnglish ? makeSubjectHeaders('B.Inggris') : []),
      ...(showArabic ? makeSubjectHeaders('B.Arab') : []),
      ...(showBtq ? makeSubjectHeaders('BTQ') : []),
      ...(showHafalan ? makeSubjectHeaders('Hafalan') : []),
      'Keterangan',
    ]);

    const toSubjectRowSlice = (data: SubjectExportData) => [
      data.c1,
      data.c2,
      data.c3,
      data.finalScore,
      data.predicate,
    ];

    session.students.forEach((s, idx) => {
      const engData = resolveSubjectExportData(s.englishCriteria, s.englishScore, s.englishPredicate, s.englishAssessed, false);
      const araData = resolveSubjectExportData(s.arabicCriteria, s.arabicScore, s.arabicPredicate, s.arabicAssessed, false);
      const btqData = resolveSubjectExportData(s.btqCriteria, s.btqScore, s.btqPredicate, undefined, true);
      const hafData = resolveSubjectExportData(s.hafalanCriteria, s.hafalanScore, s.hafalanPredicate, undefined, true);

      rows.push([
        idx + 1,
        s.studentName,
        s.nisn || '-',
        s.className || session.className,
        ...(showEnglish ? toSubjectRowSlice(engData) : []),
        ...(showArabic ? toSubjectRowSlice(araData) : []),
        ...(showBtq ? toSubjectRowSlice(btqData) : []),
        ...(showHafalan ? toSubjectRowSlice(hafData) : []),
        s.notes || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Penilaian_Lisan');

    const cleanFilename = `Rekap_Ujian_Lisan_${session.className}_${session.templateType}_${scope}_${session.academicYear.replace('/', '-')}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  }

  /**
   * Mengunduh rekap Excel gabungan lintas semua penguji & ruang untuk 1 jalur (BAHASA atau BTQ)
   */
  public static exportAllTrackSessionsToExcel(
    sessions: OralExamSession[],
    track: OralExamTrack,
    academicYear?: string
  ): void {
    const filtered = sessions.filter((s) => getOralExamSessionTrack(s) === track);
    const isBahasa = track === 'BAHASA';
    const criteriaLabels = resolveCriteriaLabels(filtered[0]?.criteriaLabels, track);
    const yearLabel = academicYear || filtered[0]?.academicYear || '2026/2027';

    const wb = XLSX.utils.book_new();
    const makeSubHeaders = (prefix: string) => [
      `${prefix} - ${criteriaLabels[0]}`,
      `${prefix} - ${criteriaLabels[1]}`,
      `${prefix} - ${criteriaLabels[2]}`,
      `${prefix} - Nilai Akhir`,
      `${prefix} - Predikat`,
    ];

    const rows: any[] = [
      ['REKAPITULASI GABUNGAN HASIL UJIAN LISAN - SEMUA RUANG & PENGUJI'],
      [isBahasa ? 'Kategori: Ujian Bahasa (Bahasa Inggris & Arab)' : 'Kategori: Ujian Mengaji BTQ & Hafalan', `Tahun Ajaran: ${yearLabel}`, `Jumlah Sesi: ${filtered.length}`],
      [`3 Kriteria Utama: 1) ${criteriaLabels[0]}, 2) ${criteriaLabels[1]}, 3) ${criteriaLabels[2]}`],
      [],
      [
        'No',
        'Ruang',
        'Penguji',
        'Kelas',
        'Nama Siswa',
        ...(isBahasa ? [...makeSubHeaders('B.Inggris'), ...makeSubHeaders('B.Arab')] : [...makeSubHeaders('BTQ'), ...makeSubHeaders('Hafalan')]),
        'Keterangan',
      ],
    ];

    let rowNum = 1;
    const toSlice = (data: SubjectExportData) => [
      data.c1,
      data.c2,
      data.c3,
      data.finalScore,
      data.predicate,
    ];

    filtered.forEach((sess) => {
      sess.students.forEach((s) => {
        const firstData = isBahasa
          ? resolveSubjectExportData(s.englishCriteria, s.englishScore, s.englishPredicate, s.englishAssessed, false)
          : resolveSubjectExportData(s.btqCriteria, s.btqScore, s.btqPredicate, undefined, true);
        const secondData = isBahasa
          ? resolveSubjectExportData(s.arabicCriteria, s.arabicScore, s.arabicPredicate, s.arabicAssessed, false)
          : resolveSubjectExportData(s.hafalanCriteria, s.hafalanScore, s.hafalanPredicate, undefined, true);

        rows.push([
          rowNum++,
          sess.roomNumber || '-',
          sess.examinerName,
          s.className || sess.className,
          s.studentName,
          ...toSlice(firstData),
          ...toSlice(secondData),
          s.notes || '',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, isBahasa ? 'Rekap_Bahasa' : 'Rekap_BTQ');
    const cleanFilename = `Rekap_Semua_Penguji_${track}_${yearLabel.replace('/', '-')}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  }
}
