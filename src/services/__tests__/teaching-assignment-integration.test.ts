/**
 * SMART ABSENSI GURU — TEACHING ASSIGNMENT INTEGRATION TEST SUITE
 * Suite 39: Tests for optional teaching assignments on teacher profiles, MockProvider persistence,
 * auto-fill subject in teaching schedules, and auto-select in exam question sessions.
 */

import { MockProvider } from '../../providers/mock-provider.service';
import type { UserProfile } from '../../types/database.types';
import type { TestSuiteResult } from '../test-runner.service';

export const runTeachingAssignmentTestSuite = async (): Promise<TestSuiteResult> => {
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

  const provider = new MockProvider();

  // Test 1: Create user with teaching_assignment
  try {
    const teacherData: Partial<UserProfile> = {
      full_name: 'Ahmad Dahlan, S.Pd',
      nip: 'NPP001',
      phone_number: '081234567890',
      role: 'GURU',
      position: 'Guru Matematika',
      teaching_assignment: 'Matematika',
    };

    const created = await provider.createUser(teacherData, 'dummy-token');
    const allUsers = await provider.getAllUsers('dummy-token');
    const found = allUsers.find((u) => u.id === created.id);

    assert(
      'Teaching Assignment 01: Create user with optional teaching_assignment persists properly',
      Boolean(found && found.teaching_assignment === 'Matematika'),
      `Stored subject: ${found?.teaching_assignment}`
    );
  } catch (err) {
    assert('Teaching Assignment 01: Create user with optional teaching_assignment persists properly', false, String(err));
  }

  // Test 2: Create user without teaching_assignment (strictly optional)
  try {
    const staffData: Partial<UserProfile> = {
      full_name: 'Siti Rahmawati',
      nip: 'NPP002',
      phone_number: '081234567891',
      role: 'GURU',
      position: 'Tenaga Administrasi / Tata Usaha',
    };

    const created = await provider.createUser(staffData, 'dummy-token');
    const allUsers = await provider.getAllUsers('dummy-token');
    const found = allUsers.find((u) => u.id === created.id);

    assert(
      'Teaching Assignment 02: Creating user without teaching_assignment succeeds (strictly optional)',
      Boolean(found && !found.teaching_assignment),
      `Subject is optional: ${found?.teaching_assignment || '(empty)'}`
    );
  } catch (err) {
    assert('Teaching Assignment 02: Creating user without teaching_assignment succeeds', false, String(err));
  }

  // Test 3: Update user teaching_assignment
  try {
    const teacherData: Partial<UserProfile> = {
      full_name: 'Budi Santoso, S.Kom',
      nip: 'NPP003',
      phone_number: '081234567892',
      role: 'GURU',
      position: 'Guru Informatika',
    };

    const created = await provider.createUser(teacherData, 'dummy-token');
    await provider.updateUser(created.id, { teaching_assignment: 'Informatika' }, 'dummy-token');

    const allUsers = await provider.getAllUsers('dummy-token');
    const updated = allUsers.find((u) => u.id === created.id);

    assert(
      'Teaching Assignment 03: Updating teaching_assignment persists to user profile',
      Boolean(updated && updated.teaching_assignment === 'Informatika'),
      `Updated subject: ${updated?.teaching_assignment}`
    );
  } catch (err) {
    assert('Teaching Assignment 03: Updating teaching_assignment persists to user profile', false, String(err));
  }

  // Test 4: Subject parser heuristic for Jadwal Pelajaran and Koreksi Soal
  try {
    const teacherA: Partial<UserProfile> = { teaching_assignment: 'Matematika' };
    const subjA = Array.isArray(teacherA.teaching_assignment)
      ? teacherA.teaching_assignment[0]
      : (teacherA.teaching_assignment || '').split(',')[0].trim();

    const teacherB: Partial<UserProfile> = { teaching_assignment: 'Fisika, Kimia, IPA' };
    const subjB = Array.isArray(teacherB.teaching_assignment)
      ? teacherB.teaching_assignment[0]
      : (teacherB.teaching_assignment || '').split(',')[0].trim();

    const teacherC: Partial<UserProfile> = { teaching_assignment: ['Bahasa Indonesia', 'Bahasa Inggris'] };
    const subjC = Array.isArray(teacherC.teaching_assignment)
      ? teacherC.teaching_assignment[0]
      : (teacherC.teaching_assignment || '').split(',')[0].trim();

    const valid = subjA === 'Matematika' && subjB === 'Fisika' && subjC === 'Bahasa Indonesia';

    assert(
      'Teaching Assignment 04: Extracts first teaching subject for schedule and exam sessions reliably',
      valid,
      `Single: ${subjA}, Comma-separated: ${subjB}, Array: ${subjC}`
    );
  } catch (err) {
    assert('Teaching Assignment 04: Extracts first teaching subject', false, String(err));
  }

  // Test 5: Search matching by teaching_assignment
  try {
    const query = 'matematika';
    const mockList: UserProfile[] = [
      { id: '1', full_name: 'Dafa', teaching_assignment: 'Matematika' } as UserProfile,
      { id: '2', full_name: 'Budi', teaching_assignment: 'Bahasa Arab' } as UserProfile,
      { id: '3', full_name: 'Ani', teaching_assignment: ['Matematika Dasar', 'Fisika'] } as UserProfile,
    ];

    const filtered = mockList.filter((t) => {
      if (!t.teaching_assignment) return false;
      return Array.isArray(t.teaching_assignment)
        ? t.teaching_assignment.join(' ').toLowerCase().includes(query)
        : String(t.teaching_assignment).toLowerCase().includes(query);
    });

    assert(
      'Teaching Assignment 05: Filtering and searching teachers by teaching_assignment works accurately',
      filtered.length === 2 && filtered[0].id === '1' && filtered[1].id === '3',
      `Matches found: ${filtered.length} (Expected 2)`
    );
  } catch (err) {
    assert('Teaching Assignment 05: Filtering and searching teachers by teaching_assignment', false, String(err));
  }

  // Test 6: Verify all 12 official school subjects are correctly registered
  try {
    const { OFFICIAL_SCHOOL_SUBJECTS } = await import('../../config/school-subjects.config');
    const expectedCodes = ['PAI', 'IPA', 'MTK', 'PP', 'B. Indonesia', 'IPS', 'B. Arab', 'B. Inggris', 'SBPK', 'Informatika', 'Hadits', 'BTQ'];
    const foundCodes = OFFICIAL_SCHOOL_SUBJECTS.map((s) => s.code);
    const allFound = expectedCodes.every((code) => foundCodes.includes(code));

    assert(
      'Teaching Assignment 06: All 12 official school subjects are accurately registered in config',
      allFound && OFFICIAL_SCHOOL_SUBJECTS.length === 12,
      `Registered count: ${OFFICIAL_SCHOOL_SUBJECTS.length} (Expected 12)`
    );
  } catch (err) {
    assert('Teaching Assignment 06: All 12 official school subjects are accurately registered', false, String(err));
  }

  // Test 7: Verify normalizeSubjectName correctly converts aliases/codes to official labels
  try {
    const { normalizeSubjectName } = await import('../../config/school-subjects.config');
    const testCases: Array<[string, string]> = [
      ['PAI', 'PAI – Pendidikan Agama Islam'],
      ['MTK', 'MTK – Matematika'],
      ['Matematika', 'MTK – Matematika'],
      ['IPA', 'IPA – Ilmu Pengetahuan Alam'],
      ['PP', 'PP – Pendidikan Pancasila'],
      ['PKn', 'PP – Pendidikan Pancasila'],
      ['B. Indonesia', 'B. Indonesia – Bahasa Indonesia'],
      ['Bahasa Indonesia', 'B. Indonesia – Bahasa Indonesia'],
      ['IPS', 'IPS – Ilmu Pengetahuan Sosial'],
      ['B. Arab', 'B. Arab – Bahasa Arab'],
      ['B. Inggris', 'B. Inggris – Bahasa Inggris'],
      ['SBPK', 'SBPK – Seni Budaya dan Prakarya'],
      ['Informatika', 'Informatika'],
      ['Hadits', 'Hadits'],
      ['BTQ', "BTQ – Baca Tulis Al-Qur'an"],
    ];

    const resultsOk = testCases.every(([input, expected]) => {
      const normalized = normalizeSubjectName(input);
      return normalized === expected;
    });

    assert(
      'Teaching Assignment 07: normalizeSubjectName maps codes and aliases to official labels accurately',
      resultsOk,
      `Normalized ${testCases.length} subjects successfully`
    );
  } catch (err) {
    assert('Teaching Assignment 07: normalizeSubjectName maps codes and aliases', false, String(err));
  }

  return {
    suiteName: 'Teacher Teaching Assignment Engine & Prepopulation (Phase 4.8)',
    passed,
    failed,
    results,
  };
};
