/**
 * SMART ABSENSI GURU — UNIVERSAL EXCEL GRADING SERVICE
 * 
 * Modul cerdas untuk mengimpor nilai siswa langsung dari berbagai format file Excel:
 * 1. Mendukung tabel koreksian rinci (kolom Skor PG, Skor Esai/Essay, Total).
 * 2. Mendukung format penilaian resmi ASTS & ASAS sekolah (nilai ujian diambil dari kolom ASTS/ASAS,
 *    mengabaikan kolom Nilai Akhir rapor yang diperuntukkan bagi gabungan kedua ujian).
 * 3. Role Word Engine: Deteksi cerdas kolom PG, Esai (ejaan 'esai' dan 'essay'), Rincian Butir Esai,
 *    Total Skor, serta penyaringan otomatis baris Kunci Jawaban.
 * 4. Pencocokan cerdas siswa (Exact match & Fuzzy match dengan nama Indonesia).
 */

import * as XLSX from 'xlsx';
import type {
  ExamSessionRecord,
  CreateExamSessionDTO,
  StudentItem,
  UserProfile,
} from '../types/database.types';
import { SemesterGradingExcelService } from './semester-grading-excel.service';
import { ExamCorrectionRepository } from '../repositories/ExamCorrectionRepository';
import { AdministrationRepository } from '../repositories/AdministrationRepository';
import { normalizeClassCode, areClassCodesEqual } from '../utils/class.utils';
import { normalizeAcademicYearString } from '../utils/academic-year.utils';
import { logger } from '../utils/logger.utils';
import { OFFICIAL_SCHOOL_SUBJECTS } from '../config/school-subjects.config';

export interface UniversalExcelStudentRow {
  rowNumber: number;
  rawName: string;
  rawStudentName?: string; // alias for rawName
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchConfidence: 'EXACT' | 'FUZZY' | 'MANUAL' | 'UNMATCHED';
  matchType?: 'EXACT' | 'FUZZY' | 'MANUAL' | 'UNMATCHED'; // alias
  pgScore: number | null;
  essayScore: number | null;
  finalScore: number;
  originalScore: number;
  passed?: boolean;
  excluded?: boolean;
}

export interface UniversalExcelParsedSheet {
  sheetName: string;
  detectedClass: string;
  detectedClassName?: string; // alias for detectedClass
  detectedSubject: string;
  detectedTeacher: string;
  detectedAcademicYear: string;
  detectedSemester: string;
  detectedKkm: number;
  detectedFormat: 'PG_ONLY' | 'PG_AND_ESSAY';
  detectedFormatDescription?: string;
  rows: UniversalExcelStudentRow[];
}

export interface ExecuteImportExcelSessionParams {
  mode?: 'CREATE_NEW' | 'UPDATE_EXISTING';
  importMode?: 'CREATE_NEW' | 'UPDATE_EXISTING'; // alias
  existingSessionId?: string;
  targetSessionId?: string; // alias
  sessionConfig: {
    sessionName: string;
    teacherName?: string;
    subject: string;
    className: string;
    examType: string;
    academicYear?: string;
    semester?: string;
    kkm?: number;
    format?: 'PG_ONLY' | 'PG_AND_ESSAY';
    examFormat?: 'PG_ONLY' | 'PG_AND_ESSAY'; // alias
  };
  rows?: UniversalExcelStudentRow[] | any[];
  mappedRows?: UniversalExcelStudentRow[] | any[]; // alias
  allDirectoryStudents?: StudentItem[];
  currentUser?: UserProfile;
}

export interface ExecuteImportResult {
  success: boolean;
  session: ExamSessionRecord;
  sessionId: string;
  savedCount: number;
  message: string;
}

export interface SingleSheetImportPlan {
  sheetName: string;
  mode?: 'CREATE_NEW' | 'UPDATE_EXISTING';
  existingSessionId?: string;
  sessionConfig: {
    sessionName: string;
    teacherName?: string;
    subject: string;
    className: string;
    examType: string;
    academicYear?: string;
    semester?: string;
    kkm?: number;
    format?: 'PG_ONLY' | 'PG_AND_ESSAY';
    examFormat?: 'PG_ONLY' | 'PG_AND_ESSAY';
  };
  rows: UniversalExcelStudentRow[];
}

export interface ExecuteImportAllSheetsParams {
  sheets: SingleSheetImportPlan[];
  currentUser: UserProfile;
  onProgress?: (current: number, total: number, currentSheet: string) => void;
}

export interface ExecuteImportAllSheetsResult {
  success: boolean;
  totalSavedCount: number;
  totalSessionsCount: number;
  sessions: ExamSessionRecord[];
  results: {
    sheetName: string;
    className: string;
    session: ExamSessionRecord;
    savedCount: number;
  }[];
  message: string;
}

export interface DetectedHeaderInfo {
  headerRowIndex: number;
  nameColIndex: number;
  pgColIndex: number;
  essayColIndex: number;
  subEssayColIndices: number[];
  totalColIndex: number;
  astsColIndex: number;
  asasColIndex: number;
  semesterNaColIndex: number;
  classColIndex: number;
  formatType: 'CORRECTION_TABLE' | 'OFFICIAL_ASSESSMENT' | 'SIMPLE_TABLE';
}

export class UniversalExcelGradingService {
  /**
   * Parse sembarang file Excel (.xlsx / .xls) dan mendeteksi peran kolom (role words)
   * secara cerdas: Skor PG, Skor Esai/Essay, Total Ujian, ASTS, ASAS.
   */
  public static async parseExcelFile(
    file: File | ArrayBuffer | Uint8Array,
    allDirectoryStudents: StudentItem[] = [],
    availableTeachers: UserProfile[] = [],
    currentUser?: UserProfile,
    customFileName: string = ''
  ): Promise<UniversalExcelParsedSheet[]> {
    let data: Uint8Array;
    let fileName = customFileName;

    if (typeof File !== 'undefined' && file instanceof File) {
      fileName = file.name || customFileName;
      const buffer = await file.arrayBuffer();
      data = new Uint8Array(buffer);
    } else if (file instanceof Uint8Array) {
      data = file;
    } else {
      data = new Uint8Array(file as ArrayBuffer);
    }

    const wb = XLSX.read(data, { type: 'array' });
    const sheetsResult: UniversalExcelParsedSheet[] = [];

    // Baca metadata global dari sheet IDENTITAS SEKOLAH & FORMAT PENILAIAN jika ada
    let globalSubject = '';
    let globalTeacher = '';
    let globalAcademicYear = AdministrationRepository.getActiveAcademicYear() || '2026/2027';
    let globalSemester = AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil';
    let globalKkm = 75;

    const idSheet = wb.Sheets['IDENTITAS SEKOLAH'];
    if (idSheet) {
      const idGrid: any[][] = XLSX.utils.sheet_to_json<any[]>(idSheet, { header: 1, defval: '' });
      for (const row of idGrid) {
        const rowStr = row.map((c) => String(c || '').trim().toLowerCase()).join(' ');
        if (rowStr.includes('tahun pelajaran') || rowStr.includes('tahun ajaran')) {
          const val = row.find((c: any) => /\b202\d\/202\d\b/.test(String(c || '')));
          if (val) globalAcademicYear = String(val).trim();
        }
        if (rowStr.includes('semester')) {
          if (rowStr.includes('genap')) globalSemester = 'Genap';
          else if (rowStr.includes('ganjil')) globalSemester = 'Ganjil';
        }
        if (row[0] && /^guru$/i.test(String(row[0]).trim())) {
          const val = String(row[1] || '').trim();
          if (val && val !== '0') globalTeacher = this.cleanTeacherName(val);
        }
        if (row[0] && /^mata\s*pelajaran$/i.test(String(row[0]).trim())) {
          const val = String(row[1] || '').trim();
          if (val && val !== '0') globalSubject = this.resolveOfficialSubjectLabel(val) || val;
        }
      }
      if (!globalTeacher && idSheet['B10']?.v) {
        globalTeacher = this.cleanTeacherName(String(idSheet['B10'].v));
      }
      if (!globalSubject && idSheet['B11']?.v) {
        globalSubject = this.resolveOfficialSubjectLabel(String(idSheet['B11'].v)) || String(idSheet['B11'].v);
      }
    }

    const formatSheet = wb.Sheets['FORMAT PENILAIAN'];
    if (formatSheet && formatSheet['B5']?.v) {
      globalKkm = Number(formatSheet['B5']?.v) || 75;
    }

    // Iterasi seluruh sheet yang memuat daftar siswa
    for (const sheetName of wb.SheetNames) {
      // Abaikan sheet konfigurasi umum
      if (['IDENTITAS SEKOLAH', 'FORMAT PENILAIAN', 'PETUNJUK', 'COVER'].includes(sheetName.trim().toUpperCase())) {
        continue;
      }

      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rawGrid: any[][] = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (rawGrid.length < 2) continue;

      // Cari baris header dan analisis peran kolom (role words)
      const headerInfo = this.detectHeaderRow(rawGrid);
      if (headerInfo.headerRowIndex < 0 || headerInfo.nameColIndex < 0) {
        continue;
      }

      const detectedClass = this.detectClassFromContext(sheetName, rawGrid, headerInfo);
      const filteredDirStudents = allDirectoryStudents.filter((s) =>
        detectedClass === 'ALL' || areClassCodesEqual(s.className || '', detectedClass)
      );

      const rows: UniversalExcelStudentRow[] = [];
      const hasEssay = headerInfo.essayColIndex >= 0 || headerInfo.subEssayColIndices.length > 0;

      for (let r = headerInfo.headerRowIndex + 1; r < rawGrid.length; r++) {
        const rowData = rawGrid[r];
        if (!rowData) continue;

        const rawNameVal = String(rowData[headerInfo.nameColIndex] || '').trim();

        // 1. Validasi nama siswa yang sah (abaikan baris jika hanya angka 31, 23.4032..., 40.5, atau kata kunci footer/kunci)
        if (!this.isLegitimateStudentName(rawNameVal)) {
          continue;
        }

        // 2. Deteksi baris footer / rangkuman statistik di tingkat baris keseluruhan
        // (Misal: kolom A bertuliskan "Rata-rata", "Jumlah", sementara kolom lain berisi nilai/formula)
        const rowSummaryPattern =
          /(rata[\s\-_]*rata|rerata|average|mean|median|modus|jumlah\s*siswa|nilai\s*tertinggi|nilai\s*terendah|standar\s*deviasi|stdev|daya\s*serap|mengetahui|kepala\s*sekolah|guru\s*(mata\s*pelajaran|mapel|pengampu)?|tanda\s*tangan|^nip\b|^nuptk\b)/i;

        const hasSummaryKeywordInRow = rowData.some((cell: any) =>
          rowSummaryPattern.test(String(cell || '').trim())
        );
        if (hasSummaryKeywordInRow) {
          continue;
        }

        // 3. Abaikan baris jika hanya memuat huruf kunci jawaban pilihan ganda (misal baris kunci tanpa nama 'KUNCI')
        const nonBlank = rowData.filter((x: any) => x !== '' && x !== undefined);
        if (nonBlank.length > 5 && nonBlank.every((x: any) => typeof x === 'string' && /^[A-E]$/i.test(x.trim()))) {
          continue;
        }

        // Ambil nilai per kolom sesuai role words
        const pgVal = headerInfo.pgColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.pgColIndex]) : null;
        let essayVal = headerInfo.essayColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.essayColIndex]) : null;

        // Jika tidak ada kolom total essay tunggal tetapi ada sub-butir Soal E-1..Soal E-5, jumlahkan
        if (essayVal === null && headerInfo.subEssayColIndices.length > 0) {
          const sum = headerInfo.subEssayColIndices.reduce(
            (acc, colIdx) => acc + (this.parseNumericScore(rowData[colIdx]) || 0),
            0
          );
          if (sum > 0) essayVal = sum;
        }

        const totalVal = headerInfo.totalColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.totalColIndex]) : null;
        const astsVal = headerInfo.astsColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.astsColIndex]) : null;
        const asasVal = headerInfo.asasColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.asasColIndex]) : null;
        const naVal = headerInfo.semesterNaColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.semesterNaColIndex]) : null;

        let computedPg: number | null = pgVal;
        let computedEssay: number | null = essayVal;
        let computedFinal = 0;

        // KASUS A: Format Koreksian Rinci (Ada kolom Skor PG dan/atau Skor Esai/Essay)
        if (pgVal !== null || essayVal !== null) {
          if (totalVal !== null) {
            computedFinal = totalVal;
          } else if (pgVal !== null && essayVal !== null) {
            computedFinal = Math.round((pgVal + essayVal) * 10) / 10;
          } else if (pgVal !== null) {
            computedFinal = pgVal;
          } else if (essayVal !== null) {
            computedFinal = essayVal;
          }
        }
        // KASUS B: Format Penilaian Resmi ASTS & ASAS Sekolah
        // Kolom "Nilai Akhir" (naVal) di Excel resmi BUKAN acuan sesi karena merupakan rumus rapor (ASTS+ASAS)/2.
        // Nilai ujian sesi saat ini adalah murni nilai di kolom ASTS atau ASAS!
        else if (astsVal !== null || asasVal !== null) {
          const examScore = astsVal !== null ? astsVal : (asasVal || 0);
          computedFinal = examScore;
          computedPg = examScore;
          computedEssay = null; // Di template resmi tidak dipecah esai
        }
        // KASUS C: Tabel Nilai Tunggal / Lainnya
        else if (totalVal !== null) {
          computedFinal = totalVal;
          computedPg = totalVal;
          computedEssay = null;
        } else if (naVal !== null) {
          computedFinal = naVal;
          computedPg = naVal;
          computedEssay = null;
        }

        const match = this.matchStudent(rawNameVal, filteredDirStudents);

        rows.push({
          rowNumber: r + 1,
          rawName: rawNameVal,
          rawStudentName: rawNameVal,
          matchedStudentId: match.student?.id,
          matchedStudentName: match.student?.fullName || (match.student as any)?.name,
          matchConfidence: match.confidence,
          matchType: match.confidence,
          pgScore: computedPg,
          essayScore: computedEssay,
          finalScore: computedFinal,
          originalScore: computedFinal,
          passed: computedFinal >= (globalKkm || 75),
        });
      }

      if (rows.length > 0) {
        let desc = 'Format Tabel Nilai Umum';
        if (headerInfo.formatType === 'CORRECTION_TABLE') {
          desc = `Tabel Koreksian Rinci (PG: Kolom ${headerInfo.pgColIndex >= 0 ? headerInfo.pgColIndex + 1 : '-'}, Esai: Kolom ${headerInfo.essayColIndex >= 0 ? headerInfo.essayColIndex + 1 : '-'}, Total: Kolom ${headerInfo.totalColIndex >= 0 ? headerInfo.totalColIndex + 1 : '-'})`;
        } else if (headerInfo.formatType === 'OFFICIAL_ASSESSMENT') {
          desc = 'Format Penilaian Resmi ASTS/ASAS (Nilai Ujian diambil dari kolom ASTS/ASAS, Nilai Akhir rapor diabaikan)';
        }

        const detectedSub =
          this.detectSubjectFromContext(sheetName, rawGrid, fileName) ||
          globalSubject ||
          'Informatika';

        const detectedTch =
          this.detectTeacherFromContext(rawGrid, availableTeachers, currentUser) ||
          globalTeacher ||
          currentUser?.full_name ||
          '';

        sheetsResult.push({
          sheetName,
          detectedClass: detectedClass !== 'ALL' ? detectedClass : '8A',
          detectedClassName: detectedClass !== 'ALL' ? detectedClass : '8A',
          detectedSubject: detectedSub,
          detectedTeacher: detectedTch,
          detectedAcademicYear: globalAcademicYear || AdministrationRepository.getActiveAcademicYear() || '2026/2027',
          detectedSemester: globalSemester || (AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil'),
          detectedKkm: globalKkm || 75,
          detectedFormat: hasEssay ? 'PG_AND_ESSAY' : 'PG_ONLY',
          detectedFormatDescription: desc,
          rows,
        });
      }
    }

    return sheetsResult;
  }

  /**
   * Helper alias untuk parsing buffer langsung
   */
  public static async parseExcelBuffer(
    buffer: ArrayBuffer | Uint8Array | Buffer,
    fileName: string = 'import.xlsx',
    allDirectoryStudents: StudentItem[] = [],
    availableTeachers: UserProfile[] = [],
    currentUser?: UserProfile
  ): Promise<{ sheets: UniversalExcelParsedSheet[] }> {
    const sheets = await this.parseExcelFile(
      buffer as any,
      allDirectoryStudents,
      availableTeachers,
      currentUser,
      fileName
    );
    return { sheets };
  }

  /**
   * Mencocokkan nama siswa dari Excel dengan master siswa di kelas.
   */
  public static matchStudent(
    excelName: string,
    candidates: StudentItem[]
  ): {
    student: StudentItem | null;
    matchedStudent: StudentItem | null;
    confidence: 'EXACT' | 'FUZZY' | 'UNMATCHED';
    matchType: 'EXACT' | 'FUZZY' | 'UNMATCHED';
  } {
    if (!excelName || !Array.isArray(candidates) || candidates.length === 0) {
      return { student: null, matchedStudent: null, confidence: 'UNMATCHED', matchType: 'UNMATCHED' };
    }

    const normTarget = excelName.trim().toUpperCase();

    const getCandidateName = (c: any) =>
      String(c?.fullName || c?.name || c?.student_name || '').trim().toUpperCase();

    // 1. Exact match (case insensitive)
    const exact = candidates.find((c) => getCandidateName(c) === normTarget);
    if (exact) {
      return { student: exact, matchedStudent: exact, confidence: 'EXACT', matchType: 'EXACT' };
    }

    // 2. Canonical match (Muhammad / Ahmad dll)
    const ceTarget = SemesterGradingExcelService.canonicalizeStudentName(normTarget);
    const seTarget = SemesterGradingExcelService.compressRepeatedChars(ceTarget);
    const cleTarget = seTarget.replace(/\s+/g, '');
    const tokensTarget = seTarget.split(' ').filter(Boolean);

    for (const cand of candidates) {
      const normCand = getCandidateName(cand);
      if (!normCand) continue;

      const ceCand = SemesterGradingExcelService.canonicalizeStudentName(normCand);
      if (ceCand === ceTarget) {
        return { student: cand, matchedStudent: cand, confidence: 'FUZZY', matchType: 'FUZZY' };
      }

      const seCand = SemesterGradingExcelService.compressRepeatedChars(ceCand);
      if (seCand === seTarget) {
        return { student: cand, matchedStudent: cand, confidence: 'FUZZY', matchType: 'FUZZY' };
      }

      const cleCand = seCand.replace(/\s+/g, '');
      if (cleCand.length >= 6 && (cleTarget.includes(cleCand) || cleCand.includes(cleTarget))) {
        return { student: cand, matchedStudent: cand, confidence: 'FUZZY', matchType: 'FUZZY' };
      }

      const tokensCand = seCand.split(' ').filter(Boolean);
      const overlap = tokensTarget.filter((t) => t.length > 2 && tokensCand.includes(t));
      if (overlap.length >= 2 || (tokensTarget.length === 1 && overlap.length === 1)) {
        return { student: cand, matchedStudent: cand, confidence: 'FUZZY', matchType: 'FUZZY' };
      }
    }

    return { student: null, matchedStudent: null, confidence: 'UNMATCHED', matchType: 'UNMATCHED' };
  }

  /**
   * Validasi apakah sebuah string merupakan nama siswa yang sah:
   * - Bukan berupa angka murni atau formula kalkulasi Excel (misal: "31", "23.403225806451612", "40.5")
   * - Mengandung minimal 2 karakter alfabet latin (a-z / A-Z)
   * - Bukan kata kunci indikator statistik, rekap, tanda tangan, atau catatan footer
   */
  public static isLegitimateStudentName(rawName: string): boolean {
    const trimmed = String(rawName || '').trim();
    if (!trimmed) return false;

    // 1. Abaikan jika murni angka, desimal, atau kalkulasi Excel (misal "31", "23.403225806451612", "40.5", "100")
    if (/^[\d.,\s\-_/\\#%:=+]+$/.test(trimmed)) {
      return false;
    }

    // 2. Wajib mengandung minimal 2 karakter huruf alfabet (a-z / A-Z)
    // Nama siswa manusia selalu memiliki minimal 2 huruf (cth: "Al", "Ibnu", "Siti", "Ahmad")
    const letters = trimmed.match(/[a-zA-Z]/g);
    if (!letters || letters.length < 2) {
      return false;
    }

    // 3. Filter kata kunci non-siswa di kolom nama
    const nonStudentRegex =
      /^(kunci|kunci\s*jawaban|kunci_jawaban|rekap|rata[\s\-_]*rata|rerata|average|mean|median|modus|jumlah(\s*siswa)?|^total(\s*siswa)?|nilai\s*(tertinggi|terendah)|tertinggi|terendah|^max$|^min$|standar\s*deviasi|stdev|daya\s*serap|persentase|ketuntasan|mengetahui|kepala\s*sekolah|guru(\s*(mata\s*pelajaran|mapel|pengampu))?|pengawas|^nip\b|^nuptk\b|^ttd\b|tanda\s*tangan|catatan|keterangan|deskripsi)\b/i;

    if (nonStudentRegex.test(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Eksekusi penyimpanan sesi baru atau pembaruan sesi yang ada beserta nilai siswa.
   */
  public static async executeImport(
    params: ExecuteImportExcelSessionParams,
    userFallback?: UserProfile
  ): Promise<ExecuteImportResult> {
    const mode = params.mode || params.importMode || 'CREATE_NEW';
    const existingSessionId = params.existingSessionId || params.targetSessionId;
    const rawRows = params.rows || params.mappedRows || [];
    const currentUser = params.currentUser || userFallback || { id: 'usr_importer', full_name: 'Guru Pengampu' } as UserProfile;
    const sessionConfig = params.sessionConfig;

    const activeRows = rawRows.filter((r) => !r.excluded);

    let targetSession: ExamSessionRecord;

    const format = sessionConfig.format || sessionConfig.examFormat || 'PG_ONLY';

    if (mode === 'UPDATE_EXISTING' && existingSessionId) {
      const found = await ExamCorrectionRepository.getSessionById(existingSessionId);
      if (!found) {
        throw new Error('Sesi ujian yang dipilih tidak ditemukan.');
      }
      targetSession = found;
    } else {
      // Buat sesi ujian baru secara otomatis
      const defaultAnswerKey = format === 'PG_ONLY'
        ? Array.from({ length: 10 }, () => 'A')
        : Array.from({ length: 5 }, () => 'A');

      const createDTO: CreateExamSessionDTO = {
        session_name: sessionConfig.sessionName.trim(),
        teacher: (sessionConfig.teacherName || currentUser.full_name || 'Guru Pengampu').trim(),
        subject: sessionConfig.subject.trim(),
        class_name: sessionConfig.className.trim(),
        school_level: sessionConfig.className.toUpperCase().includes('SMA') ? 'SMA' : 'SMP',
        student_list: activeRows.map((r) => r.matchedStudentName || r.rawStudentName || r.rawName),
        answer_key: defaultAnswerKey,
        exam_type: sessionConfig.examType || 'PTS',
        academic_year: normalizeAcademicYearString(sessionConfig.academicYear || '') || '2026/2027',
        semester: sessionConfig.semester || 'Ganjil',
        kkm: Number(sessionConfig.kkm) || 75,
        scoring_config: {
          pgWeight: format === 'PG_ONLY' ? 1.0 : 0.7,
          essayWeight: format === 'PG_ONLY' ? 0.0 : 0.3,
          essayMaxScore: format === 'PG_ONLY' ? 0 : 20,
          essayCount: format === 'PG_ONLY' ? 0 : 5,
        },
      };

      targetSession = await ExamCorrectionRepository.saveExamSession(createDTO);
    }

    // Siapkan item nilai siswa untuk disimpan secara atomik
    const batchItems = activeRows.map((r, idx) => {
      const studentName = r.matchedStudentName || r.rawStudentName || r.rawName?.trim();
      const studentUserId = r.matchedStudentId || `imported_stu_${Date.now()}_${idx}`;
      const finalScore = Math.max(0, Math.min(100, Number(r.finalScore) || 0));
      const pgScore = r.pgScore !== null && r.pgScore !== undefined ? Math.max(0, Math.min(100, Number(r.pgScore))) : finalScore;
      const essayScore = r.essayScore !== null && r.essayScore !== undefined ? Math.max(0, Math.min(100, Number(r.essayScore))) : 0;

      return {
        session_id: targetSession.id,
        student_user_id: studentUserId,
        name: studentName,
        final_score: finalScore,
        mcq_score: pgScore,
        essay_score: essayScore,
        original_score: finalScore,
        mcq_answers: {},
        essay_scores: essayScore > 0 ? [essayScore] : [],
        correct: Math.round(pgScore / 10),
        wrong: 0,
        csi: finalScore >= (sessionConfig.kkm || 75) ? 85 : 65,
        lps: 80,
        source: 'IMPORT_EXCEL',
        actor_user_id: currentUser.id,
        actor_name: currentUser.full_name,
        actor_role: (currentUser.role || 'GURU').toUpperCase(),
      };
    });

    const batchRes = await ExamCorrectionRepository.batchSaveGradedStudents({
      session_id: targetSession.id,
      items: batchItems,
      source: 'IMPORT_EXCEL',
    });

    const savedCount = batchRes.results?.length ?? batchItems.length;

    logger.info(
      'UniversalExcelGradingService',
      `Berhasil mengimpor ${savedCount} nilai siswa ke sesi: ${targetSession.session_name} (${targetSession.id})`
    );

    return {
      success: true,
      session: targetSession,
      sessionId: targetSession.id,
      savedCount,
      message: `Berhasil mengimpor ${savedCount} nilai siswa ke sesi "${targetSession.session_name}".`,
    };
  }

  /**
   * Eksekusi import massal untuk seluruh sheet/kelas sekaligus dalam satu proses.
   */
  public static async executeImportAllSheets(
    params: ExecuteImportAllSheetsParams
  ): Promise<ExecuteImportAllSheetsResult> {
    const validSheets = (params.sheets || []).filter((s) => s.rows && s.rows.length > 0);
    if (validSheets.length === 0) {
      throw new Error('Tidak ada sheet atau kelas dengan data siswa yang dapat diimpor.');
    }

    const createdSessions: ExamSessionRecord[] = [];
    const itemResults: { sheetName: string; className: string; session: ExamSessionRecord; savedCount: number }[] = [];
    let totalSaved = 0;

    for (let i = 0; i < validSheets.length; i++) {
      const plan = validSheets[i];
      const targetName = plan.sessionConfig.className || plan.sheetName;
      params.onProgress?.(i + 1, validSheets.length, targetName);

      const singleResult = await this.executeImport(
        {
          mode: plan.mode || 'CREATE_NEW',
          existingSessionId: plan.existingSessionId,
          sessionConfig: plan.sessionConfig,
          rows: plan.rows,
          currentUser: params.currentUser,
        },
        params.currentUser
      );

      if (singleResult.success && singleResult.session) {
        createdSessions.push(singleResult.session);
        totalSaved += singleResult.savedCount;
        itemResults.push({
          sheetName: plan.sheetName,
          className: targetName,
          session: singleResult.session,
          savedCount: singleResult.savedCount,
        });
      }
    }

    const classNames = itemResults.map((r) => r.className).join(', ');
    return {
      success: true,
      totalSavedCount: totalSaved,
      totalSessionsCount: createdSessions.length,
      sessions: createdSessions,
      results: itemResults,
      message: `Berhasil mengimpor ${totalSaved} nilai siswa ke ${createdSessions.length} kelas (${classNames})!`,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helper Detectors (Role Word Engine)
  // ──────────────────────────────────────────────────────────────────────────

  private static detectHeaderRow(grid: any[][]): DetectedHeaderInfo {
    let bestRow = -1;
    let nameCol = -1;
    let pgCol = -1;
    let essayCol = -1;
    let subEssayCols: number[] = [];
    let totalCol = -1;
    let astsCol = -1;
    let asasCol = -1;
    let semesterNaCol = -1;
    let classCol = -1;

    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;

      let foundName = -1;
      let foundPg = -1;
      let foundEssay = -1;
      const foundSubEssays: number[] = [];
      let foundTotal = -1;
      let foundAsts = -1;
      let foundAsas = -1;
      let foundSemesterNa = -1;
      let foundClass = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();

        // 1. Nama Siswa
        if (/(nama\s*(siswa|peserta|lengkap|peserta\s*didik)?|^siswa$|^nama$)/i.test(val)) {
          foundName = c;
        }
        // 2. Skor/Nilai PG
        else if (/(skor\s*pg|nilai\s*pg|benar\s*\(pg\)|^pg$|total\s*pg|pilihan\s*ganda|mcq)/i.test(val)) {
          foundPg = c;
        }
        // 3. Skor/Nilai Essay / Esai (mendukung 'esai' dan 'essay')
        else if (/(skor\s*es[sa]+[iy]|nilai\s*es[sa]+[iy]|^es[sa]+[iy]$|uraian|isian|skor\s*uraian|nilai\s*uraian)/i.test(val)) {
          foundEssay = c;
        }
        // 4. Sub-butir esai (Soal E-1..Soal E-5, E1..E5)
        else if (/^(soal\s*e[\-_]?\d+|e\d+)$/i.test(val)) {
          foundSubEssays.push(c);
        }
        // 5. Total Skor / Nilai Ujian / Nilai Tunggal
        else if (/(^total$|^skor\s*total$|^total\s*skor$|^nilai\s*total$|^total\s*nilai$|^nilai\s*ujian$|^skor\s*ujian$|^nilai$|^skor$)/i.test(val)) {
          foundTotal = c;
        }
        // 6. ASTS / PTS / UTS
        else if (/(^asts$|^sts$|^pts$|^uts$|tengah\s*semester)/i.test(val)) {
          foundAsts = c;
        }
        // 7. ASAS / PAS / UAS / PAT
        else if (/(^asas$|^sas$|^pas$|^uas$|^pat$|akhir\s*semester)/i.test(val)) {
          foundAsas = c;
        }
        // 8. Nilai Akhir Rapor Semester (gabungan)
        else if (/(nilai\s*akhir|^na$|^skor\s*akhir|rata[\s\-]*rata\s*semester)/i.test(val)) {
          foundSemesterNa = c;
        }
        // 9. Kelas / Rombel
        else if (/(kelas|rombel)/i.test(val)) {
          foundClass = c;
        }
      }

      if (foundName >= 0) {
        bestRow = r;
        nameCol = foundName;
        pgCol = foundPg;
        essayCol = foundEssay;
        subEssayCols = foundSubEssays;
        totalCol = foundTotal;
        astsCol = foundAsts;
        asasCol = foundAsas;
        semesterNaCol = foundSemesterNa;
        classCol = foundClass;
        break;
      }
    }

    let formatType: 'CORRECTION_TABLE' | 'OFFICIAL_ASSESSMENT' | 'SIMPLE_TABLE' = 'SIMPLE_TABLE';
    if (pgCol >= 0 || essayCol >= 0 || subEssayCols.length > 0) {
      formatType = 'CORRECTION_TABLE';
    } else if (astsCol >= 0 || asasCol >= 0) {
      formatType = 'OFFICIAL_ASSESSMENT';
    }

    return {
      headerRowIndex: bestRow,
      nameColIndex: nameCol,
      pgColIndex: pgCol,
      essayColIndex: essayCol,
      subEssayColIndices: subEssayCols,
      totalColIndex: totalCol,
      astsColIndex: astsCol,
      asasColIndex: asasCol,
      semesterNaColIndex: semesterNaCol,
      classColIndex: classCol,
      formatType,
    };
  }

  private static detectClassFromContext(sheetName: string, grid: any[][], _headerInfo: any): string {
    const matchSheet = sheetName.match(/(?:kelas\s*)?([789][A-Za-z]?|1[0-2][A-Za-z]?|SMA)/i);
    if (matchSheet && matchSheet[1]) {
      const code = normalizeClassCode(matchSheet[1]);
      if (code && code !== 'ALL') return code;
    }

    const normSheet = normalizeClassCode(sheetName);
    if (normSheet && normSheet !== 'ALL') return normSheet;

    // Periksa sel baris 1-6 untuk keterangan kelas (misal: "Kelas: 9A")
    for (let r = 0; r < Math.min(6, grid.length); r++) {
      for (const cell of grid[r] || []) {
        const str = String(cell || '');
        const match = str.match(/kelas\s*[:\s]*([0-9]{1,2}[a-zA-Z]?|sma)/i);
        if (match && match[1]) {
          return normalizeClassCode(match[1]);
        }
      }
    }

    return '8A';
  }

  /**
   * Menganalisis dan mendeteksi nama mata pelajaran dari:
   * 1. Sel-sel header sheet (baris 0 - 15) baik format 1-sel ("Mapel: ...") maupun 2-sel ([A: "Mata Pelajaran", B: "Informatika"])
   * 2. Nama sheet (misal: "Informatika 8A", "Hadits Arbain", "MTK")
   * 3. Nama berkas file (misal: "koreksian soal oea.xlsx", "hadits_arbain.xlsx")
   * 4. Normalisasi ke subjek resmi sekolah dari OFFICIAL_SCHOOL_SUBJECTS (mengembalikan label resmi untuk dropdown)
   */
  public static detectSubjectFromContext(sheetName: string, grid: any[][], fileName: string = ''): string {
    let candidate = '';

    // 1. Cek sel header (baris 0 s/d 15)
    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim();
        if (!cellStr) continue;

        // A. Format 1 sel: "Mata Pelajaran : Informatika" atau "Mapel: Matematika" (Wajib ada pemisah titik dua/strip)
        const inlineMatch = cellStr.match(
          /^(?:mata\s*pelajaran|mata\s*uji|mata\s*diklat|mapel)\s*[:\-]\s*([a-zA-Z0-9\s().&'/\\-]+)$/i
        );
        if (inlineMatch && inlineMatch[1] && inlineMatch[1].trim() && inlineMatch[1].trim() !== '0') {
          const val = inlineMatch[1].trim();
          if (!/^(pelajaran|uji|diklat)$/i.test(val)) {
            candidate = val;
            break;
          }
        }

        // B. Format 2 sel: Sel ini bertuliskan label "Mata Pelajaran", sel di sebelahnya berisi nilainya!
        if (/^(mata\s*pelajaran|mata\s*uji|mapel)$/i.test(cellStr.replace(/[:\s]/g, ''))) {
          for (let nextC = c + 1; nextC < Math.min(c + 4, row.length); nextC++) {
            const nextVal = String(row[nextC] || '').trim().replace(/^[:\-\s]+/, '');
            if (nextVal && nextVal !== '0' && isNaN(Number(nextVal))) {
              candidate = nextVal;
              break;
            }
          }
          if (candidate) break;
        }
      }
      if (candidate) break;
    }

    // 2. Jika belum ditemukan di grid, cek nama sheet
    if (!candidate) {
      const cleanSheet = sheetName.replace(/kelas\s*[0-9]{1,2}[a-zA-Z]?|[0-9]{1,2}[a-zA-Z]?/gi, '').trim();
      if (cleanSheet.length >= 3) {
        candidate = cleanSheet;
      }
    }

    // 3. Jika belum ditemukan, cek nama file
    if (!candidate && fileName) {
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const cleanFile = baseName
        .replace(/koreksian|format|soal|rekap|nilai|penilaian|kelas\s*[0-9]{1,2}[a-zA-Z]?/gi, '')
        .replace(/[_\-\s]+/g, ' ')
        .trim();
      if (cleanFile.length >= 3) {
        candidate = cleanFile;
      }
    }

    // 4. Normalisasi candidate ke daftar mata pelajaran resmi sekolah (OFFICIAL_SCHOOL_SUBJECTS)
    if (candidate) {
      const normalizedOfficialLabel = this.resolveOfficialSubjectLabel(candidate);
      if (normalizedOfficialLabel) return normalizedOfficialLabel;
      return candidate;
    }

    // 5. Cek kata kunci umum di nama sheet atau nama file sebagai fallback
    const contextToSearch = `${sheetName} ${fileName}`.toLowerCase();
    const fallbackMap: Record<string, string> = {
      mtk: 'MTK – Matematika',
      matematika: 'MTK – Matematika',
      ipa: 'IPA – Ilmu Pengetahuan Alam',
      ips: 'IPS – Ilmu Pengetahuan Sosial',
      bing: 'B. Inggris – Bahasa Inggris',
      inggris: 'B. Inggris – Bahasa Inggris',
      bindo: 'B. Indonesia – Bahasa Indonesia',
      indonesia: 'B. Indonesia – Bahasa Indonesia',
      pai: 'PAI – Pendidikan Agama Islam',
      pjok: 'PJOK',
      olahraga: 'PJOK',
      pkn: 'PP – Pendidikan Pancasila',
      pancasila: 'PP – Pendidikan Pancasila',
      infor: 'Informatika',
      informatika: 'Informatika',
      komputer: 'Informatika',
      tik: 'Informatika',
      oea: 'Informatika',
      seni: 'SBPK – Seni Budaya dan Prakarya',
      sbk: 'SBPK – Seni Budaya dan Prakarya',
      prakarya: 'SBPK – Seni Budaya dan Prakarya',
      hadits: 'Hadits',
      hadist: 'Hadits',
      arab: 'B. Arab – Bahasa Arab',
      btq: "BTQ – Baca Tulis Al-Qur'an",
      tahfidz: "BTQ – Baca Tulis Al-Qur'an",
    };

    for (const [key, val] of Object.entries(fallbackMap)) {
      if (contextToSearch.includes(key)) {
        return val;
      }
    }

    return 'Informatika';
  }

  /**
   * Menemukan label resmi dari daftar OFFICIAL_SCHOOL_SUBJECTS berdasarkan nama, kode, atau alias.
   */
  public static resolveOfficialSubjectLabel(text: string): string | null {
    if (!text) return null;
    const clean = text.trim().toLowerCase();

    for (const subj of OFFICIAL_SCHOOL_SUBJECTS) {
      if (
        subj.name.toLowerCase() === clean ||
        subj.label.toLowerCase() === clean ||
        subj.code.toLowerCase() === clean
      ) {
        return subj.label;
      }
      for (const alias of subj.aliases) {
        if (alias.toLowerCase() === clean || clean.includes(alias.toLowerCase())) {
          return subj.label;
        }
      }
    }
    return null;
  }

  /**
   * Menganalisis dan mendeteksi nama Guru Pengampu dari berkas Excel:
   * 1. Sel Header (baris 0 - 15)
   * 2. Blok Tanda Tangan / Footer (di bawah tabel siswa)
   * 3. Pencocokan dengan direktori guru terdaftar di sekolah (availableTeachers / currentUser)
   */
  public static detectTeacherFromContext(
    grid: any[][],
    availableTeachers: UserProfile[] = [],
    currentUser?: UserProfile
  ): string {
    let candidate = '';

    // 1. Cek sel header (baris 0 s/d 15)
    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim();
        if (!cellStr) continue;

        // A. Format 1 sel: "Guru Pengampu : Dafa Maulana" atau "Nama Guru: ..." (Wajib ada pemisah titik dua/strip)
        const inlineMatch = cellStr.match(
          /^(?:guru\s*pengampu|guru\s*mata\s*pelajaran|guru\s*mapel|nama\s*guru|guru|pengajar|pendidik)\s*[:\-]\s*([a-zA-Z\s.,'`-]+)$/i
        );
        if (inlineMatch && inlineMatch[1]) {
          const val = this.cleanTeacherName(inlineMatch[1]);
          if (
            this.isLegitimateStudentName(val) &&
            !/^(pengampu|mata\s*pelajaran|mapel|kelas|bidang\s*studi)$/i.test(val)
          ) {
            candidate = val;
            break;
          }
        }

        // B. Format 2 sel: Sel ini adalah label "Guru Pengampu" / "Guru", sel di sebelahnya adalah namanya
        if (
          /^(guru\s*pengampu|guru\s*mata\s*pelajaran|guru\s*mapel|nama\s*guru|guru|pengajar|pendidik)$/i.test(
            cellStr.replace(/[:\s]/g, '')
          )
        ) {
          for (let nextC = c + 1; nextC < Math.min(c + 4, row.length); nextC++) {
            const nextVal = this.cleanTeacherName(String(row[nextC] || ''));
            if (nextVal && this.isLegitimateStudentName(nextVal) && isNaN(Number(nextVal))) {
              candidate = nextVal;
              break;
            }
          }
          if (candidate) break;
        }
      }
      if (candidate) break;
    }

    // 2. Jika belum ditemukan di header, cari di area footer tanda tangan (r >= 10 s/d akhir sheet)
    if (!candidate && grid.length >= 10) {
      for (let r = 10; r < grid.length; r++) {
        const row = grid[r] || [];
        for (let c = 0; c < row.length; c++) {
          const cellStr = String(row[c] || '').trim();
          if (!cellStr) continue;

          // Cek label tanda tangan guru: "Guru Mata Pelajaran,", "Guru Pengampu,", "Guru Kelas,"
          if (
            /^(guru\s*(mata\s*pelajaran|pengampu|kelas|bidang\s*studi|mapel)?|pengajar|pendidik)[,:]?$/i.test(
              cellStr
            )
          ) {
            // Telusuri 1 s/d 6 baris di bawahnya pada kolom yang sama (atau c-1, c+1)
            for (let downR = r + 1; downR <= Math.min(r + 6, grid.length - 1); downR++) {
              for (let colOffset = -1; colOffset <= 1; colOffset++) {
                const targetCol = c + colOffset;
                if (targetCol < 0) continue;
                const signCell = String(grid[downR]?.[targetCol] || '').trim();
                const cleaned = this.cleanTeacherName(signCell);
                if (
                  cleaned &&
                  cleaned.length >= 3 &&
                  this.isLegitimateStudentName(cleaned) &&
                  !/^(nip|nuptk|kepala\s*sekolah|mengetahui)/i.test(cleaned)
                ) {
                  candidate = cleaned;
                  break;
                }
              }
              if (candidate) break;
            }
          }
          if (candidate) break;
        }
        if (candidate) break;
      }
    }

    // 3. Cocokkan dengan database profil guru resmi (availableTeachers)
    if (candidate && availableTeachers.length > 0) {
      const matched = this.matchTeacherWithDirectory(candidate, availableTeachers);
      if (matched) return matched.full_name;
    }

    // 4. Jika candidate ditemukan, kembalikan candidate
    if (candidate) {
      return candidate;
    }

    // 5. Fallback ke currentUser jika ada
    if (currentUser?.full_name) {
      return currentUser.full_name;
    }

    return '';
  }

  /**
   * Membersihkan string nama guru dari tanda kurung, titik dua, dan spasi berlebih.
   */
  public static cleanTeacherName(raw: string): string {
    return String(raw || '')
      .replace(/^[(\s:'"-]+|[)\s:'"-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Mencocokkan nama guru dari Excel dengan master profil guru di sekolah.
   */
  public static matchTeacherWithDirectory(rawName: string, teachers: UserProfile[]): UserProfile | null {
    if (!rawName || !teachers || teachers.length === 0) return null;
    const cleanRaw = this.cleanTeacherName(rawName).toLowerCase();
    const stripTitles = (name: string) =>
      name
        .toLowerCase()
        .replace(/,\s*(s\.pd\.?|m\.pd\.?|s\.e\.?|s\.mat\.?|s\.si\.?|s\.kom\.?|s\.pd\.i\.?|g\.r\.?|m\.m\.?|m\.si\.?|ph\.d\.?)/gi, '')
        .trim();

    const baseRaw = stripTitles(cleanRaw);

    for (const t of teachers) {
      const tName = (t.full_name || '').toLowerCase();
      const baseT = stripTitles(tName);
      if (tName === cleanRaw || baseT === baseRaw) {
        return t;
      }
      if (baseRaw.length >= 4 && (baseT.includes(baseRaw) || baseRaw.includes(baseT))) {
        return t;
      }
    }
    return null;
  }

  private static parseNumericScore(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(String(val).replace(',', '.').trim());
    return isNaN(num) ? null : Math.max(0, Math.min(100, num));
  }
}
