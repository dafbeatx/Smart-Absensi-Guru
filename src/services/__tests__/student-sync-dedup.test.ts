/**
 * SMART ABSENSI GURU - STUDENT SYNC DEDUPLICATION & TOMBSTONE INTEGRITY TEST SUITE
 * Verifies that:
 * 1. Synchronizing from GradeMaster twice produces 0 duplicate records.
 * 2. Deleting a student creates a tombstone and prevents resurrection upon sync.
 * 3. Existing student IDs and paired RFID UIDs are preserved safely across syncs.
 * 4. Manually re-adding a student clears the tombstone and persists the student.
 * 5. deduplicateStudents utility handles variations in casing, whitespace, and class prefixes.
 */

import { StudentRepository, clearDeletedStudentKeys, getDeletedStudentKeys } from '../../repositories/StudentRepository';
import { deduplicateStudents, getStudentNaturalKey } from '../../utils/student-dedup.utils';
import type { TestResultItem } from '../test-runner.service';
import type { StudentItem } from '../../types/database.types';

export const runStudentSyncDedupTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> => {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    // Reset state before tests
    clearDeletedStudentKeys();
    await StudentRepository.saveStudents([]);

    // =========================================================================
    // Test 1: deduplicateStudents normalizes class code, trims name, merges records
    // =========================================================================
    const dirtyInput: StudentItem[] = [
      {
        id: 'std_01',
        nisn: '',
        fullName: 'Adiba Khansa Az-Zahra',
        className: 'Kelas 7',
        academicYear: '2026/2027',
        gender: 'P',
        cardStatus: 'ACTIVE',
        attendanceRate: 100,
      },
      {
        id: 'std_02',
        nisn: '',
        fullName: '  ADIBA KHANSA   AZ-ZAHRA  ',
        className: '7',
        academicYear: '2026/2027',
        gender: 'P',
        rfidUid: 'CARD-ADIBA-123',
        cardStatus: 'ACTIVE',
        attendanceRate: 100,
      },
      {
        id: 'std_03',
        nisn: '',
        fullName: 'BILQIS AINUN NISSA',
        className: 'Kelas VIII-A',
        academicYear: '2026/2027',
        gender: 'P',
        cardStatus: 'ACTIVE',
        attendanceRate: 100,
      },
    ];

    const deduped = deduplicateStudents(dirtyInput);
    assert(
      'Deduplication: Merges duplicate student records with different class prefixes and formats',
      deduped.length === 2 &&
      deduped.some((s) => s.fullName.toUpperCase() === 'ADIBA KHANSA AZ-ZAHRA' && s.rfidUid === 'CARD-ADIBA-123') &&
      deduped.some((s) => s.fullName.toUpperCase() === 'BILQIS AINUN NISSA' && s.className === '8A'),
      `Result count: ${deduped.length}, Adiba RFID: ${deduped.find((s) => s.fullName.toUpperCase() === 'ADIBA KHANSA AZ-ZAHRA')?.rfidUid}`
    );

    // =========================================================================
    // Test 2: Initial syncFromGradeMaster pulls roster cleanly
    // =========================================================================
    const sync1 = await StudentRepository.syncFromGradeMaster('2026/2027');
    const studentsAfterSync1 = await StudentRepository.getStudents();
    assert(
      'Sync 01: Initial sync creates student list without duplicates',
      sync1.syncedCount > 0 && studentsAfterSync1.length === sync1.syncedCount,
      `Synced: ${sync1.syncedCount}, Total in store: ${studentsAfterSync1.length}`
    );

    // =========================================================================
    // Test 3: Second syncFromGradeMaster produces ZERO duplicates
    // =========================================================================
    await StudentRepository.syncFromGradeMaster('2026/2027');
    const studentsAfterSync2 = await StudentRepository.getStudents();

    // Verify no two students have the same (className, fullName)
    const keyCounts = new Map<string, number>();
    studentsAfterSync2.forEach((s) => {
      const k = getStudentNaturalKey(s.className, s.fullName);
      keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
    });
    const hasAnyDuplicate = Array.from(keyCounts.values()).some((cnt) => cnt > 1);

    assert(
      'Sync 02: Repeated sync maintains exact student count with 0 duplicates',
      studentsAfterSync2.length === studentsAfterSync1.length && !hasAnyDuplicate,
      `After 1st: ${studentsAfterSync1.length}, After 2nd: ${studentsAfterSync2.length}, Has duplicates: ${hasAnyDuplicate}`
    );

    // =========================================================================
    // Test 4: Preserves RFID UID and student ID across syncs
    // =========================================================================
    const testStudent = studentsAfterSync2[0];
    const originalId = testStudent.id;
    const testRfid = 'RFID-TEST-99999';

    await StudentRepository.bindRfidCard(testStudent.id, testRfid);
    const afterBind = await StudentRepository.getStudents();
    const boundStudent = afterBind.find((s) => s.id === originalId);

    assert(
      'RFID Binding: Card successfully paired to student',
      boundStudent?.rfidUid === testRfid,
      `Expected: ${testRfid}, Got: ${boundStudent?.rfidUid}`
    );

    // Run sync again
    await StudentRepository.syncFromGradeMaster('2026/2027');
    const afterSyncWithRfid = await StudentRepository.getStudents();
    const preservedStudent = afterSyncWithRfid.find((s) => s.id === originalId);

    assert(
      'Sync 03: Preserves existing student ID and paired RFID card UID',
      preservedStudent?.id === originalId && preservedStudent?.rfidUid === testRfid,
      `Preserved ID: ${preservedStudent?.id === originalId}, Preserved RFID: ${preservedStudent?.rfidUid}`
    );

    // =========================================================================
    // Test 5: Deleting a student marks tombstone and prevents resurrection upon sync
    // =========================================================================
    const studentToDelete = afterSyncWithRfid.find((s) => s.fullName === 'ADIBA KHANSA AZ-ZAHRA') || afterSyncWithRfid[1];
    const deletedName = studentToDelete.fullName;
    const deletedClass = studentToDelete.className;
    const countBeforeDelete = afterSyncWithRfid.length;

    const delSuccess = await StudentRepository.deleteStudent(studentToDelete.id, undefined, {
      className: deletedClass,
      fullName: deletedName,
    });

    const tombstones = getDeletedStudentKeys();
    const expectedKey = getStudentNaturalKey(deletedClass, deletedName);
    const afterDeleteList = await StudentRepository.getStudents();

    assert(
      'Deletion: Student deleted and registered in persistent tombstones',
      delSuccess &&
      tombstones.has(expectedKey) &&
      !afterDeleteList.some((s) => s.id === studentToDelete.id),
      `Tombstone registered: ${tombstones.has(expectedKey)}, Remaining: ${afterDeleteList.length}`
    );

    // NOW CLICK SINKRON! THE DELETED STUDENT MUST NOT REAPPEAR!
    await StudentRepository.syncFromGradeMaster('2026/2027');
    const afterSyncPostDelete = await StudentRepository.getStudents();
    const resurrectedStudent = afterSyncPostDelete.find(
      (s) => getStudentNaturalKey(s.className, s.fullName) === expectedKey
    );

    assert(
      'Sync 04: Deleted student is NOT resurrected by GradeMaster sync',
      !resurrectedStudent && afterSyncPostDelete.length === countBeforeDelete - 1,
      `Resurrected: ${Boolean(resurrectedStudent)}, Student count: ${afterSyncPostDelete.length} (Expected ${countBeforeDelete - 1})`
    );

    // =========================================================================
    // Test 6: Explicitly re-adding a student clears the tombstone
    // =========================================================================
    await StudentRepository.createStudent({
      nisn: '1234567890',
      fullName: deletedName,
      className: deletedClass,
      academicYear: '2026/2027',
      gender: 'P',
      cardStatus: 'ACTIVE',
      attendanceRate: 100,
    });

    const tombstonesAfterReadd = getDeletedStudentKeys();
    const afterReaddList = await StudentRepository.getStudents();

    assert(
      'Re-addition: Admin explicitly adding student removes tombstone',
      !tombstonesAfterReadd.has(expectedKey) &&
      afterReaddList.some((s) => s.fullName === deletedName),
      `Tombstone removed: ${!tombstonesAfterReadd.has(expectedKey)}, In list: ${afterReaddList.some((s) => s.fullName === deletedName)}`
    );

    // Sync again after re-adding: student should stay and not duplicate
    await StudentRepository.syncFromGradeMaster('2026/2027');
    const afterFinalSync = await StudentRepository.getStudents();
    const matchingFinal = afterFinalSync.filter(
      (s) => getStudentNaturalKey(s.className, s.fullName) === expectedKey
    );

    assert(
      'Sync 05: Re-added student remains safely in directory without duplicates',
      matchingFinal.length === 1,
      `Matching count: ${matchingFinal.length} (Expected exactly 1)`
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert('Student Sync Deduplication Suite Execution', false, msg);
  }

  return { passed, failed, results };
};
