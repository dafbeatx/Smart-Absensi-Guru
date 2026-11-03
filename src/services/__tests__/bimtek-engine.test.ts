/**
 * SMART ABSENSI GURU — PENCATATAN BIMTEK & DIKLAT GURU TEST SUITE
 * Memvalidasi sistem pencatatan bimbingan teknis, akumulasi JP, validasi bukti sertifikat,
 * ekspor rekapitulasi, dan isolasi data per akun guru.
 */

import { BimtekRepository } from '../../repositories/BimtekRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import type { CreateBimtekDTO, UpdateBimtekDTO, VerifyBimtekDTO } from '../../types/bimtek.types';

export interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

export async function runBimtekTestSuite(): Promise<{
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

  const teacherId1 = 'usr_bimtek_guru_01';
  const teacherId2 = 'usr_bimtek_guru_02';

  // ── TEST 1: Create Bimtek Record (Pencatatan Baru) ────────
  let record1Id = '';
  try {
    const dto: CreateBimtekDTO = {
      user_id: teacherId1,
      teacher_name: 'Dafa Maulana, S.Pd.',
      teacher_nip: '198705022011011002',
      title: 'Bimtek Pemanfaatan AI untuk Asesmen Pembelajaran Kurikulum Merdeka',
      activity_type: 'BIMTEK',
      organizer: 'BBGP Jawa Barat (Balai Guru Penggerak)',
      scope: 'PROVINSI',
      role: 'PESERTA',
      execution_method: 'DARING',
      start_date: '2026-11-01',
      end_date: '2026-11-04',
      duration_hours: 32,
      location_or_platform: 'Zoom Meeting BBGP & LMS PMM',
      certificate_number: '1240/B.BBGP/PK.01/2026',
      certificate_url: 'https://drive.google.com/file/d/test_ai_cert',
      summary_notes: 'Menyusun rubrik asesmen berbasis AI dan diferensiasi soal.',
      academic_year: '2026/2027',
    };

    const record = await BimtekRepository.create(dto);
    record1Id = record.id;

    assert(
      'Pencatatan Bimtek baru berhasil dibuat dengan status SUBMITTED dan 32 JP',
      record &&
        record.id.startsWith('bimtek_') &&
        record.duration_hours === 32 &&
        record.status === 'SUBMITTED',
      `ID: ${record.id}, JP: ${record.duration_hours}`
    );
  } catch (err: any) {
    assert('Pencatatan Bimtek baru berhasil dibuat', false, err?.message);
  }

  // ── TEST 2: Filter Data Berdasarkan Akun Guru (Data Isolation) ────────
  try {
    await BimtekRepository.create({
      user_id: teacherId2,
      teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
      title: 'Workshop Pengelolaan Sarpras dan Laboratorium Komputer',
      activity_type: 'WORKSHOP',
      organizer: 'Dinas Pendidikan Kab. Bandung',
      scope: 'KOTA_KABUPATEN',
      start_date: '2026-10-15',
      end_date: '2026-10-15',
      duration_hours: 8,
      location_or_platform: 'Aula SMP Terpadu',
    });

    const listTeacher1 = await BimtekRepository.getByUserId(teacherId1);
    const listTeacher2 = await BimtekRepository.getByUserId(teacherId2);
    const listAll = await BimtekRepository.getAll();

    assert(
      'Isolasi data per akun guru berjalan tepat dan tidak tercampur',
      listTeacher1.length === 1 &&
        listTeacher1[0].user_id === teacherId1 &&
        listTeacher2.length === 1 &&
        listTeacher2[0].user_id === teacherId2 &&
        listAll.length >= 2,
      `Guru 1: ${listTeacher1.length}, Guru 2: ${listTeacher2.length}, Total: ${listAll.length}`
    );
  } catch (err: any) {
    assert('Isolasi data per akun guru berjalan tepat', false, err?.message);
  }

  // ── TEST 3: Update Bimtek Record ────────
  try {
    const updateDTO: UpdateBimtekDTO = {
      title: 'Bimtek Pemanfaatan AI & Big Data untuk Media Pembelajaran',
      duration_hours: 36,
    };

    const updated = await BimtekRepository.update(record1Id, updateDTO);
    assert(
      'Pembaruan data kegiatan bimtek dan penyesuaian JP berhasil',
      updated !== null &&
        updated.title === 'Bimtek Pemanfaatan AI & Big Data untuk Media Pembelajaran' &&
        updated.duration_hours === 36,
      `Judul: ${updated?.title}, JP: ${updated?.duration_hours}`
    );
  } catch (err: any) {
    assert('Pembaruan data kegiatan bimtek berhasil', false, err?.message);
  }

  // ── TEST 4: Verifikasi Resmi oleh Kepala Sekolah (Approval Flow) ────────
  try {
    const verifyDTO: VerifyBimtekDTO = {
      status: 'APPROVED',
      verified_by: 'Farhan Sopian Sahid, S.Pd.I',
      verification_notes: 'Sertifikat dan dokumen pendukung 36 JP terverifikasi valid.',
    };

    const verifyOk = await BimtekRepository.verify(record1Id, verifyDTO);
    const records = await BimtekRepository.getByUserId(teacherId1);
    const verifiedItem = records.find((r) => r.id === record1Id);

    assert(
      'Kepala Sekolah sukses memverifikasi sertifikat bimtek menjadi APPROVED',
      verifyOk &&
        verifiedItem?.status === 'APPROVED' &&
        verifiedItem?.verified_by === 'Farhan Sopian Sahid, S.Pd.I',
      `Status: ${verifiedItem?.status}, Verifikator: ${verifiedItem?.verified_by}`
    );
  } catch (err: any) {
    assert('Kepala Sekolah sukses memverifikasi sertifikat bimtek', false, err?.message);
  }

  // ── TEST 5: Perhitungan Statistik Akumulasi JP dan Sertifikat ────────
  try {
    const allRecords = await BimtekRepository.getAll();
    const stats = BimtekRepository.calculateStatistics(allRecords);

    assert(
      'Kalkulasi statistik akumulasi JP, status validasi, dan sertifikat akurat',
      stats.totalActivities >= 2 &&
        stats.totalDurationHours >= 44 && // 36 + 8
        stats.approvedCount >= 1 &&
        stats.submittedCount >= 1 &&
        stats.activeTeachersCount >= 2,
      `Total Aktivitas: ${stats.totalActivities}, Total JP: ${stats.totalDurationHours}, Valid: ${stats.approvedCount}`
    );
  } catch (err: any) {
    assert('Kalkulasi statistik akumulasi JP akurat', false, err?.message);
  }

  // ── TEST 6: Hapus Catatan Bimtek ────────
  try {
    const deleteOk = await BimtekRepository.delete(record1Id);
    const afterDelete = await BimtekRepository.getByUserId(teacherId1);

    assert(
      'Catatan bimtek berhasil dihapus dari sistem dengan bersih',
      deleteOk && afterDelete.find((r) => r.id === record1Id) === undefined,
      `Sisa data guru 1: ${afterDelete.length}`
    );
  } catch (err: any) {
    assert('Catatan bimtek berhasil dihapus dari sistem', false, err?.message);
  }

  return { passed, failed, results };
}
