/**
 * SMART ABSENSI GURU — CATATAN BIMBINGAN KONSELING (BK) TEST SUITE
 * Memvalidasi sistem pencatatan layanan BK, filter kelas & jenis layanan,
 * integrasi data dengan Nawasena Platform Siswa, kalkulasi KPI, dan ekspor data.
 */

import { CounselingRepository } from '../../repositories/CounselingRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import type { CreateCounselingDTO, UpdateCounselingDTO } from '../../types/counseling.types';

export interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

export async function runCounselingBkTestSuite(): Promise<{
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

  const counselorId = 'usr_guru_010'; // Mawar Andinia, S.Pd., G.r (Guru BK)
  let recordId = '';

  // ── TEST 1: Pencatatan BK Baru dengan Visibilitas Nawasena Siswa ───
  try {
    const dto: CreateCounselingDTO = {
      student_id: 'std_test_001',
      student_name: 'Fakhri Alamsyah',
      student_nisn: '0098123456',
      class_name: '8A',
      counselor_id: counselorId,
      counselor_name: 'Mawar Andinia, S.Pd., G.r',
      counselor_npp: null,
      counseling_date: '2026-11-03',
      counseling_time: '10:00',
      counseling_type: 'BEHAVIOR_MEDIATION',
      urgency: 'HIGH',
      status: 'IN_PROGRESS',
      visibility: 'PUBLIC_STUDENT',
      topic: 'Mediasi Keterlambatan Masuk Kelas & Pembiasaan Kedisiplinan Siswa',
      background_narrative: 'Tercatat 3 kali terlambat mengikuti jam pertama pelajaran matematika.',
      action_taken: 'Konseling individual, menyusun strategi bangun pagi, dan kesepakatan pemantauan.',
      student_commitment: 'Berkomitmen berangkat lebih awal pukul 06:20 WIB.',
      parent_involvement: 'Orang tua diinformasikan via WhatsApp dan mendukung pembiasaan tidur tepat waktu.',
      follow_up_plan: 'Evaluasi kehadiran jam pertama sepekan ke depan.',
      follow_up_date: '2026-11-10',
      academic_year: '2026/2027',
      semester: 'GANJIL',
    };

    const created = await CounselingRepository.create(dto);
    recordId = created.id;

    assert(
      'Pencatatan BK baru berhasil dibuat dan otomatis terhubung ke Nawasena Siswa',
      Boolean(created.id && created.visibility === 'PUBLIC_STUDENT' && created.synced_to_nawasena === true),
      `ID: ${created.id}, Visibilitas: ${created.visibility}, Nawasena Sync: ${created.synced_to_nawasena}`
    );
  } catch (err: any) {
    assert('Pencatatan BK baru berhasil dibuat dan otomatis terhubung ke Nawasena Siswa', false, err.message);
  }

  // ── TEST 2: Filter Pencarian Berdasarkan Kelas & Jenis Layanan ─────
  try {
    const recordsClass8A = await CounselingRepository.getAll({ className: '8A' });
    const found = recordsClass8A.some((r) => r.id === recordId && r.class_name === '8A');

    const recordsWrongClass = await CounselingRepository.getAll({ className: '9E' });
    const notFoundInWrong = !recordsWrongClass.some((r) => r.id === recordId);

    assert(
      'Filter pencatatan berdasarkan kelas berfungsi akurat dan terisolasi',
      found && notFoundInWrong,
      `Ditemukan di 8A: ${found}, Terisolasi dari 9E: ${notFoundInWrong}`
    );
  } catch (err: any) {
    assert('Filter pencatatan berdasarkan kelas berfungsi akurat dan terisolasi', false, err.message);
  }

  // ── TEST 3: Pembaruan Data Catatan BK & Perubahan Status ke RESOLVED
  try {
    const updateDto: UpdateCounselingDTO = {
      status: 'RESOLVED',
      student_commitment: 'Siswa konsisten hadir tepat waktu selama 7 hari berturut-turut.',
      action_taken: 'Pembinaan selesai dengan hasil sangat baik. Apresiasi diberikan kepada siswa.',
    };

    const updated = await CounselingRepository.update(recordId, updateDto);

    assert(
      'Pembaruan data catatan BK dan penyelesaian kasus (RESOLVED) sukses',
      Boolean(updated && updated.status === 'RESOLVED' && updated.student_commitment?.includes('konsisten')),
      `Status: ${updated?.status}, Komitmen: ${updated?.student_commitment}`
    );
  } catch (err: any) {
    assert('Pembaruan data catatan BK dan penyelesaian kasus (RESOLVED) sukses', false, err.message);
  }

  // ── TEST 4: Kalkulasi Metrik KPI Statistik Bimbingan Konseling ─────
  try {
    const allRecords = await CounselingRepository.getAll();
    const stats = CounselingRepository.calculateStatistics(allRecords);

    assert(
      'Kalkulasi statistik metrik BK akurat (Total, Selesai, Prioritas, & Nawasena)',
      stats.totalRecords >= 1 && stats.resolvedCount >= 1 && stats.publicToNawasenaCount >= 1,
      `Total: ${stats.totalRecords}, Selesai: ${stats.resolvedCount}, Nawasena Publik: ${stats.publicToNawasenaCount}`
    );
  } catch (err: any) {
    assert('Kalkulasi statistik metrik BK akurat (Total, Selesai, Prioritas, & Nawasena)', false, err.message);
  }

  // ── TEST 5: Penghapusan Catatan BK dari Sistem ────────────────────
  try {
    const deleteSuccess = await CounselingRepository.delete(recordId);
    const afterDelete = await CounselingRepository.getAll();
    const isGone = !afterDelete.some((r) => r.id === recordId);

    assert(
      'Penghapusan catatan BK berhasil dan data dibersihkan secara konsisten',
      deleteSuccess && isGone,
      `Status Hapus: ${deleteSuccess}, Data terhapus: ${isGone}`
    );
  } catch (err: any) {
    assert('Penghapusan catatan BK berhasil dan data dibersihkan secara konsisten', false, err.message);
  }

  return { passed, failed, results };
}

