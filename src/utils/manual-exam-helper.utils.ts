/**
 * SMART ABSENSI GURU — MANUAL EXAM KEYS & KISI-KISI HELPER
 * Utility for parsing and applying teacher's custom answer keys, essay rubrics, and kisi-kisi matrices.
 */

import { parseAnswerKey } from './scoring.utils';
import type { ExamPaperData, McqQuestionItem, EssayQuestionItem } from '../services/exam-paper-docx.service';

export interface ManualParsedIndicator {
  number: number;
  topic?: string;
  indicator: string;
  cognitiveLevel?: string;
}

export interface ManualParsedEssayRubric {
  number: number;
  expectedAnswer: string;
  maxScore: number;
}

/**
 * Parses raw manual answer keys text into a map { [questionNumber]: 'A' | 'B' | 'C' | 'D' }
 */
export function parseManualKeysToMap(
  input: string,
  _totalCount: number = 25
): Record<number, 'A' | 'B' | 'C' | 'D'> {
  if (!input || !input.trim()) return {};

  const keys = parseAnswerKey(input);
  const result: Record<number, 'A' | 'B' | 'C' | 'D'> = {};

  keys.forEach((k, idx) => {
    const upper = k.toUpperCase();
    if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
      result[idx + 1] = upper;
    }
  });

  return result;
}

/**
 * Formats a map of manual keys { 1: 'A', 2: 'B' } into standard display string "1.A 2.B 3.C"
 */
export function formatManualKeysMapToString(
  keysMap: Record<number, 'A' | 'B' | 'C' | 'D'>,
  totalCount: number
): string {
  const parts: string[] = [];
  for (let i = 1; i <= totalCount; i++) {
    const val = keysMap[i];
    if (val) {
      parts.push(`${i}.${val}`);
    }
  }
  return parts.join(' ');
}

/**
 * Generates an alternating A, B, C, D pattern for quick testing or draft
 */
export function generateQuickPatternKeys(totalCount: number): Record<number, 'A' | 'B' | 'C' | 'D'> {
  const rotation: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const result: Record<number, 'A' | 'B' | 'C' | 'D'> = {};
  for (let i = 1; i <= totalCount; i++) {
    result[i] = rotation[(i - 1) % 4];
  }
  return result;
}

/**
 * Parses manual kisi-kisi lines:
 * Format A: "1. Aljabar | Menghitung persamaan linier | L2"
 * Format B: "1. Menghitung persamaan linier dua variabel"
 * Format C: "Menghitung persamaan linier dua variabel"
 */
export function parseManualKisiKisiText(
  rawText: string,
  defaultSubject: string,
  _totalCount: number = 25
): Record<number, ManualParsedIndicator> {
  if (!rawText || !rawText.trim()) return {};

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#'));

  const result: Record<number, ManualParsedIndicator> = {};
  let currentNum = 1;

  for (const line of lines) {
    // Check if line starts with a number like "1. " or "1) "
    const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
    let itemNum = currentNum;
    let content = line;

    if (numMatch) {
      itemNum = parseInt(numMatch[1], 10);
      content = numMatch[2].trim();
    }

    if (!content) continue;

    // Check if piped format: "Topic | Indicator | Level"
    if (content.includes('|')) {
      const parts = content.split('|').map((p) => p.trim());
      const topic = parts[0] || defaultSubject;
      const indicator = parts[1] || `Memahami materi ${topic}`;
      const cognitiveLevel = parts[2] || (itemNum % 2 === 0 ? 'L2 (C3)' : 'L3 (C4)');

      result[itemNum] = {
        number: itemNum,
        topic,
        indicator,
        cognitiveLevel,
      };
    } else {
      // Simple text: indicator only
      result[itemNum] = {
        number: itemNum,
        topic: defaultSubject,
        indicator: content,
        cognitiveLevel: itemNum % 2 === 0 ? 'L2 (C3)' : 'L3 (C4)',
      };
    }

    currentNum = itemNum + 1;
  }

  return result;
}

/**
 * Parses manual essay rubrics:
 * Format: "1. Menyebutkan 2 perbedaan fisika dan kimia (Skor: 20)"
 */
export function parseManualEssayRubrics(
  rawText: string,
  totalCount: number = 5
): Record<number, ManualParsedEssayRubric> {
  if (!rawText || !rawText.trim()) return {};

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#'));

  const result: Record<number, ManualParsedEssayRubric> = {};
  let currentNum = 1;
  const defaultMax = Math.round(100 / Math.max(1, totalCount));

  for (const line of lines) {
    const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
    let itemNum = currentNum;
    let content = line;

    if (numMatch) {
      itemNum = parseInt(numMatch[1], 10);
      content = numMatch[2].trim();
    }

    if (!content) continue;

    // Check if there is an explicit score notation: e.g. "(Skor: 25)" or "[20]" or "20 poin"
    let maxScore = defaultMax;
    const scoreMatch = content.match(/(?:\(|\[)?(?:Skor|Poin|Nilai)?\s*[:=]?\s*(\d+)\s*(?:poin|pts|skor)?(?:\)|\])?$/i);
    if (scoreMatch) {
      const parsedScore = parseInt(scoreMatch[1], 10);
      if (parsedScore > 0 && parsedScore <= 100) {
        maxScore = parsedScore;
      }
      content = content.replace(scoreMatch[0], '').trim();
    }

    result[itemNum] = {
      number: itemNum,
      expectedAnswer: content || 'Kriteria jawaban lengkap dan tepat sesuai materi pokok.',
      maxScore,
    };

    currentNum = itemNum + 1;
  }

  return result;
}

/**
 * Applies custom manual answer keys, indicators, and essay rubrics to generated ExamPaperData
 */
export function applyManualKeysAndKisiKisi(
  data: ExamPaperData,
  manualData: {
    keysMap: Record<number, 'A' | 'B' | 'C' | 'D'>;
    indicators: Record<number, ManualParsedIndicator>;
    rubrics: Record<number, ManualParsedEssayRubric>;
  }
): ExamPaperData {
  const { keysMap, indicators, rubrics } = manualData;

  // Clone MCQ questions and apply manual keys and indicators
  const updatedMcq: McqQuestionItem[] = data.mcqQuestions.map((q) => {
    const manualKey = keysMap[q.number];
    const manualInd = indicators[q.number];

    return {
      ...q,
      correctAnswer: manualKey || q.correctAnswer,
      topic: manualInd?.topic || q.topic || data.subject,
      indicator: manualInd?.indicator || q.indicator,
      cognitiveLevel: manualInd?.cognitiveLevel || q.cognitiveLevel,
    };
  });

  // Clone Essay questions and apply manual rubrics and indicators
  const updatedEssay: EssayQuestionItem[] = data.essayQuestions.map((eq) => {
    const manualRubric = rubrics[eq.number];
    const offsetIndNum = data.mcqQuestions.length + eq.number;
    const manualInd = indicators[offsetIndNum] || indicators[eq.number];

    return {
      ...eq,
      expectedAnswer: manualRubric?.expectedAnswer || eq.expectedAnswer,
      maxScore: manualRubric?.maxScore || eq.maxScore,
      topic: manualInd?.topic || eq.topic || data.subject,
      indicator: manualInd?.indicator || eq.indicator,
      cognitiveLevel: manualInd?.cognitiveLevel || eq.cognitiveLevel,
    };
  });

  return {
    ...data,
    mcqQuestions: updatedMcq,
    essayQuestions: updatedEssay,
  };
}

export const SAMPLE_MANUAL_KISIKISI_TEMPLATE = `// Format: Nomor. Materi Pokok | Indikator Pencapaian Kompetensi | Level
1. Operasi Bilangan | Menghitung hasil operasi penjumlahan & perkalian bilangan | L1 (C2)
2. Massa Jenis & Zat | Menentukan besaran massa jenis dan volume zat padat | L2 (C3)
3. Ciri Makhluk Hidup | Mengidentifikasi fungsi iritabilitas makhluk hidup | L2 (C3)
4. Nilai Kejujuran | Menganalisis sikap integritas dalam kehidupan sekolah | L3 (C4)
5. Sistem Pernapasan | Mengidentifikasi fungsi alveolus pada organ manusia | L1 (C2)`;

export const SAMPLE_MANUAL_ESSAY_RUBRIC_TEMPLATE = `// Format: Nomor. Kriteria Jawaban Diharapkan (Skor: Poin)
1. Menjelaskan secara lengkap perbedaan perubahan fisika dan kimia beserta 2 contoh nyata (Skor: 20)
2. Menghitung luas permukaan tabung dengan rumus dan langkah pengerjaan runtut (Skor: 20)
3. Menguraikan faktor penyebab pencemaran lingkungan dan solusi pelestariannya (Skor: 20)`;
