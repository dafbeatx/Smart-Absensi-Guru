import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { SemesterGradingExcelService } from '../semester-grading-excel.service';

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
    const { ExamCorrectionRepository } = require('../../repositories/ExamCorrectionRepository');
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
    assert.strictEqual(ws['!cols'].length, 13, 'Must have 13 column widths defined');

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
});
