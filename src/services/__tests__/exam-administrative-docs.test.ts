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

  // Clean up any test files written by XLSX.writeFile during node execution if created
  try {
    const fs = await import('fs');
    ['test_proctor_attendance.xlsx', 'test_handover_docs.xlsx', 'test_recap_docs.xlsx', 'test_committee_docs.xlsx'].forEach((f) => {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    });
  } catch {}

  return { passed, failed, results };
};
