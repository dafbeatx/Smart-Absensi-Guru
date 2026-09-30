import type { TestSuiteResult } from '../test-runner.service';
import { OFFICIAL_STUDENTS_2026_2027 } from '../../data/official-students-2026-2027';
import { StudentRepository } from '../../repositories/StudentRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import {
  normalizeSubjectName,
  getSubjectShortCode,
  isSameSubject,
  OFFICIAL_SCHOOL_SUBJECTS,
} from '../../config/school-subjects.config';
import { ExamSchedulerService } from '../exam-scheduler.service';
import type { UserProfile } from '../../types/database.types';

export async function runOfficialStudentsAndArabicTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({
      testName: name,
      status: condition ? 'PASS' : 'FAIL',
      details,
    });
  };

  try {
    // Test 1: Verify total count and class distribution of official 2026/2027 students
    const count7 = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '7').length;
    const count8A = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '8A').length;
    const count8B = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '8B').length;
    const count9A = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '9A').length;
    const count9B = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '9B').length;
    const countSMA = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === 'SMA').length;
    const totalStudents = OFFICIAL_STUDENTS_2026_2027.length;

    assert(
      'Official Students 01: Exactly 144 students partitioned across 6 classes matching official Excel',
      totalStudents === 144 &&
        count7 === 31 &&
        count8A === 15 &&
        count8B === 29 &&
        count9A === 20 &&
        count9B === 26 &&
        countSMA === 23,
      `Total: ${totalStudents}, 7: ${count7}, 8A: ${count8A}, 8B: ${count8B}, 9A: ${count9A}, 9B: ${count9B}, SMA: ${countSMA}`
    );

    // Test 2: Verify gender accuracy (Kelas 8A and 9A are 100% Female)
    const is8AAllFemale = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '8A').every((s) => s.gender === 'P');
    const is9AAllFemale = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '9A').every((s) => s.gender === 'P');
    const is8BAllMale = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '8B').every((s) => s.gender === 'L');
    const is9BAllMale = OFFICIAL_STUDENTS_2026_2027.filter((s) => s.className === '9B').every((s) => s.gender === 'L');

    assert(
      'Official Students 02: Gender segregation preserved (8A/9A all Female, 8B/9B all Male)',
      is8AAllFemale && is9AAllFemale && is8BAllMale && is9BAllMale,
      `8A P: ${is8AAllFemale}, 9A P: ${is9AAllFemale}, 8B L: ${is8BAllMale}, 9B L: ${is9BAllMale}`
    );

    // Test 3: MockProvider syncStudentsFromGradeMaster loads all 144 official students
    const mockProvider = new MockProvider();
    const syncRes = await mockProvider.syncStudentsFromGradeMaster('2026/2027');
    const loadedStudents = await mockProvider.getStudents();

    assert(
      'Official Students 03: MockProvider syncStudentsFromGradeMaster loads all 144 students',
      loadedStudents.length === 144 && syncRes.syncedCount === 144,
      `Loaded: ${loadedStudents.length}, Synced: ${syncRes.syncedCount}`
    );

    // Test 4: StudentRepository.getStudentsByClass retrieves each class accurately
    const studentsClass7 = await StudentRepository.getStudentsByClass('7');
    const studentsClass7Alias = await StudentRepository.getStudentsByClass('7A');
    const studentsClass8A = await StudentRepository.getStudentsByClass('8A');
    const studentsClass8B = await StudentRepository.getStudentsByClass('8B');
    const studentsClass9A = await StudentRepository.getStudentsByClass('9A');
    const studentsClass9B = await StudentRepository.getStudentsByClass('9B');
    const studentsClassSMA = await StudentRepository.getStudentsByClass('SMA');

    assert(
      'Official Students 04: StudentRepository.getStudentsByClass returns accurate counts per class with 7/7A alias support',
      studentsClass7.length === 31 &&
        studentsClass7Alias.length === 31 &&
        studentsClass8A.length === 15 &&
        studentsClass8B.length === 29 &&
        studentsClass9A.length === 20 &&
        studentsClass9B.length === 26 &&
        studentsClassSMA.length === 23,
      `7: ${studentsClass7.length}, 7A: ${studentsClass7Alias.length}, 8A: ${studentsClass8A.length}, 8B: ${studentsClass8B.length}, 9A: ${studentsClass9A.length}, 9B: ${studentsClass9B.length}, SMA: ${studentsClassSMA.length}`
    );

    // Test 5: Bahasa Arab Subject Normalization & Aliases
    const normalizedArab1 = normalizeSubjectName('Bahasa Arab');
    const normalizedArab2 = normalizeSubjectName('B. Arab');
    const normalizedArab3 = normalizeSubjectName('BARB');
    const normalizedArab4 = normalizeSubjectName('B Arab');
    const normalizedArab5 = normalizeSubjectName('B. Arab – Bahasa Arab');

    assert(
      'Bahasa Arab 01: All aliases normalize to canonical "B. Arab – Bahasa Arab"',
      normalizedArab1 === 'B. Arab – Bahasa Arab' &&
        normalizedArab2 === 'B. Arab – Bahasa Arab' &&
        normalizedArab3 === 'B. Arab – Bahasa Arab' &&
        normalizedArab4 === 'B. Arab – Bahasa Arab' &&
        normalizedArab5 === 'B. Arab – Bahasa Arab',
      `Results: "${normalizedArab1}", "${normalizedArab2}", "${normalizedArab3}", "${normalizedArab4}"`
    );

    // Test 6: Bahasa Arab isSameSubject matching
    const same1 = isSameSubject('Bahasa Arab', 'B. Arab');
    const same2 = isSameSubject('B. Arab – Bahasa Arab', 'bahasa arab');
    const same3 = isSameSubject('BARB', 'Arab');

    assert(
      'Bahasa Arab 02: isSameSubject correctly equates all variations of Bahasa Arab',
      same1 && same2 && same3,
      `same1: ${same1}, same2: ${same2}, same3: ${same3}`
    );

    // Test 7: getSubjectShortCode returns 'B. Arab'
    const shortCode = getSubjectShortCode('Bahasa Arab');
    assert(
      'Bahasa Arab 03: getSubjectShortCode("Bahasa Arab") returns "B. Arab"',
      shortCode === 'B. Arab',
      `Got: ${shortCode}`
    );

    // Test 8: OFFICIAL_SCHOOL_SUBJECTS registration
    const arabConfig = OFFICIAL_SCHOOL_SUBJECTS.find((s) => s.code === 'B. Arab');
    assert(
      'Bahasa Arab 04: Registered in OFFICIAL_SCHOOL_SUBJECTS under category Muatan Lokal',
      Boolean(arabConfig && arabConfig.category === 'Muatan Lokal' && arabConfig.name === 'Bahasa Arab'),
      `Config: ${JSON.stringify(arabConfig)}`
    );

    // Test 9: ExamScheduler default fallback subjects includes Bahasa Arab
    const sampleTeachers: UserProfile[] = [
      { id: 'usr_t1', full_name: 'Guru 1', teaching_assignment: 'PAI' } as unknown as UserProfile,
      { id: 'usr_t2', full_name: 'Guru 2', teaching_assignment: 'Bahasa Arab' } as unknown as UserProfile,
    ];

    const sampleConfig = {
      examType: 'ASTS' as const,
      examTitle: 'ASTS Ganjil 2026/2027',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      sessionsPerDay: 2,
      sessionSlots: [
        { sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:30' },
        { sessionNumber: 2, sessionName: 'Sesi 2', startTime: '10:00', endTime: '12:00' },
      ],
      selectedClasses: ['7', '8A', '8B', '9A', '9B', 'SMA'],
      selectedSubjects: [], // Intentionally empty to test fallback default subjects containing Bahasa Arab
      selectedTeacherIds: sampleTeachers.map((t) => t.id),
      proctorsPerRoom: 1 as const,
      excludeOwnSubject: true,
      excludeCommitteeProctor: true,
      assignBackupProctor: false,
    };

    const sampleSchedule = ExamSchedulerService.generateSchedule(sampleConfig as any, sampleTeachers, []);

    const hasArabicInSchedule = sampleSchedule.subjectSchedules.some(
      (s) => s.subject === 'Bahasa Arab' || s.subject.includes('Arab')
    );

    assert(
      'Bahasa Arab 05: ExamScheduler default subjects include Bahasa Arab',
      hasArabicInSchedule,
      `Schedule subjects: ${Array.from(new Set(sampleSchedule.subjectSchedules.map((s) => s.subject))).join(', ')}`
    );

    // Clean up local student store after tests so other isolated suites start clean
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('smart_absensi_students');
    }
  } catch (err: any) {
    assert('Test Suite Execution', false, err?.message || String(err));
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'Master Data Siswa 2026/2027 & Mapel Bahasa Arab',
    passed,
    failed,
    results,
  };
}
