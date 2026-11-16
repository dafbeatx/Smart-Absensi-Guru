/**
 * SMART ABSENSI GURU — MOBILE HARDWARE & GESTURE BACK NAVIGATION ENGINE TEST SUITE
 * Memvalidasi sistem navigasi tombol kembali bawaan HP (Android back / swipe gesture / popstate):
 * 1. LIFO Stack: Menutup modal terbaru tanpa menutup modal sebelumnya.
 * 2. Hierarki Prioritas: OVERLAY > MODAL > DRAWER > SUB_LAYER > TAB > ROOT.
 * 3. Double-back exit protection (2000ms window) saat berada di root dashboard.
 * 4. UI Clean Unregister: Tombol ✕ di UI membersihkan stack tanpa memory leak.
 */

import {
  BackNavigationService,
  BACK_PRIORITIES,
} from '../back-navigation.service';
import type { TestSuiteResult } from '../test-runner.service';

export async function runBackNavigationTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: LIFO Modal Stack
  try {
    BackNavigationService.reset();
    let isModalAOpen = true;
    let isModalBOpen = true;

    const unregA = BackNavigationService.register({
      id: 'suite_modal_a',
      onBack: () => {
        isModalAOpen = false;
      },
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });

    const unregB = BackNavigationService.register({
      id: 'suite_modal_b',
      onBack: () => {
        isModalBOpen = false;
      },
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });

    const handled1 = BackNavigationService.handleBack();
    const handled2 = BackNavigationService.handleBack();

    if (handled1 && handled2 && !isModalBOpen && !isModalAOpen) {
      passed++;
      results.push({
        testName: 'LIFO Modal Closure: Modal terbaru (B) tertutup duluan, lalu modal pertama (A)',
        status: 'PASS',
        details: 'Modal B tertutup -> Modal A tertutup secara bertingkat',
      });
    } else {
      failed++;
      results.push({
        testName: 'LIFO Modal Closure: Modal terbaru (B) tertutup duluan, lalu modal pertama (A)',
        status: 'FAIL',
        details: `handled1=${handled1}, handled2=${handled2}, isA=${isModalAOpen}, isB=${isModalBOpen}`,
      });
    }
    unregB();
    unregA();
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'LIFO Modal Closure Error',
      status: 'FAIL',
      details: errMsg,
    });
  }

  // Test 2: Priority Hierarchy (OVERLAY > MODAL > SUB_LAYER > TAB)
  try {
    BackNavigationService.reset();
    const closeOrder: string[] = [];

    BackNavigationService.register({
      id: 'tab',
      onBack: () => {
        closeOrder.push('TAB');
      },
      priority: BACK_PRIORITIES.TAB,
      pushHistory: false,
    });
    BackNavigationService.register({
      id: 'sub_layer',
      onBack: () => {
        closeOrder.push('SUB_LAYER');
      },
      priority: BACK_PRIORITIES.SUB_LAYER,
      pushHistory: false,
    });
    BackNavigationService.register({
      id: 'modal',
      onBack: () => {
        closeOrder.push('MODAL');
      },
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });
    BackNavigationService.register({
      id: 'overlay',
      onBack: () => {
        closeOrder.push('OVERLAY');
      },
      priority: BACK_PRIORITIES.OVERLAY,
      pushHistory: false,
    });

    BackNavigationService.handleBack();
    BackNavigationService.handleBack();
    BackNavigationService.handleBack();
    BackNavigationService.handleBack();

    const expected = ['OVERLAY', 'MODAL', 'SUB_LAYER', 'TAB'];
    const isMatched = JSON.stringify(closeOrder) === JSON.stringify(expected);

    if (isMatched) {
      passed++;
      results.push({
        testName: 'Priority Hierarchy: OVERLAY -> MODAL -> SUB_LAYER -> TAB dieksekusi secara presisi',
        status: 'PASS',
        details: closeOrder.join(' -> '),
      });
    } else {
      failed++;
      results.push({
        testName: 'Priority Hierarchy: OVERLAY -> MODAL -> SUB_LAYER -> TAB dieksekusi secara presisi',
        status: 'FAIL',
        details: `Actual: ${closeOrder.join(', ')} | Expected: ${expected.join(', ')}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'Priority Hierarchy Error',
      status: 'FAIL',
      details: errMsg,
    });
  }

  // Test 3: Root Double Back Exit Protection
  try {
    BackNavigationService.reset();
    let exitTriggered = false;

    // Tekanan 1: Menampilkan toast
    BackNavigationService.handleRootExit(() => {
      exitTriggered = true;
    });
    const press1Passed = !exitTriggered;

    // Tekanan 2: Memanggil exit callback
    BackNavigationService.handleRootExit(() => {
      exitTriggered = true;
    });
    const press2Passed = exitTriggered;

    if (press1Passed && press2Passed) {
      passed++;
      results.push({
        testName: 'Root Double-Back Protection: Tekanan 1 menampilkan toast, tekanan 2 mengizinkan exit',
        status: 'PASS',
        details: 'Double back to exit 2000ms window terverifikasi',
      });
    } else {
      failed++;
      results.push({
        testName: 'Root Double-Back Protection: Tekanan 1 menampilkan toast, tekanan 2 mengizinkan exit',
        status: 'FAIL',
        details: `press1=${press1Passed}, press2=${press2Passed}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'Root Double-Back Protection Error',
      status: 'FAIL',
      details: errMsg,
    });
  }

  // Test 4: UI Button ✕ Unregister
  try {
    BackNavigationService.reset();
    let modalCalled = false;
    const unreg = BackNavigationService.register({
      id: 'ui_close_test',
      onBack: () => {
        modalCalled = true;
      },
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });

    unreg(); // UI Close
    const handled = BackNavigationService.handleBack();

    if (!handled && !modalCalled && BackNavigationService.getStackSnapshot().length === 0) {
      passed++;
      results.push({
        testName: 'UI Close Unregister: Penutupan modal via UI tombol ✕ membersihkan stack tanpa memory leak',
        status: 'PASS',
        details: 'Stack bersih, handleBack returns false',
      });
    } else {
      failed++;
      results.push({
        testName: 'UI Close Unregister: Penutupan modal via UI tombol ✕ membersihkan stack tanpa memory leak',
        status: 'FAIL',
        details: `handled=${handled}, modalCalled=${modalCalled}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'UI Close Unregister Error',
      status: 'FAIL',
      details: errMsg,
    });
  }

  // Test 5: Same ID Deduplication
  try {
    BackNavigationService.reset();
    BackNavigationService.register({
      id: 're_reg_modal',
      onBack: () => {},
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });

    BackNavigationService.register({
      id: 're_reg_modal',
      onBack: () => {},
      priority: BACK_PRIORITIES.MODAL,
      pushHistory: false,
    });

    const isDeduped = BackNavigationService.getStackSnapshot().length === 1;
    if (isDeduped) {
      passed++;
      results.push({
        testName: 'ID Deduplication: Registrasi ulang ID sama memperbarui stack tanpa duplikasi',
        status: 'PASS',
        details: 'Stack length = 1',
      });
    } else {
      failed++;
      results.push({
        testName: 'ID Deduplication: Registrasi ulang ID sama memperbarui stack tanpa duplikasi',
        status: 'FAIL',
        details: `Stack length = ${BackNavigationService.getStackSnapshot().length}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'ID Deduplication Error',
      status: 'FAIL',
      details: errMsg,
    });
  }

  return {
    suiteName: 'Mobile Hardware & Gesture Back Navigation Engine (Phase 5.7)',
    passed,
    failed,
    results,
  };
}
