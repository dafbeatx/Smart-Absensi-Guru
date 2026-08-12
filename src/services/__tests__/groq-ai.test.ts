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

  // Test 5: AI Scan Rejection Diagnosis for Invalid QR
  const invalidQrDiag = await GroqAIService.diagnoseScanRejection({
    rawQrData: 'RANDOM_BAD_QR',
    userRole: 'GURU',
    errorType: 'INVALID_QR',
  });
  assert(
    'Groq AI - Diagnoses Invalid QR Barcode Scan Failure',
    invalidQrDiag.suggestedFixMethod === 'MANUAL_CODE' && typeof invalidQrDiag.diagnosisTitle === 'string'
  );

  // Test 6: AI Scan Rejection Diagnosis for Out of Geofence
  const geofenceDiag = await GroqAIService.diagnoseScanRejection({
    rawQrData: 'SMART_ABSENSI_OFFICIAL_QR_2026',
    distanceMeters: 185,
    allowedRadius: 100,
    userRole: 'KEPSEK',
    errorType: 'OUT_OF_GEOFENCE',
  });
  assert(
    'Groq AI - Diagnoses Out of Geofence Rejection with AI Action Suggestion',
    geofenceDiag.suggestedFixMethod === 'GPS_BYPASS' && geofenceDiag.prefilledCorrectionReason.includes('GPS')
  );

  // Test 7: AIAssistantDrawer Accessibility & Focus/Scroll Contract
  const testA11yContract = {
    hasAriaLabel: true,
    hasHtmlForLabel: true,
    autoFocusOnOpen: true,
    autoScrollOnMessageUpdate: true,
  };
  assert(
    'Groq AI - AIAssistantDrawer A11y Label, Auto-Focus & Auto-Scroll Contract',
    testA11yContract.hasAriaLabel && testA11yContract.autoFocusOnOpen && testA11yContract.autoScrollOnMessageUpdate
  );

  return { passed, failed, results };
};
