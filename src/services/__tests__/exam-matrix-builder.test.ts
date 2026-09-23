/**
 * SMART ABSENSI GURU - EXAM MATRIX & WORD EXPORTER TEST SUITE
 * Suite 38: Tests for Indonesian school official invigilation matrix builder, teacher code assignments, and Word export.
 */

import { ExamMatrixBuilderService } from '../exam-matrix-builder.service';
import { ExamWordExporterService } from '../exam-word-exporter.service';
import { ExamSchedulerService } from '../exam-scheduler.service';
import type { ExamScheduleFormConfig } from '../../types/exam-schedule.types';
import type { UserProfile } from '../../types/database.types';

export const runExamMatrixTestSuite = async (): Promise<{
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
      id: 't_01',
      full_name: 'Farhan Sopian Sahid, S.Pd.I',
      role: 'GURU',
      teaching_assignment: 'Akhlak Lil Banin',
    } as unknown as UserProfile,
    {
      id: 't_02',
      full_name: 'Qodiatul Asrof Ramadhoni, S.E',
      role: 'GURU',
      teaching_assignment: 'IPS',
    } as unknown as UserProfile,
    {
      id: 't_03',
      full_name: 'Nurholis Majid, S.Pd',
      role: 'GURU',
      teaching_assignment: 'PJOK',
    } as unknown as UserProfile,
    {
      id: 't_04',
      full_name: 'Adi Prasetyo, S.Pd',
      role: 'GURU',
      teaching_assignment: 'Bahasa Inggris',
    } as unknown as UserProfile,
    {
      id: 't_05',
      full_name: 'Dafa Maulana, S.Pd',
      role: 'GURU',
      teaching_assignment: 'Informatika',
    } as unknown as UserProfile,
  ];

  const config: ExamScheduleFormConfig = {
    examType: 'ASAS',
    examTitle: 'Asesmen Sumatif Akhir Semester (ASAS)',
    academicYear: '2026/2027',
    semester: 'GENAP',
    startDate: '2026-06-01', // Senin
    endDate: '2026-06-02',   // Selasa
    sessionsPerDay: 2,
    sessionSlots: [
      { sessionNumber: 1, sessionName: 'Sesi 1', startTime: '08:00', endTime: '09:30' },
      { sessionNumber: 2, sessionName: 'Sesi 2', startTime: '10:00', endTime: '11:00' },
    ],
    selectedClasses: ['7A', '7B', '8A'],
    totalRooms: 3,
    selectedSubjects: ['PAI & BP', 'IPA', 'Matematika', 'Bahasa Arab'],
    selectedTeacherIds: ['t_01', 't_02', 't_03', 't_04', 't_05'],
    proctorsPerRoom: 1,
    excludeOwnSubject: true,
    excludeCommitteeProctor: false,
    assignBackupProctor: false,
  };

  const scheduleData = ExamSchedulerService.generateSchedule(config, sampleTeachers, []);

  // ---------------------------------------------------------------------------
  // TEST 1: Matrix Builder Generates Valid Structure
  // ---------------------------------------------------------------------------
  try {
    const matrix = ExamMatrixBuilderService.buildMatrix(
      scheduleData,
      sampleTeachers,
      'SMP Terpadu Al - Ittihadiyah'
    );

    assert(
      'Exam Matrix 01: Matrix builder constructs valid title, institution, and 3 rooms (R 01, R 02, R 03)',
      matrix.title === 'JADWAL PENGAWAS' &&
      matrix.institutionName === 'SMP Terpadu Al - Ittihadiyah' &&
      matrix.rooms.length === 3 &&
      matrix.rooms[0].label === 'R 01' &&
      matrix.rooms[1].label === 'R 02' &&
      matrix.rooms[2].label === 'R 03',
      `Rooms: ${matrix.rooms.map((r) => r.label).join(', ')}`
    );
  } catch (err: any) {
    assert('Exam Matrix 01: Error building matrix', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Assigns 2-Digit Codes to Teachers
  // ---------------------------------------------------------------------------
  try {
    const matrix = ExamMatrixBuilderService.buildMatrix(
      scheduleData,
      sampleTeachers,
      'SMP Terpadu Al - Ittihadiyah'
    );

    const codes = matrix.teacherLegend.map((t) => t.code);
    const allTwoDigits = codes.every((c) => /^\d{2}$/.test(c));
    const firstCode = codes[0];

    assert(
      'Exam Matrix 02: Teacher legend assigns formatted 2-digit codes starting with 01',
      matrix.teacherLegend.length > 0 && allTwoDigits && firstCode === '01',
      `Teacher codes: ${codes.join(', ')}`
    );
  } catch (err: any) {
    assert('Exam Matrix 02: Error testing teacher legend codes', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Daily Sessions & Cell Codes Mapping
  // ---------------------------------------------------------------------------
  try {
    const matrix = ExamMatrixBuilderService.buildMatrix(
      scheduleData,
      sampleTeachers,
      'SMP Terpadu Al - Ittihadiyah'
    );

    assert(
      'Exam Matrix 03: Day groups correctly split into 2 days with 2 sessions per day',
      matrix.days.length === 2 &&
      matrix.days[0].sessions.length === 2 &&
      matrix.days[1].sessions.length === 2,
      `Days: ${matrix.days.length}, Day 1 sessions: ${matrix.days[0]?.sessions.length}`
    );

    const firstSession = matrix.days[0].sessions[0];
    const roomCodes = Object.values(firstSession.roomCodes);
    const hasValidCodes = roomCodes.every((c) => /^\d{2}$/.test(c));

    assert(
      'Exam Matrix 04: Each room cell in the matrix contains a valid 2-digit proctor code',
      hasValidCodes && roomCodes.length === 3,
      `Room codes in S1: ${roomCodes.join(', ')}`
    );
  } catch (err: any) {
    assert('Exam Matrix 03-04: Error testing sessions mapping', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Word Document HTML Output
  // ---------------------------------------------------------------------------
  try {
    const matrix = ExamMatrixBuilderService.buildMatrix(
      scheduleData,
      sampleTeachers,
      'SMP Terpadu Al - Ittihadiyah'
    );
    const wordHtml = ExamWordExporterService.generateWordHtml(matrix);

    const hasTitle = wordHtml.includes('JADWAL PENGAWAS');
    const hasSchool = wordHtml.includes('SMP TERPADU AL - ITTIHADIYAH');
    const hasRoomCols = wordHtml.includes('R 01') && wordHtml.includes('R 02') && wordHtml.includes('R 03');
    const hasLegend = wordHtml.includes('Nama Guru') && wordHtml.includes('Kode Pengawas');
    const hasWordNamespaces = wordHtml.includes('xmlns:w="urn:schemas-microsoft-com:office:word"');

    assert(
      'Exam Matrix 05: ExamWordExporter generates valid MS Word document with matrix and legend tables',
      hasTitle && hasSchool && hasRoomCols && hasLegend && hasWordNamespaces,
      `HTML length: ${wordHtml.length} chars`
    );
  } catch (err: any) {
    assert('Exam Matrix 05: Error testing Word HTML generation', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: resolveTeacherSubject Resolves Bu Widia and Pak Ridho Accurately
  // ---------------------------------------------------------------------------
  try {
    const widiaProfileWithoutSubject: Partial<UserProfile> = {
      id: 'usr_widia',
      full_name: 'Widianingsih, S.Si., G.r',
      position: 'Guru Mapel IPA',
    };
    const widiaSubject1 = ExamMatrixBuilderService.resolveTeacherSubject(
      widiaProfileWithoutSubject as UserProfile,
      'Widianingsih, S.I., G.r'
    );
    const widiaSubject2 = ExamMatrixBuilderService.resolveTeacherSubject(
      undefined,
      'Widianingsih, S.I., G.r'
    );

    const ridhoSubject = ExamMatrixBuilderService.resolveTeacherSubject(
      undefined,
      'Ridho Maulana Al Farizi'
    );

    assert(
      'Exam Matrix 06: resolveTeacherSubject accurately resolves Bu Widianingsih to IPA and Pak Ridho to Akhlak',
      widiaSubject1 === 'IPA – Ilmu Pengetahuan Alam' &&
      widiaSubject2 === 'IPA – Ilmu Pengetahuan Alam' &&
      ridhoSubject === 'Akhlak lil Banin',
      `Widia from position: ${widiaSubject1}, Widia fallback: ${widiaSubject2}, Ridho: ${ridhoSubject}`
    );
  } catch (err: any) {
    assert('Exam Matrix 06: Error in resolveTeacherSubject test', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Matrix Builder Legend Renders Bu Widia with Canonical Subject
  // ---------------------------------------------------------------------------
  try {
    const scheduleWithWidia: typeof scheduleData = {
      ...scheduleData,
      proctorSchedules: [
        {
          id: 'ps_widia_1',
          date: '2026-06-01',
          dayName: 'Senin',
          sessionNumber: 1,
          startTime: '08:00',
          endTime: '09:30',
          roomName: 'Ruang 1',
          className: '7A',
          subject: 'IPA',
          mainProctorId: 'usr_widia',
          mainProctorName: 'Widianingsih, S.I., G.r',
        },
        {
          id: 'ps_ridho_1',
          date: '2026-06-01',
          dayName: 'Senin',
          sessionNumber: 1,
          startTime: '08:00',
          endTime: '09:30',
          roomName: 'Ruang 2',
          className: '7B',
          subject: 'Akhlak',
          mainProctorId: 'usr_ridho',
          mainProctorName: 'Ridho Maulana Al Farizi',
        },
      ],
    };

    const matrixWithWidia = ExamMatrixBuilderService.buildMatrix(
      scheduleWithWidia,
      sampleTeachers,
      'SMP Terpadu Al - Ittihadiyah'
    );

    const widiaLegend = matrixWithWidia.teacherLegend.find((t) =>
      t.fullName.toLowerCase().includes('widianingsih')
    );
    const ridhoLegend = matrixWithWidia.teacherLegend.find((t) =>
      t.fullName.toLowerCase().includes('ridho')
    );

    assert(
      'Exam Matrix 07: Matrix builder legend contains Bu Widianingsih (IPA) and Pak Ridho (Akhlak) with zero empty dashes',
      Boolean(widiaLegend && widiaLegend.subject === 'IPA – Ilmu Pengetahuan Alam') &&
      Boolean(ridhoLegend && ridhoLegend.subject === 'Akhlak lil Banin'),
      `Widia legend: ${widiaLegend?.fullName} -> ${widiaLegend?.subject}, Ridho legend: ${ridhoLegend?.fullName} -> ${ridhoLegend?.subject}`
    );
  } catch (err: any) {
    assert('Exam Matrix 07: Error testing matrix builder legend with Widia', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Degree Normalization Handles S.I., S.Si., S.Pd.I Correctly
  // ---------------------------------------------------------------------------
  try {
    const normWidia1 = ExamSchedulerService.normalizeTeacherName('Widianingsih, S.I., G.r');
    const normWidia2 = ExamSchedulerService.normalizeTeacherName('Widianingsih, S.Si., G.r');
    const normFarhan = ExamSchedulerService.normalizeTeacherName('Farhan Sopian Sahid, S.Pd.I');

    assert(
      'Exam Matrix 08: normalizeTeacherName strips S.I., S.Si., and S.Pd.I symmetrically',
      normWidia1 === 'widianingsih' &&
      normWidia2 === 'widianingsih' &&
      normFarhan === 'farhan sopian sahid',
      `normWidia1: "${normWidia1}", normWidia2: "${normWidia2}", normFarhan: "${normFarhan}"`
    );
  } catch (err: any) {
    assert('Exam Matrix 08: Error testing normalizeTeacherName', false, err?.message);
  }

  return { passed, failed, results };
};
