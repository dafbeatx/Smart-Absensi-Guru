/**
 * MANUAL EXAM HELPER TEST SUITE
 * Tests for parsing manual answer keys, kisi-kisi indicators, and applying them to exam paper data.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseManualKeysToMap,
  formatManualKeysMapToString,
  generateQuickPatternKeys,
  parseManualKisiKisiText,
  parseManualEssayRubrics,
  applyManualKeysAndKisiKisi,
} from '../../utils/manual-exam-helper.utils';
import type { ExamPaperData } from '../../services/exam-paper-docx.service';

describe('Manual Exam Helper Utility Suite', () => {
  it('1. parseManualKeysToMap correctly parses numbered and space-separated keys', () => {
    const inputNumbered = '1.A 2.B 3.C 4.D 5.A';
    const mapNumbered = parseManualKeysToMap(inputNumbered, 5);
    assert.strictEqual(mapNumbered[1], 'A');
    assert.strictEqual(mapNumbered[2], 'B');
    assert.strictEqual(mapNumbered[3], 'C');
    assert.strictEqual(mapNumbered[4], 'D');
    assert.strictEqual(mapNumbered[5], 'A');

    const inputSpace = 'A B C D A';
    const mapSpace = parseManualKeysToMap(inputSpace, 5);
    assert.strictEqual(mapSpace[1], 'A');
    assert.strictEqual(mapSpace[2], 'B');
    assert.strictEqual(mapSpace[3], 'C');
    assert.strictEqual(mapSpace[4], 'D');
    assert.strictEqual(mapSpace[5], 'A');
  });

  it('2. formatManualKeysMapToString formats keys map to standard string', () => {
    const map: Record<number, 'A' | 'B' | 'C' | 'D'> = { 1: 'B', 2: 'C', 3: 'A' };
    const str = formatManualKeysMapToString(map, 3);
    assert.strictEqual(str, '1.B 2.C 3.A');
  });

  it('3. generateQuickPatternKeys generates rotating A, B, C, D pattern', () => {
    const pattern = generateQuickPatternKeys(6);
    assert.strictEqual(pattern[1], 'A');
    assert.strictEqual(pattern[2], 'B');
    assert.strictEqual(pattern[3], 'C');
    assert.strictEqual(pattern[4], 'D');
    assert.strictEqual(pattern[5], 'A');
    assert.strictEqual(pattern[6], 'B');
  });

  it('4. parseManualKisiKisiText parses piped lines and numbered indicators', () => {
    const raw = `1. Aljabar | Menghitung persamaan linier | L2
2. Geometri | Menghitung volume tabung | L3
3. Menganalisis diagram data statistik`;

    const parsed = parseManualKisiKisiText(raw, 'Matematika', 3);
    assert.strictEqual(parsed[1]?.topic, 'Aljabar');
    assert.strictEqual(parsed[1]?.indicator, 'Menghitung persamaan linier');
    assert.strictEqual(parsed[1]?.cognitiveLevel, 'L2');

    assert.strictEqual(parsed[2]?.topic, 'Geometri');
    assert.strictEqual(parsed[2]?.indicator, 'Menghitung volume tabung');
    assert.strictEqual(parsed[2]?.cognitiveLevel, 'L3');

    assert.strictEqual(parsed[3]?.topic, 'Matematika');
    assert.strictEqual(parsed[3]?.indicator, 'Menganalisis diagram data statistik');
  });

  it('5. parseManualEssayRubrics parses expected answer and optional score notation', () => {
    const raw = `1. Menjelaskan perbedaan fisika & kimia (Skor: 25)
2. Menghitung rumus tabung secara lengkap (20 poin)
3. Menyebutkan contoh penerapan dalam kehidupan`;

    const parsed = parseManualEssayRubrics(raw, 3);
    assert.strictEqual(parsed[1]?.number, 1);
    assert.strictEqual(parsed[1]?.expectedAnswer, 'Menjelaskan perbedaan fisika & kimia');
    assert.strictEqual(parsed[1]?.maxScore, 25);

    assert.strictEqual(parsed[2]?.number, 2);
    assert.strictEqual(parsed[2]?.maxScore, 20);

    assert.strictEqual(parsed[3]?.number, 3);
    assert.strictEqual(parsed[3]?.expectedAnswer, 'Menyebutkan contoh penerapan dalam kehidupan');
  });

  it('6. applyManualKeysAndKisiKisi overrides keys, rubrics, and indicators cleanly', () => {
    const dummyData: ExamPaperData = {
      institutionName: 'SMP TERPADU AL-ITTIHADIYAH',
      foundationName: 'YAYASAN AL-ITTIHADIYAH',
      examType: 'ASTS',
      examTypeLabel: 'ASTS',
      semester: 'GANJIL',
      academicYear: '2026/2027',
      subject: 'IPA',
      gradeClass: '8',
      category: 'EKSAK',
      durationMinutes: 90,
      mcqQuestions: [
        {
          number: 1,
          question: 'Soal 1',
          options: { A: '1', B: '2', C: '3', D: '4' },
          correctAnswer: 'A',
          topic: 'Default Topic',
          indicator: 'Default Ind',
          cognitiveLevel: 'L1',
        },
      ],
      essayQuestions: [
        {
          number: 1,
          question: 'Essay 1',
          expectedAnswer: 'Default Expected',
          maxScore: 20,
          topic: 'Default Topic',
          indicator: 'Default Ind',
          cognitiveLevel: 'L2',
        },
      ],
    };

    const manualData = {
      keysMap: { 1: 'C' as const },
      indicators: {
        1: { number: 1, topic: 'Zat & Wujud', indicator: 'Indikator Manual Zat', cognitiveLevel: 'L3' },
      },
      rubrics: {
        1: { number: 1, expectedAnswer: 'Kriteria Manual Lengkap', maxScore: 30 },
      },
    };

    const updated = applyManualKeysAndKisiKisi(dummyData, manualData);
    assert.strictEqual(updated.mcqQuestions[0].correctAnswer, 'C');
    assert.strictEqual(updated.mcqQuestions[0].topic, 'Zat & Wujud');
    assert.strictEqual(updated.mcqQuestions[0].indicator, 'Indikator Manual Zat');
    assert.strictEqual(updated.mcqQuestions[0].cognitiveLevel, 'L3');

    assert.strictEqual(updated.essayQuestions[0].expectedAnswer, 'Kriteria Manual Lengkap');
    assert.strictEqual(updated.essayQuestions[0].maxScore, 30);
  });
});
