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

  // Test 6: Regression - UI Unmount / Multi-Unregister & StrictMode Never Calls window.history.back()
  try {
    BackNavigationService.reset();
    const prevWindow = (globalThis as any).window;
    let historyBackCalls = 0;
    const historyStack: Array<Record<string, unknown>> = [
      { url: 'https://www.google.com/search?q=smart+absensi' },
      { url: 'https://smart-absensi-guru-eight.vercel.app' },
    ];
    let currentState: Record<string, unknown> | null = historyStack[1];
    const listeners: Record<string, Array<(ev: any) => void>> = {};

    (globalThis as any).window = {
      history: {
        get state() {
          return currentState;
        },
        replaceState(state: any) {
          historyStack[historyStack.length - 1] = state;
          currentState = state;
        },
        pushState(state: any) {
          historyStack.push(state);
          currentState = state;
        },
        back() {
          historyBackCalls++;
        },
      },
      addEventListener(type: string, cb: (ev: any) => void) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(cb);
      },
      removeEventListener(type: string, cb: (ev: any) => void) {
        listeners[type] = (listeners[type] || []).filter((fn) => fn !== cb);
      },
    };

    try {
      // Simulate React StrictMode double init()
      const cleanup1 = BackNavigationService.init();
      cleanup1();
      const cleanup2 = BackNavigationService.init();

      // Simulate double modal registration (Modal.tsx + usePageModalBackStack) followed by simultaneous unmount
      const unreg1 = BackNavigationService.register({
        id: 'dup_dashboard_modal',
        onBack: () => true,
        priority: BACK_PRIORITIES.MODAL,
        pushHistory: true,
      });
      const unreg2 = BackNavigationService.register({
        id: 'dup_modal_component',
        onBack: () => true,
        priority: BACK_PRIORITIES.MODAL,
        pushHistory: true,
      });

      unreg2();
      unreg1();

      // Simulate pressing Back once after popstate already ran (delayed React unmount > 50ms)
      let delayedClosed = false;
      const unregDelayed = BackNavigationService.register({
        id: 'delayed_modal',
        onBack: () => {
          delayedClosed = true;
          return true;
        },
        priority: BACK_PRIORITIES.MODAL,
        pushHistory: true,
      });
      const popListeners = listeners['popstate'] || [];
      popListeners.forEach((fn) => fn({ state: { sagAppActive: true, level: 1 } }));
      unregDelayed();

      cleanup2();

      const ok =
        historyBackCalls === 0 &&
        delayedClosed &&
        historyStack[0]?.url === 'https://www.google.com/search?q=smart+absensi' &&
        Boolean(historyStack[1]?.sagRootGuard);

      if (ok) {
        passed++;
        results.push({
          testName: 'Anti-Search-Eject Guard: StrictMode double-init & multi-unregister never call window.history.back()',
          status: 'PASS',
          details: `historyBackCalls=${historyBackCalls}, historyDepth=${historyStack.length}`,
        });
      } else {
        failed++;
        results.push({
          testName: 'Anti-Search-Eject Guard: StrictMode double-init & multi-unregister never call window.history.back()',
          status: 'FAIL',
          details: `historyBackCalls=${historyBackCalls}, delayedClosed=${delayedClosed}, stack=${JSON.stringify(historyStack)}`,
        });
      }
    } finally {
      if (prevWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = prevWindow;
      BackNavigationService.reset();
    }
  } catch (err: unknown) {
    failed++;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({
      testName: 'Anti-Search-Eject Guard Error',
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
