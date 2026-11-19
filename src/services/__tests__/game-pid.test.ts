/**
 * Unit Test Suite: Game PID & School Slice 3D Integration
 * SMP Terpadu Al-Ittihadiyah
 */

import {
  DEFAULT_GAME_PID_URL,
  DEFAULT_SCHOOL_SLICE_3D_URL,
  DEFAULT_RUMAH_SUNYI_URL,
  STORAGE_KEY_GAME_PID_URL,
  STORAGE_KEY_SCHOOL_SLICE_3D_URL,
  STORAGE_KEY_RUMAH_SUNYI_URL,
  getGamePidPlatformUrl,
  setGamePidPlatformUrl,
  getSchoolSlice3dUrl,
  setSchoolSlice3dUrl,
  getRumahSunyiUrl,
  setRumahSunyiUrl,
} from '../../config/game-pid.config';
import type { TestSuiteResult, TestResultItem } from '../test-runner.service';

export async function runGamePidTestSuite(): Promise<TestSuiteResult> {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  // Setup Mock Browser Storage & Event System for Node environment
  const mockStorage: Record<string, string> = {};
  const mockListeners: Record<string, Array<(e: unknown) => void>> = {};

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  const setupMockBrowser = () => {
    // Mock localStorage
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      },
    };

    // Mock window
    const windowMock = {
      addEventListener: (type: string, listener: (e: unknown) => void) => {
        if (!mockListeners[type]) mockListeners[type] = [];
        mockListeners[type].push(listener);
      },
      removeEventListener: (type: string, listener: (e: unknown) => void) => {
        if (mockListeners[type]) {
          mockListeners[type] = mockListeners[type].filter((l) => l !== listener);
        }
      },
      dispatchEvent: (event: { type: string; detail?: unknown }) => {
        const listeners = mockListeners[event.type] || [];
        for (const l of listeners) l(event);
        return true;
      },
    };

    // Inject into globalThis
    (globalThis as unknown as { localStorage: unknown }).localStorage = storageMock;
    (globalThis as unknown as { window: unknown }).window = windowMock;
  };

  const cleanupMockBrowser = () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    for (const k of Object.keys(mockListeners)) delete mockListeners[k];
  };

  // Test 1: Default URLs validity
  try {
    if (!DEFAULT_GAME_PID_URL.startsWith('https://')) {
      throw new Error(`DEFAULT_GAME_PID_URL tidak valid: ${DEFAULT_GAME_PID_URL}`);
    }
    if (!DEFAULT_SCHOOL_SLICE_3D_URL.startsWith('/') && !DEFAULT_SCHOOL_SLICE_3D_URL.startsWith('https://')) {
      throw new Error(`DEFAULT_SCHOOL_SLICE_3D_URL tidak valid: ${DEFAULT_SCHOOL_SLICE_3D_URL}`);
    }
    if (!DEFAULT_SCHOOL_SLICE_3D_URL.includes('school-slice-3d')) {
      throw new Error('DEFAULT_SCHOOL_SLICE_3D_URL tidak mengarah ke school slice');
    }

    passed++;
    results.push({
      testName: 'Default URLs: URL default Game PID & School Slice 3D terkonfigurasi resmi',
      status: 'PASS',
      details: `${DEFAULT_SCHOOL_SLICE_3D_URL} & ${DEFAULT_GAME_PID_URL}`,
    });
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Default URLs: URL default Game PID & School Slice 3D terkonfigurasi resmi',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 2: Game PID Platform Getter & Setter
  try {
    setupMockBrowser();
    const initial = getGamePidPlatformUrl();
    if (initial !== DEFAULT_GAME_PID_URL) {
      throw new Error(`Getter default gagal: diharapkan ${DEFAULT_GAME_PID_URL}, didapat ${initial}`);
    }

    let eventDispatched = false;
    let eventDetail = '';
    const listener = (e: unknown) => {
      eventDispatched = true;
      eventDetail = (e as { detail: string }).detail;
    };
    globalThis.window.addEventListener('smart_absensi_game_pid_url_updated', listener);

    const testUrl = 'https://nawasena-staging.vercel.app';
    setGamePidPlatformUrl(testUrl);
    if (getGamePidPlatformUrl() !== testUrl || mockStorage[STORAGE_KEY_GAME_PID_URL] !== testUrl) {
      throw new Error(`Getter tidak mengembalikan URL kustom: didapat ${getGamePidPlatformUrl()}`);
    }
    if (!eventDispatched || eventDetail !== testUrl) {
      throw new Error('CustomEvent smart_absensi_game_pid_url_updated tidak ter-dispatch');
    }

    // Reset URL
    setGamePidPlatformUrl('');
    if (getGamePidPlatformUrl() !== DEFAULT_GAME_PID_URL) {
      throw new Error('Reset URL gagal kembali ke default');
    }

    globalThis.window.removeEventListener('smart_absensi_game_pid_url_updated', listener);
    cleanupMockBrowser();

    passed++;
    results.push({
      testName: 'Game PID Platform Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'PASS',
      details: 'URL kustom tersimpan, CustomEvent ter-dispatch, reset default sukses',
    });
  } catch (err: unknown) {
    cleanupMockBrowser();
    failed++;
    results.push({
      testName: 'Game PID Platform Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 3: School Slice 3D Getter & Setter
  try {
    setupMockBrowser();
    const initial = getSchoolSlice3dUrl();
    if (initial !== DEFAULT_SCHOOL_SLICE_3D_URL) {
      throw new Error(`Getter default 3D gagal: diharapkan ${DEFAULT_SCHOOL_SLICE_3D_URL}, didapat ${initial}`);
    }

    let eventDispatched = false;
    let eventDetail = '';
    const listener = (e: unknown) => {
      eventDispatched = true;
      eventDetail = (e as { detail: string }).detail;
    };
    globalThis.window.addEventListener('smart_absensi_school_slice_3d_url_updated', listener);

    const localhostUrl = 'http://localhost:5173';
    setSchoolSlice3dUrl(localhostUrl);
    if (getSchoolSlice3dUrl() !== localhostUrl || mockStorage[STORAGE_KEY_SCHOOL_SLICE_3D_URL] !== localhostUrl) {
      throw new Error(`Getter tidak mengembalikan URL lokal 3D: didapat ${getSchoolSlice3dUrl()}`);
    }
    if (!eventDispatched || eventDetail !== localhostUrl) {
      throw new Error('CustomEvent smart_absensi_school_slice_3d_url_updated tidak ter-dispatch');
    }

    // Reset URL ke default
    setSchoolSlice3dUrl('');
    if (getSchoolSlice3dUrl() !== DEFAULT_SCHOOL_SLICE_3D_URL) {
      throw new Error('Reset URL 3D gagal kembali ke default');
    }

    // Auto-migration test: Tautan Vercel 404 lama dibersihkan otomatis ke bundle internal
    mockStorage[STORAGE_KEY_SCHOOL_SLICE_3D_URL] = 'https://school-slice-3d.vercel.app';
    if (getSchoolSlice3dUrl() !== DEFAULT_SCHOOL_SLICE_3D_URL) {
      throw new Error('Migrasi otomatis URL 404 lama gagal kembali ke default');
    }
    if (mockStorage[STORAGE_KEY_SCHOOL_SLICE_3D_URL]) {
      throw new Error('Key URL 404 lama belum terhapus dari storage');
    }

    globalThis.window.removeEventListener('smart_absensi_school_slice_3d_url_updated', listener);
    cleanupMockBrowser();

    passed++;
    results.push({
      testName: 'School Slice 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'PASS',
      details: 'Localhost port 5173 tersimpan, CustomEvent ter-dispatch, reset default sukses',
    });
  } catch (err: unknown) {
    cleanupMockBrowser();
    failed++;
    results.push({
      testName: 'School Slice 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 4: CSV Question Bank Schema Validation
  try {
    const sampleCsv = `npcName,npcRole,storyIntro,question,optionA,optionB,optionC,optionD,correctIndex,explanation
Pak Budi (Guru TIK),Guru Informatika,Selamat pagi!,Langkah logis untuk memecahkan masalah?,Algoritma,Perangkat Keras,Jaringan,Basis Data,0,Algoritma adalah langkah logis.
Siti (Ketua Kelas),Teman Sebangku,Hai kawan!,Perangkat masukan komputer?,Monitor,Printer,Keyboard,Speaker,2,Keyboard adalah perangkat masukan.`;

    const lines = sampleCsv.trim().split('\n');
    const header = lines[0].split(',').map((c) => c.trim());
    const expectedColumns = [
      'npcName',
      'npcRole',
      'storyIntro',
      'question',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctIndex',
      'explanation',
    ];

    if (header.length !== 10) {
      throw new Error(`Jumlah kolom header tidak sesuai: ${header.length} (harus 10)`);
    }

    for (let i = 0; i < expectedColumns.length; i++) {
      if (header[i] !== expectedColumns[i]) {
        throw new Error(`Kolom ke-${i} tidak cocok: ${header[i]} vs ${expectedColumns[i]}`);
      }
    }

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      if (cells.length !== 10) {
        throw new Error(`Baris ${i} memiliki ${cells.length} kolom, diharapkan 10`);
      }
      const correctIdx = parseInt(cells[8], 10);
      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) {
        throw new Error(`correctIndex tidak valid pada baris ${i}: ${cells[8]} (harus 0-3)`);
      }
    }

    passed++;
    results.push({
      testName: 'CSV Question Bank Schema: Validasi format 10 kolom bank soal School Slice 3D',
      status: 'PASS',
      details: '10 header terverifikasi: npcName, npcRole, storyIntro, question, optionA..D, correctIndex, explanation',
    });
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'CSV Question Bank Schema: Validasi format 10 kolom bank soal School Slice 3D',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 5: Rumah Sunyi: Tiga Kunci 3D Getter & Setter
  try {
    setupMockBrowser();
    const initial = getRumahSunyiUrl();
    if (initial !== DEFAULT_RUMAH_SUNYI_URL) {
      throw new Error(`Getter default Rumah Sunyi gagal: diharapkan ${DEFAULT_RUMAH_SUNYI_URL}, didapat ${initial}`);
    }

    let eventDispatched = false;
    let eventDetail = '';
    const listener = (e: unknown) => {
      eventDispatched = true;
      eventDetail = (e as { detail: string }).detail;
    };
    globalThis.window.addEventListener('smart_absensi_rumah_sunyi_url_updated', listener);

    const customUrl = '/games/rumah-sunyi/index.html?diff=normal';
    setRumahSunyiUrl(customUrl);
    if (getRumahSunyiUrl() !== customUrl || mockStorage[STORAGE_KEY_RUMAH_SUNYI_URL] !== customUrl) {
      throw new Error(`Getter tidak mengembalikan URL kustom: didapat ${getRumahSunyiUrl()}`);
    }
    if (!eventDispatched || eventDetail !== customUrl) {
      throw new Error('CustomEvent smart_absensi_rumah_sunyi_url_updated tidak ter-dispatch');
    }

    // Reset URL ke default
    setRumahSunyiUrl('');
    if (getRumahSunyiUrl() !== DEFAULT_RUMAH_SUNYI_URL) {
      throw new Error('Reset URL Rumah Sunyi gagal kembali ke default');
    }

    globalThis.window.removeEventListener('smart_absensi_rumah_sunyi_url_updated', listener);
    cleanupMockBrowser();

    passed++;
    results.push({
      testName: 'Rumah Sunyi 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'PASS',
      details: 'URL kustom tersimpan, CustomEvent ter-dispatch, reset default sukses',
    });
  } catch (err: unknown) {
    cleanupMockBrowser();
    failed++;
    results.push({
      testName: 'Rumah Sunyi 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  return {
    suiteName: 'Game PID & School Slice 3D Integration Test Suite',
    passed,
    failed,
    results,
  };
}
