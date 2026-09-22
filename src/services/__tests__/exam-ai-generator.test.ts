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
import { ExamMatrixBuilderService } from '../exam-matrix-builder.service';
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

  // ---------------------------------------------------------------------------
  // TEST 5: SMP vs SMA Independent Segregation & Safe Isolation
  // ---------------------------------------------------------------------------
  try {
    const combinedClasses = ['7A', '7B', '8A', '8B', '9A', '9B', '10', '11', '12'];

    // 1. Generate SMP Schedule
    const smpPrompt = 'Buatkan jadwal ASTS SMP Terpadu Al-Ittihadiyah 2 sesi per hari tanggal 29 Sep - 3 Okt 2026';
    const smpGen = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: smpPrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      educationLevel: 'SMP',
      teachers: sampleTeachers,
      availableClasses: combinedClasses,
      availableSubjects: sampleSubjects,
    });

    // 2. Generate SMA Schedule
    const smaPrompt = 'Buatkan jadwal ASTS SMA Terpadu As Salaam 2 sesi per hari tanggal 29 Sep - 3 Okt 2026';
    const smaGen = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: smaPrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      educationLevel: 'SMA',
      teachers: sampleTeachers,
      availableClasses: combinedClasses,
      availableSubjects: sampleSubjects,
    });

    // Verify SMP only contains SMP classes
    const smpOnlySMPClasses = smpGen.config.selectedClasses.every((c) => /^[789]/.test(c));
    // Verify SMA only contains SMA classes
    const smaOnlySMAClasses = smaGen.config.selectedClasses.every((c) => /^(10|11|12)/.test(c));

    // Verify both exist independently in repository
    const smpLoaded = await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS', 'SMP');
    const smaLoaded = await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS', 'SMA');
    const bothExist = smpLoaded !== null && smaLoaded !== null;

    // Delete SMP only
    await ExamScheduleRepository.deleteSchedule('2026/2027', 'ASTS', 'SMP');
    const smpAfterDelete = await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS', 'SMP');
    const smaAfterSmpDelete = await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS', 'SMA');

    const smpDeletedIsolated = smpAfterDelete === null && smaAfterSmpDelete !== null;

    // Clean up SMA
    await ExamScheduleRepository.deleteSchedule('2026/2027', 'ASTS', 'SMA');
    const smaCleaned = (await ExamScheduleRepository.getSchedule('2026/2027', 'ASTS', 'SMA')) === null;

    assert(
      'Exam AI 05: SMP and SMA schedules operate with 100% independent storage, class filtering, and safe deletion',
      smpOnlySMPClasses && smaOnlySMAClasses && bothExist && smpDeletedIsolated && smaCleaned,
      `SMP Classes: ${smpGen.config.selectedClasses.join(',')} | SMA Classes: ${smaGen.config.selectedClasses.join(',')} | Isolated delete: ${smpDeletedIsolated}`
    );
  } catch (err: any) {
    assert('Exam AI 05: Error in SMP vs SMA segregation test', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Explicit Custom Proctor Matrix (P1 to P5) Deterministic Allocation
  // ---------------------------------------------------------------------------
  try {
    const customTeachers: UserProfile[] = [
      { id: 'usr_fitri', full_name: 'Fitri Ani Rahayu, S.Mat', role: 'GURU', teaching_assignment: 'Matematika' } as unknown as UserProfile,
      { id: 'usr_qodiatul', full_name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', role: 'ADMIN', teaching_assignment: 'Informatika' } as unknown as UserProfile,
      { id: 'usr_widianingsih', full_name: 'Widianingsih, S.Si., G.r', role: 'GURU', teaching_assignment: 'IPA' } as unknown as UserProfile,
      { id: 'usr_adi', full_name: 'Adi Prasetyo, S.Pd., G.r', role: 'GURU', teaching_assignment: 'Bahasa Inggris' } as unknown as UserProfile,
      { id: 'usr_iqbal', full_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', role: 'GURU', teaching_assignment: 'PJOK' } as unknown as UserProfile,
      { id: 'usr_nurul', full_name: 'Nurul Fahriya, S.Pd., G.r', role: 'GURU', teaching_assignment: 'Kurikulum' } as unknown as UserProfile,
      { id: 'usr_ridho', full_name: 'Ridho Maulana Al Farizi', role: 'GURU', teaching_assignment: 'Akhlak' } as unknown as UserProfile,
      { id: 'usr_septi', full_name: 'Septi Nur Aeni, S.E', role: 'GURU', teaching_assignment: 'Bahasa Indonesia' } as unknown as UserProfile,
      { id: 'usr_mira', full_name: 'Mira Nurdianti, S.Pd', role: 'GURU', teaching_assignment: 'Tata Usaha' } as unknown as UserProfile,
      { id: 'usr_dafa', full_name: 'Dafa Maulana', role: 'GURU', teaching_assignment: 'IT' } as unknown as UserProfile,
      { id: 'usr_mawar', full_name: 'Mawar Andinia, S.Pd., G.r', role: 'GURU', teaching_assignment: 'BK' } as unknown as UserProfile,
    ];

    const exactPrompt = `Tolong buatkan jadwal pengawasan ujian sesuai dengan matrik alokasi guru pengawas per mata pelajaran (P1 hingga P5) berikut:

PAI: P1 = Fitri Ani Rahayu, P2 = Qodiatul Asrof Ramadhoni, P3 = Widianingsih, P4 = Adi Prasetyo, P5 = M. Iqbal Gustiawan

IPA: P1 = Widianingsih, P2 = Nurul Farhiya, P3 = Ridho Maulana Al Farizi, P4 = Fitri Ani Rahayu, P5 = Adi Prasetyo

MTK: P1 = Septi Nur Aeni, P2 = Fitri Ani Rahayu, P3 = M. Iqbal Gustiawan, P4 = Mira Nurdianti, P5 = Adi Prasetyo

PP: P1 = Widianingsih, P2 = Ridho Maulana Al Farizi, P3 = Septi Nur Aeni, P4 = Qodiatul Asrof Ramadhoni, P5 = Nurul Farhiya

B. Indonesia: P1 = Nurul Farhiya, P2 = Dafa Maulana, P3 = Fitri Ani Rahayu, P4 = Mawar Andinia, P5 = Adi Prasetyo

IPS: P1 = Ridho Maulana Al Farizi, P2 = Septi Nur Aeni, P3 = Widianingsih, P4 = Adi Prasetyo, P5 = Fitri Ani Rahayu

B. Arab: P1 = Qodiatul Asrof Ramadhoni, P2 = Widianingsih, P3 = Nurul Farhiya, P4 = M. Iqbal Gustiawan, P5 = Adi Prasetyo

B. Inggris: P1 = Nurul Farhiya, P2 = Widianingsih, P3 = Fitri Ani Rahayu, P4 = Mira Nurdianti, P5 = Adi Prasetyo

SBPK: P1 = Fitri Ani Rahayu, P2 = Mawar Andinia, P3 = Qodiatul Asrof Ramadhoni, P4 = Adi Prasetyo, P5 = Widianingsih

Informatika: P1 = Qodiatul Asrof Ramadhoni, P2 = Septi Nur Aeni, P3 = Dafa Maulana, P4 = Fitri Ani Rahayu, P5 = M. Iqbal Gustiawan

Hadits: P1 = Widianingsih, P2 = Mawar Andinia, P3 = Ridho Maulana Al Farizi, P4 = Nurul Farhiya, P5 = Mira Nurdianti

BTQ: P1 = M. Iqbal Gustiawan, P2 = Mira Nurdianti, P3 = Qodiatul Asrof Ramadhoni, P4 = Dafa Maulana, P5 = Mawar Andinia

Mohon terapkan penugasan pengawas di atas secara tepat tanpa mengubah urutan guru pengawas untuk masing-masing mata pelajaran.`;

    const parsedMatrix = ExamScheduleAIGeneratorService.parseCustomSubjectProctors(exactPrompt);
    const has12Subjects = parsedMatrix.detectedSubjects.length === 12;
    const has5ProctorsPerSubject = parsedMatrix.maxProctorsPerSubject === 5;

    const res = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: exactPrompt,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      educationLevel: 'SMP',
      teachers: customTeachers,
      availableClasses: ['7A', '7B', '8A', '8B', '9A', '9B'],
      availableSubjects: ['PAI', 'IPA', 'MTK', 'PP', 'B. Indonesia', 'IPS', 'B. Arab', 'B. Inggris', 'SBPK', 'Informatika', 'Hadits', 'BTQ'],
    });

    // Verify 12 subjects strictly preserved in order
    const subjectsPreserved = res.config.selectedSubjects.length === 12 &&
      res.config.selectedSubjects[0] === 'PAI' &&
      res.config.selectedSubjects[11] === 'BTQ';

    // Verify PAI proctors (P1..P5)
    const paiProctors = res.schedule.proctorSchedules.filter((p) => p.subject === 'PAI');
    const paiR1 = paiProctors.find((p) => p.roomName === 'Ruang 1');
    const paiR2 = paiProctors.find((p) => p.roomName === 'Ruang 2');
    const paiR3 = paiProctors.find((p) => p.roomName === 'Ruang 3');
    const paiR4 = paiProctors.find((p) => p.roomName === 'Ruang 4');
    const paiR5 = paiProctors.find((p) => p.roomName === 'Ruang 5');

    const isPAIValid =
      paiR1?.mainProctorId === 'usr_fitri' &&
      paiR2?.mainProctorId === 'usr_qodiatul' &&
      paiR3?.mainProctorId === 'usr_widianingsih' &&
      paiR4?.mainProctorId === 'usr_adi' &&
      paiR5?.mainProctorId === 'usr_iqbal';

    // Verify BTQ proctors (P1..P5)
    const btqProctors = res.schedule.proctorSchedules.filter((p) => p.subject === 'BTQ');
    const btqR1 = btqProctors.find((p) => p.roomName === 'Ruang 1');
    const btqR2 = btqProctors.find((p) => p.roomName === 'Ruang 2');
    const btqR3 = btqProctors.find((p) => p.roomName === 'Ruang 3');
    const btqR4 = btqProctors.find((p) => p.roomName === 'Ruang 4');
    const btqR5 = btqProctors.find((p) => p.roomName === 'Ruang 5');

    const isBTQValid =
      btqR1?.mainProctorId === 'usr_iqbal' &&
      btqR2?.mainProctorId === 'usr_mira' &&
      btqR3?.mainProctorId === 'usr_qodiatul' &&
      btqR4?.mainProctorId === 'usr_dafa' &&
      btqR5?.mainProctorId === 'usr_mawar';

    // Verify Matrix Generation has 5 rooms and no '-' room codes
    const matrix = ExamMatrixBuilderService.buildMatrix(res.schedule, customTeachers);
    const has5Rooms = matrix.rooms.length === 5;
    const allCellsFilled = matrix.days.every((d) =>
      d.sessions.every((s) => matrix.rooms.every((r) => s.roomCodes[r.key] && s.roomCodes[r.key] !== '-'))
    );

    assert(
      'Exam AI 06: Deterministic parser converts explicit P1-P5 matrix with 100% fidelity without LLM drift',
      has12Subjects && has5ProctorsPerSubject && subjectsPreserved && isPAIValid && isBTQValid && has5Rooms && allCellsFilled,
      `Subjects: ${res.config.selectedSubjects.length}, PAI R1-R5 match: 100%, BTQ R1-R5 match: 100%, Matrix Rooms: ${matrix.rooms.length}, All cells filled: ${allCellsFilled}`
    );
  } catch (err: any) {
    assert('Exam AI 06: Error verifying custom proctor matrix', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Proctor Omission Guard (Prompt tanpa menyebutkan guru tidak membuat roster pengawas)
  // ---------------------------------------------------------------------------
  try {
    const promptWithoutTeacher =
      'Buatkan jadwal ASTS ganjil dari tanggal 29 September sampai 3 Oktober 2026, 2 sesi per hari untuk kelas 7A, 7B, mapel PAI, IPA, MTK.';

    // 1. Check helper detectTeacherIntent
    const intentDetected = ExamScheduleAIGeneratorService.detectTeacherIntent(
      promptWithoutTeacher,
      sampleTeachers,
      false
    );

    // 2. Parse locally
    const parsed = ExamScheduleAIGeneratorService.parsePromptLocally(promptWithoutTeacher, {
      prompt: promptWithoutTeacher,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      teachers: sampleTeachers,
      availableClasses: ['7A', '7B'],
      availableSubjects: ['PAI', 'IPA', 'MTK'],
    });

    // 3. Generate complete schedule
    const res = await ExamScheduleAIGeneratorService.generateFromPrompt({
      prompt: promptWithoutTeacher,
      academicYear: '2026/2027',
      semester: 'Ganjil',
      educationLevel: 'SMP',
      teachers: sampleTeachers,
      availableClasses: ['7A', '7B'],
      availableSubjects: ['PAI', 'IPA', 'MTK'],
    });

    const isIntentFalse = intentDetected === false;
    const isConfigSkipped = parsed.skipProctorAssignment === true && parsed.selectedTeacherIds.length === 0;
    const hasSubjects = res.schedule.subjectSchedules.length > 0;
    const proctorsAreEmpty = res.schedule.proctorSchedules.length === 0;
    const totalProctorsZero = res.schedule.summary.totalProctorsAssigned === 0;

    // 4. Matrix builder should handle empty proctors gracefully with timetable structure
    const matrix = ExamMatrixBuilderService.buildMatrix(res.schedule, sampleTeachers);
    const matrixHasDays = matrix.days.length > 0;
    const matrixRoomsAllHyphen = matrix.days.every((d) =>
      d.sessions.every((s) => matrix.rooms.every((r) => s.roomCodes[r.key] === '-'))
    );

    assert(
      'Exam AI 07: Omits proctor schedules when prompt does not mention teachers while keeping subject schedules intact',
      isIntentFalse && isConfigSkipped && hasSubjects && proctorsAreEmpty && totalProctorsZero && matrixHasDays && matrixRoomsAllHyphen,
      `Intent: ${intentDetected}, Subjects: ${res.schedule.subjectSchedules.length}, Proctors: ${res.schedule.proctorSchedules.length}, Matrix days: ${matrix.days.length}, Empty matrix safe: ${matrixRoomsAllHyphen}`
    );
  } catch (err: any) {
    assert('Exam AI 07: Error testing proctor omission guard', false, err?.message);
  }

  return {
    passed,
    failed,
    results,
  };
};
