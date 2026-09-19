/**
 * SMART ABSENSI GURU - EXAM SCHEDULER & COMMITTEE AI TEST SUITE
 * Suite 37: Tests for ASTS/ASAS scheduling engine, proctor load balancing, anti-own-subject rule, and committee access control.
 */

import { ExamSchedulerService } from '../exam-scheduler.service';
import { ExamCommitteeRepository } from '../../repositories/ExamCommitteeRepository';
import { ExamScheduleRepository } from '../../repositories/ExamScheduleRepository';
import { StudentRepository } from '../../repositories/StudentRepository';
import type {
  ExamScheduleFormConfig,
  ExamCommitteeMember,
} from '../../types/exam-schedule.types';
import type { UserProfile, StudentItem } from '../../types/database.types';

export const runExamSchedulerTestSuite = async (): Promise<{
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

  const testAcademicYear = '2026/2027';

  // Sample teachers
  const sampleTeachers: UserProfile[] = [
    {
      id: 'teacher_1',
      full_name: 'Ahmad Dahlan, S.Pd',
      nip: 'NPP001',
      role: 'GURU',
      teaching_assignment: 'Matematika',
    } as unknown as UserProfile,
    {
      id: 'teacher_2',
      full_name: 'Siti Aminah, M.Pd',
      nip: 'NPP002',
      role: 'GURU',
      teaching_assignment: 'Bahasa Indonesia',
    } as unknown as UserProfile,
    {
      id: 'teacher_3',
      full_name: 'Budi Santoso, S.Kom',
      nip: 'NPP003',
      role: 'GURU',
      teaching_assignment: 'Informatika',
    } as unknown as UserProfile,
    {
      id: 'teacher_4',
      full_name: 'Dewi Lestari, S.Si',
      nip: 'NPP004',
      role: 'GURU',
      teaching_assignment: 'IPA',
    } as unknown as UserProfile,
    {
      id: 'teacher_5',
      full_name: 'Hasan Basri, S.Ag',
      nip: 'NPP005',
      role: 'GURU',
      teaching_assignment: 'PAI',
    } as unknown as UserProfile,
  ];

  // ---------------------------------------------------------------------------
  // TEST 1: Valid Exam Dates Generation (Sunday Exclusion)
  // ---------------------------------------------------------------------------
  try {
    // Range with a weekend (e.g. 2026-10-02 [Jumat] to 2026-10-06 [Selasa], Saturday is 2026-10-03, Sunday is 2026-10-04)
    const defaultDates = ExamSchedulerService.getValidExamDates('2026-10-02', '2026-10-06');
    const hasSunday = defaultDates.some((d) => d.dayName.toLowerCase() === 'minggu');
    const hasSaturdayDefault = defaultDates.some((d) => d.dayName.toLowerCase() === 'sabtu');

    const withSaturdayDates = ExamSchedulerService.getValidExamDates('2026-10-02', '2026-10-06', true);
    const hasSaturdayWhenEnabled = withSaturdayDates.some((d) => d.dayName.toLowerCase() === 'sabtu');

    assert(
      'Exam Scheduler 01: Generates valid exam dates, skips weekends by default, and includes Saturday when requested',
      defaultDates.length === 3 &&
      !hasSunday &&
      !hasSaturdayDefault &&
      hasSaturdayWhenEnabled &&
      withSaturdayDates.length === 4,
      `Default days: ${defaultDates.map((d) => d.dayName).join(', ')} | With Saturday: ${withSaturdayDates.map((d) => d.dayName).join(', ')}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 01: Error generating valid exam dates', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: AI Subject Scheduling & Class Allocation
  // ---------------------------------------------------------------------------
  const config: ExamScheduleFormConfig = {
    academicYear: testAcademicYear,
    semester: 'Ganjil',
    examType: 'ASTS',
    examTitle: 'ASTS Ganjil 2026/2027',
    startDate: '2026-10-05', // Senin
    endDate: '2026-10-08',   // Kamis (4 hari)
    sessionsPerDay: 2,
    sessionSlots: [
      { sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' },
      { sessionNumber: 2, sessionName: 'Sesi 2', startTime: '10:00', endTime: '12:00' },
    ],
    selectedClasses: ['7A', '7B'],
    selectedSubjects: ['Matematika', 'Bahasa Indonesia', 'Informatika', 'IPA'],
    selectedTeacherIds: sampleTeachers.map((t) => t.id),
    proctorsPerRoom: 1,
    excludeOwnSubject: true,
    excludeCommitteeProctor: true,
    assignBackupProctor: true,
  };

  try {
    const schedule = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);

    assert(
      'Exam Scheduler 02: Generates subject schedules for all selected classes and subjects',
      schedule.subjectSchedules.length === config.selectedClasses.length * config.selectedSubjects.length,
      `Expected ${config.selectedClasses.length * config.selectedSubjects.length}, got ${schedule.subjectSchedules.length}`
    );

    const infoItem = schedule.subjectSchedules.find((s) => s.subject === 'Informatika');
    assert(
      'Exam Scheduler 03: Detects CBT / computer lab requirement for Informatika',
      infoItem?.isLabRequired === true,
      `isLabRequired was ${infoItem?.isLabRequired}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 02-03: Error generating subject schedule', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Anti-Own-Subject Guard (Guru dilarang mengawas mapel sendiri)
  // ---------------------------------------------------------------------------
  try {
    const schedule = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);
    let ownSubjectViolations = 0;

    schedule.proctorSchedules.forEach((p) => {
      const teacher = sampleTeachers.find((t) => t.id === p.mainProctorId);
      if (teacher && teacher.teaching_assignment === p.subject) {
        ownSubjectViolations++;
      }
    });

    assert(
      'Exam Scheduler 04: Anti-Own-Subject Guard ensures teachers never proctor their own subjects',
      ownSubjectViolations === 0,
      `Violations found: ${ownSubjectViolations}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 04: Error testing anti-own-subject guard', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Anti Double-Booking Guard (Tidak ada guru mengawas 2 ruang di jam sama)
  // ---------------------------------------------------------------------------
  try {
    const schedule = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);
    const slotTeacherMap = new Map<string, Set<string>>();
    let doubleBookings = 0;

    schedule.proctorSchedules.forEach((p) => {
      const key = `${p.date}_Sesi${p.sessionNumber}`;
      if (!slotTeacherMap.has(key)) {
        slotTeacherMap.set(key, new Set());
      }
      const assigned = slotTeacherMap.get(key)!;
      if (assigned.has(p.mainProctorId)) {
        doubleBookings++;
      } else {
        assigned.add(p.mainProctorId);
      }
    });

    assert(
      'Exam Scheduler 05: Anti Double-Booking Guard ensures no teacher is in 2 rooms simultaneously',
      doubleBookings === 0,
      `Double bookings detected: ${doubleBookings}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 05: Error testing double-booking guard', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Committee Access Control & Admin Privilege
  // ---------------------------------------------------------------------------
  try {
    const adminUser = { id: 'admin_1', role: 'ADMIN', full_name: 'Kepala Sekolah' } as unknown as UserProfile;
    const committeeUser = { id: 'teacher_1', role: 'GURU', full_name: 'Ahmad Dahlan' } as unknown as UserProfile;
    const regularTeacher = { id: 'teacher_99', role: 'GURU', full_name: 'Guru Biasa' } as unknown as UserProfile;

    // Save committee with Ahmad Dahlan as Ketua
    const committee: ExamCommitteeMember[] = [
      {
        id: 'comm_1',
        academicYear: testAcademicYear,
        userId: 'teacher_1',
        fullName: 'Ahmad Dahlan, S.Pd',
        role: 'KETUA',
        isActive: true,
      },
    ];
    await ExamCommitteeRepository.saveCommitteeMembers(committee, testAcademicYear);

    const adminAccess = await ExamCommitteeRepository.checkCommitteeAccess(adminUser, testAcademicYear);
    const committeeAccess = await ExamCommitteeRepository.checkCommitteeAccess(committeeUser, testAcademicYear);
    const regularAccess = await ExamCommitteeRepository.checkCommitteeAccess(regularTeacher, testAcademicYear);

    assert(
      'Exam Scheduler 06: Admin has full canManage rights by default',
      adminAccess.isAdmin && adminAccess.canManage,
      `Admin canManage: ${adminAccess.canManage}`
    );

    assert(
      'Exam Scheduler 07: Committee member has canManage rights and correct role label',
      committeeAccess.isCommittee && committeeAccess.canManage && committeeAccess.roleLabel.includes('Ketua'),
      `RoleLabel: ${committeeAccess.roleLabel}`
    );

    assert(
      'Exam Scheduler 08: Regular teacher is restricted to view-only mode (canManage: false)',
      !regularAccess.canManage && !regularAccess.isCommittee,
      `Regular canManage: ${regularAccess.canManage}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 06-08: Error testing committee access control', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Schedule Persistence & Deletion
  // ---------------------------------------------------------------------------
  try {
    const generated = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);
    await ExamScheduleRepository.saveSchedule(generated);

    const loaded = await ExamScheduleRepository.getSchedule(testAcademicYear, 'ASTS');
    assert(
      'Exam Scheduler 09: Successfully persists and retrieves exam schedule data',
      loaded !== null && loaded.config.examType === 'ASTS' && loaded.subjectSchedules.length > 0,
      `Loaded subjects: ${loaded?.subjectSchedules.length || 0}`
    );

    await ExamScheduleRepository.deleteSchedule(testAcademicYear, 'ASTS');
    const afterDelete = await ExamScheduleRepository.getSchedule(testAcademicYear, 'ASTS');
    assert(
      'Exam Scheduler 10: Successfully deletes exam schedule data',
      afterDelete === null,
      `After delete was: ${afterDelete}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 09-10: Error testing schedule persistence', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 11: Academic Year Aware Class Extraction with Zero Unnecessary Egress
  // ---------------------------------------------------------------------------
  try {
    const mockStudents: StudentItem[] = [
      { id: 'std_1', nisn: '001', fullName: 'Siswa 1', className: '7A', gender: 'L', academicYear: '2026/2027' },
      { id: 'std_2', nisn: '002', fullName: 'Siswa 2', className: '7A', gender: 'P', academicYear: '2026/2027' },
      { id: 'std_3', nisn: '003', fullName: 'Siswa 3', className: '8B', gender: 'L', academicYear: '2026/2027' },
      { id: 'std_4', nisn: '004', fullName: 'Siswa 4', className: '9A', gender: 'P', academicYear: '2025/2026' }, // Older year
    ];

    await StudentRepository.saveStudents(mockStudents);

    const currentYearResult = await StudentRepository.getDistinctClassesByAcademicYear('2026/2027', false);
    assert(
      'Exam Scheduler 11: Extracts distinct classes strictly for 2026/2027 using Local Cache (0 B Egress)',
      currentYearResult.source === 'LOCAL_CACHE' &&
      currentYearResult.classes.includes('7A') &&
      currentYearResult.classes.includes('8B') &&
      !currentYearResult.classes.includes('9A') &&
      currentYearResult.classStudentCounts['7A'] === 2,
      `Classes: ${currentYearResult.classes.join(', ')}, Source: ${currentYearResult.source}`
    );

    const oldYearResult = await StudentRepository.getDistinctClassesByAcademicYear('2025/2026', false);
    assert(
      'Exam Scheduler 12: Extracts distinct classes strictly for 2025/2026 without data leakage from other years',
      oldYearResult.source === 'LOCAL_CACHE' &&
      oldYearResult.classes.includes('9A') &&
      !oldYearResult.classes.includes('7A') &&
      oldYearResult.totalStudents === 1,
      `Classes: ${oldYearResult.classes.join(', ')}, Total: ${oldYearResult.totalStudents}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 11-12: Error testing academic year class extraction', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 13: Custom Subjects Inclusion in AI Exam Scheduler
  // ---------------------------------------------------------------------------
  try {
    const customConfig: ExamScheduleFormConfig = {
      ...config,
      selectedSubjects: ['Matematika', 'Bahasa Sunda', 'BTQ', 'Fiqih'],
      selectedClasses: ['7A', '8A'],
    };

    const customGenerated = ExamSchedulerService.generateSchedule(customConfig, sampleTeachers, []);
    const scheduledSubjects = new Set(customGenerated.subjectSchedules.map((s) => s.subject));

    assert(
      'Exam Scheduler 13: Successfully generates exam schedule with custom added subjects (Bahasa Sunda, BTQ, Fiqih)',
      scheduledSubjects.has('Bahasa Sunda') &&
      scheduledSubjects.has('BTQ') &&
      scheduledSubjects.has('Fiqih') &&
      customGenerated.summary.totalSubjects === 4,
      `Subjects: ${Array.from(scheduledSubjects).join(', ')}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 13: Error testing custom subjects scheduling', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 14: Granular Single Subject Exam Slot Deletion & Persistence
  // ---------------------------------------------------------------------------
  try {
    const baseSchedule = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);
    await ExamScheduleRepository.saveSchedule(baseSchedule);

    const initialCount = baseSchedule.subjectSchedules.length;
    const itemToDelete = baseSchedule.subjectSchedules[0];

    const updatedList = baseSchedule.subjectSchedules.filter((s) => s.id !== itemToDelete.id);
    const updatedSchedule = {
      ...baseSchedule,
      subjectSchedules: updatedList,
      summary: {
        ...baseSchedule.summary,
        totalSubjects: new Set(updatedList.map((s) => s.subject)).size,
      },
      updatedAt: new Date().toISOString(),
    };

    await ExamScheduleRepository.saveSchedule(updatedSchedule);
    const reloaded = await ExamScheduleRepository.getSchedule(config.academicYear, config.examType);

    assert(
      'Exam Scheduler 14: Successfully removes a single subject slot and persists the updated schedule',
      reloaded !== null &&
      reloaded.subjectSchedules.length === initialCount - 1 &&
      !reloaded.subjectSchedules.some((s) => s.id === itemToDelete.id),
      `Initial: ${initialCount}, After deletion: ${reloaded?.subjectSchedules.length}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 14: Error testing granular single subject slot deletion', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 15: Per-Day Dynamic Sessions Count (e.g. Jumat 1 Sesi, Sabtu 3 Sesi)
  // ---------------------------------------------------------------------------
  try {
    const dynamicConfig: ExamScheduleFormConfig = {
      ...config,
      startDate: '2026-10-02', // Jumat
      endDate: '2026-10-03',   // Sabtu
      includeSaturday: true,
      sessionsPerDay: 2,
      selectedClasses: ['7A'],
      selectedSubjects: ['Mapel 1', 'Mapel 2', 'Mapel 3', 'Mapel 4'],
      dayOverrides: [
        { date: '2026-10-02', dayName: 'Jumat', sessionsCount: 1 },
        { date: '2026-10-03', dayName: 'Sabtu', sessionsCount: 3 },
      ],
    };

    const dynamicSchedule = ExamSchedulerService.generateSchedule(dynamicConfig, sampleTeachers, []);
    const jumatSlots = dynamicSchedule.subjectSchedules.filter((s) => s.date === '2026-10-02');
    const sabtuSlots = dynamicSchedule.subjectSchedules.filter((s) => s.date === '2026-10-03');

    assert(
      'Exam Scheduler 15: Successfully supports variable session counts per day (Jumat 1 sesi, Sabtu 3 sesi)',
      jumatSlots.length === 1 &&
      sabtuSlots.length === 3 &&
      jumatSlots[0].endTime === '08:45' &&
      dynamicSchedule.summary.totalSessions === 4,
      `Jumat slots: ${jumatSlots.length} (End: ${jumatSlots[0]?.endTime}), Sabtu slots: ${sabtuSlots.length}, Total sessions: ${dynamicSchedule.summary.totalSessions}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 15: Error testing per-day dynamic sessions count', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 16: Multi-Subject Daily Distribution & Chronological Session Ordering
  // ---------------------------------------------------------------------------
  try {
    const multiSubjectConfig: ExamScheduleFormConfig = {
      ...config,
      startDate: '2026-10-05', // Senin
      endDate: '2026-10-05',   // Senin (1 hari pelaksanaan)
      sessionsPerDay: 3,
      selectedClasses: ['7A', '7B'],
      selectedSubjects: ['PAI', 'Matematika', 'Bahasa Arab'],
      dayOverrides: [
        { date: '2026-10-05', dayName: 'Senin', sessionsCount: 3 },
      ],
    };

    const multiSched = ExamSchedulerService.generateSchedule(multiSubjectConfig, sampleTeachers, []);
    const senin7ASlots = multiSched.subjectSchedules.filter((s) => s.className === '7A');

    const sesi1 = senin7ASlots.find((s) => s.sessionNumber === 1);
    const sesi2 = senin7ASlots.find((s) => s.sessionNumber === 2);
    const sesi3 = senin7ASlots.find((s) => s.sessionNumber === 3);

    const isDistinctSubjects =
      sesi1?.subject === 'PAI' &&
      sesi2?.subject === 'Matematika' &&
      sesi3?.subject === 'Bahasa Arab';

    const isDistinctTimes =
      sesi1?.startTime !== sesi2?.startTime &&
      sesi2?.startTime !== sesi3?.startTime;

    assert(
      'Exam Scheduler 16: Multi-subject daily distribution allocates distinct subjects per session on the same day',
      senin7ASlots.length === 3 && isDistinctSubjects && isDistinctTimes,
      `Sesi 1: ${sesi1?.subject} (${sesi1?.startTime}-${sesi1?.endTime}), Sesi 2: ${sesi2?.subject} (${sesi2?.startTime}-${sesi2?.endTime}), Sesi 3: ${sesi3?.subject} (${sesi3?.startTime}-${sesi3?.endTime})`
    );
  } catch (err: any) {
    assert('Exam Scheduler 16: Error testing multi-subject daily distribution', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 17: Admin-Configured Numbered Exam Rooms (Ruang 1 s/d Ruang X)
  // ---------------------------------------------------------------------------
  try {
    const roomConfig: ExamScheduleFormConfig = {
      ...config,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      sessionsPerDay: 1,
      selectedClasses: ['7A', '7B', '8A'],
      totalRooms: 3,
      roomFormat: 'NUMERIC',
      selectedSubjects: ['Matematika'],
    };

    const sched = ExamSchedulerService.generateSchedule(roomConfig, sampleTeachers, []);

    // Check subjects room names
    const subj7A = sched.subjectSchedules.find((s) => s.className === '7A');
    const subj7B = sched.subjectSchedules.find((s) => s.className === '7B');
    const subj8A = sched.subjectSchedules.find((s) => s.className === '8A');

    // Check proctors room names
    const proc7A = sched.proctorSchedules.find((p) => p.className === '7A');
    const proc7B = sched.proctorSchedules.find((p) => p.className === '7B');
    const proc8A = sched.proctorSchedules.find((p) => p.className === '8A');

    // Also test DOUBLE_DIGIT format
    const doubleDigitConfig: ExamScheduleFormConfig = {
      ...roomConfig,
      roomFormat: 'DOUBLE_DIGIT',
    };
    const doubleSched = ExamSchedulerService.generateSchedule(doubleDigitConfig, sampleTeachers, []);
    const dSubj7A = doubleSched.subjectSchedules.find((s) => s.className === '7A');

    // Also test custom mapping
    const customMappingConfig: ExamScheduleFormConfig = {
      ...roomConfig,
      classRoomMapping: { '7A': 'Ruang 5', '7B': 'Ruang 6' },
    };
    const customSched = ExamSchedulerService.generateSchedule(customMappingConfig, sampleTeachers, []);
    const cSubj7A = customSched.subjectSchedules.find((s) => s.className === '7A');
    const cSubj7B = customSched.subjectSchedules.find((s) => s.className === '7B');

    const isNumericValid =
      subj7A?.roomName === 'Ruang 1' &&
      subj7B?.roomName === 'Ruang 2' &&
      subj8A?.roomName === 'Ruang 3' &&
      proc7A?.roomName === 'Ruang 1' &&
      proc7B?.roomName === 'Ruang 2' &&
      proc8A?.roomName === 'Ruang 3';

    const isDoubleDigitValid = dSubj7A?.roomName === 'Ruang 01';
    const isCustomMappingValid = cSubj7A?.roomName === 'Ruang 5' && cSubj7B?.roomName === 'Ruang 6';

    assert(
      'Exam Scheduler 17: Admin-configured exam rooms assigns Ruang 1 - X, supports double-digit formatting, and custom class mapping',
      isNumericValid && isDoubleDigitValid && isCustomMappingValid,
      `Numeric: ${subj7A?.roomName}, ${subj7B?.roomName}, ${subj8A?.roomName} | DoubleDigit: ${dSubj7A?.roomName} | Custom: ${cSubj7A?.roomName}, ${cSubj7B?.roomName}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 17: Error testing admin-configured numbered exam rooms', false, err?.message);
  }

  return { passed, failed, results };
};

