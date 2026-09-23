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
      'Exam Scheduler 03: All subjects including Informatika execute in standard numbered exam rooms without lab constraint',
      infoItem !== undefined && infoItem?.roomName?.startsWith('Ruang') === true,
      `Room was ${infoItem?.roomName}`
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

  // ---------------------------------------------------------------------------
  // TEST 18: Dynamic Committee Assignment, Role Retrieval & Position Fallback
  // ---------------------------------------------------------------------------
  try {
    const teacherUser = {
      id: 'teacher_assigned_comm',
      full_name: 'Drs. Supriyanto, M.Pd',
      nip: 'NPP888',
      role: 'GURU',
      position: 'Guru Fisika',
    } as unknown as UserProfile;

    // Initially not in committee
    const initialRole = await ExamCommitteeRepository.getTeacherCommitteeRole(teacherUser, testAcademicYear);

    // Assign as SEKRETARIS
    await ExamCommitteeRepository.setTeacherCommitteeRole(teacherUser, 'SEKRETARIS', testAcademicYear);
    const assignedRole = await ExamCommitteeRepository.getTeacherCommitteeRole(teacherUser, testAcademicYear);

    // Assign as KETUA
    await ExamCommitteeRepository.setTeacherCommitteeRole(teacherUser, 'KETUA', testAcademicYear);
    const updatedRole = await ExamCommitteeRepository.getTeacherCommitteeRole(teacherUser, testAcademicYear);

    // Position-based fallback test (without repository entry)
    const positionOnlyUser = {
      id: 'teacher_pos_comm',
      full_name: 'Hj. Fatimah, S.Pd',
      nip: 'NPP999',
      role: 'GURU',
      position: 'Guru Bahasa Inggris / Bendahara Panitia Ujian',
    } as unknown as UserProfile;
    const posRole = await ExamCommitteeRepository.getTeacherCommitteeRole(positionOnlyUser, testAcademicYear);

    // Unassign (NONE)
    await ExamCommitteeRepository.setTeacherCommitteeRole(teacherUser, 'NONE', testAcademicYear);
    const unassignedRole = await ExamCommitteeRepository.getTeacherCommitteeRole(teacherUser, testAcademicYear);

    const isTest18Valid =
      initialRole === null &&
      assignedRole?.isCommittee === true &&
      assignedRole?.role === 'SEKRETARIS' &&
      assignedRole?.roleLabel === 'Sekretaris Panitia Ujian' &&
      updatedRole?.role === 'KETUA' &&
      updatedRole?.roleLabel === 'Ketua Panitia Ujian' &&
      posRole?.isCommittee === true &&
      posRole?.role === 'BENDAHARA' &&
      posRole?.roleLabel === 'Bendahara Panitia Ujian' &&
      unassignedRole === null;

    assert(
      'Exam Scheduler 18: Dynamic committee assignment, role retrieval, and position fallback work seamlessly',
      isTest18Valid,
      `Assigned: ${assignedRole?.roleLabel}, Updated: ${updatedRole?.roleLabel}, Pos: ${posRole?.roleLabel}, Unassigned: ${unassignedRole === null}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 18: Error testing dynamic committee assignment', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 19: Custom Subject Proctors Allocation & Name Normalization
  // ---------------------------------------------------------------------------
  try {
    const customConfig: ExamScheduleFormConfig = {
      ...config,
      totalRooms: 5,
      selectedSubjects: ['PAI', 'IPA'],
      customSubjectProctors: {
        PAI: ['Fitri Ani Rahayu', 'Qodiatul Asrof Ramadhoni', 'Widianingsih', 'Adi Prasetyo', 'M. Iqbal Gustiawan'],
        IPA: ['Widianingsih', 'Nurul Farhiya', 'Ridho Maulana Al Farizi', 'Fitri Ani Rahayu', 'Adi Prasetyo'],
      },
    };

    const sched = ExamSchedulerService.generateSchedule(customConfig, sampleTeachers, []);
    const paiProctors = sched.proctorSchedules.filter((p) => p.subject === 'PAI');
    const paiR1 = paiProctors.find((p) => p.roomName === 'Ruang 1');
    const paiR2 = paiProctors.find((p) => p.roomName === 'Ruang 2');
    const paiR3 = paiProctors.find((p) => p.roomName === 'Ruang 3');
    const paiR4 = paiProctors.find((p) => p.roomName === 'Ruang 4');
    const paiR5 = paiProctors.find((p) => p.roomName === 'Ruang 5');

    const isMatch =
      Boolean(paiR1?.mainProctorName.includes('Fitri Ani Rahayu')) &&
      Boolean(paiR2?.mainProctorName.includes('Qodiatul Asrof Ramadhoni')) &&
      Boolean(paiR3?.mainProctorName.includes('Widianingsih')) &&
      Boolean(paiR4?.mainProctorName.includes('Adi Prasetyo')) &&
      Boolean(paiR5?.mainProctorName.includes('M. Iqbal Gustiawan'));

    assert(
      'Exam Scheduler 19: Custom subject proctors accurately allocated to Ruang 1-5 with name normalization',
      Boolean(isMatch && paiProctors.length === 5),
      `PAI proctors count: ${paiProctors.length}, R1: ${paiR1?.mainProctorName}, R2: ${paiR2?.mainProctorName}, R3: ${paiR3?.mainProctorName}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 19: Error testing custom subject proctors', false, err?.message);
  }

  // Test 20: Admin Proctor Swap between 2 slots (e.g. Senin vs Selasa)
  try {
    const baseConfig: ExamScheduleFormConfig = {
      examType: 'ASTS',
      examTitle: 'ASTS Ganjil',
      academicYear: testAcademicYear,
      semester: '1',
      startDate: '2026-09-28', // Senin
      endDate: '2026-09-29',   // Selasa
      sessionsPerDay: 1,
      sessionSlots: [{ sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' }],
      selectedClasses: ['7A', '7B'],
      selectedSubjects: ['Matematika', 'Bahasa Indonesia'],
      selectedTeacherIds: sampleTeachers.map((t) => t.id),
      proctorsPerRoom: 1,
      excludeOwnSubject: false,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
    };

    const initialSched = ExamSchedulerService.generateSchedule(baseConfig, sampleTeachers, []);
    const slotA = initialSched.proctorSchedules[0];
    const slotB = initialSched.proctorSchedules[1];

    const prevAProctor = slotA.mainProctorName;
    const prevBProctor = slotB.mainProctorName;

    const swapResult = ExamSchedulerService.swapProctorsBetweenSlots(
      initialSched,
      slotA.id,
      slotB.id,
      'Admin Ujian',
      'Pak A bertukar dengan Bu B'
    );

    const updatedSlotA = swapResult.updatedSchedule?.proctorSchedules.find((p) => p.id === slotA.id);
    const updatedSlotB = swapResult.updatedSchedule?.proctorSchedules.find((p) => p.id === slotB.id);
    const historyItem = swapResult.updatedSchedule?.swapHistory?.[0];

    const isSwappedAccurately =
      Boolean(swapResult.success) &&
      updatedSlotA?.mainProctorName === prevBProctor &&
      updatedSlotB?.mainProctorName === prevAProctor &&
      updatedSlotA?.isSwapped === true &&
      updatedSlotB?.isSwapped === true &&
      historyItem?.type === 'SWAP_SLOTS';

    assert(
      'Exam Scheduler 20: Admin Proctor Swap between 2 slots accurately exchanges proctors and logs history',
      Boolean(isSwappedAccurately),
      `Swap success: ${swapResult.success}, New Slot A Proctor: ${updatedSlotA?.mainProctorName} (Expected ${prevBProctor}), History: ${historyItem?.reason}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 20: Error testing proctor swap', false, err?.message);
  }

  // Test 21: Conflict prevention when proctor already scheduled at that session
  try {
    const configWith2Rooms: ExamScheduleFormConfig = {
      examType: 'ASTS',
      examTitle: 'ASTS Ganjil',
      academicYear: testAcademicYear,
      semester: '1',
      startDate: '2026-09-28', // Senin
      endDate: '2026-09-28',   // Senin saja
      sessionsPerDay: 1,
      sessionSlots: [{ sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' }],
      selectedClasses: ['7A', '7B'],
      totalRooms: 2,
      selectedSubjects: ['Matematika'],
      selectedTeacherIds: [sampleTeachers[0].id, sampleTeachers[1].id],
      proctorsPerRoom: 1,
      excludeOwnSubject: false,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
    };

    const twoRoomSched = ExamSchedulerService.generateSchedule(configWith2Rooms, sampleTeachers, []);
    const r1Slot = twoRoomSched.proctorSchedules.find((p) => p.roomName.includes('1'));

    // Try to reassign Room 1 to sampleTeacher[1] who is ALREADY proctoring Room 2 in the exact same date & session
    const conflictResult = ExamSchedulerService.reassignSingleProctor(
      twoRoomSched,
      r1Slot?.id || '',
      { userId: sampleTeachers[1].id, fullName: sampleTeachers[1].full_name || '' },
      'Admin Ujian'
    );

    assert(
      'Exam Scheduler 21: Proctor assignment prevents double-booking conflict at identical date & session',
      conflictResult.success === false && Boolean(conflictResult.error?.includes('Konflik')),
      `Expected conflict error, got: ${conflictResult.error}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 21: Error testing conflict prevention', false, err?.message);
  }

  // Test 22: Admin Single Proctor Reassignment with relaxed own-subject rule
  try {
    const singleConfig: ExamScheduleFormConfig = {
      examType: 'ASTS',
      examTitle: 'ASTS Ganjil',
      academicYear: testAcademicYear,
      semester: '1',
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      sessionsPerDay: 1,
      sessionSlots: [{ sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' }],
      selectedClasses: ['7A'],
      selectedSubjects: ['Matematika'],
      selectedTeacherIds: [sampleTeachers[1].id], // Starts with teacher 2 (Bahasa Indonesia)
      proctorsPerRoom: 1,
      excludeOwnSubject: false,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
    };

    const sched = ExamSchedulerService.generateSchedule(singleConfig, sampleTeachers, []);
    const targetSlot = sched.proctorSchedules[0];

    // Reassign to teacher 1 (Ahmad Dahlan, Matematika) - teaching subject is Matematika, should succeed because quota is limited
    const reassignResult = ExamSchedulerService.reassignSingleProctor(
      sched,
      targetSlot.id,
      { userId: sampleTeachers[0].id, fullName: sampleTeachers[0].full_name || '' },
      'Admin Ujian',
      'Pelimpahan tugas darurat'
    );

    const reloadedSlot = reassignResult.updatedSchedule?.proctorSchedules.find((p) => p.id === targetSlot.id);
    const history = reassignResult.updatedSchedule?.swapHistory?.[0];

    assert(
      'Exam Scheduler 22: Admin reassigns single proctor and permits proctoring own subject when teacher quota is limited',
      Boolean(reassignResult.success) &&
        reloadedSlot?.mainProctorName === sampleTeachers[0].full_name &&
        reloadedSlot?.isSwapped === true &&
        history?.type === 'REASSIGN',
      `Reassigned name: ${reloadedSlot?.mainProctorName}, IsSwapped: ${reloadedSlot?.isSwapped}, History: ${history?.reason}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 22: Error testing single proctor reassign', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 23: Smart Recommendation Engine for Mutual Proctor Swap
  // ---------------------------------------------------------------------------
  try {
    const multiDayConfig: ExamScheduleFormConfig = {
      examType: 'ASTS',
      examTitle: 'ASTS Ganjil Multi-Day',
      academicYear: testAcademicYear,
      semester: '1',
      startDate: '2026-09-28', // Senin
      endDate: '2026-09-29',   // Selasa
      sessionsPerDay: 2,
      sessionSlots: [
        { sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' },
        { sessionNumber: 2, sessionName: 'Sesi 2', startTime: '10:00', endTime: '12:00' },
      ],
      selectedClasses: ['7A', '7B'],
      selectedSubjects: ['Matematika', 'Bahasa Indonesia', 'Informatika', 'IPA'],
      selectedTeacherIds: [
        sampleTeachers[0].id, // Ahmad Dahlan (Matematika)
        sampleTeachers[1].id, // Siti Aminah (Bahasa Indonesia)
        sampleTeachers[2].id, // Budi Santoso (Informatika)
        sampleTeachers[3].id, // Dewi Lestari (IPA)
      ],
      proctorsPerRoom: 1,
      excludeOwnSubject: false,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
    };

    const sched = ExamSchedulerService.generateSchedule(multiDayConfig, sampleTeachers, []);
    const slotA = sched.proctorSchedules[0];

    // 1. Get all smart swap candidates (unfiltered)
    const allCandidates = ExamSchedulerService.getSmartSwapCandidates(sched, slotA.id, undefined, sampleTeachers);

    // Verify all returned candidates are marked zero conflict
    const allZeroConflict = allCandidates.length > 0 && allCandidates.every((c) => c.isZeroConflict);

    // Verify none of the candidates have the same slot or the same proctor
    const noSelfSwap = allCandidates.every(
      (c) => c.slot.id !== slotA.id && c.slot.mainProctorId !== slotA.mainProctorId
    );

    // 2. Filter candidates specifically for 'Selasa'
    const selasaCandidates = ExamSchedulerService.getSmartSwapCandidates(sched, slotA.id, 'Selasa', sampleTeachers);
    const allAreSelasa = selasaCandidates.length > 0 && selasaCandidates.every((c) => c.targetDayName.toLowerCase() === 'selasa');

    // 3. Verify match scores are sorted descending
    let isSorted = true;
    for (let i = 0; i < allCandidates.length - 1; i++) {
      if (allCandidates[i].matchScore < allCandidates[i + 1].matchScore) {
        isSorted = false;
        break;
      }
    }

    assert(
      'Exam Scheduler 23: Smart Recommendation Engine generates 100% clash-free swap candidates with day filtering and score ranking',
      allCandidates.length > 0 &&
        allZeroConflict &&
        noSelfSwap &&
        selasaCandidates.length > 0 &&
        allAreSelasa &&
        isSorted,
      `All Candidates: ${allCandidates.length}, Selasa Candidates: ${selasaCandidates.length}, All Zero Conflict: ${allZeroConflict}, Sorted: ${isSorted}`
    );
  } catch (err: any) {
    assert('Exam Scheduler 23: Error testing smart swap recommendation engine', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 24: Smart Recommendation Engine for Single Proctor Reassignment
  // ---------------------------------------------------------------------------
  try {
    const reassignConfig: ExamScheduleFormConfig = {
      examType: 'ASTS',
      examTitle: 'ASTS Reassign Test',
      academicYear: testAcademicYear,
      semester: '1',
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      sessionsPerDay: 1,
      sessionSlots: [{ sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' }],
      selectedClasses: ['7A'],
      selectedSubjects: ['Matematika'],
      selectedTeacherIds: [sampleTeachers[0].id], // Ahmad Dahlan assigned
      proctorsPerRoom: 1,
      excludeOwnSubject: false,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
    };

    const sched = ExamSchedulerService.generateSchedule(reassignConfig, sampleTeachers, []);
    const targetSlot = sched.proctorSchedules[0];

    // Get smart reassign candidates from all sample teachers
    const candidates = ExamSchedulerService.getSmartReassignCandidates(sched, targetSlot.id, sampleTeachers);

    // Target proctor (Ahmad Dahlan) should not be in candidate list
    const containsSelf = candidates.some((c) => c.teacherId === targetSlot.mainProctorId);

    // All other 4 teachers (Siti, Budi, Dewi, Hasan) should be available (isAvailable = true)
    const availableCount = candidates.filter((c) => c.isAvailable).length;

    // Available candidates should have duty count 0 and be ranked first
    const firstCandidate = candidates[0];

    assert(
      'Exam Scheduler 24: Smart Reassign Recommendation Engine ranks available teachers with lowest duty count and excludes current proctor',
      !containsSelf &&
        candidates.length === sampleTeachers.length - 1 &&
        availableCount === sampleTeachers.length - 1 &&
        firstCandidate.isAvailable === true &&
        firstCandidate.currentDutyCount === 0,
      `Total candidates: ${candidates.length}, Contains Self: ${containsSelf}, First candidate: ${firstCandidate?.teacherName} (Duties: ${firstCandidate?.currentDutyCount})`
    );
  } catch (err: any) {
    assert('Exam Scheduler 24: Error testing smart reassign recommendation engine', false, err?.message);
  }

  return { passed, failed, results };
};

