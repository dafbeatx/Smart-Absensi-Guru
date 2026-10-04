import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { SemesterGradingExcelService } from '../semester-grading-excel.service';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';

describe('SemesterGradingExcelService — ASTS & ASAS Official Sync', () => {
  it('1. Normalizes class names correctly for sheet matching', () => {
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('7'), '7');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('Kelas 7'), '7');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('7A'), '7');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('8A'), '8A');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('Kelas 8A'), '8A');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('8B'), '8B');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('9A'), '9A');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('9B'), '9B');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('SMA'), 'SMA');
    assert.strictEqual(SemesterGradingExcelService.normalizeSheetClassName('Kelas SMA'), 'SMA');
  });

  it('2. Preserves native Excel formulas and fills ASTS & ASAS scores', async () => {
    // Read local master template buffer
    const buf = fs.readFileSync('public/templates/FORMAT_PENILAIAN_ASTS_ASAS.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });

    // Verify 8 sheets exist
    const expectedSheets = ['IDENTITAS SEKOLAH', 'FORMAT PENILAIAN', '7', '8A', '8B', '9A', '9B', 'SMA'];
    assert.deepStrictEqual(wb.SheetNames, expectedSheets);

    // Verify IDENTITAS SEKOLAH
    const idWs = wb.Sheets['IDENTITAS SEKOLAH'];
    assert.ok(idWs, 'IDENTITAS SEKOLAH sheet must exist');
    idWs['B8'] = { t: 's', v: '2026/2027' };
    idWs['B9'] = { t: 's', v: 'Ganjil' };
    idWs['B10'] = { t: 's', v: 'M. Iqbal Gustiawan, S.Pd., G.r' };
    idWs['B11'] = { t: 's', v: 'Informatika' };

    // Verify class sheet 8A formulas
    const ws8A = wb.Sheets['8A'];
    assert.ok(ws8A['F9'], 'F9 must exist');
    assert.ok(ws8A['F9'].f, 'F9 must contain formula');
    assert.ok(ws8A['G9'].f, 'G9 must contain formula');
    assert.ok(ws8A['H9'].f, 'H9 must contain formula');
    assert.ok(ws8A['I9'].f, 'I9 must contain formula');

    // Simulate filling student 1 in 8A (AMANDA HASNA MIRZA)
    ws8A['D9'] = { t: 'n', v: 85 }; // ASTS
    ws8A['E9'] = { t: 'n', v: 95 }; // ASAS

    const testOutputPath = 'scratch/test_verify_export.xlsx';
    XLSX.writeFile(wb, testOutputPath);

    // Read back exported file
    const readBack = XLSX.read(fs.readFileSync(testOutputPath), { type: 'buffer' });
    const read8A = readBack.Sheets['8A'];
    assert.strictEqual(read8A['D9'].v, 85);
    assert.strictEqual(read8A['E9'].v, 95);
    assert.ok(read8A['F9'].f.includes('ROUND'), 'F9 formula must be preserved');

    // Clean up
    fs.unlinkSync(testOutputPath);
  });

  it('3. Master template contains all 144 registered students across 6 classes', () => {
    const buf = fs.readFileSync('public/templates/FORMAT_PENILAIAN_ASTS_ASAS.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });

    const classCounts: Record<string, number> = {
      '7': 31,
      '8A': 15,
      '8B': 29,
      '9A': 20,
      '9B': 26,
      'SMA': 23,
    };

    let total = 0;
    Object.entries(classCounts).forEach(([cls, expected]) => {
      const ws = wb.Sheets[cls];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      const students = data.slice(8).filter((r) => r[0] && typeof r[0] === 'number');
      assert.strictEqual(students.length, expected, `Class ${cls} must have ${expected} students`);
      total += students.length;
    });

    assert.strictEqual(total, 144, 'Total students in template must be 144');
  });

  it('4. ExamCorrectionRepository.buildRecapWorksheet builds rich table with gridlines, autofilter, and predikat', () => {
    const mockSession = {
      id: 'sess_test_1',
      session_name: 'PTS Informatika 8A Ganjil 2026/2027',
      teacher: 'Dafa Maulana',
      subject: 'Informatika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: ['A', 'B', 'C', 'D'],
      student_list: ['AMANDA HASNA MIRZA', 'AZKIYA RAMADHANI', 'ZAHRA AULIA'],
      scoring_config: { pgWeight: 0.7, essayWeight: 0.3, essayCount: 5, essayMaxScore: 20 },
      created_at: new Date().toISOString(),
    };

    const mockStudents = [
      {
        id: 'st_1',
        session_id: 'sess_test_1',
        name: 'AMANDA HASNA MIRZA',
        mcq_answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
        essay_scores: [4, 4, 4, 4, 4],
        mcq_score: 100,
        essay_score: 100,
        final_score: 100,
        csi: 95,
        lps: 92,
        correct: 4,
        wrong: 0,
      },
      {
        id: 'st_2',
        session_id: 'sess_test_1',
        name: 'AZKIYA RAMADHANI',
        mcq_answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'A' },
        essay_scores: [3, 3, 3, 3, 3],
        mcq_score: 75,
        essay_score: 75,
        final_score: 75,
        csi: 75,
        lps: 70,
        correct: 3,
        wrong: 1,
      },
      {
        id: 'st_3',
        session_id: 'sess_test_1',
        name: 'ZAHRA AULIA',
        mcq_answers: { 1: 'A', 2: 'A', 3: 'A', 4: 'A' },
        essay_scores: [2, 2, 2, 2, 2],
        mcq_score: 50,
        essay_score: 50,
        final_score: 50,
        csi: 50,
        lps: 50,
        correct: 1,
        wrong: 3,
      },
    ];

    const ws = ExamCorrectionRepository.buildRecapWorksheet(mockSession, mockStudents);

    // Verify gridlines and autofilter
    assert.ok(ws['!views'], 'Worksheet must contain !views');
    assert.strictEqual(ws['!views'][0].showGridLines, true, 'Gridlines must be explicitly enabled');
    assert.ok(ws['!autofilter'], 'Worksheet must contain !autofilter');
    assert.strictEqual(ws['!autofilter'].ref, 'A13:M16', 'AutoFilter range must cover headers and all 3 student rows');
    assert.strictEqual(ws['!cols']?.length, 13, 'Must have 13 column widths defined');

    // Verify header columns (Row 13)
    assert.strictEqual(ws['A13'].v, 'No');
    assert.strictEqual(ws['B13'].v, 'Nama Peserta Didik');
    assert.strictEqual(ws['C13'].v, 'L/P');
    assert.strictEqual(ws['D13'].v, 'Benar (PG)');
    assert.strictEqual(ws['E13'].v, 'Salah (PG)');
    assert.strictEqual(ws['F13'].v, 'Nilai PG');
    assert.strictEqual(ws['G13'].v, 'Nilai Essay');
    assert.strictEqual(ws['H13'].v, 'Nilai Akhir');
    assert.strictEqual(ws['I13'].v, 'Predikat');
    assert.strictEqual(ws['J13'].v, 'Status Ketuntasan');
    assert.strictEqual(ws['K13'].v, 'CSI');
    assert.strictEqual(ws['L13'].v, 'LPS');
    assert.strictEqual(ws['M13'].v, 'Keterangan Deskriptif');

    // Verify student 1 (Row 14)
    assert.strictEqual(ws['A14'].v, 1);
    assert.strictEqual(ws['B14'].v, 'AMANDA HASNA MIRZA');
    assert.strictEqual(ws['C14'].v, 'P'); // 8A all female
    assert.strictEqual(ws['H14'].v, 100);
    assert.strictEqual(ws['I14'].v, 'A');
    assert.strictEqual(ws['J14'].v, 'TUNTAS');

    // Verify student 3 (Row 16, remedial)
    assert.strictEqual(ws['A16'].v, 3);
    assert.strictEqual(ws['H16'].v, 50);
    assert.strictEqual(ws['I16'].v, 'D');
    assert.strictEqual(ws['J16'].v, 'REMEDIAL');
  });

  it('5. SemesterGradingExcelService.exportOfficialFormatExcel prepends REKAP NILAI as Sheet 1 and sets activeTab 0', async () => {
    const mockSession = {
      id: 'sess_test_2',
      session_name: 'PTS Informatika 8A Ganjil 2026/2027',
      teacher: 'Dafa Maulana',
      subject: 'Informatika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: ['A', 'B'],
      student_list: ['AMANDA HASNA MIRZA'],
      created_at: new Date().toISOString(),
    };

    const mockStudents = [
      {
        id: 'st_1',
        session_id: 'sess_test_2',
        name: 'AMANDA HASNA MIRZA',
        mcq_answers: { 1: 'A', 2: 'B' },
        essay_scores: [],
        mcq_score: 95,
        essay_score: 0,
        final_score: 95,
        csi: 90,
        lps: 85,
        correct: 2,
        wrong: 0,
      },
    ];

    // In Node test environment, exportOfficialFormatExcel writes file to disk
    await SemesterGradingExcelService.exportOfficialFormatExcel({
      session: mockSession,
      gradedStudents: mockStudents,
      subject: 'Informatika',
      teacher: 'Dafa Maulana',
      className: '8A',
    });

    const expectedExportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Informatika_8A_2026-2027.xlsx';
    assert.ok(fs.existsSync(expectedExportPath), 'Exported file must exist on disk');

    const exportedWb = XLSX.read(fs.readFileSync(expectedExportPath), { type: 'buffer' });

    // REKAP NILAI MUST BE SHEET 1!
    assert.strictEqual(exportedWb.SheetNames[0], 'REKAP NILAI', 'Sheet 1 must be REKAP NILAI table');
    assert.strictEqual(exportedWb.SheetNames[1], 'IDENTITAS SEKOLAH');
    assert.strictEqual(exportedWb.SheetNames[2], 'FORMAT PENILAIAN');

    // Verify student data exists on REKAP NILAI
    const rekapSheet = exportedWb.Sheets['REKAP NILAI'];
    assert.ok(rekapSheet, 'REKAP NILAI sheet must exist');
    assert.strictEqual(rekapSheet['B14'].v, 'AMANDA HASNA MIRZA');
    assert.strictEqual(rekapSheet['H14'].v, 95);
    assert.strictEqual(rekapSheet['J14'].v, 'TUNTAS');

    // Clean up exported test file
    fs.unlinkSync(expectedExportPath);
  });
  it('6. exportOfficialFormatExcel with targetColumn: ASTS populates column D and leaves column E blank', async () => {
    const mockSession = {
      id: 'sess_test_asts',
      session_name: 'Ujian Harian Matematika 8A',
      teacher: 'Ahmad Guru',
      subject: 'Matematika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: ['A'],
      student_list: ['AMANDA HASNA MIRZA'],
      created_at: new Date().toISOString(),
    };

    const mockStudents = [
      {
        id: 'st_asts_1',
        session_id: 'sess_test_asts',
        name: 'AMANDA HASNA MIRZA',
        mcq_answers: { 1: 'A' },
        essay_scores: [],
        mcq_score: 88,
        essay_score: 0,
        final_score: 88,
        csi: 90,
        lps: 85,
        correct: 1,
        wrong: 0,
      },
    ];

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      session: mockSession,
      gradedStudents: mockStudents,
      subject: 'Matematika',
      teacher: 'Ahmad Guru',
      className: '8A',
      targetColumn: 'ASTS',
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Matematika_8A_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const wb = XLSX.read(fs.readFileSync(exportPath), { type: 'buffer' });
    const sheet8A = wb.Sheets['8A'];
    assert.ok(sheet8A, 'Sheet 8A must exist');

    // Amanda Hasna Mirza is row 9
    assert.strictEqual(sheet8A['B9'].v, 'AMANDA HASNA MIRZA');
    assert.strictEqual(sheet8A['D9'].v, 88, 'ASTS (Col D) must be populated with 88');
    assert.strictEqual(sheet8A['E9'], undefined, 'ASAS (Col E) must remain blank');

    fs.unlinkSync(exportPath);
  });

  it('7. exportOfficialFormatExcel with targetColumn: ASAS populates column E and leaves column D blank', async () => {
    const mockSession = {
      id: 'sess_test_asas',
      session_name: 'Ujian Akhir Semester Matematika 8A',
      teacher: 'Ahmad Guru',
      subject: 'Matematika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: ['A'],
      student_list: ['AMANDA HASNA MIRZA'],
      created_at: new Date().toISOString(),
    };

    const mockStudents = [
      {
        id: 'st_asas_1',
        session_id: 'sess_test_asas',
        name: 'AMANDA HASNA MIRZA',
        mcq_answers: { 1: 'A' },
        essay_scores: [],
        mcq_score: 92,
        essay_score: 0,
        final_score: 92,
        csi: 90,
        lps: 85,
        correct: 1,
        wrong: 0,
      },
    ];

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      session: mockSession,
      gradedStudents: mockStudents,
      subject: 'Matematika',
      teacher: 'Ahmad Guru',
      className: '8A',
      targetColumn: 'ASAS',
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Matematika_8A_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const wb = XLSX.read(fs.readFileSync(exportPath), { type: 'buffer' });
    const sheet8A = wb.Sheets['8A'];
    assert.ok(sheet8A, 'Sheet 8A must exist');

    // Amanda Hasna Mirza is row 9
    assert.strictEqual(sheet8A['B9'].v, 'AMANDA HASNA MIRZA');
    assert.strictEqual(sheet8A['D9'], undefined, 'ASTS (Col D) must remain blank');
    assert.strictEqual(sheet8A['E9'].v, 92, 'ASAS (Col E) must be populated with 92');

    fs.unlinkSync(exportPath);
  });

  it('8. exportOfficialFormatExcel with targetColumn: BOTH populates both columns D and E', async () => {
    const mockSession = {
      id: 'sess_test_both',
      session_name: 'Simulasi Lengkap Nilai Matematika 8A',
      teacher: 'Ahmad Guru',
      subject: 'Matematika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: ['A'],
      student_list: ['AMANDA HASNA MIRZA'],
      created_at: new Date().toISOString(),
    };

    const mockStudents = [
      {
        id: 'st_both_1',
        session_id: 'sess_test_both',
        name: 'AMANDA HASNA MIRZA',
        mcq_answers: { 1: 'A' },
        essay_scores: [],
        mcq_score: 85,
        essay_score: 0,
        final_score: 85,
        csi: 90,
        lps: 85,
        correct: 1,
        wrong: 0,
      },
    ];

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      session: mockSession,
      gradedStudents: mockStudents,
      subject: 'Matematika',
      teacher: 'Ahmad Guru',
      className: '8A',
      targetColumn: 'BOTH',
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Matematika_8A_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const wb = XLSX.read(fs.readFileSync(exportPath), { type: 'buffer' });
    const sheet8A = wb.Sheets['8A'];
    assert.ok(sheet8A, 'Sheet 8A must exist');

    assert.strictEqual(sheet8A['D9'].v, 85, 'ASTS (Col D) must be 85');
    assert.strictEqual(sheet8A['E9'].v, 85, 'ASAS (Col E) must be 85');

    fs.unlinkSync(exportPath);
  });

  it('9. exportOfficialFormatExcel with targetColumn: NONE leaves grades blank and omits REKAP NILAI', async () => {
    const mockSession = {
      id: 'sess_test_none',
      session_name: 'Blanko Matematika 8A',
      teacher: 'Ahmad Guru',
      subject: 'Matematika',
      class_name: '8A',
      school_level: 'SMP' as const,
      kkm: 75,
      academic_year: '2026/2027',
      semester: 'Ganjil',
      answer_key: [],
      student_list: [],
      created_at: new Date().toISOString(),
    };

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      session: mockSession,
      gradedStudents: [],
      subject: 'Matematika',
      teacher: 'Ahmad Guru',
      className: '8A',
      targetColumn: 'NONE',
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Matematika_8A_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const wb = XLSX.read(fs.readFileSync(exportPath), { type: 'buffer' });
    
    // REKAP NILAI should NOT be prepended on blank template
    assert.strictEqual(wb.SheetNames[0], 'IDENTITAS SEKOLAH');
    assert.strictEqual(wb.SheetNames[1], 'FORMAT PENILAIAN');

    const sheet8A = wb.Sheets['8A'];
    assert.ok(sheet8A, 'Sheet 8A must exist');
    assert.strictEqual(sheet8A['B9'].v, 'AMANDA HASNA MIRZA', 'Official student roster is preserved');
    assert.strictEqual(sheet8A['D9'], undefined, 'ASTS must be blank');
    assert.strictEqual(sheet8A['E9'], undefined, 'ASAS must be blank');

    fs.unlinkSync(exportPath);
  });
  it('10. exportOfficialFormatExcel with className: SEMUA_KELAS includes all 6 class sheets with identical blank template table structure, user-selected subject, academic year, semester, and teacher', async () => {
    await SemesterGradingExcelService.exportOfficialFormatExcel({
      subject: 'Informatika',
      teacher: 'M. Iqbal Gustiawan, S.Pd., G.r',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      kkm: 75,
      className: 'SEMUA_KELAS',
      targetColumn: 'NONE',
      includeRecapSheet: false,
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Informatika_SEMUA_KELAS_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported all classes file must exist on disk');

    const wb = XLSX.read(fs.readFileSync(exportPath), { type: 'buffer' });

    // Must be EXACTLY the 8 official sheets matching the master blank template
    const expectedSheets = ['IDENTITAS SEKOLAH', 'FORMAT PENILAIAN', '7', '8A', '8B', '9A', '9B', 'SMA'];
    assert.deepStrictEqual(wb.SheetNames, expectedSheets, 'Sheet structure must be 100% identical to master blank template');

    // Verify IDENTITAS SEKOLAH metadata
    const idSheet = wb.Sheets['IDENTITAS SEKOLAH'];
    assert.strictEqual(idSheet['B8'].v, '2026/2027', 'Tahun Pelajaran must be 2026/2027');
    assert.strictEqual(idSheet['B9'].v, 'Ganjil', 'Semester must be Ganjil');
    assert.strictEqual(idSheet['B10'].v, 'M. Iqbal Gustiawan, S.Pd., G.r', 'Guru must match');
    assert.strictEqual(idSheet['B11'].v, 'Informatika', 'Mata Pelajaran must match');

    // Verify FORMAT PENILAIAN
    const fpSheet = wb.Sheets['FORMAT PENILAIAN'];
    assert.strictEqual(fpSheet['B5'].v, 75, 'KKM must be 75');

    // Verify each class sheet has table headers, metadata, and students
    const classRosters: Record<string, { expectedCount: number; firstStudent: string }> = {
      '7': { expectedCount: 31, firstStudent: 'AFHTAR SHAKIL' },
      '8A': { expectedCount: 15, firstStudent: 'AMANDA HASNA MIRZA' },
      '8B': { expectedCount: 29, firstStudent: 'ABILA YAZID RIZAQI' },
      '9A': { expectedCount: 20, firstStudent: 'ADELIA ZAFIRAH BILQIZ' },
      '9B': { expectedCount: 26, firstStudent: 'ANDIKA PRATAMA' },
      'SMA': { expectedCount: 23, firstStudent: 'M. FAZRIL FATURRAHMAN' },
    };

    let totalVerifiedStudents = 0;
    Object.entries(classRosters).forEach(([cls, info]) => {
      const ws = wb.Sheets[cls];
      assert.ok(ws, `Class sheet ${cls} must exist`);

      // Header row 8
      assert.strictEqual(ws['A8'].v, 'No', 'Column A8 must be No');
      assert.strictEqual(ws['B8'].v, 'Nama Peserta Didik', 'Column B8 must be Nama Peserta Didik');
      assert.strictEqual(ws['C8'].v, 'L/P', 'Column C8 must be L/P');
      assert.strictEqual(ws['D8'].v, 'ASTS', 'Column D8 must be ASTS');
      assert.strictEqual(ws['E8'].v, 'ASAS', 'Column E8 must be ASAS');
      assert.strictEqual(ws['F8'].v, 'Nilai Akhir', 'Column F8 must be Nilai Akhir');
      assert.strictEqual(ws['G8'].v, 'Predikat', 'Column G8 must be Predikat');
      assert.strictEqual(ws['H8'].v, 'Status', 'Column H8 must be Status');

      // First student
      assert.strictEqual(ws['B9'].v, info.firstStudent, `First student in ${cls} must be ${info.firstStudent}`);

      // Check formulas for Nilai Akhir and Predikat
      assert.ok(ws['F9'].f, 'F9 formula must exist');
      assert.ok(ws['G9'].f, 'G9 formula must exist');
      assert.ok(ws['H9'].f, 'H9 formula must exist');

      // Metadata in class sheet
      assert.strictEqual(ws['B5'].v, 'Informatika', 'Mata Pelajaran must be Informatika');
      assert.strictEqual(ws['E4'].v, '2026/2027', 'Tahun Pelajaran must be 2026/2027');
      assert.strictEqual(ws['H4'].v, 'Ganjil', 'Semester must be Ganjil');
      assert.strictEqual(ws['E5'].v, 75, 'KKM must be 75');

      // Count students in class table
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      const studentsInTable = rows.slice(8).filter((r) => r[0] && typeof r[0] === 'number');
      assert.strictEqual(studentsInTable.length, info.expectedCount, `Class ${cls} must contain ${info.expectedCount} students`);
      totalVerifiedStudents += studentsInTable.length;
    });

    assert.strictEqual(totalVerifiedStudents, 144, 'Total students across all 6 classes must be exactly 144');

    fs.unlinkSync(exportPath);
  });

  it('11. exportOfficialFormatExcel with includeRecapSheet: false preserves green header style, cream row style, and formulas', async () => {
    const { default: XLSXStyle } = await import('xlsx-js-style');

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      subject: 'Informatika',
      teacher: 'M. Iqbal Gustiawan, S.Pd., G.r',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      kkm: 75,
      className: '8B',
      targetColumn: 'ASAS',
      includeRecapSheet: false,
      scoresByClass: {
        '8B': [
          { name: 'ABILA YAZID RIZAQI', asas: 80 },
          { name: 'ADRIAN PUTRA NUGRAHA', asas: 90 },
        ],
      },
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Informatika_8B_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported 8B file must exist');

    const wb = XLSXStyle.read(fs.readFileSync(exportPath), { type: 'buffer', cellStyles: true });

    // Verify 8 official sheets
    assert.strictEqual(wb.SheetNames[0], 'IDENTITAS SEKOLAH');
    assert.strictEqual(wb.SheetNames[1], 'FORMAT PENILAIAN');
    assert.strictEqual(wb.SheetNames[4], '8B');

    const s8b = wb.Sheets['8B'];
    assert.ok(s8b, 'Sheet 8B must exist');

    // Verify Green Header styling is preserved on row 8
    assert.strictEqual(s8b['A8'].v, 'No');
    assert.strictEqual(s8b['B8'].v, 'Nama Peserta Didik');
    assert.strictEqual(s8b['A8'].s?.fgColor?.rgb, '2E7D32', 'Header cell A8 must retain dark green background (#2E7D32)');
    assert.strictEqual(s8b['B8'].s?.fgColor?.rgb, '2E7D32', 'Header cell B8 must retain dark green background (#2E7D32)');

    // Verify student 1 (ABILA YAZID RIZAQI) has ASAS filled and styling preserved
    assert.strictEqual(s8b['B9'].v, 'ABILA YAZID RIZAQI');
    assert.strictEqual(s8b['B9'].s?.fgColor?.rgb, 'FFF2CC', 'Student name cell B9 must retain cream accent (#FFF2CC)');
    assert.strictEqual(s8b['E9'].v, 80, 'ASAS score for Abila must be 80');
    assert.strictEqual(s8b['E9'].s?.fgColor?.rgb, 'FFF2CC', 'ASAS score cell E9 must retain cream accent (#FFF2CC)');

    // Verify student 2 (ADRIAN PUTRA NUGRAHA) has ASAS filled
    assert.strictEqual(s8b['B10'].v, 'ADRIAN PUTRA NUGRAHA');
    assert.strictEqual(s8b['E10'].v, 90, 'ASAS score for Adrian must be 90');

    // Clean up
    fs.unlinkSync(exportPath);
  });

  it('12. Universal Excel Compatibility — purges stale calcChain.xml and enforces fullCalcOnLoad', async () => {
    const fflate = await import('fflate');

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      subject: 'Informatika',
      teacher: 'M. Iqbal Gustiawan, S.Pd., G.r',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      kkm: 75,
      className: '8B',
      targetColumn: 'ASTS',
      includeRecapSheet: false,
      scoresByClass: {
        '8B': [
          { name: 'MUHAMAD AL FAZRI', asts: 88 },
        ],
      },
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Informatika_8B_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const fileBuf = fs.readFileSync(exportPath);
    const files = fflate.unzipSync(new Uint8Array(fileBuf));

    // 1. Verify xl/calcChain.xml is completely removed to prevent Excel repair warning
    assert.strictEqual(files['xl/calcChain.xml'], undefined, 'xl/calcChain.xml must NOT exist in universal Excel export');

    // 2. Verify [Content_Types].xml does NOT reference calcChain.xml
    const ctXml = new TextDecoder().decode(files['[Content_Types].xml']);
    assert.ok(!ctXml.includes('calcChain.xml'), '[Content_Types].xml must not contain calcChain.xml');

    // 3. Verify xl/_rels/workbook.xml.rels does NOT reference calcChain.xml
    const relsXml = new TextDecoder().decode(files['xl/_rels/workbook.xml.rels']);
    assert.ok(!relsXml.includes('calcChain.xml'), 'workbook.xml.rels must not contain calcChain.xml');

    // 4. Verify xl/workbook.xml contains forceFullCalc="1" and fullCalcOnLoad="1"
    const wbXml = new TextDecoder().decode(files['xl/workbook.xml']);
    assert.ok(wbXml.includes('forceFullCalc="1"'), 'workbook.xml must contain forceFullCalc="1"');
    assert.ok(wbXml.includes('fullCalcOnLoad="1"'), 'workbook.xml must contain fullCalcOnLoad="1"');

    // Clean up
    fs.unlinkSync(exportPath);
  });

  it('13. Indonesian Student Name Normalization & Fuzzy Matching handles spelling variations without false positives', () => {
    const gradesMap: Record<string, { asts?: number | null; asas?: number | null }> = {
      'MUHAMMAD AL FAZRI': { asts: 85 },
      'MUHAMMAD FAZRIL FATURRAHMAN': { asts: 90 },
      'FATURRAHMAN RANGGA': { asts: 78 },
      'FERDIANSYAH': { asts: 92 },
      'ZAKI AHMAD AL FARIDZI': { asts: 88 },
      'BILQIS AINUN NISA': { asts: 95 },
      'SAYYID AGIL': { asts: 82 },
      'AL DAFI PUTRA ASYABANI': { asts: 87 },
      'AFNAN SYAKIR AZZAKWAN': { asts: 91 },
      'MUHAMMAD HAFIDZ TRI HENDRIAWAN': { asts: 89 },
    };

    // 1. Muhamad (single M) in Excel vs Muhammad (double M) in database/manual input
    const match1 = SemesterGradingExcelService.fuzzyFindStudentScore('MUHAMAD AL FAZRI', gradesMap);
    assert.ok(match1, 'MUHAMAD AL FAZRI must match MUHAMMAD AL FAZRI');
    assert.strictEqual(match1?.asts, 85);

    // 2. M. Fazril in Excel vs Muhammad Fazril in database/manual input
    const match2 = SemesterGradingExcelService.fuzzyFindStudentScore('M. FAZRIL FATURRAHMAN', gradesMap);
    assert.ok(match2, 'M. FAZRIL FATURRAHMAN must match MUHAMMAD FAZRIL FATURRAHMAN');
    assert.strictEqual(match2?.asts, 90);

    // 3. Faturrahman (double R) vs Fatturahman (double T) typo compression
    const match3 = SemesterGradingExcelService.fuzzyFindStudentScore('FATTURAHMAN RANGGA', gradesMap);
    assert.ok(match3, 'FATTURAHMAN RANGGA must match FATURRAHMAN RANGGA');
    assert.strictEqual(match3?.asts, 78);

    // 4. Single-name Ferdiansyah
    const match4 = SemesterGradingExcelService.fuzzyFindStudentScore('FERDIANSYAH', gradesMap);
    assert.ok(match4, 'FERDIANSYAH must match FERDIANSYAH');
    assert.strictEqual(match4?.asts, 92);

    // 5. Zakii (double I) vs Zaki (single I) & Alfaridzi vs Al Faridzi
    const match5 = SemesterGradingExcelService.fuzzyFindStudentScore('ZAKII AHMAD ALFARIDZI', gradesMap);
    assert.ok(match5, 'ZAKII AHMAD ALFARIDZI must match ZAKI AHMAD AL FARIDZI');
    assert.strictEqual(match5?.asts, 88);

    // 6. Nissa (double S) vs Nisa (single S)
    const match6 = SemesterGradingExcelService.fuzzyFindStudentScore('BILQIS AINUN NISSA', gradesMap);
    assert.ok(match6, 'BILQIS AINUN NISSA must match BILQIS AINUN NISA');
    assert.strictEqual(match6?.asts, 95);

    // 7. Middle name / token overlap
    const match7 = SemesterGradingExcelService.fuzzyFindStudentScore('M. SAYYID AGIL M', gradesMap);
    assert.ok(match7, 'M. SAYYID AGIL M must match SAYYID AGIL');
    assert.strictEqual(match7?.asts, 82);

    // 8. Negative tests: ensure different students are NOT cross-matched (Zero False Positives)
    const neg1 = SemesterGradingExcelService.fuzzyFindStudentScore('AMANDA HASNA MIRZA', gradesMap);
    assert.strictEqual(neg1, null, 'AMANDA HASNA MIRZA must not match unrelated students');

    const neg2 = SemesterGradingExcelService.fuzzyFindStudentScore('MUHAMAD ILHAM AZZIKRA', gradesMap);
    assert.strictEqual(neg2, null, 'MUHAMAD ILHAM AZZIKRA must not match MUHAMMAD AL FAZRI');
  });

  it('14. Manual Score from "Koreksi Nilai Manual (Opsional)" with Indonesian names is written to Excel table', async () => {
    const { default: XLSXStyle } = await import('xlsx-js-style');

    await SemesterGradingExcelService.exportOfficialFormatExcel({
      subject: 'Informatika',
      teacher: 'Guru Pengampu',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      kkm: 75,
      className: '8B',
      targetColumn: 'ASTS',
      includeRecapSheet: false,
      scoresByClass: {
        '8B': [
          // Input names as entered by teacher in manual correction (with Muhammad double M)
          { name: 'Muhammad Al Fazri', asts: 94 },
          { name: 'Muhammad Hafidz Tri Hendriawan', asts: 86 },
        ],
      },
    });

    const exportPath = 'FORMAT_PENILAIAN_ASTS_ASAS_Informatika_8B_2026-2027.xlsx';
    assert.ok(fs.existsSync(exportPath), 'Exported file must exist');

    const wb = XLSXStyle.read(fs.readFileSync(exportPath), { type: 'buffer' });
    const s8b = wb.Sheets['8B'];

    // In 8B sheet:
    // Row 20 in Excel template is "MUHAMAD AL FAZRI"
    // Row 21 in Excel template is "MUHAMAD HAFIDZ TRI HENDRIAWAN"
    let foundAlFazri = false;
    let foundHafidz = false;

    for (let r = 9; r <= 45; r++) {
      const name = s8b['B' + r]?.v;
      if (name === 'MUHAMAD AL FAZRI') {
        assert.strictEqual(s8b['D' + r]?.v, 94, 'ASTS score for MUHAMAD AL FAZRI must be 94');
        foundAlFazri = true;
      }
      if (name === 'MUHAMAD HAFIDZ TRI HENDRIAWAN') {
        assert.strictEqual(s8b['D' + r]?.v, 86, 'ASTS score for MUHAMAD HAFIDZ TRI HENDRIAWAN must be 86');
        foundHafidz = true;
      }
    }

    assert.ok(foundAlFazri, 'MUHAMAD AL FAZRI must be matched and graded in Excel');
    assert.ok(foundHafidz, 'MUHAMAD HAFIDZ TRI HENDRIAWAN must be matched and graded in Excel');

    fs.unlinkSync(exportPath);
  });
});

