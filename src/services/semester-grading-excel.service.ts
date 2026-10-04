/**
 * SMART ABSENSI GURU — SEMESTER GRADING EXCEL SERVICE
 * 
 * Sinkronisasi format penilaian resmi sekolah: "FORMAT PENILAIAN ASTS & ASAS.xlsx"
 * Multi-Sheet Structure:
 * - IDENTITAS SEKOLAH
 * - FORMAT PENILAIAN (Bobot 50%:50%, KKM 75, Predikat A-D)
 * - 7, 8A, 8B, 9A, 9B, SMA (Daftar siswa & formula Nilai Akhir, Predikat, Rekap)
 */

import * as XLSX from 'xlsx';
import * as fflate from 'fflate';
import { logger } from '../utils/logger.utils';
import type { ExamSessionRecord, GradedStudentScoreRecord } from '../types/database.types';
import { ExamCorrectionRepository } from '../repositories/ExamCorrectionRepository';

export interface StudentScoreEntry {
  name: string;
  asts?: number | null;
  asas?: number | null;
  gender?: 'L' | 'P';
}

export type GradingTargetColumn = 'ASTS' | 'ASAS' | 'BOTH' | 'NONE';

export interface ExportOfficialAssessmentOptions {
  subject: string;
  teacher: string;
  academicYear?: string;
  semester?: string;
  kkm?: number;
  className?: string; // '7' | '8A' | '8B' | '9A' | '9B' | 'SMA' | 'ALL'
  scoresByClass?: Record<string, StudentScoreEntry[]>;
  session?: ExamSessionRecord;
  gradedStudents?: GradedStudentScoreRecord[];
  targetColumn?: GradingTargetColumn;
  includeRecapSheet?: boolean;
}

export interface ParsedStudentRow {
  no: number;
  name: string;
  gender: string;
  asts: number | null;
  asas: number | null;
  finalScore: number | null;
  predicate: string;
  status: string;
}

export interface ParsedClassSheetResult {
  className: string;
  schoolName: string;
  subject: string;
  teacher: string;
  academicYear: string;
  semester: string;
  kkm: number;
  students: ParsedStudentRow[];
}

export interface ExcelValidationError {
  row: number;
  studentName: string;
  field: string;
  value: any;
  reason: string;
}

export interface PreparedBatchImport {
  isValid: boolean;
  errors: ExcelValidationError[];
  items: Array<{
    session_id: string;
    student_user_id: string;
    name: string;
    final_score: number;
    mcq_score: number;
    essay_score: number;
    mcq_answers: Record<string, string>;
    essay_scores: number[];
    correct: number;
    wrong: number;
    csi: number;
    lps: number;
    source: string;
  }>;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
  };
}

export class SemesterGradingExcelService {
  public static TEMPLATE_PATH = '/templates/FORMAT_PENILAIAN_ASTS_ASAS.xlsx';
  public static CANONICAL_CLASSES = ['7', '8A', '8B', '9A', '9B', 'SMA'] as const;

  /**
   * Unduh langsung template blanko resmi Excel sekolah.
   */
  public static async downloadCleanTemplate(customFileName?: string): Promise<void> {
    try {
      const resp = await fetch(this.TEMPLATE_PATH);
      if (!resp.ok) {
        throw new Error(`Gagal memuat template: ${resp.statusText}`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = customFileName || 'FORMAT_PENILAIAN_ASTS_&_ASAS_RESMI.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      logger.info('SemesterGradingExcelService', 'Blank template downloaded successfully');
    } catch (err: any) {
      logger.error('SemesterGradingExcelService', 'Failed to download clean template:', err);
      throw err;
    }
  }

  /**
   * Mengambil master binary buffer template dari path publik.
   */
  private static async loadTemplateBuffer(): Promise<Uint8Array> {
    try {
      const resp = await fetch(this.TEMPLATE_PATH);
      if (!resp.ok) {
        throw new Error(`Status ${resp.status} saat fetch ${this.TEMPLATE_PATH}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (fetchErr) {
      logger.warn('SemesterGradingExcelService', 'Browser fetch failed, trying local node buffer if available', fetchErr);
      if (typeof window === 'undefined') {
        try {
          const dynamicImport = new Function('m', 'return import(m)');
          const fs = await dynamicImport('fs');
          const buf = fs.readFileSync('public/templates/FORMAT_PENILAIAN_ASTS_ASAS.xlsx');
          return new Uint8Array(buf);
        } catch (nodeErr) {
          logger.error('SemesterGradingExcelService', 'Node fallback buffer failed:', nodeErr);
        }
      }
      throw fetchErr;
    }
  }

  /**
   * Helper sanitasi string XML untuk keamanan injeksi tag OpenXML.
   */
  private static escapeXml(str: any): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Ekspor berkas Excel format resmi sekolah yang 100% mempertahankan seluruh border,
   * warna header tabel, formula native Excel, grafik/chart, dan formatting sel dari template master.
   */
  public static async exportStyledOfficialFormatExcel(options: ExportOfficialAssessmentOptions): Promise<void> {
    const {
      subject,
      teacher,
      academicYear = '2026/2027',
      semester = 'Ganjil',
      kkm = 75,
      className,
      scoresByClass,
      session,
      gradedStudents,
      targetColumn = 'NONE',
    } = options;

    const templateBytes = await this.loadTemplateBuffer();
    const files = fflate.unzipSync(templateBytes);

    const effectiveSubject = subject || session?.subject || 'Mata Pelajaran';
    const effectiveTeacher = teacher || session?.teacher || 'Guru Pengampu';
    const effectiveKkm = Number(kkm) || Number(session?.kkm) || 75;

    // 1. Update sheet1.xml (IDENTITAS SEKOLAH)
    if (files['xl/worksheets/sheet1.xml']) {
      let s1 = new TextDecoder().decode(files['xl/worksheets/sheet1.xml']);
      s1 = s1.replace(
        /(<c\s+[^>]*r="B8"[^>]*>).*?(<\/c>)|(<c\s+[^>]*r="B8"[^>]*\/>)/,
        `<c r="B8" s="50" t="inlineStr"><is><t>${this.escapeXml(academicYear)}</t></is></c>`
      );
      s1 = s1.replace(
        /(<c\s+[^>]*r="B9"[^>]*>).*?(<\/c>)|(<c\s+[^>]*r="B9"[^>]*\/>)/,
        `<c r="B9" s="50" t="inlineStr"><is><t>${this.escapeXml(semester)}</t></is></c>`
      );
      s1 = s1.replace(
        /(<c\s+[^>]*r="B10"[^>]*>).*?(<\/c>)|(<c\s+[^>]*r="B10"[^>]*\/>)/,
        `<c r="B10" s="50" t="inlineStr"><is><t>${this.escapeXml(effectiveTeacher)}</t></is></c>`
      );
      s1 = s1.replace(
        /(<c\s+[^>]*r="B11"[^>]*>).*?(<\/c>)|(<c\s+[^>]*r="B11"[^>]*\/>)/,
        `<c r="B11" s="50" t="inlineStr"><is><t>${this.escapeXml(effectiveSubject)}</t></is></c>`
      );
      files['xl/worksheets/sheet1.xml'] = new TextEncoder().encode(s1);
    }

    // 2. Update sheet2.xml (FORMAT PENILAIAN)
    if (files['xl/worksheets/sheet2.xml']) {
      let s2 = new TextDecoder().decode(files['xl/worksheets/sheet2.xml']);
      s2 = s2.replace(
        /(<c\s+[^>]*r="B5"[^>]*>).*?(<\/c>)|(<c\s+[^>]*r="B5"[^>]*\/>)/,
        `<c r="B5" s="53"><v>${effectiveKkm}</v></c>`
      );
      files['xl/worksheets/sheet2.xml'] = new TextEncoder().encode(s2);
    }

    // 3. Kumpulkan data nilai siswa per kelas
    const classScoreMap: Record<string, Record<string, { asts?: number | null; asas?: number | null }>> = {};

    if (scoresByClass) {
      Object.entries(scoresByClass).forEach(([cls, list]) => {
        const normCls = this.normalizeSheetClassName(cls);
        if (!classScoreMap[normCls]) classScoreMap[normCls] = {};
        if (targetColumn === 'NONE') return;
        list.forEach((st) => {
          const normName = st.name.trim().toUpperCase();
          if (targetColumn === 'ASTS') {
            classScoreMap[normCls][normName] = { asts: st.asts ?? st.asas, asas: null };
          } else if (targetColumn === 'ASAS') {
            classScoreMap[normCls][normName] = { asts: null, asas: st.asas ?? st.asts };
          } else if (targetColumn === 'BOTH') {
            const sc = st.asts ?? st.asas;
            classScoreMap[normCls][normName] = { asts: sc, asas: sc };
          } else {
            classScoreMap[normCls][normName] = {
              asts: st.asts,
              asas: st.asas,
            };
          }
        });
      });
    }

    if (session && Array.isArray(gradedStudents) && gradedStudents.length > 0) {
      const normCls = this.normalizeSheetClassName(session.class_name);
      if (!classScoreMap[normCls]) classScoreMap[normCls] = {};

      const isNone = targetColumn === 'NONE';
      const isBoth = targetColumn === 'BOTH';
      const isAsas = targetColumn === 'ASAS'
        ? true
        : (targetColumn === 'ASTS' ? false : /ASAS|PAS|UAS|AKHIR/i.test(session.exam_type || ''));

      if (!isNone) {
        gradedStudents.forEach((st) => {
          const normName = st.name.trim().toUpperCase();
          const score = Number(st.final_score) || 0;
          if (!classScoreMap[normCls][normName]) {
            classScoreMap[normCls][normName] = {};
          }
          if (isBoth) {
            classScoreMap[normCls][normName].asts = score;
            classScoreMap[normCls][normName].asas = score;
          } else if (isAsas) {
            classScoreMap[normCls][normName].asas = score;
          } else {
            classScoreMap[normCls][normName].asts = score;
          }
        });
      }
    }

    // Extract shared strings untuk membaca nama siswa di tabel tiap kelas
    const ssXml = new TextDecoder().decode(files['xl/sharedStrings.xml'] || new Uint8Array());
    const sharedStrings = [...ssXml.matchAll(/<si>(.*?)<\/si>/gs)].map((si) => {
      const tMatches = [...si[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((m) => m[1]);
      return tMatches.join('');
    });

    const classSheets = [
      { name: '7', path: 'xl/worksheets/sheet3.xml', tabIndex: 2 },
      { name: '8A', path: 'xl/worksheets/sheet4.xml', tabIndex: 3 },
      { name: '8B', path: 'xl/worksheets/sheet5.xml', tabIndex: 4 },
      { name: '9A', path: 'xl/worksheets/sheet6.xml', tabIndex: 5 },
      { name: '9B', path: 'xl/worksheets/sheet7.xml', tabIndex: 6 },
      { name: 'SMA', path: 'xl/worksheets/sheet8.xml', tabIndex: 7 },
    ];

    classSheets.forEach(({ name: clsName, path: sheetPath }) => {
      if (!files[sheetPath]) return;
      let xml = new TextDecoder().decode(files[sheetPath]);

      // Update header info di kelas dengan tipe string eksplisit (t="str") untuk formula berbasis teks
      xml = xml.replace(
        /(<c\s+[^>]*r="B5"[^>]*)(><f>[^<]*<\/f>)(<v>[^<]*<\/v>)?(<\/c>)/g,
        (_m, cOpen, fTag, _v, cClose) => {
          const cleanOpen = cOpen.replace(/\s*t="[^"]*"/g, '');
          return `${cleanOpen} t="str"${fTag}<v>${this.escapeXml(effectiveSubject)}</v>${cClose}`;
        }
      );
      xml = xml.replace(
        /(<c\s+[^>]*r="E4"[^>]*)(><f>[^<]*<\/f>)(<v>[^<]*<\/v>)?(<\/c>)/g,
        (_m, cOpen, fTag, _v, cClose) => {
          const cleanOpen = cOpen.replace(/\s*t="[^"]*"/g, '');
          return `${cleanOpen} t="str"${fTag}<v>${this.escapeXml(academicYear)}</v>${cClose}`;
        }
      );
      xml = xml.replace(
        /(<c\s+[^>]*r="H4"[^>]*)(><f>[^<]*<\/f>)(<v>[^<]*<\/v>)?(<\/c>)/g,
        (_m, cOpen, fTag, _v, cClose) => {
          const cleanOpen = cOpen.replace(/\s*t="[^"]*"/g, '');
          return `${cleanOpen} t="str"${fTag}<v>${this.escapeXml(semester)}</v>${cClose}`;
        }
      );
      xml = xml.replace(/(<c\s+[^>]*r="E5"[^>]*><f>[^<]*<\/f>)(<v>[^<]*<\/v>)?(<\/c>)/g, `$1<v>${effectiveKkm}</v>$3`);

      const studentGrades = classScoreMap[clsName];

      if (studentGrades && Object.keys(studentGrades).length > 0) {
        xml = xml.replace(/<row\s+[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs, (rowMatch, rowStr, rowContent) => {
          const r = parseInt(rowStr, 10);
          if (r < 9) return rowMatch;

          let studentName = '';
          const bMatch = rowContent.match(/<c\s+[^>]*r="B\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/);
          if (bMatch) {
            const strIdx = parseInt(bMatch[1], 10);
            studentName = (sharedStrings[strIdx] || '').trim().toUpperCase();
          } else {
            const inlineMatch = rowContent.match(/<c\s+[^>]*r="B\d+"[^>]*t="inlineStr"[^>]*><is><t>([^<]+)<\/t><\/is><\/c>/);
            if (inlineMatch) {
              studentName = inlineMatch[1].trim().toUpperCase();
            }
          }
          if (!studentName || studentName.includes('REKAP')) return rowMatch;

          const grade = studentGrades[studentName] || this.fuzzyFindStudentScore(studentName, studentGrades);
          if (!grade) return rowMatch;

          let updatedRow = rowMatch;

          if (grade.asts !== null && grade.asts !== undefined && !isNaN(grade.asts)) {
            const astsVal = Number(grade.asts);
            updatedRow = updatedRow.replace(
              new RegExp(`(<c\\s+[^>]*r="D${r}"[^>]*>).*?(<\\/c>)|(<c\\s+[^>]*r="D${r}"[^>]*\\/>)`),
              `<c r="D${r}" s="17"><v>${astsVal}</v></c>`
            );
          }
          if (grade.asas !== null && grade.asas !== undefined && !isNaN(grade.asas)) {
            const asasVal = Number(grade.asas);
            updatedRow = updatedRow.replace(
              new RegExp(`(<c\\s+[^>]*r="E${r}"[^>]*>).*?(<\\/c>)|(<c\\s+[^>]*r="E${r}"[^>]*\\/>)`),
              `<c r="E${r}" s="17"><v>${asasVal}</v></c>`
            );
          }

          // Perbarui cached values pada F, G, H, I dengan formula tetap utuh
          const aVal = grade.asts ?? 0;
          const sVal = grade.asas ?? 0;
          const finalScore = Math.round((aVal * 0.5 + sVal * 0.5) * 10) / 10;
          const pred = finalScore >= 90 ? 'A' : (finalScore >= 80 ? 'B' : (finalScore >= effectiveKkm ? 'C' : 'D'));
          const status = finalScore >= effectiveKkm ? 'Tuntas' : 'Belum Tuntas';
          const desc = pred === 'A'
            ? 'Penguasaan kompetensi sangat baik.'
            : (pred === 'B'
              ? 'Penguasaan kompetensi baik.'
              : (pred === 'C'
                ? 'Penguasaan kompetensi cukup dan masih perlu penguatan.'
                : 'Belum mencapai KKM.'));

          updatedRow = updatedRow.replace(new RegExp(`(<c\\s+[^>]*r="F${r}"[^>]*><f>.*?<\\/f>)(<v>[^<]*<\\/v>)?(<\\/c>)`), `$1<v>${finalScore}</v>$3`);
          updatedRow = updatedRow.replace(new RegExp(`(<c\\s+[^>]*r="G${r}"[^>]*><f>.*?<\\/f>)(<v>[^<]*<\\/v>)?(<\\/c>)`), `$1<v>${pred}</v>$3`);
          updatedRow = updatedRow.replace(new RegExp(`(<c\\s+[^>]*r="H${r}"[^>]*><f>.*?<\\/f>)(<v>[^<]*<\\/v>)?(<\\/c>)`), `$1<v>${status}</v>$3`);
          updatedRow = updatedRow.replace(new RegExp(`(<c\\s+[^>]*r="I${r}"[^>]*><f[^>]*>.*?<\\/f>)(<v>[^<]*<\\/v>)?(<\\/c>)`), `$1<v>${this.escapeXml(desc)}</v>$3`);

          return updatedRow;
        });
      }

      files[sheetPath] = new TextEncoder().encode(xml);
    });

    // 4. Update activeTab & kalkulasi di xl/workbook.xml
    if (files['xl/workbook.xml']) {
      let wbXml = new TextDecoder().decode(files['xl/workbook.xml']);
      const normClass = className ? this.normalizeSheetClassName(className) : '';
      const matchedSheet = classSheets.find((cs) => cs.name === normClass);
      // Default ke sheet '7' (tabIndex 2) jika semua kelas, atau spesifik tabIndex kelas terkait
      const targetTabIndex = matchedSheet ? matchedSheet.tabIndex : 2;

      wbXml = wbXml.replace(
        /<workbookView\s+([^>]*?)activeTab="\d+"([^>]*?)\/>/,
        `<workbookView $1activeTab="${targetTabIndex}"$2/>`
      );

      // Force full calculation on load across all versions of Excel (MS Excel, WPS, LibreOffice, Google Sheets)
      if (wbXml.includes('<calcPr')) {
        wbXml = wbXml.replace(/<calcPr([^>]*?)\/>/g, (_m, attrs) => {
          const cleanAttrs = attrs
            .replace(/\s*forceFullCalc="[^"]*"/g, '')
            .replace(/\s*fullCalcOnLoad="[^"]*"/g, '');
          return `<calcPr${cleanAttrs} forceFullCalc="1" fullCalcOnLoad="1"/>`;
        });
      } else {
        wbXml = wbXml.replace('</workbook>', '<calcPr forceFullCalc="1" fullCalcOnLoad="1"/></workbook>');
      }

      files['xl/workbook.xml'] = new TextEncoder().encode(wbXml);
    }

    // 5. Universal Excel Compatibility (Hilangkan calcChain.xml agar bebas dari pesan repair/corrupt di seluruh versi Excel)
    // Excel akan secara otomatis dan bersih meregenerasi calculation chain baru saat dibuka tanpa dialog error.
    delete files['xl/calcChain.xml'];

    if (files['[Content_Types].xml']) {
      let ctXml = new TextDecoder().decode(files['[Content_Types].xml']);
      ctXml = ctXml.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, '');
      files['[Content_Types].xml'] = new TextEncoder().encode(ctXml);
    }

    if (files['xl/_rels/workbook.xml.rels']) {
      let relsXml = new TextDecoder().decode(files['xl/_rels/workbook.xml.rels']);
      relsXml = relsXml.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g, '');
      files['xl/_rels/workbook.xml.rels'] = new TextEncoder().encode(relsXml);
    }

    // 5. Pack dan simpan / download
    const zipped = fflate.zipSync(files);

    const cleanSubject = effectiveSubject.replace(/[\\/:*?"<>|]/g, '_');
    const cleanClass = className ? this.normalizeSheetClassName(className) : (session?.class_name ? this.normalizeSheetClassName(session.class_name) : 'SEMUA_KELAS');
    const cleanAcademicYear = (academicYear || '2026-2027').replace('/', '-');
    const filename = `FORMAT_PENILAIAN_ASTS_ASAS_${cleanSubject}_${cleanClass}_${cleanAcademicYear}.xlsx`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([zipped as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      // Lingkungan Node (test runner)
      const dynamicImport = new Function('m', 'return import(m)');
      const fs = await dynamicImport('fs');
      fs.writeFileSync(filename, Buffer.from(zipped));
    }

    logger.info('SemesterGradingExcelService', `Exported 100% styled official template Excel: ${filename}`);
  }

  /**
   * Mengambil master workbook dari path template publik.
   */
  private static async loadTemplateWorkbook(): Promise<XLSX.WorkBook> {
    try {
      const resp = await fetch(this.TEMPLATE_PATH);
      if (!resp.ok) {
        throw new Error(`Status ${resp.status} saat fetch ${this.TEMPLATE_PATH}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      return XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    } catch (fetchErr) {
      logger.warn('SemesterGradingExcelService', 'Browser fetch failed, trying local node buffer if available', fetchErr);
      // Fallback for Node test environment
      if (typeof window === 'undefined') {
        try {
          const dynamicImport = new Function('m', 'return import(m)');
          const fs = await dynamicImport('fs');
          const buf = fs.readFileSync('public/templates/FORMAT_PENILAIAN_ASTS_ASAS.xlsx');
          return XLSX.read(buf, { type: 'buffer' });
        } catch (nodeErr) {
          logger.error('SemesterGradingExcelService', 'Node fallback also failed:', nodeErr);
        }
      }
      throw fetchErr;
    }
  }

  /**
   * Menormalkan nama kelas agar cocok dengan nama sheet ('7', '8A', '8B', '9A', '9B', 'SMA').
   */
  public static normalizeSheetClassName(className?: string): string {
    if (!className) return '8A';
    const cleaned = className.toUpperCase().replace(/^KELAS\s*/i, '').trim();
    if (cleaned === '7A' || cleaned === '7B' || cleaned === 'VII') return '7';
    if (cleaned.startsWith('SMA') || cleaned.startsWith('X') || cleaned.startsWith('XI') || cleaned.startsWith('XII')) {
      return 'SMA';
    }
    return cleaned;
  }

  /**
   * Ekspor nilai ujian web ke dalam format berkas Excel yang 100% identik dengan master template sekolah.
   */
  public static async exportOfficialFormatExcel(options: ExportOfficialAssessmentOptions): Promise<void> {
    const {
      subject,
      teacher,
      academicYear = '2026/2027',
      semester = 'Ganjil',
      kkm = 75,
      className,
      scoresByClass,
      session,
      gradedStudents,
      targetColumn,
      includeRecapSheet = true,
    } = options;

    // Jika includeRecapSheet === false atau targetColumn === 'NONE',
    // WAJIB gunakan exportStyledOfficialFormatExcel agar 100% mempertahankan tabel, border,
    // warna header, grafik/chart, dan formula native dari master template tanpa kehilangan styling.
    if (includeRecapSheet === false || targetColumn === 'NONE') {
      return this.exportStyledOfficialFormatExcel(options);
    }

    const wb = await this.loadTemplateWorkbook();

    // 1. Perbarui Metadata di Sheet "IDENTITAS SEKOLAH"
    const idSheet = wb.Sheets['IDENTITAS SEKOLAH'];
    if (idSheet) {
      idSheet['B8'] = { t: 's', v: academicYear };
      idSheet['B9'] = { t: 's', v: semester };
      idSheet['B10'] = { t: 's', v: teacher || session?.teacher || '' };
      idSheet['B11'] = { t: 's', v: subject || session?.subject || '' };
    }

    // 2. Perbarui KKM di Sheet "FORMAT PENILAIAN"
    const formatSheet = wb.Sheets['FORMAT PENILAIAN'];
    if (formatSheet) {
      formatSheet['B5'] = { t: 'n', v: kkm || Number(session?.kkm) || 75 };
    }

    // 3. Masukkan Nilai Siswa ke Sheet Kelas
    // Kumpulkan data nilai per kelas
    const classScoreMap: Record<string, Record<string, { asts?: number | null; asas?: number | null }>> = {};

    // Jika berasal dari scoresByClass terstruktur
    if (scoresByClass) {
      Object.entries(scoresByClass).forEach(([cls, list]) => {
        const normCls = this.normalizeSheetClassName(cls);
        if (!classScoreMap[normCls]) classScoreMap[normCls] = {};
        if ((targetColumn as any) === 'NONE') return;
        list.forEach((st) => {
          const normName = st.name.trim().toUpperCase();
          if (targetColumn === 'ASTS') {
            classScoreMap[normCls][normName] = { asts: st.asts ?? st.asas, asas: null };
          } else if (targetColumn === 'ASAS') {
            classScoreMap[normCls][normName] = { asts: null, asas: st.asas ?? st.asts };
          } else if (targetColumn === 'BOTH') {
            const sc = st.asts ?? st.asas;
            classScoreMap[normCls][normName] = { asts: sc, asas: sc };
          } else {
            classScoreMap[normCls][normName] = {
              asts: st.asts,
              asas: st.asas,
            };
          }
        });
      });
    }

    // Jika berasal dari Sesi Ujian Aktif (QuestionCorrectionModal)
    if (session && Array.isArray(gradedStudents) && gradedStudents.length > 0) {
      const normCls = this.normalizeSheetClassName(session.class_name);
      if (!classScoreMap[normCls]) classScoreMap[normCls] = {};

      const isNone = (targetColumn as any) === 'NONE';
      const isBoth = targetColumn === 'BOTH';
      const isAsas = targetColumn === 'ASAS'
        ? true
        : (targetColumn === 'ASTS' ? false : /ASAS|PAS|UAS|AKHIR/i.test(session.exam_type || ''));

      if (!isNone) {
        gradedStudents.forEach((st) => {
          const normName = st.name.trim().toUpperCase();
          const score = Number(st.final_score) || 0;
          if (!classScoreMap[normCls][normName]) {
            classScoreMap[normCls][normName] = {};
          }
          if (isBoth) {
            classScoreMap[normCls][normName].asts = score;
            classScoreMap[normCls][normName].asas = score;
          } else if (isAsas) {
            classScoreMap[normCls][normName].asas = score;
          } else {
            classScoreMap[normCls][normName].asts = score;
          }
        });
      }
    }

    // Tulis nilai ke dalam tiap sheet kelas yang ada pada template
    this.CANONICAL_CLASSES.forEach((clsSheetName) => {
      const ws = wb.Sheets[clsSheetName];
      if (!ws) return;

      // Update header metadata in all class sheets to reflect user's chosen subject, academic year, semester, and KKM
      ws['B5'] = { t: 's', v: subject || session?.subject || '', f: "'IDENTITAS SEKOLAH'!B11" };
      ws['E4'] = { t: 's', v: academicYear, f: "'IDENTITAS SEKOLAH'!B8" };
      ws['H4'] = { t: 's', v: semester, f: "'IDENTITAS SEKOLAH'!B9" };
      ws['E5'] = { t: 'n', v: kkm || Number(session?.kkm) || 75, f: "'FORMAT PENILAIAN'!B5" };

      const studentGrades = classScoreMap[clsSheetName];
      if (!studentGrades) return;

      // Iterasi baris tabel siswa (mulai baris 9 sampai baris sebelum REKAP KELAS)
      for (let r = 9; r <= 60; r++) {
        const nameCell = ws['B' + r];
        if (!nameCell || typeof nameCell.v !== 'string') continue;
        const studentNameInExcel = nameCell.v.trim().toUpperCase();
        if (!studentNameInExcel || studentNameInExcel.includes('REKAP')) break;

        // Cari nilai yang cocok
        const gradeEntry = studentGrades[studentNameInExcel] || this.fuzzyFindStudentScore(studentNameInExcel, studentGrades);

        if (gradeEntry) {
          if (typeof gradeEntry.asts === 'number' && !isNaN(gradeEntry.asts)) {
            ws['D' + r] = { t: 'n', v: gradeEntry.asts };
          }
          if (typeof gradeEntry.asas === 'number' && !isNaN(gradeEntry.asas)) {
            ws['E' + r] = { t: 'n', v: gradeEntry.asas };
          }
        }
      }
    });

    // 4. Prepend dedicated "REKAP NILAI" worksheet as Sheet 1 so teachers immediately see the student table
    let recapWs: XLSX.WorkSheet | null = null;
    const shouldIncludeRecap = Boolean(includeRecapSheet);
    if (shouldIncludeRecap && session && Array.isArray(gradedStudents) && gradedStudents.length > 0) {
      recapWs = ExamCorrectionRepository.buildRecapWorksheet(session, gradedStudents);
    } else if (shouldIncludeRecap && scoresByClass) {
      const targetClass = className ? this.normalizeSheetClassName(className) : '8A';
      const studentEntries = scoresByClass[targetClass] || Object.values(scoresByClass)[0] || [];
      if (studentEntries.length > 0) {
        const synthSession: ExamSessionRecord = {
          id: 'synth_session',
          session_name: `Penilaian Semester ${subject || 'Mapel'} Kelas ${targetClass}`,
          teacher: teacher || '',
          subject: subject || 'Mata Pelajaran',
          class_name: targetClass,
          school_level: targetClass === 'SMA' ? 'SMA' : 'SMP',
          kkm: kkm || 75,
          academic_year: academicYear,
          semester,
          answer_key: [],
          student_list: [],
          created_at: new Date().toISOString(),
        };
        const synthStudents: GradedStudentScoreRecord[] = studentEntries.map((st, i) => {
          const finalScore = st.asas !== null && st.asas !== undefined && st.asts !== null && st.asts !== undefined
            ? Math.round((st.asts * 0.5 + st.asas * 0.5) * 10) / 10
            : (st.asas ?? st.asts ?? 0);
          return {
            id: `st_${i + 1}`,
            session_id: 'synth_session',
            name: st.name,
            mcq_answers: {},
            essay_scores: [],
            mcq_score: st.asts ?? 0,
            essay_score: st.asas ?? 0,
            final_score: finalScore,
            csi: 80,
            lps: 80,
            correct: 0,
            wrong: 0,
          };
        });
        recapWs = ExamCorrectionRepository.buildRecapWorksheet(synthSession, synthStudents);
      }
    }

    if (recapWs) {
      wb.SheetNames = ['REKAP NILAI', ...wb.SheetNames.filter((n) => n !== 'REKAP NILAI')];
      wb.Sheets['REKAP NILAI'] = recapWs;
    }

    // Ensure all sheets have visible gridlines
    Object.keys(wb.Sheets).forEach((sheetName) => {
      const s = wb.Sheets[sheetName];
      if (s) {
        s['!views'] = [{ showGridLines: true }];
      }
    });

    const wbAny = wb as any;
    wbAny.Workbook = wbAny.Workbook || {};
    wbAny.Workbook.WBView = [{ activeTab: 0, showSheetTabs: true }];
    wbAny.Workbook.Views = [{ activeTab: 0 }];

    // 5. Buat Nama File yang Rapi dan Unduh
    const cleanSubject = (subject || session?.subject || 'MAPEL').replace(/[\\/:*?"<>|]/g, '_');
    const cleanClass = className ? this.normalizeSheetClassName(className) : (session?.class_name ? this.normalizeSheetClassName(session.class_name) : 'SEMUA_KELAS');
    const cleanAcademicYear = (academicYear || '2026-2027').replace('/', '-');
    const filename = `FORMAT_PENILAIAN_ASTS_ASAS_${cleanSubject}_${cleanClass}_${cleanAcademicYear}.xlsx`;

    XLSX.writeFile(wb, filename);
    logger.info('SemesterGradingExcelService', `Exported official format file with REKAP NILAI table: ${filename}`);
  }

  /**
   * Menormalkan nama siswa Indonesia untuk pencocokan toleran (fuzzy).
   * Menghilangkan tanda baca, merapikan spasi ganda, dan menstandarisasi variasi ejaan umum
   * seperti Muhammad/Muhamad/M./MHD, Achmad/Akhmad/Ahmad.
   */
  public static canonicalizeStudentName(name: string): string {
    if (!name) return '';
    return name
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\b(MUHAMMAD|MUHAMAD|MUCHAMMAD|MOCHAMMAD|MOCHAMAD|MHD|MUH|M)\b/g, 'MUH')
      .replace(/\b(ACHMAD|AKHMAD|AHMAD)\b/g, 'AHMAD')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Mengompresi huruf berulang berturutan (misal: TT -> T, RR -> R, SS -> S, II -> I)
   * sehingga nama dengan perbedaan huruf rangkap (FATTURAHMAN vs FATURRAHMAN) menjadi identik.
   */
  public static compressRepeatedChars(str: string): string {
    if (!str) return '';
    let res = '';
    for (let i = 0; i < str.length; i++) {
      if (i === 0 || str[i] !== str[i - 1]) {
        res += str[i];
      }
    }
    return res;
  }

  /**
   * Helper pencarian nama siswa fleksibel cerdas yang menangani seluruh variasi penamaan siswa Indonesia:
   * 1. Exact match (case insensitive, trimmed).
   * 2. Canonical ejaan umum (Muhammad vs Muhamad vs M., Ahmad vs Achmad).
   * 3. Toleransi typo huruf rangkap (Faturrahman vs Fatturahman, Zakii vs Zaki, Bilqis Nissa vs Nisa).
   * 4. Substring inclusion antar-nama bersih (misal gelar/nama tengah hilang).
   * 5. Token overlap matching: jika minimal 2 kata utama cocok, atau 1 kata unik pada nama tunggal (misal FERDIANSYAH).
   */
  public static fuzzyFindStudentScore(
    excelName: string,
    gradesMap: Record<string, { asts?: number | null; asas?: number | null }>
  ): { asts?: number | null; asas?: number | null } | null {
    if (!excelName || !gradesMap) return null;

    // 1. Exact match
    const normExcel = excelName.trim().toUpperCase();
    if (gradesMap[normExcel]) return gradesMap[normExcel];

    // 2. Canonical & stemmed comparison
    const ce = this.canonicalizeStudentName(normExcel);
    const se = this.compressRepeatedChars(ce);
    const cle = se.replace(/\s+/g, '');
    const tokensE = se.split(' ').filter(Boolean);
    const sigE = tokensE.filter((t) => t !== 'MUH');

    for (const [key, val] of Object.entries(gradesMap)) {
      const normKey = key.trim().toUpperCase();
      if (normKey === normExcel) return val;

      const ci = this.canonicalizeStudentName(normKey);
      if (ci === ce) return val;

      const si = this.compressRepeatedChars(ci);
      if (si === se) return val;

      const cli = si.replace(/\s+/g, '');
      if (cli === cle) return val;
      if (cle.length >= 6 && cli.length >= 6 && (cle.includes(cli) || cli.includes(cle))) {
        return val;
      }

      // Token overlap matching
      const tokensI = si.split(' ').filter(Boolean);
      const sigI = tokensI.filter((t) => t !== 'MUH');
      const overlap = sigE.filter((t) => sigI.includes(t));

      // Jika 2 atau lebih kata utama cocok
      if (overlap.length >= 2) {
        return val;
      }
      // Jika salah satu nama hanya terdiri dari 1 kata utama (misal 'FERDIANSYAH') dan kata itu cocok
      if ((sigE.length === 1 || sigI.length === 1) && overlap.length >= 1) {
        return val;
      }
    }

    // 3. Fallback alphanumeric basic inclusion
    const cleanExcel = normExcel.replace(/[^A-Z0-9]/g, '');
    for (const [key, val] of Object.entries(gradesMap)) {
      const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanKey === cleanExcel || cleanKey.includes(cleanExcel) || cleanExcel.includes(cleanKey)) {
        return val;
      }
    }

    return null;
  }

  /**
   * Membaca dan mem-parsing berkas Excel "FORMAT PENILAIAN ASTS & ASAS.xlsx" yang diupload guru.
   */
  public static async importScoresFromExcel(file: File): Promise<ParsedClassSheetResult[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });

          const results: ParsedClassSheetResult[] = [];

          // Baca identitas umum jika tersedia
          let commonSubject = '';
          let commonTeacher = '';
          let commonAcademicYear = '2026/2027';
          let commonSemester = 'Ganjil';
          let commonKkm = 75;

          const idSheet = wb.Sheets['IDENTITAS SEKOLAH'];
          if (idSheet) {
            commonAcademicYear = String(idSheet['B8']?.v || commonAcademicYear);
            commonSemester = String(idSheet['B9']?.v || commonSemester);
            commonTeacher = String(idSheet['B10']?.v || '');
            commonSubject = String(idSheet['B11']?.v || '');
          }

          const formatSheet = wb.Sheets['FORMAT PENILAIAN'];
          if (formatSheet && formatSheet['B5']?.v) {
            commonKkm = Number(formatSheet['B5']?.v) || 75;
          }

          // Baca tiap sheet kelas
          this.CANONICAL_CLASSES.forEach((cls) => {
            const ws = wb.Sheets[cls];
            if (!ws) return;

            const sheetData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
            if (sheetData.length < 9) return;

            const schoolName = String(sheetData[1]?.[0] || 'Sekolah');
            const classVal = String(sheetData[3]?.[1] || cls);
            const subVal = String(sheetData[4]?.[1] || commonSubject);
            const kkmVal = Number(sheetData[4]?.[4]) || commonKkm;

            const students: ParsedStudentRow[] = [];

            for (let r = 8; r < sheetData.length; r++) {
              const row = sheetData[r];
              if (!row || !row[1] || String(row[0]).includes('REKAP') || String(row[1]).includes('REKAP')) {
                break;
              }

              const no = Number(row[0]) || (students.length + 1);
              const name = String(row[1]).trim();
              const gender = String(row[2] || 'L').trim().toUpperCase();
              const asts = row[3] !== '' && !isNaN(Number(row[3])) ? Number(row[3]) : null;
              const asas = row[4] !== '' && !isNaN(Number(row[4])) ? Number(row[4]) : null;
              const finalScore = row[5] !== '' && !isNaN(Number(row[5])) ? Number(row[5]) : null;
              const predicate = String(row[6] || '-').trim();
              const status = String(row[7] || '-').trim();

              students.push({
                no,
                name,
                gender,
                asts,
                asas,
                finalScore,
                predicate,
                status,
              });
            }

            if (students.length > 0) {
              results.push({
                className: classVal,
                schoolName,
                subject: subVal,
                teacher: commonTeacher,
                academicYear: commonAcademicYear,
                semester: commonSemester,
                kkm: kkmVal,
                students,
              });
            }
          });

          resolve(results);
        } catch (err) {
          logger.error('SemesterGradingExcelService', 'Failed to parse Excel file:', err);
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Pre-validates all rows from an imported sheet before any write to database.
   * Prevents partial writes: if any row is invalid, isValid is false and no records should be saved.
   */
  public static prepareBatchImport(
    sheet: ParsedClassSheetResult,
    session: ExamSessionRecord,
    roster: Array<{ id: string; fullName: string }> = []
  ): PreparedBatchImport {
    const errors: ExcelValidationError[] = [];
    const items: PreparedBatchImport['items'] = [];
    const seenNames = new Set<string>();

    const isAsas = /ASAS|PAS|UAS|AKHIR/i.test(session.exam_type || '');

    // Build lookup for student IDs by normalized name
    const rosterMap = new Map<string, string>();
    roster.forEach((r) => {
      if (r.fullName && r.id) {
        rosterMap.set(r.fullName.trim().toLowerCase(), r.id);
      }
    });

    sheet.students.forEach((st, idx) => {
      const rowNum = idx + 9; // Rows in template start at row 9
      const trimmedName = (st.name || '').trim();

      if (!trimmedName) {
        errors.push({
          row: rowNum,
          studentName: '',
          field: 'name',
          value: st.name,
          reason: 'Nama siswa kosong pada baris ini.',
        });
        return;
      }

      // Check duplicates within the file
      const lowerName = trimmedName.toLowerCase();
      if (seenNames.has(lowerName)) {
        errors.push({
          row: rowNum,
          studentName: trimmedName,
          field: 'name',
          value: trimmedName,
          reason: `Nama siswa duplikat di file Excel pada baris ${rowNum}. Setiap siswa hanya boleh muncul sekali.`,
        });
        return;
      }
      seenNames.add(lowerName);

      // Determine raw score
      const rawScore = isAsas ? st.asas : st.asts;
      const effectiveScore = typeof rawScore === 'number' && !isNaN(rawScore)
        ? rawScore
        : (typeof st.finalScore === 'number' && !isNaN(st.finalScore) ? st.finalScore : null);

      if (effectiveScore === null) {
        errors.push({
          row: rowNum,
          studentName: trimmedName,
          field: isAsas ? 'ASAS' : 'ASTS',
          value: rawScore,
          reason: 'Nilai siswa belum diisi atau tidak valid (bukan angka).',
        });
        return;
      }

      if (effectiveScore < 0 || effectiveScore > 100) {
        errors.push({
          row: rowNum,
          studentName: trimmedName,
          field: isAsas ? 'ASAS' : 'ASTS',
          value: effectiveScore,
          reason: `Nilai (${effectiveScore}) di luar batas wajar 0..100.`,
        });
        return;
      }

      // Resolve student unique ID
      const matchedUserId = rosterMap.get(lowerName) || `std_${trimmedName.replace(/\s+/g, '_').toLowerCase()}`;

      items.push({
        session_id: session.id,
        student_user_id: matchedUserId,
        name: trimmedName,
        final_score: Math.round(effectiveScore),
        mcq_score: Math.round(effectiveScore),
        essay_score: 0,
        mcq_answers: {},
        essay_scores: [],
        correct: 0,
        wrong: 0,
        csi: 0,
        lps: 0,
        source: 'IMPORT_EXCEL',
      });
    });

    const isValid = errors.length === 0 && items.length > 0;

    return {
      isValid,
      errors,
      items: isValid ? items : [],
      summary: {
        totalRows: sheet.students.length,
        validCount: items.length,
        invalidCount: errors.length,
      },
    };
  }
}
