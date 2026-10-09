import * as XLSX from 'xlsx';
import { ProviderFactory } from '../providers/provider-factory';
import type {
  ExamSessionRecord,
  CreateExamSessionDTO,
  GradedStudentScoreRecord,
  SaveGradedStudentDTO,
  BatchSaveGradesDTO,
  BatchSaveGradesResult,
  SyncScoresToGradeMasterDTO,
  SyncScoresToGradeMasterResult,
  BulkSyncSessionsOptions,
  BulkSyncSessionsResult,
} from '../types/database.types';
import { useSettingsStore } from '../store/useSettingsStore';
import { resolveSessionAcademicYear } from '../utils/academic-year.utils';
import { logger } from '../utils/logger.utils';

export interface ClassRecapSummary {
  totalStudents: number;
  gradedCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  remedialCount: number;
  passRate: number;
}

export interface SessionFetchResult {
  data: ExamSessionRecord[];
  status: 'ok' | 'offline_cache' | 'error';
  error?: string;
}

export interface GradedStudentsFetchResult {
  data: GradedStudentScoreRecord[];
  status: 'ok' | 'offline_cache' | 'error';
  error?: string;
}

export class ExamCorrectionRepository {
  /**
   * Retrieves all exam sessions with explicit load status ('ok' | 'offline_cache' | 'error').
   */
  public static async getSessionsWithStatus(token?: string): Promise<SessionFetchResult> {
    try {
      const provider = ProviderFactory.getProvider();
      const data = await provider.getExamSessions(token);
      return { data: Array.isArray(data) ? data : [], status: 'ok' };
    } catch (err: any) {
      logger.warn('ExamCorrectionRepository', 'Cloud load failed, checking offline cache:', err?.message || err);
      try {
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('smart_absensi_exam_sessions');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return { data: parsed, status: 'offline_cache', error: err?.message || 'Memuat draft offline lokal' };
            }
          }
        }
      } catch {}
      return { data: [], status: 'error', error: err?.message || 'Gagal memuat sesi ujian' };
    }
  }

  /**
   * Retrieves all exam sessions available from active provider.
   */
  public static async getSessions(token?: string): Promise<ExamSessionRecord[]> {
    const res = await this.getSessionsWithStatus(token);
    return res.data;
  }

  /**
   * Retrieves full exam session detail by ID (including answer_key and student_list).
   */
  public static async getSessionById(sessionId: string, token?: string): Promise<ExamSessionRecord | null> {
    const provider = ProviderFactory.getProvider();
    if (typeof provider.getExamSessionById === 'function') {
      return await provider.getExamSessionById(sessionId, token);
    }
    const sessions = await this.getSessions(token);
    return sessions.find((s) => s.id === sessionId) || null;
  }

  /**
   * Saves or updates an exam session.
   */
  public static async saveSession(
    session: CreateExamSessionDTO,
    token?: string
  ): Promise<ExamSessionRecord> {
    const provider = ProviderFactory.getProvider();
    return await provider.saveExamSession(session, token);
  }

  /**
   * Deletes an exam session and its associated student grades.
   */
  public static async deleteSession(sessionId: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return await provider.deleteExamSession(sessionId, token);
  }

  /**
   * Retrieves all graded students for a session with explicit status.
   */
  public static async getGradedStudentsWithStatus(
    sessionId: string,
    token?: string
  ): Promise<GradedStudentsFetchResult> {
    try {
      const provider = ProviderFactory.getProvider();
      const data = await provider.getGradedStudents(sessionId, token);
      return { data: Array.isArray(data) ? data : [], status: 'ok' };
    } catch (err: any) {
      logger.warn('ExamCorrectionRepository', 'Graded students cloud fetch failed, checking offline cache:', err?.message || err);
      try {
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem(`smart_absensi_graded_${sessionId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return { data: parsed, status: 'offline_cache', error: err?.message || 'Memuat draft offline' };
            }
          }
        }
      } catch {}
      return { data: [], status: 'error', error: err?.message || 'Gagal memuat nilai siswa' };
    }
  }

  /**
   * Retrieves all graded students for a session.
   */
  public static async getGradedStudents(
    sessionId: string,
    token?: string
  ): Promise<GradedStudentScoreRecord[]> {
    const res = await this.getGradedStudentsWithStatus(sessionId, token);
    return res.data;
  }

  /**
   * Saves or updates a graded student result.
   */
  public static async saveGradedStudent(
    data: SaveGradedStudentDTO,
    token?: string
  ): Promise<GradedStudentScoreRecord> {
    const provider = ProviderFactory.getProvider();
    return await provider.saveGradedStudent(data, token);
  }

  /**
   * Saves multiple graded student results atomically in a single batch request.
   */
  public static async batchSaveGradedStudents(
    data: BatchSaveGradesDTO,
    token?: string
  ): Promise<BatchSaveGradesResult> {
    const provider = ProviderFactory.getProvider();
    if (typeof provider.batchSaveGradedStudents === 'function') {
      return await provider.batchSaveGradedStudents(data, token);
    }
    const results: GradedStudentScoreRecord[] = [];
    for (const item of data.items) {
      const saved = await provider.saveGradedStudent(item, token);
      results.push(saved);
    }
    return {
      success: true,
      total_processed: results.length,
      results,
    };
  }

  /**
   * Deletes a student grade record.
   */
  public static async deleteGradedStudent(studentId: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return await provider.deleteGradedStudent(studentId, token);
  }

  /**
   * Synchronizes score list directly to GradeMaster HTTP API bridge.
   */
  public static async syncScoresToGradeMaster(
    data: SyncScoresToGradeMasterDTO,
    _token?: string
  ): Promise<SyncScoresToGradeMasterResult> {
    const { syncScoresToGradeMaster } = await import('../services/grademaster-sync.service');
    return await syncScoresToGradeMaster(data);
  }

  /**
   * Synchronizes an existing exam session and all its graded students to GradeMaster.
   */
  public static async syncSessionToGradeMaster(
    sessionId: string,
    token?: string
  ): Promise<SyncScoresToGradeMasterResult> {
    const { syncExistingSessionToGradeMaster } = await import('../services/grademaster-sync.service');
    return await syncExistingSessionToGradeMaster(sessionId, token);
  }

  /**
   * Synchronizes all eligible exam sessions to GradeMaster in bulk.
   * Smartly deduplicates duplicate sessions and student scores, and respects target academic year & semester.
   */
  public static async syncAllSessionsToGradeMaster(
    options?: BulkSyncSessionsOptions,
    token?: string
  ): Promise<BulkSyncSessionsResult> {
    const { syncAllSessionsToGradeMaster } = await import('../services/grademaster-sync.service');
    return await syncAllSessionsToGradeMaster(options, token);
  }

  /**
   * Computes class performance analytics.
   */
  public static computeClassSummary(
    gradedStudents: GradedStudentScoreRecord[],
    kkm: number = 75,
    totalStudentsInClass: number = 0
  ): ClassRecapSummary {
    const gradedCount = gradedStudents.length;
    if (gradedCount === 0) {
      return {
        totalStudents: totalStudentsInClass,
        gradedCount: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passedCount: 0,
        remedialCount: 0,
        passRate: 0,
      };
    }

    const scores = gradedStudents.map((s) => Number(s.final_score) || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const averageScore = Math.round((sum / gradedCount) * 10) / 10;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    const passedCount = gradedStudents.filter((s) => (Number(s.final_score) || 0) >= kkm).length;
    const remedialCount = gradedCount - passedCount;
    const passRate = Math.round((passedCount / gradedCount) * 100);

    return {
      totalStudents: Math.max(totalStudentsInClass, gradedCount),
      gradedCount,
      averageScore,
      highestScore,
      lowestScore,
      passedCount,
      remedialCount,
      passRate,
    };
  }

  /**
   * Resolves student gender ('L' | 'P' | '-').
   */
  public static resolveStudentGender(studentName: string, className?: string): 'L' | 'P' | '-' {
    const normClass = (className || '').toUpperCase().trim();
    if (normClass.includes('8A') || normClass.includes('9A')) return 'P';
    if (normClass.includes('8B') || normClass.includes('9B')) return 'L';

    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('smart_absensi_students');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const cleanTarget = studentName.trim().toUpperCase();
            const match = list.find((s: any) => (s.fullName || s.name || '').trim().toUpperCase() === cleanTarget);
            if (match && (match.gender === 'L' || match.gender === 'P')) {
              return match.gender;
            }
          }
        }
      }
    } catch {
      // ignore local storage errors in non-browser env
    }
    return '-';
  }

  /**
   * Builds an official, styled REKAP NILAI worksheet with full student grades table,
   * AutoFilter, gridlines, class summary statistics, and signatures.
   */
  public static buildRecapWorksheet(
    session: ExamSessionRecord,
    students: GradedStudentScoreRecord[]
  ): XLSX.WorkSheet {
    const appSettings = useSettingsStore.getState().settings;
    const institutionName = appSettings.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';
    const appName = appSettings.app_name || 'Smart Absensi Guru';

    const kkm = Number(session.kkm) || 75;
    const pgCount = session.answer_key?.length || 0;
    const essayCount = session.scoring_config?.essayCount ?? 0;
    const pgWeight = session.scoring_config?.pgWeight ? Math.round(session.scoring_config.pgWeight * 100) : 100;
    const essayWeight = session.scoring_config?.essayWeight ? Math.round(session.scoring_config.essayWeight * 100) : 0;

    // Header rows
    const rows: (string | number)[][] = [
      [appName.toUpperCase()],
      [institutionName.toUpperCase()],
      ['REKAPITULASI HASIL PENILAIAN & KOREKSI UJIAN'],
      [''],
      ['Mata Pelajaran', `: ${session.subject}`],
      ['Kelas / Rombel', `: Kelas ${session.class_name} (${session.school_level || 'SMP/SMA'})`],
      ['Guru Pengampu', `: ${session.teacher}`],
      ['Nama Sesi Ujian', `: ${session.session_name}`],
      ['Tahun Ajaran / Semester', `: ${resolveSessionAcademicYear(session.academic_year, session.session_name, session.created_at)} - ${session.semester || 'Ganjil'}`],
      ['Kriteria Ketuntasan Minimal (KKM)', `: ${kkm}`],
      ['Komposisi Soal & Bobot', `: PG: ${pgWeight}% (${pgCount} Butir) | Essay: ${essayWeight}% (${essayCount} Butir)`],
      [''],
      [
        'No',
        'Nama Peserta Didik',
        'L/P',
        'Benar (PG)',
        'Salah (PG)',
        'Nilai PG',
        'Nilai Essay',
        'Nilai Akhir',
        'Predikat',
        'Status Ketuntasan',
        'CSI',
        'LPS',
        'Keterangan Deskriptif',
      ],
    ];

    // Student rows
    students.forEach((s, idx) => {
      const finalScore = Number(s.final_score) || 0;
      const isPassed = finalScore >= kkm;
      const status = isPassed ? 'TUNTAS' : 'REMEDIAL';

      let predikat = 'D';
      let ket = 'Remedial — Belum mencapai KKM, perlu perbaikan kompetensi';
      if (finalScore >= 90) {
        predikat = 'A';
        ket = 'Sangat Baik — Penguasaan materi amat memuaskan';
      } else if (finalScore >= 80) {
        predikat = 'B';
        ket = 'Baik — Penguasaan materi baik dan tuntas';
      } else if (finalScore >= kkm) {
        predikat = 'C';
        ket = 'Cukup — Penguasaan materi cukup dan mencapai KKM';
      }

      const gender = this.resolveStudentGender(s.name, session.class_name);

      rows.push([
        idx + 1,
        s.name,
        gender,
        s.correct,
        s.wrong,
        s.mcq_score,
        s.essay_score,
        finalScore,
        predikat,
        status,
        s.csi || 0,
        s.lps || 0,
        ket,
      ]);
    });

    // Summary statistics row
    const summary = this.computeClassSummary(students, kkm, session.student_list?.length || students.length);
    rows.push(['']);
    rows.push(['RINGKASAN & STATISTIK HASIL KELAS']);
    rows.push(['Total Siswa Dinilai', `: ${summary.gradedCount} Siswa`]);
    rows.push(['Rata-rata Nilai Kelas', `: ${summary.averageScore}`]);
    rows.push(['Nilai Tertinggi', `: ${summary.highestScore}`]);
    rows.push(['Nilai Terendah', `: ${summary.lowestScore}`]);
    rows.push(['Jumlah Tuntas (>= KKM)', `: ${summary.passedCount} Siswa`]);
    rows.push(['Jumlah Remedial (< KKM)', `: ${summary.remedialCount} Siswa`]);
    rows.push(['Persentase Ketuntasan Kelas', `: ${summary.passRate}%`]);

    // Signatures
    rows.push(['']);
    rows.push(['', '', '', '', '', '', '', '', 'Mengetahui,']);
    rows.push(['', 'Kepala Sekolah,', '', '', '', '', '', '', 'Guru Mata Pelajaran,']);
    rows.push(['']);
    rows.push(['']);
    rows.push(['']);
    rows.push(['', '( ....................................................... )', '', '', '', '', '', '', `( ${session.teacher || '.......................................................'} )`]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    worksheet['!cols'] = [
      { wch: 6 },  // A: No
      { wch: 34 }, // B: Nama Peserta Didik
      { wch: 8 },  // C: L/P
      { wch: 12 }, // D: Benar (PG)
      { wch: 12 }, // E: Salah (PG)
      { wch: 12 }, // F: Nilai PG
      { wch: 12 }, // G: Nilai Essay
      { wch: 14 }, // H: Nilai Akhir
      { wch: 10 }, // I: Predikat
      { wch: 18 }, // J: Status Ketuntasan
      { wch: 10 }, // K: CSI
      { wch: 10 }, // L: LPS
      { wch: 45 }, // M: Keterangan Deskriptif
    ];

    // Explicit native Excel AutoFilter on the table header (Row 13)
    const headerRow = 13;
    const lastStudentRow = headerRow + Math.max(students.length, 1);
    worksheet['!autofilter'] = { ref: `A${headerRow}:M${lastStudentRow}` };

    // Explicit gridline visibility
    worksheet['!views'] = [{ showGridLines: true }];

    return worksheet;
  }

  /**
   * Exports class exam recap to an official Excel file (.xlsx) with interactive table, AutoFilter & gridlines.
   */
  public static exportToExcel(
    session: ExamSessionRecord,
    students: GradedStudentScoreRecord[]
  ): void {
    const worksheet = this.buildRecapWorksheet(session, students);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'REKAP NILAI');
    const wbAny = workbook as any;
    wbAny.Workbook = {
      Views: [{ activeTab: 0 }],
      WBView: [{ activeTab: 0, showSheetTabs: true }],
    };

    const cleanFilename = `Rekap_Nilai_${session.subject}_${session.class_name}_${session.exam_type || 'Ujian'}.xlsx`.replace(
      /\s+/g,
      '_'
    );
    XLSX.writeFile(workbook, cleanFilename);
    logger.info('ExamCorrectionRepository', `Exported rekap nilai table: ${cleanFilename}`);
  }

  /**
   * Exports class exam recap to CSV format.
   */
  public static exportToCSV(
    session: ExamSessionRecord,
    students: GradedStudentScoreRecord[]
  ): string {
    const kkm = Number(session.kkm) || 75;
    const lines: string[] = [];

    lines.push(`REKAP NILAI UJIAN - ${session.subject} - KELAS ${session.class_name}`);
    lines.push(`Guru: ${session.teacher}, KKM: ${kkm}`);
    lines.push('No,Nama Siswa,Benar,Salah,Nilai PG,Nilai Essay,Skor Akhir,Status,CSI,LPS');

    students.forEach((s, idx) => {
      const score = Number(s.final_score) || 0;
      const status = score >= kkm ? 'TUNTAS' : 'REMEDIAL';
      const cleanName = `"${s.name.replace(/"/g, '""')}"`;
      lines.push(`${idx + 1},${cleanName},${s.correct},${s.wrong},${s.mcq_score},${s.essay_score},${score},${status},${s.csi || 0},${s.lps || 0}`);
    });

    const csvContent = '\uFEFF' + lines.join('\n');

    if (typeof window !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rekap_Nilai_${session.subject}_${session.class_name}.csv`.replace(/\s+/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvContent;
  }
}
