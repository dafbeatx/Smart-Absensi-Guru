/**
 * SMART ABSENSI GURU - ORAL EXAM EXPORT SERVICE (PDF & EXCEL)
 * Menghasilkan berkas cetak PDF resmi berstandar A4 dan file Excel (.xlsx)
 * berdasarkan format fisik sekolah SMP Terpadu Al-Ittihadiyah Ciampea - Bogor.
 */

import * as XLSXModule from 'xlsx-js-style';
const XLSX: any = (XLSXModule as any).default || XLSXModule;
import { exportHtmlToPdf } from './pdf-export.lib';
import type { OralExamSession } from '../types/oral-exam.types';

export class OralExamExportService {
  /**
   * Menghasilkan string HTML dokumen cetak A4 resmi untuk ujian lisan
   */
  public static generatePrintHtml(session: OralExamSession): string {
    const isChecklist = session.templateType === 'BAHASA_INGGRIS_ARAB';
    const dateFormatted = new Date(session.date || new Date()).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Kriteria Box HTML
    const kriteriaHtml = isChecklist
      ? `
        <div style="border: 1px solid #15803d; border-radius: 8px; padding: 10px 14px; background-color: #f0fdf4; margin-bottom: 14px; font-size: 11px;">
          <strong style="color: #14532d; display: block; margin-bottom: 4px; font-size: 11.5px;">KRITERIA PENILAIAN (DARI 15 BUTIR SOAL):</strong>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
            <div style="background: #ffffff; border: 1px solid #86efac; padding: 4px 6px; border-radius: 4px; text-align: center;">
              <strong style="color: #166534;">A (14 – 15 Benar)</strong><br><span style="font-size: 10px; color: #4b5563;">Sangat Baik</span>
            </div>
            <div style="background: #ffffff; border: 1px solid #93c5fd; padding: 4px 6px; border-radius: 4px; text-align: center;">
              <strong style="color: #1e40af;">B (11 – 13 Benar)</strong><br><span style="font-size: 10px; color: #4b5563;">Baik</span>
            </div>
            <div style="background: #ffffff; border: 1px solid #fde047; padding: 4px 6px; border-radius: 4px; text-align: center;">
              <strong style="color: #854d0e;">C (6 – 10 Benar)</strong><br><span style="font-size: 10px; color: #4b5563;">Cukup (Min 6 Benar)</span>
            </div>
            <div style="background: #ffffff; border: 1px solid #fca5a5; padding: 4px 6px; border-radius: 4px; text-align: center;">
              <strong style="color: #991b1b;">D (0 – 5 Benar)</strong><br><span style="font-size: 10px; color: #4b5563;">Perlu Bimbingan</span>
            </div>
          </div>
        </div>
      `
      : `
        <div style="border: 1px solid #0d9488; border-radius: 8px; padding: 10px 14px; background-color: #f0fdfa; margin-bottom: 14px; font-size: 11px;">
          <strong style="color: #115e59; display: block; margin-bottom: 4px; font-size: 11.5px;">KRITERIA PENILAIAN (SKALA 0 – 100):</strong>
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

    // Table Header & Rows
    let tableHtml = '';
    if (isChecklist) {
      // Model Checklist: Bahasa Inggris & Bahasa Arab
      let rowsHtml = '';
      session.students.forEach((s, idx) => {
        const engChecks = (s.englishChecklist || new Array(15).fill(false))
          .map((c) => `<td style="border: 1px solid #000; text-align: center; font-size: 10px; width: 14px;">${c ? '✓' : ''}</td>`)
          .join('');
        const arabChecks = (s.arabicChecklist || new Array(15).fill(false))
          .map((c) => `<td style="border: 1px solid #000; text-align: center; font-size: 10px; width: 14px;">${c ? '✓' : ''}</td>`)
          .join('');

        rowsHtml += `
          <tr style="height: 22px;">
            <td style="border: 1px solid #000; text-align: center; font-size: 10px;">${idx + 1}</td>
            <td style="border: 1px solid #000; padding: 2px 6px; font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${s.studentName}</td>
            ${engChecks}
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold; background: #f9fafb;">${s.englishCorrectCount ?? 0}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold; background: #f9fafb;">${s.englishScore ?? '-'}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold;">${s.englishPredicate || '-'}</td>
            ${arabChecks}
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold; background: #f9fafb;">${s.arabicCorrectCount ?? 0}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold; background: #f9fafb;">${s.arabicScore ?? '-'}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 10px; font-weight: bold;">${s.arabicPredicate || '-'}</td>
          </tr>
        `;
      });

      const qHeaders = Array.from({ length: 15 }, (_, i) => `<th style="border: 1px solid #000; font-size: 8.5px; width: 14px; text-align: center; padding: 2px 0;">${i + 1}</th>`).join('');

      tableHtml = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10px; border: 1px solid #000;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: center;">
              <th rowspan="2" style="border: 1px solid #000; width: 24px; padding: 4px;">No</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px; min-width: 120px;">Nama Peserta</th>
              <th colspan="18" style="border: 1px solid #000; padding: 2px; background: #eff6ff;">🇬🇧 BAHASA INGGRIS</th>
              <th colspan="18" style="border: 1px solid #000; padding: 2px; background: #f0fdf4;">🇸🇦 BAHASA ARAB</th>
            </tr>
            <tr style="background-color: #f9fafb; text-align: center;">
              ${qHeaders}
              <th style="border: 1px solid #000; font-size: 9px; width: 22px; padding: 2px;">Jml</th>
              <th style="border: 1px solid #000; font-size: 9px; width: 26px; padding: 2px;">Nilai</th>
              <th style="border: 1px solid #000; font-size: 9px; width: 20px; padding: 2px;">Pred</th>
              ${qHeaders}
              <th style="border: 1px solid #000; font-size: 9px; width: 22px; padding: 2px;">Jml</th>
              <th style="border: 1px solid #000; font-size: 9px; width: 26px; padding: 2px;">Nilai</th>
              <th style="border: 1px solid #000; font-size: 9px; width: 20px; padding: 2px;">Pred</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } else {
      // Model Direct: BTQ & Hafalan
      let rowsHtml = '';
      session.students.forEach((s, idx) => {
        rowsHtml += `
          <tr style="height: 24px;">
            <td style="border: 1px solid #000; text-align: center; font-size: 11px;">${idx + 1}</td>
            <td style="border: 1px solid #000; padding: 4px 8px; font-size: 11px; font-weight: 600;">${s.studentName}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold;">${s.btqScore ?? '-'}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold;">${s.btqPredicate ?? '-'}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold;">${s.hafalanScore ?? '-'}</td>
            <td style="border: 1px solid #000; text-align: center; font-size: 11px; font-weight: bold;">${s.hafalanPredicate ?? '-'}</td>
            <td style="border: 1px solid #000; padding: 4px 8px; font-size: 10px; font-style: italic; color: #4b5563;">${s.notes || '-'}</td>
          </tr>
        `;
      });

      tableHtml = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; border: 1px solid #000;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: center;">
              <th rowspan="2" style="border: 1px solid #000; width: 32px; padding: 6px;">No</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 6px; min-width: 180px;">Nama Siswa</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px; background: #ecfdf5;">📖 BTQ</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px; background: #eff6ff;">📖 HAFALAN</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 140px;">Keterangan</th>
            </tr>
            <tr style="background-color: #f9fafb; text-align: center;">
              <th style="border: 1px solid #000; width: 60px; padding: 4px;">Nilai</th>
              <th style="border: 1px solid #000; width: 60px; padding: 4px;">Predikat</th>
              <th style="border: 1px solid #000; width: 60px; padding: 4px;">Nilai</th>
              <th style="border: 1px solid #000; width: 60px; padding: 4px;">Predikat</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    return `
      <div style="font-family: Arial, sans-serif; padding: 24px 30px; color: #111827; background: #ffffff; line-height: 1.4;">
        <!-- KOP SURAT RESMI -->
        <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 14px;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">SMP TERPADU AL-ITTIHADIYAH</h2>
          <p style="margin: 2px 0 0 0; font-size: 10.5px; color: #374151;">Jl. Raya Ciampea No. 12, Ciampea, Kab. Bogor, Jawa Barat 16620</p>
          <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #4b5563;">Email: info@smpterpadu-alittihadiyah.sch.id | Website: https://smart-absensi.sch.id</p>
        </div>

        <!-- JUDUL DOKUMEN -->
        <div style="text-align: center; margin-bottom: 14px;">
          <h1 style="margin: 0; font-size: 15px; font-weight: 900; text-transform: uppercase; text-decoration: underline;">
            ${session.title || (isChecklist ? 'DAFTAR PENILAIAN UJIAN LISAN BAHASA INGGRIS & BAHASA ARAB' : 'DAFTAR PENILAIAN BTQ DAN HAFALAN')}
          </h1>
          <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #4b5563;">
            Tahun Ajaran ${session.academicYear} • Semester ${session.semester}
          </p>
        </div>

        <!-- METADATA PENGUJI & RUANG -->
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; margin-bottom: 12px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div>
            <span>Penguji : </span><strong style="color: #0f172a;">${session.examinerName}</strong>
          </div>
          <div style="display: flex; gap: 16px;">
            <span>Kelas : <strong>${session.className}</strong></span>
            ${session.roomNumber ? `<span>Ruang : <strong>${session.roomNumber}</strong></span>` : ''}
            <span>Tanggal : <strong>${dateFormatted}</strong></span>
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
            <p style="margin: 0 0 4px 0;">Bogor, ${dateFormatted}</p>
            <p style="margin: 0 0 60px 0; font-weight: 600;">Mengetahui,<br>Guru Penguji,</p>
            <p style="margin: 0; font-weight: 800; text-decoration: underline;">${session.examinerName}</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">NPP. Penguji Ujian Lisan</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Mengunduh berkas PDF A4 siap cetak
   */
  public static async exportToPdf(session: OralExamSession): Promise<void> {
    const isChecklist = session.templateType === 'BAHASA_INGGRIS_ARAB';
    const html = this.generatePrintHtml(session);
    const filename = `Penilaian_Lisan_${session.className}_${session.templateType}_${session.academicYear.replace('/', '-')}`;

    await exportHtmlToPdf(html, {
      filename,
      orientation: isChecklist ? 'landscape' : 'portrait',
      format: 'a4',
      scale: 2,
    });
  }

  /**
   * Mengunduh rekap Excel (.xlsx) rapi
   */
  public static exportToExcel(session: OralExamSession): void {
    const isChecklist = session.templateType === 'BAHASA_INGGRIS_ARAB';
    const wb = XLSX.utils.book_new();

    let rows: any[] = [];

    if (isChecklist) {
      // Header Info
      rows.push(['SMP TERPADU AL-ITTIHADIYAH CIAMPEA - BOGOR']);
      rows.push(['DAFTAR PENILAIAN UJIAN LISAN BAHASA INGGRIS & BAHASA ARAB']);
      rows.push([`Tahun Ajaran: ${session.academicYear}`, `Semester: ${session.semester}`, `Kelas: ${session.className}`, `Ruang: ${session.roomNumber || '-'}`]);
      rows.push([`Penguji: ${session.examinerName}`, `Tanggal: ${session.date}`]);
      rows.push([]);

      // Column Headers
      const qColsEng = Array.from({ length: 15 }, (_, i) => `ENG_Q${i + 1}`);
      const qColsArab = Array.from({ length: 15 }, (_, i) => `ARB_Q${i + 1}`);

      rows.push([
        'No',
        'Nama Siswa',
        'NISN',
        'Kelas',
        ...qColsEng,
        'ENG_Benar',
        'ENG_Nilai',
        'ENG_Predikat',
        ...qColsArab,
        'ARB_Benar',
        'ARB_Nilai',
        'ARB_Predikat',
      ]);

      session.students.forEach((s, idx) => {
        const engChecks = (s.englishChecklist || new Array(15).fill(false)).map((v) => (v ? 1 : 0));
        const arabChecks = (s.arabicChecklist || new Array(15).fill(false)).map((v) => (v ? 1 : 0));

        rows.push([
          idx + 1,
          s.studentName,
          s.nisn || '-',
          s.className || session.className,
          ...engChecks,
          s.englishCorrectCount ?? 0,
          s.englishScore ?? 0,
          s.englishPredicate || 'D',
          ...arabChecks,
          s.arabicCorrectCount ?? 0,
          s.arabicScore ?? 0,
          s.arabicPredicate || 'D',
        ]);
      });
    } else {
      // BTQ & Hafalan
      rows.push(['SMP TERPADU AL-ITTIHADIYAH CIAMPEA - BOGOR']);
      rows.push(['DAFTAR PENILAIAN BTQ DAN HAFALAN']);
      rows.push([`Tahun Ajaran: ${session.academicYear}`, `Semester: ${session.semester}`, `Kelas: ${session.className}`]);
      rows.push([`Penguji: ${session.examinerName}`, `Tanggal: ${session.date}`]);
      rows.push([]);

      rows.push([
        'No',
        'Nama Siswa',
        'NISN',
        'Kelas',
        'BTQ_Nilai',
        'BTQ_Predikat',
        'Hafalan_Nilai',
        'Hafalan_Predikat',
        'Keterangan',
      ]);

      session.students.forEach((s, idx) => {
        rows.push([
          idx + 1,
          s.studentName,
          s.nisn || '-',
          s.className || session.className,
          s.btqScore ?? '-',
          s.btqPredicate ?? '-',
          s.hafalanScore ?? '-',
          s.hafalanPredicate ?? '-',
          s.notes || '',
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Penilaian_Lisan');

    const cleanFilename = `Rekap_Ujian_Lisan_${session.className}_${session.templateType}_${session.academicYear.replace('/', '-')}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
  }
}
