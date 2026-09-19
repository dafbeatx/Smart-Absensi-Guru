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
    // Range with a Sunday (e.g. 2026-10-02 [Jumat] to 2026-10-06 [Selasa], Sunday is 2026-10-04)
    const dates = ExamSchedulerService.getValidExamDates('2026-10-02', '2026-10-06');
    const hasSunday = dates.some((d) => d.dayName.toLowerCase() === 'minggu');

    assert(
      'Exam Scheduler 01: Generates valid exam dates and strictly skips Sundays',
      dates.length > 0 && !hasSunday,
      `Generated ${dates.length} days, days: ${dates.map((d) => d.dayName).join(', ')}`
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

  return { passed, failed, results };
};
