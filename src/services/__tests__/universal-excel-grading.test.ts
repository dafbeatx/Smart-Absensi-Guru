/**
 * SMART ABSENSI GURU — UNIVERSAL EXCEL GRADING TEST SUITE
 * Memverifikasi kemampuan parsing Excel fleksibel, pencocokan nama siswa (fuzzy match),
 * alokasi skor otomatis (PG & Essay), serta pembuatan dan pembaruan sesi ujian.
 */

import * as XLSX from 'xlsx';
import { UniversalExcelGradingService } from '../universal-excel-grading.service';
import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
import type { StudentItem } from '../../types/database.types';
import type { TestSuiteResult } from '../test-runner.service';

export async function runUniversalExcelGradingTestSuite(): Promise<TestSuiteResult> {
  const results: { testName: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  const originalProvider = ProviderFactory.getProvider();
  const mockProvider = new MockProvider();
  ProviderFactory.setProvider(mockProvider);

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // Test 1: Normalisasi & Fuzzy Matching Nama Siswa
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const dbStudents: StudentItem[] = [
        { id: 'stu_1', fullName: 'MUHAMMAD RIZKI PRATAMA', className: '9A', nisn: '001', gender: 'L' },
        { id: 'stu_2', fullName: 'SITI NURHALIZA', className: '9A', nisn: '002', gender: 'P' },
        { id: 'stu_3', fullName: 'FATURRAHMAN AL-FARISI', className: '9A', nisn: '003', gender: 'L' },
        { id: 'stu_4', fullName: 'AURA KASIH', className: '9A', nisn: '004', gender: 'P' },
      ];

      // Exact Match
      const m1 = UniversalExcelGradingService.matchStudent('Siti Nurhaliza', dbStudents);
      if (!m1.matchedStudent || m1.matchedStudent.id !== 'stu_2' || m1.matchType !== 'EXACT') {
        throw new Error(`Expected exact match for Siti Nurhaliza, got ${m1.matchType}`);
      }

      // Fuzzy Match - Singkatan MHD -> MUHAMMAD
      const m2 = UniversalExcelGradingService.matchStudent('Mhd Rizki Pratama', dbStudents);
      if (!m2.matchedStudent || m2.matchedStudent.id !== 'stu_1') {
        throw new Error(`Expected match for Mhd Rizki Pratama, got ${m2.matchedStudent?.fullName}`);
      }

      // Fuzzy Match - Double huruf (Fatturrahman -> Faturrahman)
      const m3 = UniversalExcelGradingService.matchStudent('Fatturrahman Al Farisi', dbStudents);
      if (!m3.matchedStudent || m3.matchedStudent.id !== 'stu_3') {
        throw new Error(`Expected match for Fatturrahman Al Farisi, got ${m3.matchedStudent?.fullName}`);
      }

      // Unmatched
      const m4 = UniversalExcelGradingService.matchStudent('Bambang Pamungkas', dbStudents);
      if (m4.matchType !== 'UNMATCHED' || m4.matchedStudent !== null) {
        throw new Error(`Expected unmatched for Bambang Pamungkas, got ${m4.matchType}`);
      }

      results.push({
        testName: '1. Fuzzy matching & normalisasi nama siswa Indonesia berfungsi akurat',
        status: 'PASS',
      });
    } catch (err: any) {
      results.push({
        testName: '1. Fuzzy matching & normalisasi nama siswa Indonesia berfungsi akurat',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 2: Parsing Buffer Excel Format Tabel Umum (PG, Essay, Nilai Akhir)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      // Buat workbook sintetis dengan format kolom umum
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['REKAPITULASI NILAI UJIAN SEMESTER GANJIL'],
        ['Mata Pelajaran: Matematika', 'Kelas: 9A', 'Tahun: 2026/2027'],
        [],
        ['No', 'NISN', 'Nama Siswa', 'Skor PG', 'Skor Essay', 'Nilai Akhir'],
        [1, '00123', 'Muhammad Rizki Pratama', 60, 25, 85],
        [2, '00124', 'Siti Nurhaliza', 70, 30, 100],
        [3, '00125', 'Faturrahman Al-Farisi', 50, 20, 70],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Nilai_9A');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const parsed = await UniversalExcelGradingService.parseExcelBuffer(buf, 'rekap_nilai_9a.xlsx');

      if (parsed.sheets.length !== 1) {
        throw new Error(`Expected 1 sheet, got ${parsed.sheets.length}`);
      }

      const sheet = parsed.sheets[0];
      if (sheet.rows.length !== 3) {
        throw new Error(`Expected 3 student rows, got ${sheet.rows.length}`);
      }

      const r1 = sheet.rows[0];
      if (r1.rawStudentName !== 'Muhammad Rizki Pratama' || r1.pgScore !== 60 || r1.essayScore !== 25 || r1.finalScore !== 85) {
        throw new Error(`Invalid parsed row 1 data: ${JSON.stringify(r1)}`);
      }

      if (sheet.detectedClassName !== '9A') {
        throw new Error(`Expected detectedClassName 9A, got ${sheet.detectedClassName}`);
      }

      results.push({
        testName: '2. Parsing buffer Excel format tabel umum (PG, Essay, Nilai Akhir) sukses',
        status: 'PASS',
      });
    } catch (err: any) {
      results.push({
        testName: '2. Parsing buffer Excel format tabel umum (PG, Essay, Nilai Akhir) sukses',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 3: Eksekusi Import Mode CREATE_NEW (Membuat Sesi Ujian Baru & Simpan Nilai)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const dbStudents: StudentItem[] = [
        { id: 'stu_9a_1', fullName: 'Muhammad Rizki Pratama', className: '9A', nisn: '001', gender: 'L' },
        { id: 'stu_9a_2', fullName: 'Siti Nurhaliza', className: '9A', nisn: '002', gender: 'P' },
        { id: 'stu_9a_3', fullName: 'Faturrahman Al-Farisi', className: '9A', nisn: '003', gender: 'L' },
      ];

      // Simulasi baris yang sudah dipetakan
      const mappedRows = [
        {
          rowNumber: 1,
          rawStudentName: 'Mhd Rizki Pratama',
          matchedStudentId: 'stu_9a_1',
          matchedStudentName: 'Muhammad Rizki Pratama',
          matchType: 'FUZZY' as const,
          confidence: 0.9,
          pgScore: 70,
          essayScore: 20,
          finalScore: 90,
          passed: true,
          excluded: false,
        },
        {
          rowNumber: 2,
          rawStudentName: 'Siti Nurhaliza',
          matchedStudentId: 'stu_9a_2',
          matchedStudentName: 'Siti Nurhaliza',
          matchType: 'EXACT' as const,
          confidence: 1.0,
          pgScore: 60,
          essayScore: 15,
          finalScore: 75,
          passed: true,
          excluded: false,
        },
        {
          rowNumber: 3,
          rawStudentName: 'Siswa Tak Dikenal',
          matchedStudentId: null,
          matchedStudentName: null,
          matchType: 'UNMATCHED' as const,
          confidence: 0,
          pgScore: 50,
          essayScore: 10,
          finalScore: 60,
          passed: false,
          excluded: true, // dikecualikan
        },
      ];

      const importResult = await UniversalExcelGradingService.executeImport(
        {
          importMode: 'CREATE_NEW',
          sessionConfig: {
            sessionName: 'STS - Matematika - 9A (2026/2027)',
            subject: 'Matematika',
            className: '9A',
            examType: 'PTS / UTS',
            examFormat: 'PG_AND_ESSAY',
            academicYear: '2026/2027',
            semester: 'Ganjil',
            kkm: 75,
            teacherName: 'Budi Santoso, S.Pd.',
          },
          mappedRows,
          allDirectoryStudents: dbStudents,
        },
        { id: 'teacher_1', full_name: 'Budi Santoso, S.Pd.' } as any
      );

      if (!importResult.success) {
        throw new Error(`Import failed: ${importResult.message}`);
      }

      if (importResult.savedCount !== 2) {
        throw new Error(`Expected 2 saved students, got ${importResult.savedCount}`);
      }

      if (!importResult.sessionId) {
        throw new Error('Expected created sessionId');
      }

      // Verifikasi sesi di repository
      const createdSession = await ExamCorrectionRepository.getSessionById(importResult.sessionId);
      if (!createdSession || createdSession.session_name !== 'STS - Matematika - 9A (2026/2027)') {
        throw new Error('Created session name does not match');
      }

      if (createdSession.class_name !== '9A' || createdSession.subject !== 'Matematika') {
        throw new Error(`Invalid session attributes: ${createdSession.class_name}, ${createdSession.subject}`);
      }

      // Verifikasi nilai tersimpan
      const scoresRes = await ExamCorrectionRepository.getGradedStudentsBySession(importResult.sessionId);
      if (scoresRes.data.length !== 2) {
        throw new Error(`Expected 2 graded students in session, got ${scoresRes.data.length}`);
      }

      const s1 = scoresRes.data.find((s) => s.name === 'Muhammad Rizki Pratama' || (s as any).student_name === 'Muhammad Rizki Pratama');
      if (!s1 || s1.final_score !== 90 || s1.mcq_score !== 70 || s1.essay_score !== 20) {
        throw new Error(`Invalid saved score for student 1: ${JSON.stringify(s1)}`);
      }

      results.push({
        testName: '3. Eksekusi import mode CREATE_NEW membuat sesi & menyimpan nilai atomik',
        status: 'PASS',
      });
    } catch (err: any) {
      results.push({
        testName: '3. Eksekusi import mode CREATE_NEW membuat sesi & menyimpan nilai atomik',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 4: Eksekusi Import Mode UPDATE_EXISTING (Memperbarui Sesi Yang Ada)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      // 1. Buat sesi eksisting terlebih dahulu
      const initSessRes = await ExamCorrectionRepository.saveExamSession({
        session_name: 'UH 1 - Bahasa Inggris - 8B (2026/2027)',
        teacher: 'Guru Pengampu',
        subject: 'Bahasa Inggris',
        class_name: '8B',
        exam_type: 'Ulangan Harian',
        school_level: 'SMP',
        academic_year: '2026/2027',
        semester: 'Ganjil',
        kkm: 70,
        answer_key: ['A', 'B', 'C', 'D', 'E'],
        student_list: ['Siti Nurhaliza'],
      });

      const existingSessionId = (initSessRes as any).data ? (initSessRes as any).data.id : (initSessRes as any).id;

      // 2. Import nilai siswa ke sesi tersebut
      const updateResult = await UniversalExcelGradingService.executeImport(
        {
          importMode: 'UPDATE_EXISTING',
          targetSessionId: existingSessionId,
          sessionConfig: {
            sessionName: 'UH 1 - Bahasa Inggris - 8B (2026/2027)',
            teacherName: 'Guru Pengampu',
            subject: 'Bahasa Inggris',
            className: '8B',
            examType: 'Ulangan Harian',
            examFormat: 'PG_ONLY',
            academicYear: '2026/2027',
            semester: 'Ganjil',
            kkm: 70,
          },
          mappedRows: [
            {
              rowNumber: 1,
              rawStudentName: 'Siti Nurhaliza',
              matchedStudentId: 'stu_9a_2',
              matchedStudentName: 'Siti Nurhaliza',
              matchType: 'EXACT',
              confidence: 1.0,
              pgScore: 85,
              essayScore: 0,
              finalScore: 85,
              passed: true,
              excluded: false,
            },
          ],
          allDirectoryStudents: [{ id: 'stu_9a_2', fullName: 'Siti Nurhaliza', className: '8B', nisn: '002', gender: 'P' }],
        },
        { id: 'teacher_1', full_name: 'Guru Pengampu' } as any
      );

      if (!updateResult.success || updateResult.savedCount !== 1) {
        throw new Error(`Update import failed: ${updateResult.message}`);
      }

      const updatedScores = await ExamCorrectionRepository.getGradedStudentsBySession(existingSessionId);
      if (updatedScores.data.length !== 1 || updatedScores.data[0].final_score !== 85) {
        throw new Error(`Expected updated score 85, got ${JSON.stringify(updatedScores.data)}`);
      }

      results.push({
        testName: '4. Eksekusi import mode UPDATE_EXISTING memperbarui nilai sesi secara presisi',
        status: 'PASS',
      });
    } catch (err: any) {
      results.push({
        testName: '4. Eksekusi import mode UPDATE_EXISTING memperbarui nilai sesi secara presisi',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 5: Fallback Otomatis Saat Nilai Hanya Nilai Akhir (Auto Distribution)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      // Workbook hanya ada kolom "Nama" dan "Nilai"
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Daftar Nilai Siswa'],
        [],
        ['No', 'Nama Siswa', 'Nilai'],
        [1, 'Aura Kasih', 88],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const parsed = await UniversalExcelGradingService.parseExcelBuffer(buf, 'nilai_simple.xlsx');
      const row = parsed.sheets[0].rows[0];

      if (row.rawStudentName !== 'Aura Kasih' || row.finalScore !== 88) {
        throw new Error(`Expected Aura Kasih with 88 final score, got ${JSON.stringify(row)}`);
      }

      // Skor PG dan Essay dialokasikan
      if (row.pgScore === null && row.essayScore === null) {
        throw new Error('Expected automated score allocation for PG/Essay');
      }

      results.push({
        testName: '5. Deteksi kolom nilai tunggal (Nilai/Skor Akhir) mengalokasikan PG/Essay secara cerdas',
        status: 'PASS',
      });
    } catch (err: any) {
      results.push({
        testName: '5. Deteksi kolom nilai tunggal (Nilai/Skor Akhir) mengalokasikan PG/Essay secara cerdas',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }
  } finally {
    ProviderFactory.setProvider(originalProvider);
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'Universal Excel Grading & Auto Session Importer Suite',
    passed,
    failed,
    results,
  };
}
