/**
 * SMART ABSENSI GURU — UNIVERSAL EXCEL GRADING SERVICE
 * 
 * Modul cerdas untuk mengimpor nilai siswa langsung dari berbagai format file Excel:
 * 1. Mendukung template multi-sheet resmi sekolah ("FORMAT PENILAIAN ASTS & ASAS.xlsx").
 * 2. Mendukung format tabel Excel umum/kustom (kolom Nama, Kelas, Nilai PG, Essay, Nilai Akhir).
 * 3. Pencocokan cerdas siswa (Exact match & Fuzzy match dengan nama Indonesia).
 * 4. Otomatis membuat sesi ujian baru dan mengisi nilai PG/Essay secara atomik.
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

export class UniversalExcelGradingService {
  /**
   * Parse sembarang file Excel (.xlsx / .xls) dan mendeteksi apakah itu format
   * Multi-Sheet resmi sekolah atau format tabel umum.
   */
  public static async parseExcelFile(
    file: File | ArrayBuffer | Uint8Array,
    allDirectoryStudents: StudentItem[] = []
  ): Promise<UniversalExcelParsedSheet[]> {
    let data: Uint8Array;
    if (typeof File !== 'undefined' && file instanceof File) {
      const buffer = await file.arrayBuffer();
      data = new Uint8Array(buffer);
    } else if (file instanceof Uint8Array) {
      data = file;
    } else {
      data = new Uint8Array(file as ArrayBuffer);
    }

    const wb = XLSX.read(data, { type: 'array' });
    const sheetsResult: UniversalExcelParsedSheet[] = [];

    // 1. Periksa apakah ini Template Multi-Sheet Resmi ASTS & ASAS
    const isOfficialTemplate =
      wb.SheetNames.includes('IDENTITAS SEKOLAH') ||
      wb.SheetNames.includes('FORMAT PENILAIAN') ||
      wb.SheetNames.some((n) => SemesterGradingExcelService.CANONICAL_CLASSES.includes(n as any));

    if (isOfficialTemplate) {
      const parsedOfficial = await SemesterGradingExcelService.importScoresFromExcel(
        new File([data as any], 'import.xlsx')
      );

      for (const po of parsedOfficial) {
        if (po.students.length === 0) continue;

        const filteredDirStudents = allDirectoryStudents.filter((s) =>
          areClassCodesEqual(s.className || '', po.className)
        );

        const rows: UniversalExcelStudentRow[] = po.students.map((st, idx) => {
          const match = this.matchStudent(st.name, filteredDirStudents);
          const asts = st.asts ?? null;
          const asas = st.asas ?? null;
          const finalScore = st.finalScore ?? (asts !== null && asas !== null ? (asts + asas) / 2 : (asts ?? asas ?? 0));
          const roundedFinal = Math.round(finalScore * 10) / 10;

          return {
            rowNumber: st.no || idx + 1,
            rawName: st.name,
            rawStudentName: st.name,
            matchedStudentId: match.student?.id,
            matchedStudentName: match.student?.fullName || (match.student as any)?.name,
            matchConfidence: match.confidence,
            matchType: match.confidence,
            pgScore: asts,
            essayScore: asas,
            finalScore: roundedFinal,
            originalScore: roundedFinal,
            passed: roundedFinal >= (po.kkm || 75),
          };
        });

        sheetsResult.push({
          sheetName: po.className,
          detectedClass: po.className,
          detectedClassName: po.className,
          detectedSubject: po.subject || 'Mata Pelajaran',
          detectedTeacher: po.teacher || '',
          detectedAcademicYear: po.academicYear || AdministrationRepository.getActiveAcademicYear() || '2026/2027',
          detectedSemester: po.semester || (AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil'),
          detectedKkm: po.kkm || 75,
          detectedFormat: 'PG_AND_ESSAY',
          rows,
        });
      }

      if (sheetsResult.length > 0) {
        return sheetsResult;
      }
    }

    // 2. Format Tabel Umum (Single-Sheet atau Arbitrary Sheets)
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rawGrid: any[][] = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (rawGrid.length < 2) continue;

      // Cari baris header yang paling relevan
      const headerInfo = this.detectHeaderRow(rawGrid);
      if (headerInfo.headerRowIndex < 0 || headerInfo.nameColIndex < 0) {
        continue;
      }

      const detectedClass = this.detectClassFromContext(sheetName, rawGrid, headerInfo);
      const filteredDirStudents = allDirectoryStudents.filter((s) =>
        detectedClass === 'ALL' || areClassCodesEqual(s.className || '', detectedClass)
      );

      const rows: UniversalExcelStudentRow[] = [];
      const hasEssay = headerInfo.essayColIndex >= 0;

      for (let r = headerInfo.headerRowIndex + 1; r < rawGrid.length; r++) {
        const rowData = rawGrid[r];
        if (!rowData) continue;

        const rawNameVal = String(rowData[headerInfo.nameColIndex] || '').trim();
        // Abaikan baris kosong, baris nomor tanpa nama, atau baris rekap
        if (!rawNameVal || /^(rekap|rata-rata|jumlah|total|keterangan|ttd)/i.test(rawNameVal)) {
          continue;
        }

        const pgVal = headerInfo.pgColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.pgColIndex]) : null;
        const essayVal = headerInfo.essayColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.essayColIndex]) : null;
        const finalVal = headerInfo.finalColIndex >= 0 ? this.parseNumericScore(rowData[headerInfo.finalColIndex]) : null;

        let computedFinal = 0;
        let computedPg = pgVal;
        let computedEssay = essayVal;

        if (finalVal !== null) {
          computedFinal = finalVal;
          if (computedPg === null && computedEssay === null) {
            computedPg = finalVal; // Jika hanya nilai akhir, alokasikan ke PG
            computedEssay = 0;
          }
        } else if (pgVal !== null && essayVal !== null) {
          computedFinal = Math.round((pgVal * 0.7 + essayVal * 0.3) * 10) / 10;
        } else if (pgVal !== null) {
          computedFinal = pgVal;
        } else if (essayVal !== null) {
          computedFinal = essayVal;
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
          passed: computedFinal >= 75,
        });
      }

      if (rows.length > 0) {
        sheetsResult.push({
          sheetName,
          detectedClass: detectedClass !== 'ALL' ? detectedClass : '8A',
          detectedClassName: detectedClass !== 'ALL' ? detectedClass : '8A',
          detectedSubject: this.detectSubjectFromContext(sheetName, rawGrid),
          detectedTeacher: '',
          detectedAcademicYear: AdministrationRepository.getActiveAcademicYear() || '2026/2027',
          detectedSemester: AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil',
          detectedKkm: 75,
          detectedFormat: hasEssay ? 'PG_AND_ESSAY' : 'PG_ONLY',
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
    _fileName: string = 'import.xlsx',
    allDirectoryStudents: StudentItem[] = []
  ): Promise<{ sheets: UniversalExcelParsedSheet[] }> {
    const sheets = await this.parseExcelFile(buffer as any, allDirectoryStudents);
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

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helper Detectors
  // ──────────────────────────────────────────────────────────────────────────

  private static detectHeaderRow(grid: any[][]): {
    headerRowIndex: number;
    nameColIndex: number;
    pgColIndex: number;
    essayColIndex: number;
    finalColIndex: number;
    classColIndex: number;
  } {
    let bestRow = -1;
    let nameCol = -1;
    let pgCol = -1;
    let essayCol = -1;
    let finalCol = -1;
    let classCol = -1;

    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;

      let foundName = -1;
      let foundPg = -1;
      let foundEssay = -1;
      let foundFinal = -1;
      let foundClass = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();

        if (/(nama\s*(siswa|peserta|lengkap)?|^siswa$|^nama$)/i.test(val)) {
          foundName = c;
        } else if (/(skor\s*pg|nilai\s*pg|pilihan\s*ganda|^pg$)/i.test(val)) {
          foundPg = c;
        } else if (/(skor\s*essay|nilai\s*essay|uraian|^essay$)/i.test(val)) {
          foundEssay = c;
        } else if (/(nilai\s*(akhir|total|murni)|skor\s*akhir|^na$|^nilai$)/i.test(val)) {
          foundFinal = c;
        } else if (/(kelas|rombel)/i.test(val)) {
          foundClass = c;
        }
      }

      if (foundName >= 0) {
        bestRow = r;
        nameCol = foundName;
        pgCol = foundPg;
        essayCol = foundEssay;
        finalCol = foundFinal;
        classCol = foundClass;
        break;
      }
    }

    return {
      headerRowIndex: bestRow,
      nameColIndex: nameCol,
      pgColIndex: pgCol,
      essayColIndex: essayCol,
      finalColIndex: finalCol,
      classColIndex: classCol,
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

  private static detectSubjectFromContext(sheetName: string, grid: any[][]): string {
    for (let r = 0; r < Math.min(6, grid.length); r++) {
      for (const cell of grid[r] || []) {
        const str = String(cell || '');
        const match = str.match(/mata pelajaran\s*[:\s]*([a-zA-Z0-9\s]+)/i);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    // Cek kata kunci umum di nama sheet
    const subMap: Record<string, string> = {
      mtk: 'Matematika',
      matematika: 'Matematika',
      ipa: 'Ilmu Pengetahuan Alam (IPA)',
      ips: 'Ilmu Pengetahuan Sosial (IPS)',
      bing: 'Bahasa Inggris',
      inggris: 'Bahasa Inggris',
      bindo: 'Bahasa Indonesia',
      indonesia: 'Bahasa Indonesia',
      pai: 'Pendidikan Agama Islam',
      pjok: 'PJOK',
      pkn: 'Pendidikan Pancasila / PKn',
      infor: 'Informatika',
      seni: 'Seni Budaya',
    };

    const lowerSheet = sheetName.toLowerCase();
    for (const [key, val] of Object.entries(subMap)) {
      if (lowerSheet.includes(key)) return val;
    }

    return 'Informatika';
  }

  private static parseNumericScore(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(String(val).replace(',', '.').trim());
    return isNaN(num) ? null : Math.max(0, Math.min(100, num));
  }
}
