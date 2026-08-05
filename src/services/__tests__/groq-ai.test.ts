/**
 * SMART ABSENSI GURU - GROQ AI ENGINE TEST SUITE
 */

import { GroqAIService } from '../groq-ai.service';

export const runGroqAITestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // Test 1: Empty leave reason handling
  const emptyAnalysis = await GroqAIService.analyzeLeaveReason('');
  assert(
    'Groq AI - Handle Empty Leave Reason Gracefully',
    emptyAnalysis.recommendation === 'NEEDS_CLARIFICATION' && emptyAnalysis.confidence === 0
  );

  // Test 2: Valid leave reason refinement (Fallback or API)
  const validAnalysis = await GroqAIService.analyzeLeaveReason('demam dan flu berat dari semalam', 'SAKIT');
  assert(
    'Groq AI - Polishes Raw Leave Reason into Formal Text',
    typeof validAnalysis.polishedReason === 'string' &&
    validAnalysis.polishedReason.length > 10 &&
    typeof validAnalysis.recommendation === 'string'
  );

  // Test 3: Executive Summary generation for Kepsek
  const summary = await GroqAIService.generateExecutiveSummary({
    totalTeachers: 45,
    presentCount: 40,
    lateCount: 3,
    leaveCount: 2,
    absentCount: 0,
  });
  assert(
    'Groq AI - Generates Narrative Executive Summary for Kepsek',
    typeof summary === 'string' && (summary.includes('40') || summary.includes('Kehadiran') || summary.includes('guru'))
  );

  // Test 4: Smart Assistant Chatbot Q&A
  const botAnswer = await GroqAIService.askSmartAssistant('Bagaimana cara absen jika barcode direject?');
  assert(
    'Groq AI - Smart Assistant Answers Attendance Queries',
    typeof botAnswer === 'string' && botAnswer.length > 10
  );

  return { passed, failed, results };
};
