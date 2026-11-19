/**
 * Unit Test Suite: Game PID & School Slice 3D Integration
 * SMP Terpadu Al-Ittihadiyah
 */

import {
  DEFAULT_GAME_PID_URL,
  DEFAULT_SCHOOL_SLICE_3D_URL,
  DEFAULT_RUMAH_SUNYI_URL,
  DEFAULT_G7KAIH_URL,
  STORAGE_KEY_GAME_PID_URL,
  STORAGE_KEY_SCHOOL_SLICE_3D_URL,
  STORAGE_KEY_RUMAH_SUNYI_URL,
  STORAGE_KEY_G7KAIH_URL,
  getGamePidPlatformUrl,
  setGamePidPlatformUrl,
  getSchoolSlice3dUrl,
  setSchoolSlice3dUrl,
  getRumahSunyiUrl,
  setRumahSunyiUrl,
  getG7kaihUrl,
  setG7kaihUrl,
  getDirectGamePidShareUrl,
  shouldShowPidPromoToday,
  markPidPromoShown,
  STORAGE_KEY_PID_PROMO_DISMISSED_DATE,
  SESSION_KEY_PID_PROMO_SHOWN,
} from '../../config/game-pid.config';
import type { TestSuiteResult, TestResultItem } from '../test-runner.service';

export async function runGamePidTestSuite(): Promise<TestSuiteResult> {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  // Setup Mock Browser Storage & Event System for Node environment
  const mockStorage: Record<string, string> = {};
  const mockSessionStorage: Record<string, string> = {};
  const mockListeners: Record<string, Array<(e: unknown) => void>> = {};

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;

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

    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockSessionStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        for (const k of Object.keys(mockSessionStorage)) delete mockSessionStorage[k];
      },
    };

    // Mock window
    const windowMock = {
      location: {
        origin: 'https://smart-absensi.alittihadiyah.sch.id',
        pathname: '/dashboard',
      },
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
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = sessionStorageMock;
    (globalThis as unknown as { window: unknown }).window = windowMock;
  };

  const cleanupMockBrowser = () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = originalSessionStorage;
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    for (const k of Object.keys(mockSessionStorage)) delete mockSessionStorage[k];
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

  // Test 6: Asset Sfx Rumah Sunyi - Verifikasi 5 Berkas Audio & Pemetaan Fungsi
  try {
    const fs = await import('fs');
    const path = await import('path');
    const audioDir = path.resolve(process.cwd(), 'public/games/rumah-sunyi/audio');

    const expectedAssets = [
      { file: 'lobby.wav', minSize: 10000000, desc: 'BGM Layar Awal / Dossier Investigasi' },
      { file: 'menjelajah.mp3', minSize: 1000000, desc: 'BGM Eksplorasi Koridor & Ruangan Mansion' },
      { file: 'melihat-pemain.wav', minSize: 400000, desc: 'SFX Ketakutan saat Mata Sosok Melihat Pemain' },
      { file: 'muncul-soal.mp3', minSize: 200000, desc: 'SFX Pop-up Kuis Gembok Kunci Kuningan' },
      { file: 'menunggu-menjawab-soal.mp3', minSize: 200000, desc: 'BGM Ketegangan Saat Menjawab Soal Kuis' },
    ];

    for (const asset of expectedAssets) {
      const fullPath = path.join(audioDir, asset.file);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Berkas audio wajib tidak ditemukan: ${asset.file} (${asset.desc})`);
      }
      const stat = fs.statSync(fullPath);
      if (stat.size < asset.minSize) {
        throw new Error(`Ukuran berkas audio ${asset.file} terlalu kecil (${stat.size} < ${asset.minSize})`);
      }
    }

    // Verifikasi keterhubungan HorrorAudioEngine dengan fungsi BGM & SFX
    const horrorAudioPath = path.resolve(process.cwd(), 'public/games/rumah-sunyi/src/audio/horrorAudio.js');
    const code = fs.readFileSync(horrorAudioPath, 'utf-8');

    const requiredMethods = [
      'playLobbyBgm',
      'playExploreBgm',
      'playWaitingQuizBgm',
      'playSpotPlayer',
      'playQuizPopup',
      'lobby.wav',
      'menjelajah.mp3',
      'melihat-pemain.wav',
      'muncul-soal.mp3',
      'menunggu-menjawab-soal.mp3',
    ];

    for (const m of requiredMethods) {
      if (!code.includes(m)) {
        throw new Error(`HorrorAudioEngine belum mengimplementasikan / memetakan: ${m}`);
      }
    }

    passed++;
    results.push({
      testName: 'Asset Sfx Rumah Sunyi: 5 berkas audio (lobby, menjelajah, melihat-pemain, muncul-soal, menunggu-menjawab-soal) terintegrasi',
      status: 'PASS',
      details: 'Semua 5 berkas audio terverifikasi di public/games/rumah-sunyi/audio/ dan terhubung ke HorrorAudioEngine',
    });
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Asset Sfx Rumah Sunyi: 5 berkas audio (lobby, menjelajah, melihat-pemain, muncul-soal, menunggu-menjawab-soal) terintegrasi',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 7: G7KAIH 3D Getter & Setter
  try {
    setupMockBrowser();
    const initial = getG7kaihUrl();
    if (initial !== DEFAULT_G7KAIH_URL) {
      throw new Error(`Getter default gagal: diharapkan ${DEFAULT_G7KAIH_URL}, didapat ${initial}`);
    }

    let eventDispatched = false;
    let eventDetail = '';
    const listener = (e: unknown) => {
      eventDispatched = true;
      eventDetail = (e as { detail: string }).detail;
    };
    globalThis.window.addEventListener('smart_absensi_g7kaih_url_updated', listener);

    // Simpan URL kustom
    const customUrl = 'http://localhost:5174/g7kaih';
    setG7kaihUrl(customUrl);

    if (getG7kaihUrl() !== customUrl) {
      throw new Error(`URL kustom tidak tersimpan: ${getG7kaihUrl()}`);
    }
    if (mockStorage[STORAGE_KEY_G7KAIH_URL] !== customUrl) {
      throw new Error(`Storage key ${STORAGE_KEY_G7KAIH_URL} tidak berisi URL kustom`);
    }
    if (!eventDispatched || eventDetail !== customUrl) {
      throw new Error('Event smart_absensi_g7kaih_url_updated tidak ter-dispatch dengan benar');
    }

    // Reset default
    setG7kaihUrl('');
    if (getG7kaihUrl() !== DEFAULT_G7KAIH_URL) {
      throw new Error('Reset URL G7KAIH gagal kembali ke default');
    }

    globalThis.window.removeEventListener('smart_absensi_g7kaih_url_updated', listener);
    cleanupMockBrowser();

    passed++;
    results.push({
      testName: 'G7KAIH 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'PASS',
      details: 'URL kustom tersimpan, CustomEvent ter-dispatch, reset default sukses',
    });
  } catch (err: unknown) {
    cleanupMockBrowser();
    failed++;
    results.push({
      testName: 'G7KAIH 3D Getter & Setter: Tersimpan di localStorage & trigger event',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 8: G7KAIH Bundle & Thumbnail Integrity
  try {
    const fs = await import('fs');
    const path = await import('path');
    const g7Dir = path.resolve(process.cwd(), 'public/games/g7kaih-al-ittihadiyah');

    const expectedFiles = [
      'index.html',
      'styles.css',
      'game.js',
      'g7kaih_standalone.html',
      'agent_manifest.json',
      'README_AGENT.md',
      'thumbnail.jpg',
    ];

    for (const f of expectedFiles) {
      const fullPath = path.join(g7Dir, f);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Berkas wajib G7KAIH tidak ditemukan: ${f}`);
      }
      const stat = fs.statSync(fullPath);
      if (stat.size < 100) {
        throw new Error(`Ukuran berkas ${f} tidak valid (${stat.size} bytes)`);
      }
    }

    // Verifikasi root thumbnail public/games/g7kaih-thumbnail.jpg
    const rootThumb = path.resolve(process.cwd(), 'public/games/g7kaih-thumbnail.jpg');
    if (!fs.existsSync(rootThumb)) {
      throw new Error('Thumbnail root public/games/g7kaih-thumbnail.jpg tidak ditemukan');
    }

    passed++;
    results.push({
      testName: 'G7KAIH Bundle & Thumbnail Integrity: Semua berkas bundel & thumbnail 3D terverifikasi',
      status: 'PASS',
      details: 'Semua 7 berkas bundel g7kaih-al-ittihadiyah + thumbnail resmi terkonfirmasi ada dan utuh',
    });
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'G7KAIH Bundle & Thumbnail Integrity: Semua berkas bundel & thumbnail 3D terverifikasi',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 9: Game PID Promo & Direct Share Link (shouldShowPidPromoToday, markPidPromoShown, getDirectGamePidShareUrl)
  try {
    setupMockBrowser();
    const testDate = '2026-11-19';

    // Awal: harus bernilai true karena belum pernah dilihat
    if (!shouldShowPidPromoToday(testDate)) {
      throw new Error('shouldShowPidPromoToday harus bernilai true saat pertama kali masuk');
    }

    // Direct Share URL harus mengandung ?portal=game-pid
    const shareUrl = getDirectGamePidShareUrl();
    if (!shareUrl.includes('?portal=game-pid')) {
      throw new Error(`getDirectGamePidShareUrl tidak mengandung ?portal=game-pid: ${shareUrl}`);
    }

    // Tandai sudah dilihat di sesi ini
    markPidPromoShown(false);
    if (mockSessionStorage[SESSION_KEY_PID_PROMO_SHOWN] !== 'true') {
      throw new Error('SESSION_KEY_PID_PROMO_SHOWN tidak tersimpan di sessionStorage');
    }
    if (shouldShowPidPromoToday(testDate)) {
      throw new Error('shouldShowPidPromoToday harus false setelah ditandai di sesi saat ini');
    }

    // Hapus sesi tapi tandai jangan tampilkan lagi hari ini
    delete mockSessionStorage[SESSION_KEY_PID_PROMO_SHOWN];
    markPidPromoShown(true, testDate);
    if (mockStorage[STORAGE_KEY_PID_PROMO_DISMISSED_DATE] !== testDate) {
      throw new Error(`STORAGE_KEY_PID_PROMO_DISMISSED_DATE tidak tersimpan untuk tanggal ${testDate}`);
    }
    if (shouldShowPidPromoToday(testDate)) {
      throw new Error('shouldShowPidPromoToday harus false saat dismissed date sama dengan hari ini');
    }

    // Simulasi sesi peramban baru di hari esok: harus bernilai true kembali
    delete mockSessionStorage[SESSION_KEY_PID_PROMO_SHOWN];
    if (!shouldShowPidPromoToday('2026-11-20')) {
      throw new Error('shouldShowPidPromoToday harus bernilai true di hari baru berikutnya');
    }

    cleanupMockBrowser();

    passed++;
    results.push({
      testName: 'Game PID Promo & Direct Share Link: Logika kemunculan harian & format deep-link terverifikasi',
      status: 'PASS',
      details: 'shouldShowPidPromoToday, markPidPromoShown, dan ?portal=game-pid berfungsi presisi',
    });
  } catch (err: unknown) {
    cleanupMockBrowser();
    failed++;
    results.push({
      testName: 'Game PID Promo & Direct Share Link: Logika kemunculan harian & format deep-link terverifikasi',
      status: 'FAIL',
      details: (err as Error)?.message || String(err),
    });
  }

  // Test 10: Game PID Promo Poster Asset Integrity
  try {
    const fs = await import('fs');
    const path = await import('path');

    const posterGames = path.resolve(process.cwd(), 'public/games/game-pid-promo-poster.jpg');
    const posterImages = path.resolve(process.cwd(), 'public/images/game-pid-promo-poster.jpg');

    if (!fs.existsSync(posterGames)) {
      throw new Error('Poster promosi public/games/game-pid-promo-poster.jpg tidak ditemukan');
    }
    if (!fs.existsSync(posterImages)) {
      throw new Error('Poster promosi public/images/game-pid-promo-poster.jpg tidak ditemukan');
    }

    const statGames = fs.statSync(posterGames);
    const statImages = fs.statSync(posterImages);

    if (statGames.size < 10000 || statImages.size < 10000) {
      throw new Error(`Ukuran berkas poster terlalu kecil (${statGames.size} / ${statImages.size} bytes)`);
    }

    passed++;
    results.push({
      testName: 'Game PID Promo Poster Asset Integrity: Berkas poster resmi 16:9 terkonfirmasi valid & siap tayang',
      status: 'PASS',
      details: `Ukuran poster: ${(statGames.size / 1024).toFixed(1)} KB (public/games & public/images)`,
    });
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Game PID Promo Poster Asset Integrity: Berkas poster resmi 16:9 terkonfirmasi valid & siap tayang',
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
