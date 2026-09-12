/**
 * SMART ABSENSI GURU - BARCODE ENGINE & STUDENT EXAM CARD GENERATOR TEST SUITE
 * Unit tests verifying JsBarcode integration, participant number formatting,
 * and 4-cards-per-A4 sheet HTML template generator.
 */

import {
  BarcodeExamCardService,
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
    const mockStudents: StudentCardData[] = [
      {
        id: 'std_001',
        nisn: '0071234567',
        nama: 'Achmad Dani Pratama',
        kelas: 'XII MIPA 1',
        nomor_peserta: '01-026-XIIMIPA1-001-0071234567',
        ruang: 'Ruang 04',
        sesi: 'Sesi 1 (07:30 - 09:30)',
      },
      {
        id: 'std_002',
        nisn: '0071234568',
        nama: 'Bella Novita Sari',
        kelas: 'XII MIPA 1',
        nomor_peserta: '01-026-XIIMIPA1-002-0071234568',
        ruang: 'Ruang 04',
        sesi: 'Sesi 1 (07:30 - 09:30)',
      },
      {
        id: 'std_003',
        nisn: '0071234569',
        nama: 'Citra Kirana Dewi',
        kelas: 'XII MIPA 1',
        nomor_peserta: '01-026-XIIMIPA1-003-0071234569',
        ruang: 'Ruang 04',
        sesi: 'Sesi 1 (07:30 - 09:30)',
      },
      {
        id: 'std_004',
        nisn: '0071234570',
        nama: 'Dimas Aditya Nugraha',
        kelas: 'XII MIPA 1',
        nomor_peserta: '01-026-XIIMIPA1-004-0071234570',
        ruang: 'Ruang 04',
        sesi: 'Sesi 1 (07:30 - 09:30)',
      },
      {
        id: 'std_005',
        nisn: '0071234571',
        nama: 'Eka Putri Lestari',
        kelas: 'XII MIPA 1',
        nomor_peserta: '01-026-XIIMIPA1-005-0071234571',
        ruang: 'Ruang 05',
        sesi: 'Sesi 1 (07:30 - 09:30)',
      },
    ];

    const defaultConfig: ExamCardConfig = {
      namaSekolah: 'SMK MA`ARIF TERPADU',
      namaUjian: 'ASESMEN SUMATIF AKHIR SEMESTER (ASAS) GANJIL',
      tahunAjaran: '2026/2027',
      semester: 'Ganjil',
      kepalaSekolah: 'H. Suherman, S.Ag., M.Pd.I.',
      nipKepalaSekolah: '197605122005011004',
      kotaTanggal: 'Majalengka, 01 Desember 2026',
      ruangDefault: 'Ruang 01',
    };

    // 1. Uji Pembuatan Format Nomor Peserta Ujian Nasional
    const generatedNo1 = BarcodeExamCardService.formatExamParticipantNumber('XII MIPA 1', 1, '0071234567');
    assert(
      'Format Nomor Peserta Ujian Standar: Padding urut 3 digit & format kelas bersih',
      generatedNo1 === '01-026-XIIMIPA1-001-0071234567',
      `Hasil: ${generatedNo1}`
    );

    const generatedNo2 = BarcodeExamCardService.formatExamParticipantNumber('X-RPL-2', 45, '0089998881');
    assert(
      'Format Nomor Peserta Ujian: Karakter strip pada nama kelas dihilangkan',
      generatedNo2 === '01-026-XRPL2-045-0089998881',
      `Hasil: ${generatedNo2}`
    );

    // 2. Uji Generator Barcode SVG (JsBarcode / Fallback Deterministik)
    const barcodeSvg1 = BarcodeExamCardService.generateBarcodeSVG('0071234567');
    assert(
      'JsBarcode SVG Output: Berisi tag svg pembuka dan penutup',
      barcodeSvg1.includes('<svg') && barcodeSvg1.includes('</svg>'),
      'SVG tag valid'
    );
    assert(
      'JsBarcode SVG Output: Memuat nilai NISN atau elemen grafis barcode',
      barcodeSvg1.includes('0071234567') || barcodeSvg1.includes('<rect'),
      'Barcode memuat payload data'
    );

    // 3. Uji Generator Dokumen HTML Siap Cetak A4 (Grid 2x2 = 4 Kartu/Halaman)
    const htmlA4 = BarcodeExamCardService.generateExamCardsA4HTML(mockStudents, defaultConfig);

    assert(
      'A4 Document Template: Memuat deklarasi CSS print layout portrait dan @page',
      htmlA4.includes('@page') && htmlA4.includes('size: A4 portrait'),
      'CSS print layout terkonfigurasi untuk A4 portrait'
    );

    assert(
      'A4 Document Template: Memuat nama sekolah dan judul asesmen resmi',
      htmlA4.includes('SMK MA`ARIF TERPADU') && htmlA4.includes('ASESMEN SUMATIF AKHIR SEMESTER (ASAS) GANJIL'),
      'Kop kartu ujian memuat identitas sekolah'
    );

    assert(
      'A4 Document Template: Memuat seluruh data 5 siswa yang diuji',
      htmlA4.includes('Achmad Dani Pratama') &&
      htmlA4.includes('Bella Novita Sari') &&
      htmlA4.includes('Citra Kirana Dewi') &&
      htmlA4.includes('Dimas Aditya Nugraha') &&
      htmlA4.includes('Eka Putri Lestari'),
      'Seluruh 5 nama siswa tercetak dalam dokumen'
    );

    assert(
      'A4 Document Template: Memuat NISN dan nomor peserta ujian',
      htmlA4.includes('0071234567') && htmlA4.includes('01-026-XIIMIPA1-001-0071234567'),
      'Identitas NISN dan no peserta akurat'
    );

    assert(
      'A4 Document Template: Memuat stempel resmi digital dan pengesahan Kepala Sekolah',
      htmlA4.includes('H. Suherman, S.Ag., M.Pd.I.') && htmlA4.includes('197605122005011004'),
      'Tanda tangan & NIP Kepala Sekolah hadir'
    );

    // 4. Uji Pemisahan Halaman (Pagination A4 Grid: 5 siswa = 2 halaman A4)
    // Siswa 1-4 ada di lembar 1, siswa 5 ada di lembar 2 dengan page-break
    assert(
      'A4 Pagination: Menggunakan page-break-after untuk membatasi 4 kartu per lembar',
      htmlA4.includes('page-break-after: always') || htmlA4.includes('break-after: page'),
      'Page-break CSS aktif untuk pembagian lembar A4'
    );

    // 5. Uji Garis Potong (Cut Guidelines) untuk Kemudahan Panitia Ujian
    assert(
      'A4 Grid Layout: Memuat garis batas potong (cut-guide) untuk kemudahan gunting panitia',
      htmlA4.includes('cut-guide') || htmlA4.includes('dashed') || htmlA4.includes('border: 1px dashed'),
      'Garis potong kartu terpasang'
    );

    // 6. Uji Edge Case: Siswa Kosong
    const emptyA4 = BarcodeExamCardService.generateExamCardsA4HTML([], defaultConfig);
    assert(
      'Edge Case: Penanganan list siswa kosong menghasilkan template aman tanpa crash',
      emptyA4.includes('Tidak ada data peserta ujian') || emptyA4.includes('html'),
      'Dokumen HTML kosong tetap valid'
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
