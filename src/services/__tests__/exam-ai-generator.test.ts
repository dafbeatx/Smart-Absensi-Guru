/**
 * SMART ABSENSI GURU - EXAM AI GENERATOR TEST SUITE
 * Tests for natural language prompt parsing, Indonesian date extraction,
 * heuristic fallback engine, schedule generation, updating, and deletion.
 */

import {
  ExamScheduleAIGeneratorService,
  EXAM_AI_PROMPT_PRESETS,
} from '../exam-ai-generator.service';
import { ExamScheduleRepository } from '../../repositories/ExamScheduleRepository';
import type { UserProfile } from '../../types/database.types';

export const runExamAIGeneratorTestSuite = async (): Promise<{
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
      results.push({ testName, status: 'FAIL', details: details || 'Assertion failed' });
    }
  };

  const sampleTeachers: UserProfile[] = [
    {
      id: 'guru_1',
      full_name: 'Drs. H. Ahmad Dahlan',
      nip: 'NPP001',
      role: 'GURU',
      teaching_assignment: 'Matematika',
    } as unknown as UserProfile,
    {
      id: 'guru_2',
      full_name: 'Siti Aminah, M.Pd',
      nip: 'NPP002',
      role: 'GURU',
      teaching_assignment: 'Bahasa Indonesia',
    } as unknown as UserProfile,
    {
      id: 'guru_3',
      full_name: 'Budi Santoso, S.Kom',
      nip: 'NPP003',
      role: 'GURU',
      teaching_assignment: 'Informatika',
    } as unknown as UserProfile,
    {
      id: 'guru_4',
      full_name: 'Dewi Lestari, S.Si',
      nip: 'NPP004',
      role: 'GURU',
      teaching_assignment: 'IPA',
    } as unknown as UserProfile,
    {
      id: 'guru_5',
      full_name: 'Hasan Basri, S.Ag',
      nip: 'NPP005',
      role: 'GURU',
      teaching_assignment: 'PAI',
    } as unknown as UserProfile,
    {
      id: 'guru_6',
      full_name: 'Nurul Hidayah, S.Pd',
      nip: 'NPP006',
      role: 'GURU',
      teaching_assignment: 'Bahasa Inggris',
    } as unknown as UserProfile,
  ];

  const sampleClasses = ['7A', '7B', '8A', '8B', '9A', '9B'];
  const sampleSubjects = ['PAI', 'Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Bahasa Inggris'];

  // ---------------------------------------------------------------------------
  // TEST 1: Date Extraction from Indonesian Prompt
  // ---------------------------------------------------------------------------
  try {
    const promptDates1 = 'Jadwal dari tanggal 29 September sampai 3 Oktober 2026';
    const res1 = ExamScheduleAIGeneratorService.extractDatesFromPrompt(promptDates1);

    const promptDates2 = 'Pelaksanaan ujian 23 - 27 September 2026';
    const res2 = ExamScheduleAIGeneratorService.extractDatesFromPrompt(promptDates2);

    assert(
      'Exam AI 01: Extracts Indonesian date ranges correctly into YYYY-MM-DD',
      res1.startDate === '2026-09-29' &&
      res1.endDate === '2026-10-03' &&
      res2.startDate === '2026-09-23' &&
      res2.endDate === '2026-09-27',
      `Parsed 1: ${res1.startDate} s.d. ${res1.endDate} | Parsed 2: ${res2.startDate} s.d. ${res2.endDate}`
    );
  } catch (err: any) {
    assert('Exam AI 01: Error parsing dates', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Local Heuristic Parser for ASTS vs ASAS & Sessions
  // ---------------------------------------------------------------------------
  try {
    const astsPrompt =
      'Buatkan jadwal ASTS ganjil dari tanggal 29 September sampai 3 Oktober 2026, 2 sesi per hari, hari Jumat 1 sesi saja, 1 pengawas per ruang.';
    const parsedASTS = ExamScheduleAIGeneratorService.parsePromptLocally(astsPrompt, {
      prompt: astsPrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      teachers: sampleTeachers,
      availableClasses: sampleClasses,
      availableSubjects: sampleSubjects,
    });

    const asasPrompt =
      'Buatkan jadwal ASAS (Asesmen Sumatif Akhir Semester) selama 6 hari dari Senin sampai Sabtu, 2 sesi per hari, sertakan hari Sabtu.';
    const parsedASAS = ExamScheduleAIGeneratorService.parsePromptLocally(asasPrompt, {
      prompt: asasPrompt,
      academicYear: '2026/2027',
      semester: 'Genap',
      teachers: sampleTeachers,
      availableClasses: sampleClasses,
      availableSubjects: sampleSubjects,
    });

    const fridayOverride = parsedASTS.dayOverrides?.find((d) => d.dayName.toLowerCase() === 'jumat');

    assert(
      'Exam AI 02: Accurately identifies ASTS vs ASAS, sessions count, Friday override, and Saturday flag',
      parsedASTS.examType === 'ASTS' &&
      parsedASTS.sessionsPerDay === 2 &&
      fridayOverride?.sessionsCount === 1 &&
      parsedASAS.examType === 'ASAS' &&
      parsedASAS.includeSaturday === true,
      `ASTS Type: ${parsedASTS.examType}, Friday sessions: ${fridayOverride?.sessionsCount} | ASAS Type: ${parsedASAS.examType}, Saturday: ${parsedASAS.includeSaturday}`
    );
  } catch (err: any) {
    assert('Exam AI 02: Error in heuristic prompt parsing', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Preset Prompts Quality & Validity
  // ---------------------------------------------------------------------------
  try {
    const hasPresets = EXAM_AI_PROMPT_PRESETS.length >= 4;
    const allPresetsHaveDetails = EXAM_AI_PROMPT_PRESETS.every(
      (p) => p.id && p.title && p.badge && p.prompt && p.prompt.length > 20
    );

    assert(
      'Exam AI 03: Provides comprehensive, valid 1-click prompt presets for quick generation',
      hasPresets && allPresetsHaveDetails,
      `Total Presets: ${EXAM_AI_PROMPT_PRESETS.length} presets available`
    );
  } catch (err: any) {
    assert('Exam AI 03: Error verifying presets', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: End-to-End Generation, Update, and Deletion
  // ---------------------------------------------------------------------------
  try {
    const testPrompt =
      'Buatkan jadwal ASTS dari tanggal 2026-09-29 sampai 2026-10-03, 2 sesi per hari, hari Jumat 1 sesi, semua guru aktif mengawas, 1 guru per ruang.';
    const genResult = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: testPrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      teachers: sampleTeachers,
      availableClasses: sampleClasses,
      availableSubjects: sampleSubjects,
    });

    // Verify schedule created
    const hasSubjects = genResult.schedule.subjectSchedules.length > 0;
    const hasProctors = genResult.schedule.proctorSchedules.length > 0;
    const isSaved = (await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS')) !== null;

    // Verify updating with a new prompt
    const updatePrompt =
      'Perbarui jadwal ASTS dari tanggal 2026-09-29 sampai 2026-10-03, ubah menjadi 3 sesi per hari, hari jumat 2 sesi.';
    const updateResult = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: updatePrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      teachers: sampleTeachers,
      availableClasses: sampleClasses,
      availableSubjects: sampleSubjects,
    });

    const isUpdated = updateResult.config.sessionsPerDay === 3;

    // Verify deletion
    await ExamScheduleRepository.deleteSchedule('2026/2027', 'ASTS');
    const isDeleted = (await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS')) === null;

    assert(
      'Exam AI 04: Full lifecycle test: generate from prompt, update with new prompt, and delete cleanly',
      hasSubjects && hasProctors && isSaved && isUpdated && isDeleted,
      `Subjects: ${genResult.schedule.subjectSchedules.length}, Proctors: ${genResult.schedule.proctorSchedules.length}, Updated 3-sessions: ${isUpdated}, Deleted clean: ${isDeleted}`
    );
  } catch (err: any) {
    assert('Exam AI 04: Error in full lifecycle test', false, err?.message);
  }

  return {
    passed,
    failed,
    results,
  };
};
