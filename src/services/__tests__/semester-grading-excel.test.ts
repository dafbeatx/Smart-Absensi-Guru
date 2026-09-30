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
});
