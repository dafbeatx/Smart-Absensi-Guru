/**
 * SMART ABSENSI GURU - BARCODE ENGINE & STUDENT EXAM CARD GENERATOR TEST SUITE
 * Unit tests verifying JsBarcode integration, participant number formatting,
 * ISO/IEC 7810 ID-1 KTP size layout (85.6mm x 54mm), and SMP vs SMA segregation.
 */

import {
  BarcodeExamCardService,
  detectEducationLevel,
  filterStudentsByLevel,
  type StudentCardData,
  type ExamCardConfig,
} from '../../lib/barcode-exam-card.lib';

export const runBarcodeExamCardTestSuite = async (): Promise<{
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
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    const mockSmpStudents: StudentCardData[] = [
      {
        id: 'smp_001',
        nisn: '0081112221',
        nama: 'Ahmad Faiz Al-Ghifari',
        kelas: 'VII-A',
        ruang: 'Ruang 01',
      },
      {
        id: 'smp_002',
        nisn: '0081112222',
        nama: 'Bunga Citra Lestari',
        kelas: 'VII-A',
        ruang: 'Ruang 01',
      },
      {
        id: 'smp_003',
        nisn: '0081112223',
        nama: 'Chairul Tanjung Pratama',
        kelas: 'VIII-B',
        ruang: 'Ruang 02',
      },
      {
        id: 'smp_004',
        nisn: '0081112224',
        nama: 'Dinda Kirana Putri',
        kelas: 'IX-A',
        ruang: 'Ruang 03',
      },
    ];

    const mockSmaStudents: StudentCardData[] = [
      {
        id: 'sma_001',
        nisn: '0071234567',
        nama: 'Achmad Dani Pratama',
        kelas: 'XII MIPA 1',
        ruang: 'Ruang 04',
      },
      {
        id: 'sma_002',
        nisn: '0071234568',
        nama: 'Bella Novita Sari',
        kelas: 'XI IPS 2',
        ruang: 'Ruang 04',
      },
    ];

    const allStudents = [...mockSmpStudents, ...mockSmaStudents];

    // 1. Uji Deteksi Jenjang Pendidikan Otomatis (SMP vs SMA)
    assert(
      'Deteksi Jenjang: Rombel VII, VIII, IX dikenali sebagai SMP',
      detectEducationLevel('VII-A') === 'SMP' &&
      detectEducationLevel('Kelas 8-B') === 'SMP' &&
      detectEducationLevel('IX-A') === 'SMP',
      'Kelas SMP terdeteksi akurat'
    );

    assert(
      'Deteksi Jenjang: Rombel X, XI, XII dikenali sebagai SMA',
      detectEducationLevel('X-1') === 'SMA' &&
      detectEducationLevel('XI MIPA 1') === 'SMA' &&
      detectEducationLevel('Kelas XII IPS') === 'SMA',
      'Kelas SMA terdeteksi akurat'
    );

    // 2. Uji Isolasi & Pemisahan Siswa SMP vs SMA (Tidak Boleh Bercampur)
    const filteredSmp = filterStudentsByLevel(allStudents, 'SMP');
    const filteredSma = filterStudentsByLevel(allStudents, 'SMA');

    assert(
      'Pemisahan Jenjang: Filter jenjang SMP hanya mengembalikan siswa SMP (4 siswa)',
      filteredSmp.length === 4 && filteredSmp.every((s) => detectEducationLevel(s.kelas) === 'SMP'),
      `Total SMP: ${filteredSmp.length}`
    );

    assert(
      'Pemisahan Jenjang: Filter jenjang SMA hanya mengembalikan siswa SMA (2 siswa)',
      filteredSma.length === 2 && filteredSma.every((s) => detectEducationLevel(s.kelas) === 'SMA'),
      `Total SMA: ${filteredSma.length}`
    );

    // 3. Uji Pembuatan Format Nomor Peserta Ujian Nasional
    const generatedNo1 = BarcodeExamCardService.formatExamParticipantNumber('VII A', 1, '0081112221');
    assert(
      'Format Nomor Peserta Ujian: Padding urut 3 digit & kode rombel bersih',
      generatedNo1 === '01-026-VIIA-001-0081112221',
      `Hasil: ${generatedNo1}`
    );

    // 4. Uji Generator Barcode SVG (JsBarcode / Fallback)
    const barcodeSvg1 = BarcodeExamCardService.generateBarcodeSVG('0081112221');
    assert(
      'JsBarcode SVG Output: Berisi tag svg valid dan elemen batang barcode',
      barcodeSvg1.includes('<svg') && barcodeSvg1.includes('</svg>') && barcodeSvg1.includes('<rect'),
      'Barcode SVG siap render'
    );

    // 5. Uji Dokumen Cetak Kartu Ujian SMP (Ukuran KTP & Logo Resmi Hijau Al-Ittihadiyah)
    const smpConfig: ExamCardConfig = {
      level: 'SMP',
      namaUjian: 'ASESMEN SUMATIF AKHIR SEMESTER (ASAS) GANJIL',
      tahunAjaran: '2026/2027',
      semester: 'Ganjil',
      kepalaSekolah: 'H. Suherman, S.Ag., M.Pd.I.',
      nipKepalaSekolah: '197605122005011004',
      institutionAddress: 'Ciampea - Bogor',
    };

    const smpHtml = BarcodeExamCardService.generateExamCardsA4HTML(filteredSmp, smpConfig);

    assert(
      'Standar Ukuran KTP: Template memuat spesifikasi dimensi KTP presisi (85.6mm x 54mm)',
      smpHtml.includes('85.6mm') && smpHtml.includes('54mm'),
      'Dimensi KTP 85.6mm x 54mm terpasang di CSS'
    );

    assert(
      'Kop Resmi SMP: Memuat nama SMP TERPADU AL-ITTIHADIYAH dan Logo Resmi Hijau',
      smpHtml.includes('SMP TERPADU AL-ITTIHADIYAH') &&
      (smpHtml.includes('logo-box') || smpHtml.includes('data:image/png;base64')),
      'Kop kartu ujian memuat identitas resmi SMP Terpadu Al-Ittihadiyah'
    );

    assert(
      'Layout Cetak A4: Memuat grid 2 kolom dan garis potong (cut-guide ✂️)',
      smpHtml.includes('cut-guide') && smpHtml.includes('dashed') && smpHtml.includes('grid-template-columns'),
      'Grid cetak KTP dan garis gunting aktif'
    );

    assert(
      'Isolasi Data Siswa: Siswa SMA tidak bocor masuk ke lembar ujian SMP',
      !smpHtml.includes('Achmad Dani Pratama') && !smpHtml.includes('Bella Novita Sari'),
      'Siswa SMA terisolasi murni dari lembar ujian SMP'
    );

    // 6. Uji Dokumen Cetak Kartu Ujian SMA (Terpisah dengan Kop SMA Terpadu As Salaam)
    const smaConfig: ExamCardConfig = {
      level: 'SMA',
      namaUjian: 'PENILAIAN AKHIR TAHUN (PAT) GENAP',
      tahunAjaran: '2026/2027',
      semester: 'Genap',
    };

    const smaHtml = BarcodeExamCardService.generateExamCardsA4HTML(filteredSma, smaConfig);
    assert(
      'Kop Resmi SMA: Memuat nama SMA TERPADU AS SALAAM terpisah dari SMP',
      smaHtml.includes('SMA TERPADU AS SALAAM'),
      'Kop kartu ujian SMA terpasang'
    );

    // 7. Edge Case: List Siswa Kosong
    const emptyHtml = BarcodeExamCardService.generateExamCardsA4HTML([], smpConfig);
    assert(
      'Edge Case: Penanganan list siswa kosong aman tanpa crash',
      emptyHtml.includes('Tidak ada data') || emptyHtml.includes('html'),
      'Template kosong aman'
    );

  } catch (err: unknown) {
    const error = err as Error;
    failed++;
    results.push({
      testName: 'Barcode & Exam Card Suite Fatal Error',
      status: 'FAIL',
      details: error.message,
    });
  }

  return {
    passed,
    failed,
    results,
  };
};
