import { DEFAULT_SCORING_CONFIG, type ScoringConfig, type StudentCalculationResult } from '../types/database.types';

const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D', 'E']);

/**
 * Deterministic answer key parser.
 * Supports multiple formats:
 * - "1.A 2.B 3.C 4.D"
 * - "1) A 2) B 3) C"
 * - "A B C D"
 * - "A, B, C, D"
 * - "ABCDABCD"
 */
export function parseAnswerKey(input: string): string[] {
  if (!input || !input.trim()) return [];

  const normalized = input
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim();

  // Strategy 1: Numbered format — "1.A 2.B" or "1)A 2)B" or "1:A" or "1-A"
  const numberedPattern = /(\d+)\s*[.:\-)\s]\s*([A-Ea-e])/g;
  const numberedMatches: { num: number; ans: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = numberedPattern.exec(normalized)) !== null) {
    const num = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    if (VALID_OPTIONS.has(ans)) {
      numberedMatches.push({ num, ans });
    }
  }

  if (numberedMatches.length > 0) {
    numberedMatches.sort((a, b) => a.num - b.num);
    const result: string[] = [];
    for (const m of numberedMatches) {
      result[m.num - 1] = m.ans;
    }
    return result.filter(Boolean);
  }

  // Strategy 2: Separated letters — "A B C D" or "A, B, C, D" or "A;B;C;D"
  const separatedPattern = /^[A-Ea-e](\s*[,;\s]\s*[A-Ea-e])+$/;
  const cleanedForSep = normalized.replace(/[^A-Ea-e,;\s]/g, '').trim();

  if (separatedPattern.test(cleanedForSep)) {
    const letters = cleanedForSep
      .split(/[,;\s]+/)
      .map((l) => l.trim().toUpperCase())
      .filter((l) => VALID_OPTIONS.has(l));
    if (letters.length > 0) return letters;
  }

  // Strategy 3: Continuous string — "ABCDABCD"
  const onlyLetters = normalized.toUpperCase().replace(/[^A-E]/g, '');
  if (onlyLetters.length > 0 && onlyLetters.length === normalized.replace(/\s/g, '').length) {
    return onlyLetters.split('');
  }

  // Strategy 4: Fallback — extract all valid A-E letters in order
  if (onlyLetters.length > 0) {
    return onlyLetters.split('');
  }

  return [];
}

/**
 * Calculates student exam scores including PG, Essay, CSI, and LPS.
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

  // PG Score (0 - 100)
  const pgScore = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;

  // Essay Score (0 - 100 normalized)
  const totalEssayRaw = essayScores.reduce((a, b) => a + (Number(b) || 0), 0);
  const essayScore =
    config.essayMaxScore > 0
      ? (totalEssayRaw / config.essayMaxScore) * 100
      : 0;

  // Final Score = weighted combination
  // If exam has no essay (essayCount === 0 or essayMaxScore === 0), PG weight is 100% (1.0)
  const hasEssay = (config.essayCount ?? 0) > 0 && (config.essayMaxScore ?? 0) > 0;
  const pgWeight = hasEssay ? (config.pgWeight ?? 0.7) : 1.0;
  const essayWeight = hasEssay ? (config.essayWeight ?? 0.3) : 0;

  const finalScore = Math.round(
    pgScore * pgWeight + essayScore * essayWeight
  );

  const percentage = finalScore;

  // CSI — Cognitive Skill Index (Accuracy & Answer Completeness)
  const completeness = totalQuestions > 0 ? ((correct + wrong) / totalQuestions) * 100 : 0;
  const accuracy = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  const csi = Math.round(accuracy * 0.7 + completeness * 0.3);

  // LPS — Learning Performance Score (PG + Essay composite)
  const lps = hasEssay
    ? Math.round(pgScore * 0.6 + essayScore * 0.4)
    : Math.round(pgScore);

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

