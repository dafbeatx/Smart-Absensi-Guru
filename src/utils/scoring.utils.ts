import { DEFAULT_SCORING_CONFIG, type ScoringConfig, type StudentCalculationResult } from '../types/database.types';

export const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D', 'E']);

export interface AnswerKeyValidationResult {
  isValid: boolean;
  keys: string[];
  totalQuestions: number;
  errors: string[];
  gaps: number[];
  duplicates: number[];
  invalidOptions: Array<{ num?: number; value: string }>;
}

/**
 * Validates and inspects answer key input strictly.
 * - Enforces contiguous question numbers without gaps (e.g. 1, 2, 4 is rejected).
 * - Enforces uniqueness of question numbers (no duplicate definitions like 1.A and 1.B).
 * - Validates options strictly against A, B, C, D, E.
 */
export function validateAnswerKey(input: string): AnswerKeyValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      keys: [],
      totalQuestions: 0,
      errors: ['Kunci jawaban tidak boleh kosong.'],
      gaps: [],
      duplicates: [],
      invalidOptions: [],
    };
  }

  const normalized = input
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim();

  const errors: string[] = [];
  const gaps: number[] = [];
  const duplicates: number[] = [];
  const invalidOptions: Array<{ num?: number; value: string }> = [];

  // Strategy 1: Numbered format — "1.A 2.B" or "1)A 2)B" or "1:A" or "1-A"
  const numberedPattern = /(\d+)\s*[.:\-)\s]\s*([A-Za-z0-9]+)/g;
  const numberedMap = new Map<number, string>();
  let match: RegExpExecArray | null;
  let hasNumbered = false;

  while ((match = numberedPattern.exec(normalized)) !== null) {
    hasNumbered = true;
    const num = parseInt(match[1], 10);
    const rawVal = match[2].toUpperCase().trim();

    if (numberedMap.has(num)) {
      duplicates.push(num);
    } else {
      numberedMap.set(num, rawVal);
    }

    if (!VALID_OPTIONS.has(rawVal)) {
      invalidOptions.push({ num, value: rawVal });
    }
  }

  if (hasNumbered) {
    if (duplicates.length > 0) {
      const dupList = Array.from(new Set(duplicates)).sort((a, b) => a - b).join(', ');
      errors.push(`Ditemukan nomor soal duplikat: [${dupList}]. Setiap nomor soal harus unik.`);
    }

    if (invalidOptions.length > 0) {
      const invList = invalidOptions.map((o) => `Soal #${o.num}: '${o.value}'`).join(', ');
      errors.push(`Pilihan jawaban tidak valid (hanya A-E yang diperbolehkan): ${invList}.`);
    }

    const nums = Array.from(numberedMap.keys()).sort((a, b) => a - b);
    if (nums.length > 0) {
      if (nums[0] !== 1) {
        errors.push(`Nomor soal harus dimulai dari 1 (ditemukan nomor awal: ${nums[0]}).`);
      }

      const maxNum = nums[nums.length - 1];
      for (let expected = 1; expected <= maxNum; expected++) {
        if (!numberedMap.has(expected)) {
          gaps.push(expected);
        }
      }

      if (gaps.length > 0) {
        errors.push(`Nomor soal tidak berurutan / berlubang pada nomor: [${gaps.join(', ')}]. Dilarang melewati nomor soal.`);
      }
    }

    const isValid = errors.length === 0;
    const keys: string[] = [];
    if (isValid) {
      for (let i = 1; i <= numberedMap.size; i++) {
        keys.push(numberedMap.get(i)!);
      }
    }

    return {
      isValid,
      keys,
      totalQuestions: keys.length,
      errors,
      gaps,
      duplicates,
      invalidOptions,
    };
  }

  // Strategy 2: Separated letters — "A B C D" or "A, B, C, D" or "A;B;C;D"
  const tokens = normalized.split(/[,;\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  let allTokensAreLetters = tokens.length > 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!VALID_OPTIONS.has(tok)) {
      allTokensAreLetters = false;
      invalidOptions.push({ num: i + 1, value: tok });
    }
  }

  if (allTokensAreLetters) {
    return {
      isValid: true,
      keys: tokens,
      totalQuestions: tokens.length,
      errors: [],
      gaps: [],
      duplicates: [],
      invalidOptions: [],
    };
  }

  // Strategy 3: Continuous string — "ABCDABCD"
  const onlyAlpha = normalized.toUpperCase().replace(/[^A-Z]/g, '');
  if (onlyAlpha.length > 0 && onlyAlpha.length === normalized.replace(/\s/g, '').length) {
    const chars = onlyAlpha.split('');
    const invalidChars = chars.filter((c) => !VALID_OPTIONS.has(c));
    if (invalidChars.length === 0) {
      return {
        isValid: true,
        keys: chars,
        totalQuestions: chars.length,
        errors: [],
        gaps: [],
        duplicates: [],
        invalidOptions: [],
      };
    }
  }

  return {
    isValid: false,
    keys: [],
    totalQuestions: 0,
    errors: ['Format kunci jawaban tidak dapat dikenali. Gunakan format "1.A 2.B 3.C" atau "A B C D".'],
    gaps,
    duplicates,
    invalidOptions,
  };
}

/**
 * Deterministic answer key parser.
 * Strict mode prevents question shifting or silent data corruption from gaps/duplicates.
 */
export function parseAnswerKey(input: string, options?: { throwOnError?: boolean }): string[] {
  const validation = validateAnswerKey(input);
  if (!validation.isValid) {
    if (options?.throwOnError) {
      throw new Error(`Kunci jawaban tidak valid: ${validation.errors.join(' ')}`);
    }
    return [];
  }
  return validation.keys;
}

/**
 * Calculates student exam scores including PG, Essay, CSI, and LPS.
 * Strictly clamps all scores to 0..100 and validates per-item essay bounds.
 */
export function calculateStudentResult(
  answerKey: string[],
  studentAnswers: Record<number, string>,
  essayScores: number[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): StudentCalculationResult {
  const totalQuestions = answerKey.length;

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  const normalize = (val?: string) => (val ? val.trim().toUpperCase() : '');

  for (let i = 0; i < totalQuestions; i++) {
    const qNum = i + 1;
    const studentAns = studentAnswers[qNum];
    const correctAns = answerKey[i];

    if (!studentAns || studentAns.trim() === '') {
      unanswered++;
    } else if (normalize(studentAns) === normalize(correctAns)) {
      correct++;
    } else {
      wrong++;
    }
  }

  // PG Score (0 - 100) strictly clamped
  const rawPgScore = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  const pgScore = Math.max(0, Math.min(100, rawPgScore));

  // Essay Score (0 - 100 normalized)
  const essayCount = config.essayCount ?? 5;
  const essayMaxScore = config.essayMaxScore ?? 20;
  const maxPerItem = essayCount > 0 ? essayMaxScore / essayCount : essayMaxScore;
  const itemMax = maxPerItem > 0 ? maxPerItem : essayMaxScore;

  // Validate and clamp each individual essay score to non-negative and max per item
  const clampedEssayScores = (essayScores || []).map((score) => {
    const num = Number(score) || 0;
    return Math.max(0, Math.min(itemMax, num));
  });

  const totalEssayRaw = clampedEssayScores.reduce((a, b) => a + b, 0);
  const rawEssayScore =
    essayMaxScore > 0
      ? (totalEssayRaw / essayMaxScore) * 100
      : 0;
  const essayScore = Math.max(0, Math.min(100, Math.round(rawEssayScore * 10) / 10));

  // Final Score = weighted combination
  const hasEssay = (config.essayCount ?? 0) > 0 && (config.essayMaxScore ?? 0) > 0;
  const pgWeight = hasEssay ? (config.pgWeight ?? 0.7) : 1.0;
  const essayWeight = hasEssay ? (config.essayWeight ?? 0.3) : 0;

  const rawFinalScore = Math.round(pgScore * pgWeight + essayScore * essayWeight);
  const finalScore = Math.max(0, Math.min(100, rawFinalScore));
  const percentage = finalScore;

  // CSI — Cognitive Skill Index (Accuracy & Answer Completeness)
  const completeness = totalQuestions > 0 ? ((correct + wrong) / totalQuestions) * 100 : 0;
  const accuracy = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  const csi = Math.max(0, Math.min(100, Math.round(accuracy * 0.7 + completeness * 0.3)));

  // LPS — Learning Performance Score (PG + Essay composite)
  const rawLps = hasEssay
    ? Math.round(pgScore * 0.6 + essayScore * 0.4)
    : Math.round(pgScore);
  const lps = Math.max(0, Math.min(100, rawLps));

  return {
    correct,
    wrong,
    unanswered,
    score: pgScore,
    essayScore,
    finalScore,
    percentage,
    csi,
    lps,
  };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Sangat Baik';
  if (score >= 80) return 'Baik';
  if (score >= 70) return 'Cukup';
  if (score >= 60) return 'Kurang';
  return 'Sangat Kurang';
}

export function getCsiLabel(csi: number): string {
  if (csi >= 85) return 'Mahir';
  if (csi >= 70) return 'Cakap';
  if (csi >= 55) return 'Berkembang';
  return 'Perlu Bimbingan';
}

export function getLpsLabel(lps: number): string {
  if (lps >= 85) return 'Di Atas Rata-rata';
  if (lps >= 70) return 'Rata-rata';
  if (lps >= 55) return 'Di Bawah Rata-rata';
  return 'Perlu Perhatian';
}

/**
 * Generates automated student answers (Pilihan Ganda) to match a desired target score (0 - 100).
 * - Distributes correct and incorrect answers realistically across the answer key.
 * - Guarantees that incorrect answers pick an alternate option (e.g. B instead of A) from availableOptions.
 * - Guarantees that calculating scores from these answers produces the expected correct count and target score.
 *
 * @param answerKey List of correct answers per question, e.g. ['A', 'B', 'C', 'D', ...]
 * @param targetScore Score between 0 and 100
 * @param availableOptions List of available choices, e.g. ['A', 'B', 'C', 'D'] or ['A', 'B', 'C', 'D', 'E']
 * @returns Record<number, string> mapping question number (1-based) to selected option
 */
export function generateAutoPgAnswers(
  answerKey: string[],
  targetScore: number,
  availableOptions: string[] = ['A', 'B', 'C', 'D']
): Record<number, string> {
  const total = answerKey.length;
  if (total === 0) return {};

  const clampedScore = Math.max(0, Math.min(100, Math.round(targetScore)));
  const targetCorrect = Math.max(0, Math.min(total, Math.round((clampedScore / 100) * total)));
  const targetWrong = total - targetCorrect;

  // Determine which question indices (0-based) should be wrong
  const wrongIndices = new Set<number>();
  if (targetWrong > 0) {
    if (targetWrong >= total) {
      for (let i = 0; i < total; i++) {
        wrongIndices.add(i);
      }
    } else {
      // Distribute wrong answers evenly across the test with a slight offset
      const step = total / targetWrong;
      for (let w = 0; w < targetWrong; w++) {
        const idx = Math.min(total - 1, Math.floor((w + 0.5) * step));
        wrongIndices.add(idx);
      }
      // If rounding caused fewer than targetWrong indices, fill from the end backwards
      let fallbackIdx = total - 1;
      while (wrongIndices.size < targetWrong && fallbackIdx >= 0) {
        wrongIndices.add(fallbackIdx);
        fallbackIdx--;
      }
    }
  }

  const result: Record<number, string> = {};
  for (let i = 0; i < total; i++) {
    const qNum = i + 1;
    const correctKey = (answerKey[i] || 'A').toUpperCase().trim();
    if (wrongIndices.has(i)) {
      // Pick an alternate option that is definitely not the correct key
      const wrongChoices = availableOptions.filter(
        (opt) => opt.toUpperCase().trim() !== correctKey
      );
      const chosenWrong =
        wrongChoices.length > 0
          ? wrongChoices[i % wrongChoices.length]
          : correctKey === 'A'
          ? 'B'
          : 'A';
      result[qNum] = chosenWrong;
    } else {
      result[qNum] = correctKey;
    }
  }

  return result;
}

/**
 * Generates automated student essay scores per item to match a desired target score (0 - 100).
 * - Distributes scores evenly across essay questions so the total raw essay score produces the target percentage.
 * - Guarantees that each item score does not exceed maxPerItem and is >= 0.
 * - Distributes remainder points smoothly starting from the first questions.
 *
 * @param targetScore Score percentage between 0 and 100
 * @param essayCount Number of essay questions (default 5)
 * @param essayMaxScore Total maximum raw points for all essay questions (default 20)
 * @returns Array of numbers representing raw points per essay item, length equal to essayCount
 */
export function generateAutoEssayScores(
  targetScore: number,
  essayCount: number = 5,
  essayMaxScore: number = 20
): number[] {
  const count = Math.max(0, essayCount);
  if (count === 0) return [];

  const maxScore = Math.max(1, essayMaxScore);
  const clampedScore = Math.max(0, Math.min(100, Math.round(targetScore)));

  const targetRaw = Math.min(maxScore, Math.max(0, Math.round((clampedScore / 100) * maxScore)));
  if (targetRaw <= 0) {
    return Array(count).fill(0);
  }

  const maxPerItem = Math.max(1, Math.ceil(maxScore / count));
  const baseScore = Math.min(maxPerItem, Math.floor(targetRaw / count));
  let remainder = targetRaw - baseScore * count;

  const result: number[] = Array(count).fill(baseScore);

  for (let i = 0; i < count && remainder > 0; i++) {
    if (result[i] < maxPerItem) {
      result[i] += 1;
      remainder -= 1;
    }
  }

  let idx = 0;
  while (remainder > 0 && idx < count) {
    if (result[idx] < maxPerItem) {
      result[idx] += 1;
      remainder -= 1;
    }
    idx++;
  }

  return result;
}

