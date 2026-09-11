/**
 * SMART ABSENSI GURU — TEACHING SCHEDULE OVERHAUL TEST SUITE (SUITE 17)
 * Memvalidasi sistem jadwal mengajar: operasi atomik, deteksi konflik guru/kelas/ruangan,
 * isolasi identitas berbasis teacher_user_id murni, honest data state, dan Smart Class Alarm.
 */

import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import { TeachingScheduleRepository } from '../../repositories/TeachingScheduleRepository';
import { isTimeIntervalOverlapping } from '../../utils/teaching-schedule.utils';
import { evaluateSmartClassAlarm } from '../../utils/smart-class-alarm.utils';
import type { TeachingSlot } from '../../types/database.types';

export interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

export async function runTeachingScheduleOverhaulTestSuite(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName: name, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName: name, status: 'FAIL', details: details || 'Assertion failed' });
    }
  };

  const provider = new MockProvider();
  ProviderFactory.setProvider(provider);

  // Clear any existing mock schedules for clean test isolation
  await provider.saveTeachingSchedules([]);

  // ── TEST 1: Valid Schedule Slot Creation ──────────────────────────────────
  const createRes1 = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_alpha',
    day_of_week: 1, // Senin
    day: 'Senin',
    start_time: '07:30',
    end_time: '08:50',
    class_name: 'Kelas VII-A',
    subject: 'Matematika',
    room: 'Ruang Teori 7A',
    academic_year: '2024/2025',
  });

  assert(
    'Test 1: Valid Schedule Slot Creation',
    createRes1.success === true &&
      !!createRes1.data?.id &&
      createRes1.data.teacher_user_id === 'usr_guru_alpha' &&
      createRes1.data.version === 1,
    `Slot ID: ${createRes1.data?.id}, Version: ${createRes1.data?.version}`
  );

  const slot1Id = createRes1.data?.id || '';

  // ── TEST 2: Invalid Time Interval Guard (start_time >= end_time) ──────────
  const invalidTimeRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_alpha',
    day_of_week: 1,
    day: 'Senin',
    start_time: '08:50',
    end_time: '07:30',
    class_name: 'Kelas VII-B',
    subject: 'Fisika',
    room: 'Lab IPA',
  });

  assert(
    'Test 2: Invalid Time Interval Guard (start_time >= end_time)',
    invalidTimeRes.success === false &&
      Boolean(invalidTimeRes.error?.includes('harus lebih akhir dari waktu mulai')),
    `Error returned: ${invalidTimeRes.error}`
  );

  // ── TEST 3: Cross-Day Intervals Allowed (No False Conflict) ───────────────
  const crossDayRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_alpha',
    day_of_week: 2, // Selasa (different day)
    day: 'Selasa',
    start_time: '07:30',
    end_time: '08:50',
    class_name: 'Kelas VII-A',
    subject: 'Matematika',
    room: 'Ruang Teori 7A',
    academic_year: '2024/2025',
  });

  assert(
    'Test 3: Cross-Day Intervals Allowed (No False Conflict)',
    crossDayRes.success === true && crossDayRes.data?.day_of_week === 2,
    `Selasa schedule successfully created without colliding with Senin`
  );

  // ── TEST 4: Teacher Overlap Conflict Detection ────────────────────────────
  // Guru Alpha attempts to teach Kelas VIII-A on Senin at 08:00 - 09:20 (overlaps 07:30 - 08:50)
  const teacherOverlapRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_alpha',
    day_of_week: 1,
    day: 'Senin',
    start_time: '08:00',
    end_time: '09:20',
    class_name: 'Kelas VIII-A',
    subject: 'IPA',
    room: 'Lab IPA',
    academic_year: '2024/2025',
  });

  assert(
    'Test 4: Teacher Overlap Conflict Detection',
    teacherOverlapRes.success === false &&
      teacherOverlapRes.conflict?.conflict_type === 'TEACHER',
    `Teacher conflict correctly trapped: ${teacherOverlapRes.error}`
  );

  // ── TEST 5: Class Overlap Conflict Detection ──────────────────────────────
  // Guru Beta attempts to teach Kelas VII-A on Senin at 07:45 - 09:00 (overlaps slot1)
  const classOverlapRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_beta',
    day_of_week: 1,
    day: 'Senin',
    start_time: '07:45',
    end_time: '09:00',
    class_name: 'Kelas VII-A',
    subject: 'Bahasa Indonesia',
    room: 'Ruang Teori 7B',
    academic_year: '2024/2025',
  });

  assert(
    'Test 5: Class Overlap Conflict Detection',
    classOverlapRes.success === false &&
      classOverlapRes.conflict?.conflict_type === 'CLASS',
    `Class conflict correctly trapped: ${classOverlapRes.error}`
  );

  // ── TEST 6: Room Overlap Conflict Detection ───────────────────────────────
  // Guru Gamma attempts to use Ruang Teori 7A for Kelas IX-B on Senin at 07:30 - 08:50
  const roomOverlapRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_gamma',
    day_of_week: 1,
    day: 'Senin',
    start_time: '07:30',
    end_time: '08:50',
    class_name: 'Kelas IX-B',
    subject: 'Sejarah',
    room: 'Ruang Teori 7A', // same room
    academic_year: '2024/2025',
  });

  assert(
    'Test 6: Room Overlap Conflict Detection',
    roomOverlapRes.success === false &&
      roomOverlapRes.conflict?.conflict_type === 'ROOM',
    `Room conflict correctly trapped: ${roomOverlapRes.error}`
  );

  // ── TEST 7: Touching Boundary Condition (Back-to-Back Classes Allowed) ────
  // Slot 1 is 07:30 - 08:50. Slot next is 08:50 - 10:10. Overlap formula must return false!
  const isBoundaryOverlapping = isTimeIntervalOverlapping('07:30', '08:50', '08:50', '10:10');
  const backToBackRes = await provider.createTeachingSchedule({
    teacher_user_id: 'usr_guru_alpha',
    day_of_week: 1,
    day: 'Senin',
    start_time: '08:50',
    end_time: '10:10',
    class_name: 'Kelas VIII-B',
    subject: 'Matematika',
    room: 'Ruang Teori 8B',
    academic_year: '2024/2025',
  });

  assert(
    'Test 7: Touching Boundary Condition (Back-to-Back Classes Allowed)',
    isBoundaryOverlapping === false && backToBackRes.success === true,
    `Back-to-back classes at 08:50 permitted without false overlap`
  );

  const slot2Id = backToBackRes.data?.id || '';

  // ── TEST 8: Atomic Update Preserves Schedule ID ───────────────────────────
  const updateRes = await provider.updateTeachingSchedule({
    id: slot1Id,
    teacher_user_id: 'usr_guru_alpha',
    subject: 'Matematika Terapan',
    version: 1,
  });

  assert(
    'Test 8: Atomic Update Preserves Schedule ID',
    updateRes.success === true &&
      updateRes.data?.id === slot1Id &&
      updateRes.data?.subject === 'Matematika Terapan' &&
      updateRes.data?.version === 2,
    `Preserved ID: ${updateRes.data?.id}, New Version: ${updateRes.data?.version}`
  );

  // ── TEST 9: Optimistic Concurrency Locking on Update ──────────────────────
  // Attempt to update slot1 using stale version (version: 1 instead of current 2)
  const staleUpdateRes = await provider.updateTeachingSchedule({
    id: slot1Id,
    subject: 'Matematika Dasar',
    version: 1,
  });

  assert(
    'Test 9: Optimistic Concurrency Locking on Update',
    staleUpdateRes.success === false &&
      Boolean(staleUpdateRes.error?.includes('Konflik versi')),
    `Stale update rejected: ${staleUpdateRes.error}`
  );

  // ── TEST 10: Update Conflict Detection (Excluding Self ID) ────────────────
  // Updating slot2 to overlap slot1 (07:30 - 08:50) should fail
  const updateConflictRes = await provider.updateTeachingSchedule({
    id: slot2Id,
    start_time: '08:00',
    end_time: '09:20',
    version: 1,
  });

  assert(
    'Test 10: Update Conflict Detection (Excluding Self ID)',
    updateConflictRes.success === false &&
      updateConflictRes.conflict?.conflict_type === 'TEACHER',
    `Update conflict trapped: ${updateConflictRes.error}`
  );

  // ── TEST 11: Atomic Deletion By ID ────────────────────────────────────────
  const deleteOk = await provider.deleteTeachingSchedule(slot2Id);
  const remaining = await provider.getTeachingSchedules();
  const deletedStillExists = remaining.some((s) => s.id === slot2Id);
  const slot1StillExists = remaining.some((s) => s.id === slot1Id);

  assert(
    'Test 11: Atomic Deletion By ID',
    deleteOk === true && !deletedStillExists && slot1StillExists,
    `Deleted slot removed while other slots unaffected`
  );

  // ── TEST 12: Strict Identity Isolation (No Fuzzy Name Leakage) ───────────
  // Setup: Guru "Dafa Maulana" vs Guru "Dafa" or similar
  await provider.createTeachingSchedule({
    teacher_user_id: 'usr_dafa_001',
    day_of_week: 1,
    day: 'Senin',
    start_time: '10:30',
    end_time: '11:50',
    class_name: 'Kelas IX-A',
    subject: 'Informatika',
    room: 'Lab Komputer',
  });

  const dafaSlots = await TeachingScheduleRepository.getTeacherSchedules('usr_dafa_001');
  const otherTeacherSlots = await TeachingScheduleRepository.getTeacherSchedules('usr_other_999');

  assert(
    'Test 12: Strict Identity Isolation (No Fuzzy Name Leakage)',
    dafaSlots.length === 1 &&
      dafaSlots[0].subject === 'Informatika' &&
      otherTeacherSlots.length === 0,
    `Only matching teacher_user_id can access schedule (dafa=${dafaSlots.length}, other=${otherTeacherSlots.length})`
  );

  // ── TEST 13: Honest Data State (Empty DB Returns []) ──────────────────────
  const emptyTeacherSlots = await TeachingScheduleRepository.getTeacherSchedules('usr_ghost_none');

  assert(
    'Test 13: Honest Data State (Empty DB Returns [])',
    Array.isArray(emptyTeacherSlots) && emptyTeacherSlots.length === 0,
    `Returned genuine empty array without falling back to mock demo data`
  );

  // ── TEST 14: Smart Class Alarm - NO_SCHEDULE State ────────────────────────
  const mockNowMonday0630 = new Date('2026-09-14T06:30:00'); // Senin
  const alarmNoSchedule = evaluateSmartClassAlarm([], null, mockNowMonday0630);

  assert(
    'Test 14: Smart Class Alarm - NO_SCHEDULE State',
    alarmNoSchedule.type === 'NO_SCHEDULE' &&
      alarmNoSchedule.message.includes('Belum ada jadwal mengajar'),
    `Message: ${alarmNoSchedule.message}`
  );

  // ── TEST 15: Smart Class Alarm - UPCOMING State (> 10 Min) ────────────────
  const sampleSchedule: TeachingSlot[] = [
    {
      id: 'sched_upcoming_1',
      teacher_user_id: 'usr_test',
      day: 'Senin',
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:20',
      time: '08:00 - 09:20',
      className: 'Kelas VII-A',
      subject: 'Matematika',
      room: 'Ruang 7A',
    },
  ];

  // At 07:15, class is 45 minutes away (> 10 min) -> MUST return UPCOMING (not UPCOMING_10MIN)
  const mockNowMonday0715 = new Date('2026-09-14T07:15:00');
  const alarmUpcoming = evaluateSmartClassAlarm(sampleSchedule, null, mockNowMonday0715);

  assert(
    'Test 15: Smart Class Alarm - UPCOMING State (> 10 Min)',
    alarmUpcoming.type === 'UPCOMING' &&
      alarmUpcoming.minutesUntilNext === 45,
    `Type: ${alarmUpcoming.type}, Diff: ${alarmUpcoming.minutesUntilNext} min`
  );

  // ── TEST 16: Smart Class Alarm - UPCOMING_10MIN State (1..10 Min) ─────────
  // At 07:55, class is 5 minutes away (<= 10 min) -> MUST return UPCOMING_10MIN
  const mockNowMonday0755 = new Date('2026-09-14T07:55:00');
  const alarm10Min = evaluateSmartClassAlarm(sampleSchedule, null, mockNowMonday0755);

  assert(
    'Test 16: Smart Class Alarm - UPCOMING_10MIN State (1..10 Min)',
    alarm10Min.type === 'UPCOMING_10MIN' &&
      alarm10Min.minutesUntilNext === 5 &&
      alarm10Min.message.includes('Persiapan KBM'),
    `Type: ${alarm10Min.type}, Diff: ${alarm10Min.minutesUntilNext} min`
  );

  // ── TEST 17: Smart Class Alarm - Stable Chime Key Prevents Repeated Chimes ─
  const dateStr = '2026-09-14';
  const keyMinute10 = `${alarm10Min.upcomingSlot?.id}_${dateStr}_UPCOMING_10MIN`;
  const mockNowMonday0756 = new Date('2026-09-14T07:56:00'); // 1 minute later
  const alarmNextMinute = evaluateSmartClassAlarm(sampleSchedule, null, mockNowMonday0756);
  const keyMinute9 = `${alarmNextMinute.upcomingSlot?.id}_${dateStr}_UPCOMING_10MIN`;

  assert(
    'Test 17: Smart Class Alarm - Stable Chime Key Prevents Repeated Chimes',
    keyMinute10 === keyMinute9 &&
      keyMinute10 === 'sched_upcoming_1_2026-09-14_UPCOMING_10MIN',
    `Stable alarm key identical across minutes: ${keyMinute10}`
  );

  return { passed, failed, results };
}
