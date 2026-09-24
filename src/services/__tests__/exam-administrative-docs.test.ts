/**
 * SMART ABSENSI GURU - EXAM ADMINISTRATIVE DOCS TEST SUITE
 * Suite 41: Tests for Indonesian school official exam administrative documents generator:
 * 1. Daftar Hadir Pengawas
 * 2. Daftar Serah Terima Naskah Soal & LJK (Per Ruang & Batch)
 * 3. Berita Acara Rekapitulasi Kehadiran Siswa
 * 4. Daftar Hadir Panitia Ujian
 * Also tests Word and Excel exports.
 */

import { ExamAdministrativeDocsService } from '../exam-administrative-docs.service';
import type { ExamScheduleData, ExamCommitteeMember } from '../../types/exam-schedule.types';
import type { ExamInvigilationMatrix } from '../exam-matrix-builder.service';
import { ExamScheduleRepository } from '../../repositories/ExamScheduleRepository';

export const runExamAdministrativeDocsTestSuite = async (): Promise<{
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

  const sampleScheduleData: ExamScheduleData = {
    id: 'sch_test_01',
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
    config: {
      examType: 'ASTS',
      examTitle: 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      startDate: '2026-09-28',
      endDate: '2026-10-02',
      sessionsPerDay: 2,
      sessionSlots: [
        { sessionNumber: 1, sessionName: 'Sesi 1', startTime: '07:30', endTime: '09:00' },
        { sessionNumber: 2, sessionName: 'Sesi 2', startTime: '09:30', endTime: '11:00' },
      ],
      selectedClasses: ['VII A', 'VII B'],
      selectedSubjects: ['PAI & PB', 'IPA', 'Matematika', 'Bahasa Arab'],
      selectedTeacherIds: ['usr_01', 'usr_02'],
      proctorsPerRoom: 1,
      excludeOwnSubject: true,
      excludeCommitteeProctor: false,
      assignBackupProctor: false,
      totalRooms: 2,
    },
    subjectSchedules: [
      {
        id: 'ss_1',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 1,
        startTime: '07:30',
        endTime: '09:00',
        className: 'VII A',
        subject: 'PAI & PB',
        roomName: 'Ruang 01',
      },
      {
        id: 'ss_2',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 2,
        startTime: '09:30',
        endTime: '11:00',
        className: 'VII A',
        subject: 'IPA',
        roomName: 'Ruang 01',
      },
      {
        id: 'ss_3',
        date: '2026-09-29',
        dayName: 'Selasa',
        sessionNumber: 1,
        startTime: '07:30',
        endTime: '09:00',
        className: 'VII A',
        subject: 'Matematika',
        roomName: 'Ruang 01',
      },
    ],
    proctorSchedules: [
      {
        id: 'ps_1',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 1,
        startTime: '07:30',
        endTime: '09:00',
        roomName: 'Ruang 01',
        className: 'VII A',
        subject: 'PAI & PB',
        mainProctorId: 'usr_01',
        mainProctorName: 'Farhan Sopian Sahid, S.Pd.I',
      },
      {
        id: 'ps_2',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 2,
        startTime: '09:30',
        endTime: '11:00',
        roomName: 'Ruang 01',
        className: 'VII A',
        subject: 'IPA',
        mainProctorId: 'usr_02',
        mainProctorName: 'Qodiatul Asrof Ramadoni, S.E',
      },
      {
        id: 'ps_3',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 1,
        startTime: '07:30',
        endTime: '09:00',
        roomName: 'Ruang 02',
        className: 'VII B',
        subject: 'PAI & PB',
        mainProctorId: 'usr_03',
        mainProctorName: 'M. Ridho Alfarizi',
      },
    ],
    summary: {
      totalDays: 2,
      totalSessions: 3,
      totalClasses: 2,
      totalSubjects: 3,
      totalProctorsAssigned: 3,
      averageSessionsPerTeacher: 1,
    },
  };

  const sampleMatrix: ExamInvigilationMatrix = {
    title: 'DAFTAR HADIR PENGAWAS',
    subTitle: 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)',
    institutionName: 'SMP TERPADU AL-ITTIHADIYAH',
    rooms: [
      { key: 'Ruang 01', label: 'R 01' },
      { key: 'Ruang 02', label: 'R 02' },
    ],
    days: [],
    teacherLegend: [
      { no: 1, userId: 'usr_01', fullName: 'Farhan Sopian Sahid, S.Pd.I', subject: 'PAI & PB', code: '01' },
      { no: 2, userId: 'usr_02', fullName: 'Qodiatul Asrof Ramadoni, S.E', subject: 'IPA', code: '02' },
      { no: 3, userId: 'usr_03', fullName: 'M. Ridho Alfarizi', subject: 'Matematika', code: '03' },
    ],
  };

  const sampleCommittees: ExamCommitteeMember[] = [
    {
      id: 'com_1',
      userId: 'usr_ks',
      fullName: 'Farhan Sopian Sahid, S.Pd.I',
      role: 'ANGGOTA',
      academicYear: '2026/2027',
      isActive: true,
    },
    {
      id: 'com_2',
      userId: 'usr_ketua',
      fullName: 'Adi Prasetyo, S.Pd',
      role: 'KETUA',
      academicYear: '2026/2027',
      isActive: true,
    },
    {
      id: 'com_3',
      userId: 'usr_sek',
      fullName: 'Dafa Maulana, S.Pd',
      role: 'SEKRETARIS',
      academicYear: '2026/2027',
      isActive: true,
    },
    {
      id: 'com_4',
      userId: 'usr_ben',
      fullName: 'Mira Nurdianti, S.Pd',
      role: 'BENDAHARA',
      academicYear: '2026/2027',
      isActive: true,
    },
    {
      id: 'com_5',
      userId: 'usr_ang',
      fullName: 'Mawar Andinia, S.Pd., G.r',
      role: 'ANGGOTA',
      academicYear: '2026/2027',
      isActive: true,
    },
  ];

  // -------------------------------------------------------------
  // TEST 1: Date and Exam Day extraction
  // -------------------------------------------------------------
  const extractedDays = ExamAdministrativeDocsService.extractExamDays(sampleScheduleData);
  assert(
    '1. extractExamDays extracts unique chronological exam dates',
    extractedDays.length === 2 && extractedDays[0].date === '2026-09-28' && extractedDays[1].date === '2026-09-29',
    `Days found: ${extractedDays.length}`
  );

  // -------------------------------------------------------------
  // TEST 2: Signatory and committee resolution
  // -------------------------------------------------------------
  const ketuaName = ExamAdministrativeDocsService.resolveCommitteeHead(sampleCommittees);
  assert(
    '2. resolveCommitteeHead finds active KETUA role from committee',
    ketuaName === 'Adi Prasetyo, S.Pd',
    `Resolved name: ${ketuaName}`
  );

  const signDateStr = ExamAdministrativeDocsService.resolveSignDate(sampleScheduleData);
  assert(
    '3. resolveSignDate correctly formats month and year from schedule',
    signDateStr.includes('September 2026'),
    `Resolved sign date: ${signDateStr}`
  );

  // -------------------------------------------------------------
  // TEST 3: Document 1 - Daftar Hadir Pengawas
  // -------------------------------------------------------------
  const doc1Html = ExamAdministrativeDocsService.generateProctorAttendanceHtml(
    sampleMatrix,
    sampleScheduleData,
    { committeeHeadName: 'Adi Prasetyo, S.Pd' }
  );

  assert(
    '4. generateProctorAttendanceHtml contains required headers and title',
    doc1Html.includes('DAFTAR HADIR PENGAWAS') &&
      doc1Html.includes('HARI / TANGGAL') &&
      doc1Html.includes('TAHUN PELAJARAN 2026/2027'),
    'Doc 1 missing main headers'
  );

  assert(
    '5. generateProctorAttendanceHtml contains proctor names and signature cells',
    doc1Html.includes('Farhan Sopian Sahid, S.Pd.I') &&
      doc1Html.includes('sig-cell') &&
      doc1Html.includes('Adi Prasetyo, S.Pd'),
    'Doc 1 missing proctor rows or signature block'
  );

  // -------------------------------------------------------------
  // TEST 4: Document 2 - Daftar Serah Terima Naskah Soal & LJK
  // -------------------------------------------------------------
  const doc2SingleHtml = ExamAdministrativeDocsService.generateSingleRoomHandoverHtml(
    'Ruang 01',
    sampleScheduleData
  );

  assert(
    '6. generateSingleRoomHandoverHtml contains both handover tables and room badge',
    doc2SingleHtml.includes('RUANG 01') &&
      doc2SingleHtml.includes('Daftar Pengambilan Naskah Soal') &&
      doc2SingleHtml.includes('Daftar Penyerahan Lembar Jawaban'),
    'Doc 2 missing room badge or sub-tables'
  );

  assert(
    '7. generateSingleRoomHandoverHtml populates scheduled subjects and leaves proctor names empty for handwriting',
    doc2SingleHtml.includes('1. PAI & PB') &&
      doc2SingleHtml.includes('2. IPA') &&
      !doc2SingleHtml.includes('Farhan Sopian Sahid, S.Pd.I'),
    'Doc 2 should not pre-fill proctor names in physical handover sheet'
  );

  const doc2LandscapeHtml = ExamAdministrativeDocsService.generateHandoverDocsHtml(
    sampleScheduleData,
    { orientation: 'landscape', roomFilter: 'Ruang 01' }
  );
  assert(
    '7b. generateHandoverDocsHtml supports landscape orientation styling and 297mm width',
    doc2LandscapeHtml.includes('size: A4 landscape') &&
      doc2LandscapeHtml.includes('max-width: 297mm'),
    'Doc 2 missing landscape page style'
  );

  const doc2BatchHtml = ExamAdministrativeDocsService.generateHandoverDocsHtml(sampleScheduleData, {
    roomFilter: 'ALL',
  });
  assert(
    '8. generateHandoverDocsHtml with roomFilter ALL produces page breaks for all rooms',
    doc2BatchHtml.includes('RUANG 01') &&
      doc2BatchHtml.includes('RUANG 02') &&
      doc2BatchHtml.includes('page-break'),
    'Batch handover docs missing multi-room separation'
  );

  // -------------------------------------------------------------
  // TEST 5: Document 3 - Berita Acara Rekapitulasi Kehadiran Siswa
  // -------------------------------------------------------------
  const doc3Html = ExamAdministrativeDocsService.generateStudentAttendanceSummaryHtml(
    sampleScheduleData,
    { totalRegisteredStudents: 40 }
  );

  assert(
    '9. generateStudentAttendanceSummaryHtml contains student recapitulation columns',
    doc3Html.includes('BERITA ACARA REKAPITULASI KEHADIRAN PESERTA') &&
      doc3Html.includes('Jumlah Seharusnya') &&
      doc3Html.includes('Jumlah yang Hadir') &&
      doc3Html.includes('Jumlah yang Tidak Hadir') &&
      doc3Html.includes('Keterangan'),
    'Doc 3 missing recap table columns'
  );

  assert(
    '10. generateStudentAttendanceSummaryHtml lists distinct scheduled subjects',
    doc3Html.includes('PAI & PB') &&
      doc3Html.includes('IPA') &&
      doc3Html.includes('Matematika'),
    'Doc 3 missing scheduled subjects'
  );

  // -------------------------------------------------------------
  // TEST 5b: Document - Daftar Hadir Peserta Ujian (Roster Siswa per Ruangan)
  // Sesuai layout fisik ASTS SMP Terpadu Al-Ittihadiyah / SMA Terpadu As Salaam
  // -------------------------------------------------------------
  const docRosterHtml = ExamAdministrativeDocsService.generateStudentAttendanceRosterHtml(
    sampleScheduleData,
    { roomFilter: 'Ruang 01' }
  );

  assert(
    '10b. generateStudentAttendanceRosterHtml matches physical sheet layout and headers',
    docRosterHtml.includes('DAFTAR HADIR PESERTA') &&
      (docRosterHtml.includes('RUANG 01') || docRosterHtml.includes('Ruang 01')) &&
      docRosterHtml.includes('NO') &&
      docRosterHtml.includes('URUT') &&
      docRosterHtml.includes('PESERTA') &&
      docRosterHtml.includes('NAMA PESERTA') &&
      docRosterHtml.includes('L/P') &&
      docRosterHtml.includes('MATA PELAJARAN') &&
      docRosterHtml.includes('PAI & BP') &&
      docRosterHtml.includes('Informatika') &&
      docRosterHtml.includes('Ketua Pelaksana') &&
      docRosterHtml.includes('Adi Prasetyo, S.Pd'),
    'Roster HTML missing title, room badge, or column headers'
  );

  const roomStudentsMap = ExamAdministrativeDocsService.resolveRoomStudents(sampleScheduleData);
  const r1Students = roomStudentsMap['Ruang 01'] || [];
  const r2Students = roomStudentsMap['Ruang 02'] || [];
  const r3Students = roomStudentsMap['Ruang 03'] || [];
  const r4Students = roomStudentsMap['Ruang 04'] || [];
  const r5Students = roomStudentsMap['Ruang 05'] || [];

  assert(
    '10c. resolveRoomStudents allocates 5 rooms per class with exact class rosters (R1=7 [13L+16P], R2=8A, R3=9A, R4=9B, R5=8B)',
    r1Students.length === 29 &&
      r1Students.every((s) => s.className === '7') &&
      r1Students.slice(0, 13).every((s) => s.gender === 'L') &&
      r1Students.slice(13).every((s) => s.gender === 'P') &&
      r1Students[0].fullName === 'AFHTAR SHAKIL' &&
      r1Students[13].fullName === 'ADIBA KHANSA AZ-ZAHRA' &&
      r2Students.length === 18 &&
      r2Students.every((s) => s.className === '8A') &&
      r3Students.length === 16 &&
      r3Students.every((s) => s.className === '9A') &&
      r4Students.length === 15 &&
      r4Students.every((s) => s.className === '9B') &&
      r5Students.length === 17 &&
      r5Students.every((s) => s.className === '8B'),
    `Room class allocations incorrect: R1=${r1Students.length}, R2=${r2Students.length}, R3=${r3Students.length}, R4=${r4Students.length}, R5=${r5Students.length}`
  );

  assert(
    '10d. resolveRoomStudents numbers participants sequentially from 13-0820-001 continuously through Ruang 5 (R1: 7, R2: 8A, R3: 9A, R4: 9B, R5: 8B)',
    r1Students[0].participantNumber === '13-0820-001' &&
      r1Students[28].participantNumber === '13-0820-029' &&
      r2Students[0].participantNumber === '13-0820-030' &&
      r2Students[17].participantNumber === '13-0820-047' &&
      r3Students[0].participantNumber === '13-0820-048' &&
      r3Students[15].participantNumber === '13-0820-063' &&
      r4Students[0].participantNumber === '13-0820-064' &&
      r4Students[14].participantNumber === '13-0820-078' &&
      r5Students[0].participantNumber === '13-0820-079' &&
      r5Students[16].participantNumber === '13-0820-095',
    `Sequential participant numbering across rooms failed: R1[0]=${r1Students[0]?.participantNumber}, R1[end]=${r1Students[28]?.participantNumber}, R2[0]=${r2Students[0]?.participantNumber}, R5[end]=${r5Students[16]?.participantNumber}`
  );

  // -------------------------------------------------------------
  // TEST 5c: Document - Daftar Hadir Peserta Ujian Ruang 6 (SMA)
  // Verifikasi Ruang 6 SMA berisi 36 siswa gabungan Kelas 10, 11, dan 12
  // -------------------------------------------------------------
  const smaScheduleData = ExamScheduleRepository.createCanonicalSmaSchedule('2026/2027', 'ASTS');
  const smaRoomStudentsMap = ExamAdministrativeDocsService.resolveRoomStudents(smaScheduleData);
  const smaRooms = Object.keys(smaRoomStudentsMap);
  const r6Students = smaRoomStudentsMap['Ruang 06'] || [];

  const k10Count = r6Students.filter((s) => s.className === '10').length;
  const k11Count = r6Students.filter((s) => s.className === '11').length;
  const k12Count = r6Students.filter((s) => s.className === '12').length;

  assert(
    '10e. resolveRoomStudents allocates SMA schedule to Ruang 06 with exactly 36 students (12 Kelas 10, 12 Kelas 11, 12 Kelas 12)',
    smaRooms.length === 1 &&
      smaRooms[0] === 'Ruang 06' &&
      r6Students.length === 36 &&
      k10Count === 12 &&
      k11Count === 12 &&
      k12Count === 12,
    `SMA room resolution failed: rooms=${smaRooms.join(', ')}, total=${r6Students.length} (K10=${k10Count}, K11=${k11Count}, K12=${k12Count})`
  );

  const docRosterR6Html = ExamAdministrativeDocsService.generateStudentAttendanceRosterHtml(
    smaScheduleData,
    { roomFilter: 'Ruang 06' }
  );

  assert(
    '10f. generateStudentAttendanceRosterHtml for Ruang 06 renders RUANG 06 badge and contains all 36 SMA students',
    docRosterR6Html.includes('RUANG 06') &&
      docRosterR6Html.includes('ACHMAD DANI PRATAMA') &&
      docRosterR6Html.includes('ALIF MAULANA') &&
      docRosterR6Html.includes('WIDYA ASTUTI') &&
      docRosterR6Html.includes('13-0820-036'),
    'Ruang 06 roster HTML missing RUANG 06 badge or expected student entries'
  );

  // Cross-level check: SMP schedule that includes Ruang 6 cross-level proctor
  const crossLevelSchedule: ExamScheduleData = {
    ...sampleScheduleData,
    proctorSchedules: [
      ...sampleScheduleData.proctorSchedules,
      {
        id: 'ps_cross_r6',
        date: '2026-09-28',
        dayName: 'Senin',
        sessionNumber: 1,
        startTime: '07:30',
        endTime: '09:00',
        roomName: 'Ruang 6',
        className: '10, 11, 12',
        subject: 'PAI & PB',
        mainProctorId: 'usr_04',
        mainProctorName: 'Dafa Maulana',
      },
    ],
  };
  const crossLevelMap = ExamAdministrativeDocsService.resolveRoomStudents(crossLevelSchedule);
  const crossR6Students = crossLevelMap['Ruang 06'] || [];

  assert(
    '10g. resolveRoomStudents populates Ruang 06 with SMA students when present in cross-level schedule',
    crossR6Students.length === 36 &&
      crossR6Students[0].fullName === 'ACHMAD DANI PRATAMA' &&
      crossR6Students[35].fullName === 'WIDYA ASTUTI',
    `Cross-level Ruang 06 population failed: count=${crossR6Students.length}`
  );

  // -------------------------------------------------------------
  // TEST 6: Document 4 - Daftar Hadir Panitia Ujian
  // -------------------------------------------------------------
  const doc4Html = ExamAdministrativeDocsService.generateCommitteeAttendanceHtml(
    sampleCommittees,
    sampleScheduleData
  );

  assert(
    '11. generateCommitteeAttendanceHtml contains committee roles and daily dates',
    doc4Html.includes('DAFTAR HADIR PANITIA') &&
      doc4Html.includes('KS/ Penanggung Jawab') &&
      doc4Html.includes('Ketua') &&
      doc4Html.includes('Sekretaris') &&
      doc4Html.includes('Bendahara') &&
      doc4Html.includes('Anggota'),
    'Doc 4 missing committee roles'
  );

  assert(
    '12. generateCommitteeAttendanceHtml includes signatory footer block',
    doc4Html.includes('Ketua Penyelenggara,') && doc4Html.includes('Adi Prasetyo, S.Pd'),
    'Doc 4 missing signatory'
  );

  // -------------------------------------------------------------
  // TEST 7: Excel and Word Exporter robustness
  // -------------------------------------------------------------
  let excelExportWorked = true;
  try {
    // In node environment without window, exportToExcel will build sheets and call writeFile
    // We test that it completes without throwing any syntax/schema errors
    ExamAdministrativeDocsService.exportToExcel('PROCTOR_ATTENDANCE', {
      matrix: sampleMatrix,
      scheduleData: sampleScheduleData,
      committeeMembers: sampleCommittees,
    }, 'test_proctor_attendance.xlsx');
  } catch {
    excelExportWorked = false;
  }

  assert(
    '13. exportToExcel executes successfully for PROCTOR_ATTENDANCE',
    excelExportWorked,
    'exportToExcel threw an error'
  );

  let excelHandoverWorked = true;
  try {
    ExamAdministrativeDocsService.exportToExcel('HANDOVER_DOCS', {
      scheduleData: sampleScheduleData,
      committeeMembers: sampleCommittees,
    }, 'test_handover_docs.xlsx');
  } catch {
    excelHandoverWorked = false;
  }

  assert(
    '14. exportToExcel executes successfully for HANDOVER_DOCS',
    excelHandoverWorked,
    'exportToExcel HANDOVER_DOCS threw an error'
  );

  const handoverWs = ExamAdministrativeDocsService.buildHandoverDocsWorksheet(
    'Ruang 01',
    sampleScheduleData
  );

  assert(
    '14b. buildHandoverDocsWorksheet produces pixel-perfect sheet with styles, badge, and merges',
    handoverWs['E8']?.v === 'RUANG 01' &&
      handoverWs['E8']?.s?.font?.color?.rgb === 'C00000' &&
      handoverWs['E8']?.s?.fill?.fgColor?.rgb === 'D9E1F2' &&
      handoverWs['A10']?.v?.includes('Daftar Pengambilan Naskah Soal') &&
      handoverWs['A10']?.s?.fill?.fgColor?.rgb === '1F4E78' &&
      handoverWs['A12']?.s?.fill?.fgColor?.rgb === '8EAADB' &&
      handoverWs['C14']?.v?.includes('PAI & PB') &&
      Boolean(handoverWs['!merges'] && handoverWs['!merges'].length >= 10),
    'Handover worksheet missing exact colors, badge, or row-by-row structure'
  );

  let excelRosterWorked = true;
  try {
    ExamAdministrativeDocsService.exportToExcel('STUDENT_ATTENDANCE_ROSTER', {
      scheduleData: sampleScheduleData,
      committeeMembers: sampleCommittees,
    }, 'test_student_roster.xlsx');
  } catch {
    excelRosterWorked = false;
  }

  assert(
    '14c. exportToExcel executes successfully for STUDENT_ATTENDANCE_ROSTER',
    excelRosterWorked,
    'exportToExcel STUDENT_ATTENDANCE_ROSTER threw an error'
  );

  const studentWs = ExamAdministrativeDocsService.buildStudentAttendanceRosterWorksheet(
    'Ruang 01',
    r1Students,
    sampleScheduleData
  );

  assert(
    '14d. buildStudentAttendanceRosterWorksheet contains titles, Ruang 01 badge, MATA PELAJARAN, and 13-0820-001 participant',
    studentWs['A1']?.v === 'DAFTAR HADIR PESERTA' &&
      (studentWs['N1']?.v === 'Ruang 01' || studentWs['N1']?.v === 'RUANG 01') &&
      studentWs['A6']?.v === 'NO' &&
      studentWs['C6']?.v === 'NAMA PESERTA' &&
      studentWs['D6']?.v === 'L/P' &&
      studentWs['E6']?.v === 'MATA PELAJARAN' &&
      studentWs['A7']?.v === 'URUT' &&
      studentWs['B7']?.v === 'PESERTA' &&
      studentWs['E7']?.v === 'PAI & BP' &&
      studentWs['B8']?.v === '13-0820-001' &&
      studentWs['C8']?.v === 'AFHTAR SHAKIL' &&
      studentWs['D8']?.v === 'L' &&
      studentWs['!pageSetup']?.orientation === 'landscape',
    'Student attendance worksheet missing header, badge, or participant row'
  );

  let excelRecapWorked = true;
  try {
    ExamAdministrativeDocsService.exportToExcel('STUDENT_ATTENDANCE_SUMMARY', {
      scheduleData: sampleScheduleData,
      committeeMembers: sampleCommittees,
    }, 'test_recap_docs.xlsx');
  } catch {
    excelRecapWorked = false;
  }

  assert(
    '15. exportToExcel executes successfully for STUDENT_ATTENDANCE_SUMMARY',
    excelRecapWorked,
    'exportToExcel STUDENT_ATTENDANCE_SUMMARY threw an error'
  );

  let excelCommitteeWorked = true;
  try {
    ExamAdministrativeDocsService.exportToExcel('COMMITTEE_ATTENDANCE', {
      scheduleData: sampleScheduleData,
      committeeMembers: sampleCommittees,
    }, 'test_committee_docs.xlsx');
  } catch {
    excelCommitteeWorked = false;
  }

  assert(
    '16. exportToExcel executes successfully for COMMITTEE_ATTENDANCE',
    excelCommitteeWorked,
    'exportToExcel COMMITTEE_ATTENDANCE threw an error'
  );

  // -------------------------------------------------------------
  // TEST 8: Word Export fidelity and structure
  // -------------------------------------------------------------
  const wordDoc2Html = ExamAdministrativeDocsService.generateWordHtmlString(
    doc2LandscapeHtml,
    'landscape'
  );

  assert(
    '17. generateWordHtmlString does not nest duplicate html or body tags inside Section1',
    !wordDoc2Html.includes('<div class="Section1">\n          <!DOCTYPE html>') &&
      !wordDoc2Html.includes('<div class="Section1">\n          <html') &&
      wordDoc2Html.includes('mso-page-orientation: landscape'),
    'generateWordHtmlString has invalid nested document root'
  );

  assert(
    '18. generateWordHtmlString preserves table-banner-th and badge-table layout for Word',
    wordDoc2Html.includes('table-banner-th') &&
      wordDoc2Html.includes('badge-box-table') &&
      wordDoc2Html.includes('footer-sign-table'),
    'Word document missing table headers, badge layout table, or signatory table'
  );

  let wordExportWorked = true;
  try {
    ExamAdministrativeDocsService.exportToWord(doc2SingleHtml, 'test_export.doc', 'portrait');
  } catch {
    wordExportWorked = false;
  }

  assert(
    '19. exportToWord executes safely in node environment without exceptions',
    wordExportWorked,
    'exportToWord threw unexpected exception'
  );

  // -------------------------------------------------------------
  // TEST 9: Review & In-Place Editing Roster with Zero Empty Rooms Guarantee
  // -------------------------------------------------------------
  const customEditedMap = {
    'Ruang 01': [
      { urut: 1, participantNumber: '13-0820-001', fullName: 'AHMAD REVIU EDITED', gender: 'L', className: '7' },
      { urut: 2, participantNumber: '13-0820-002', fullName: 'BELLA REVIU EDITED', gender: 'P', className: '7' },
    ],
  };

  const resolvedCustomMap = ExamAdministrativeDocsService.resolveRoomStudents(sampleScheduleData, {
    customRoomStudentsMap: customEditedMap,
    includeNumberPrefix: true,
  });

  const customR1Students = resolvedCustomMap['Ruang 01'] || [];
  const customR2Students = resolvedCustomMap['Ruang 02'] || [];
  const customR5Students = resolvedCustomMap['Ruang 05'] || [];

  assert(
    '20. resolveRoomStudents applies custom edited roster to Ruang 01 and guarantees zero empty rooms across 5 rooms',
    customR1Students.length === 2 &&
      customR1Students[0].fullName === 'AHMAD REVIU EDITED' &&
      customR2Students.length > 0 &&
      customR5Students.length > 0,
    `Custom review roster or zero-empty guarantee failed: R1=${customR1Students.length}, R2=${customR2Students.length}, R5=${customR5Students.length}`
  );

  // -------------------------------------------------------------
  // TEST 10: Strict A4 Sizing Verification (Excel, Word, Print)
  // -------------------------------------------------------------
  const sampleRosterWs = ExamAdministrativeDocsService.buildStudentAttendanceRosterWorksheet(
    'Ruang 01',
    customR1Students,
    sampleScheduleData
  );

  const sampleHandoverWs = ExamAdministrativeDocsService.buildHandoverDocsWorksheet(
    'Ruang 01',
    sampleScheduleData
  );

  assert(
    '21. Excel worksheets strictly enforce ISO A4 paperSize 9 and print margins',
    sampleRosterWs['!pageSetup']?.paperSize === 9 &&
      sampleHandoverWs['!pageSetup']?.paperSize === 9 &&
      sampleRosterWs['!margins']?.left === 0.5,
    'Excel worksheets do not have paperSize 9 (A4) or margins configured'
  );

  const wordPortraitDoc = ExamAdministrativeDocsService.generateWordHtmlString('<p>Hello</p>', 'portrait');
  const wordLandscapeDoc = ExamAdministrativeDocsService.generateWordHtmlString('<p>Hello</p>', 'landscape');

  assert(
    '22. Word documents strictly enforce ISO A4 dimensions (210mm x 297mm)',
    wordPortraitDoc.includes('size: 210mm 297mm;') &&
      wordLandscapeDoc.includes('size: 297mm 210mm;'),
    'Word documents missing A4 dimensions (210mm 297mm / 297mm 210mm)'
  );

  const officialStyles = ExamAdministrativeDocsService.getOfficialDocumentStyles('portrait');
  assert(
    '23. Official document styles enforce A4 size and margins for print and PDF',
    officialStyles.includes('size: A4 portrait;') &&
      officialStyles.includes('margin: 10mm 15mm 10mm 15mm;') &&
      officialStyles.includes('width: 210mm;'),
    'Official styles do not enforce @page A4 portrait with margins'
  );

  // Clean up any test files written by XLSX.writeFile during node execution if created
  try {
    const fs = await import('fs');
    ['test_proctor_attendance.xlsx', 'test_student_roster.xlsx', 'test_handover_docs.xlsx', 'test_recap_docs.xlsx', 'test_committee_docs.xlsx'].forEach((f) => {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    });
  } catch {}

  return { passed, failed, results };
};
