/**
 * SMART ABSENSI GURU - ADMINISTRATION HUB & MODULE INTEGRITY TEST SUITE
 * Suite 34: Tests for academic year sensitivity, module persistence, customization, and exam integration.
 */

import { AdministrationRepository } from '../../repositories/AdministrationRepository';
import {
  DEFAULT_ADMINISTRATION_MODULES,
} from '../../types/administration.types';
import { ALL_QUICK_ICONS } from '../../features/guru/components/CustomizeQuickIconsModal';

export const runAdministrationModulesTestSuite = async (): Promise<{
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

  const testUserId = `test_admin_${Date.now()}`;

  // ---------------------------------------------------------------------------
  // TEST 1: Default Academic Year & Semester
  // ---------------------------------------------------------------------------
  try {
    const defaultYear = AdministrationRepository.getActiveAcademicYear();
    const defaultSem = AdministrationRepository.getActiveSemester();

    assert(
      'Admin Hub 01: Default academic year is 2026/2027 and semester is GANJIL',
      defaultYear === '2026/2027' && defaultSem === 'GANJIL',
      `Got year: ${defaultYear}, sem: ${defaultSem}`
    );
  } catch (err: any) {
    assert('Admin Hub 01: Error reading default academic year', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Academic Year & Semester Persistence and Event Dispatch
  // ---------------------------------------------------------------------------
  try {
    let eventFired = false;
    const handler = () => {
      eventFired = true;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('smart_absensi_academic_year_changed', handler);
    }

    AdministrationRepository.setActiveAcademicYear('2025/2026');
    AdministrationRepository.setActiveSemester('GENAP');

    const updatedYear = AdministrationRepository.getActiveAcademicYear();
    const updatedSem = AdministrationRepository.getActiveSemester();

    // Revert back to 2026/2027 and GANJIL
    AdministrationRepository.setActiveAcademicYear('2026/2027');
    AdministrationRepository.setActiveSemester('GANJIL');

    if (typeof window !== 'undefined') {
      window.removeEventListener('smart_absensi_academic_year_changed', handler);
    }

    assert(
      'Admin Hub 02: setActiveAcademicYear and setActiveSemester persist and trigger change event',
      updatedYear === '2025/2026' && updatedSem === 'GENAP' && (typeof window === 'undefined' || eventFired),
      `Updated year: ${updatedYear}, sem: ${updatedSem}, eventFired: ${eventFired}`
    );
  } catch (err: any) {
    assert('Admin Hub 02: Error setting academic year', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Default Modules Retrieval & Ujian Inclusions
  // ---------------------------------------------------------------------------
  try {
    const modules = AdministrationRepository.getModules(testUserId, '2026/2027');
    const examCorrection = modules.find((m) => m.id === 'exam_correction');
    const examCards = modules.find((m) => m.id === 'exam_cards');

    assert(
      'Admin Hub 03: Retrieves default modules including Koreksi Lembar Ujian and Kartu Ujian',
      modules.length >= 10 && Boolean(examCorrection) && Boolean(examCards),
      `Total modules: ${modules.length}, hasCorrection: ${Boolean(examCorrection)}, hasCards: ${Boolean(examCards)}`
    );
  } catch (err: any) {
    assert('Admin Hub 03: Error retrieving default modules', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Module Visibility Toggling
  // ---------------------------------------------------------------------------
  try {
    AdministrationRepository.toggleModule(testUserId, '2026/2027', 'exam_cards', false);
    const modulesAfterDisable = AdministrationRepository.getModules(testUserId, '2026/2027');
    const cardModule = modulesAfterDisable.find((m) => m.id === 'exam_cards');

    assert(
      'Admin Hub 04: toggleModule successfully disables module visibility',
      cardModule?.isEnabled === false,
      `Module isEnabled: ${cardModule?.isEnabled}`
    );

    // Toggle back
    AdministrationRepository.toggleModule(testUserId, '2026/2027', 'exam_cards', true);
  } catch (err: any) {
    assert('Admin Hub 04: Error toggling module', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Custom Module Creation & Deletion
  // ---------------------------------------------------------------------------
  try {
    const newCustom = {
      title: 'Portal CBT Ujian Sekolah',
      category: 'UJIAN' as const,
      description: 'Aplikasi CBT ujian online berbasis web browser',
      icon: '💻',
      colorClass: 'from-[#023246] to-[#18536B]',
      actionId: 'custom_link',
      customUrl: 'https://cbt.smp-terpadu.sch.id',
      isEnabled: true,
    };

    const modulesWithCustom = AdministrationRepository.addCustomModule(testUserId, '2026/2027', newCustom);
    const addedItem = modulesWithCustom.find((m) => m.title === 'Portal CBT Ujian Sekolah');

    const addedOk = Boolean(addedItem && addedItem.id.startsWith('custom_') && addedItem.customUrl === newCustom.customUrl);

    if (addedItem) {
      AdministrationRepository.removeCustomModule(testUserId, '2026/2027', addedItem.id);
    }

    const modulesAfterDelete = AdministrationRepository.getModules(testUserId, '2026/2027');
    const deletedOk = !modulesAfterDelete.some((m) => m.title === 'Portal CBT Ujian Sekolah');

    assert(
      'Admin Hub 05: addCustomModule and removeCustomModule manage custom tools seamlessly',
      addedOk && deletedOk,
      `addedOk: ${addedOk}, deletedOk: ${deletedOk}`
    );
  } catch (err: any) {
    assert('Admin Hub 05: Error handling custom module', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Reset to System Defaults
  // ---------------------------------------------------------------------------
  try {
    AdministrationRepository.toggleModule(testUserId, '2026/2027', 'teaching_materials', false);
    const resetList = AdministrationRepository.resetToDefault(testUserId, '2026/2027');
    const matModule = resetList.find((m) => m.id === 'teaching_materials');

    assert(
      'Admin Hub 06: resetToDefault restores all modules to default enabled state',
      resetList.length === DEFAULT_ADMINISTRATION_MODULES.length && matModule?.isEnabled === true,
      `Length: ${resetList.length}, materials isEnabled: ${matModule?.isEnabled}`
    );
  } catch (err: any) {
    assert('Admin Hub 06: Error resetting modules', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Quick Icons Integration in Guru Menu
  // ---------------------------------------------------------------------------
  try {
    const adminQuickIcon = ALL_QUICK_ICONS.find((icon) => icon.id === 'administrasi');

    assert(
      'Admin Hub 07: ALL_QUICK_ICONS includes "administrasi" icon item for Guru Menu',
      Boolean(adminQuickIcon && adminQuickIcon.title === 'Administrasi'),
      `Found: ${JSON.stringify(adminQuickIcon?.title)}`
    );
  } catch (err: any) {
    assert('Admin Hub 07: Error verifying ALL_QUICK_ICONS', false, err?.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Academic Year Isolation
  // ---------------------------------------------------------------------------
  try {
    // Disable in 2025/2026
    AdministrationRepository.toggleModule(testUserId, '2025/2026', 'exam_schedule', false);

    const mods2025 = AdministrationRepository.getModules(testUserId, '2025/2026');
    const mods2026 = AdministrationRepository.getModules(testUserId, '2026/2027');

    const sched2025 = mods2025.find((m) => m.id === 'exam_schedule');
    const sched2026 = mods2026.find((m) => m.id === 'exam_schedule');

    assert(
      'Admin Hub 08: Module customizations in one academic year do not leak into another',
      sched2025?.isEnabled === false && sched2026?.isEnabled === true,
      `2025 isEnabled: ${sched2025?.isEnabled}, 2026 isEnabled: ${sched2026?.isEnabled}`
    );
  } catch (err: any) {
    assert('Admin Hub 08: Error testing academic year isolation', false, err?.message);
  }

  return { passed, failed, results };
};
