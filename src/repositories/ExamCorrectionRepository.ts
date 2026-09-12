import * as XLSX from 'xlsx';
import { ProviderFactory } from '../providers/provider-factory';
import type {
  ExamSessionRecord,
  CreateExamSessionDTO,
  GradedStudentScoreRecord,
  SaveGradedStudentDTO,
} from '../types/database.types';
import { useSettingsStore } from '../store/useSettingsStore';
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

export class ExamCorrectionRepository {
  /**
   * Retrieves all exam sessions available from active provider.
   */
  public static async getSessions(token?: string): Promise<ExamSessionRecord[]> {
    try {
      const provider = ProviderFactory.getProvider();
      return await provider.getExamSessions(token);
    } catch (err) {
      logger.error('ExamCorrectionRepository', 'Failed to get sessions:', err);
      return [];
    }
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
   * Retrieves all graded students for a session.
   */
  public static async getGradedStudents(
    sessionId: string,
    token?: string
  ): Promise<GradedStudentScoreRecord[]> {
    try {
      const provider = ProviderFactory.getProvider();
      return await provider.getGradedStudents(sessionId, token);
    } catch (err) {
      logger.error('ExamCorrectionRepository', 'Failed to get graded students:', err);
      return [];
    }
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
   * Deletes a student grade record.
   */
  public static async deleteGradedStudent(studentId: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    return await provider.deleteGradedStudent(studentId, token);
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
   * Exports class exam recap to an official Excel file (.xlsx).
   */
  public static exportToExcel(
    session: ExamSessionRecord,
    students: GradedStudentScoreRecord[]
  ): void {
    const appSettings = useSettingsStore.getState().settings;
    const institutionName = appSettings.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';
    const appName = appSettings.app_name || 'Smart Absensi Guru';

    const kkm = Number(session.kkm) || 75;

    // Header rows
    const rows: (string | number)[][] = [
      [appName.toUpperCase()],
      [institutionName.toUpperCase()],
      ['REKAPITULASI NILAI UJIAN & HASIL KOREKSI'],
      [''],
      ['Mata Pelajaran', `: ${session.subject}`],
      ['Kelas / Rombel', `: ${session.class_name} (${session.school_level})`],
      ['Guru Pengampu', `: ${session.teacher}`],
      ['Nama Sesi Ujian', `: ${session.session_name}`],
      ['Tahun Ajaran / Semester', `: ${session.academic_year || '2025/2026'} - ${session.semester || 'Ganjil'}`],
      ['Kriteria Ketuntasan Minimal (KKM)', `: ${kkm}`],
      ['Jumlah Butir Soal PG', `: ${session.answer_key?.length || 0}`],
      [''],
      [
        'No',
        'Nama Siswa',
        'Benar',
        'Salah',
        'Nilai PG',
        'Nilai Essay',
        'Skor Akhir',
        'Status Ketuntasan',
        'CSI',
        'LPS',
      ],
    ];

    // Student rows
    students.forEach((s, idx) => {
      const finalScore = Number(s.final_score) || 0;
      const status = finalScore >= kkm ? 'TUNTAS' : 'REMEDIAL';
      rows.push([
        idx + 1,
        s.name,
        s.correct,
        s.wrong,
        s.mcq_score,
        s.essay_score,
        finalScore,
        status,
        s.csi,
        s.lps,
      ]);
    });

    // Summary statistics row
    const summary = this.computeClassSummary(students, kkm);
    rows.push(['']);
    rows.push(['RINGKASAN KELAS']);
    rows.push(['Total Siswa Dinilai', summary.gradedCount]);
    rows.push(['Rata-rata Nilai', summary.averageScore]);
    rows.push(['Nilai Tertinggi', summary.highestScore]);
    rows.push(['Nilai Terendah', summary.lowestScore]);
    rows.push(['Jumlah Tuntas', summary.passedCount]);
    rows.push(['Jumlah Remedial', summary.remedialCount]);
    rows.push(['Persentase Kelulusan', `${summary.passRate}%`]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 6 },  // No
      { wch: 32 }, // Nama Siswa
      { wch: 10 }, // Benar
      { wch: 10 }, // Salah
      { wch: 12 }, // Nilai PG
      { wch: 12 }, // Nilai Essay
      { wch: 12 }, // Skor Akhir
      { wch: 18 }, // Status
      { wch: 10 }, // CSI
      { wch: 10 }, // LPS
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Nilai ${session.class_name}`);

    const cleanFilename = `Rekap_Nilai_${session.subject}_${session.class_name}_${session.exam_type || 'Ujian'}.xlsx`.replace(
      /\s+/g,
      '_'
    );
    XLSX.writeFile(workbook, cleanFilename);
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
    lines.push('No,Nama Siswa,Benar,Salah,Nilai PG,Nilai Essay,Skor Akhir,Status');

    students.forEach((s, idx) => {
      const score = Number(s.final_score) || 0;
      const status = score >= kkm ? 'TUNTAS' : 'REMEDIAL';
      const cleanName = `"${s.name.replace(/"/g, '""')}"`;
      lines.push(`${idx + 1},${cleanName},${s.correct},${s.wrong},${s.mcq_score},${s.essay_score},${score},${status}`);
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
