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
import { logger } from '../utils/logger.utils';
import type { ExamSessionRecord, GradedStudentScoreRecord } from '../types/database.types';

export interface StudentScoreEntry {
  name: string;
  asts?: number | null;
  asas?: number | null;
  gender?: 'L' | 'P';
}

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
    } = options;

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
        list.forEach((st) => {
          const normName = st.name.trim().toUpperCase();
          classScoreMap[normCls][normName] = {
            asts: st.asts,
            asas: st.asas,
          };
        });
      });
    }

    // Jika berasal dari Sesi Ujian Aktif (QuestionCorrectionModal)
    if (session && Array.isArray(gradedStudents) && gradedStudents.length > 0) {
      const normCls = this.normalizeSheetClassName(session.class_name);
      if (!classScoreMap[normCls]) classScoreMap[normCls] = {};

      const isAsas = /ASAS|PAS|UAS|AKHIR/i.test(session.exam_type || '');
      // Jika bukan ASAS, maka dialokasikan ke ASTS (Asesmen Tengah Semester)

      gradedStudents.forEach((st) => {
        const normName = st.name.trim().toUpperCase();
        const score = Number(st.final_score) || 0;
        if (!classScoreMap[normCls][normName]) {
          classScoreMap[normCls][normName] = {};
        }
        if (isAsas) {
          classScoreMap[normCls][normName].asas = score;
        } else {
          classScoreMap[normCls][normName].asts = score;
        }
      });
    }

    // Tulis nilai ke dalam tiap sheet kelas yang ada pada template
    this.CANONICAL_CLASSES.forEach((clsSheetName) => {
      const ws = wb.Sheets[clsSheetName];
      if (!ws) return;

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

    // 4. Buat Nama File yang Rapi dan Unduh
    const cleanSubject = (subject || session?.subject || 'MAPEL').replace(/[\\/:*?"<>|]/g, '_');
    const cleanClass = className ? this.normalizeSheetClassName(className) : (session?.class_name ? this.normalizeSheetClassName(session.class_name) : 'SEMUA_KELAS');
    const cleanAcademicYear = (academicYear || '2026-2027').replace('/', '-');
    const filename = `FORMAT_PENILAIAN_ASTS_ASAS_${cleanSubject}_${cleanClass}_${cleanAcademicYear}.xlsx`;

    XLSX.writeFile(wb, filename);
    logger.info('SemesterGradingExcelService', `Exported official format file: ${filename}`);
  }

  /**
   * Helper pencarian nama siswa fleksibel (mengabaikan titik, spasi ganda, gelar singkat).
   */
  private static fuzzyFindStudentScore(
    excelName: string,
    gradesMap: Record<string, { asts?: number | null; asas?: number | null }>
  ): { asts?: number | null; asas?: number | null } | null {
    const cleanExcel = excelName.replace(/[^A-Z0-9]/g, '');
    for (const [key, val] of Object.entries(gradesMap)) {
      const cleanKey = key.replace(/[^A-Z0-9]/g, '');
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
}
