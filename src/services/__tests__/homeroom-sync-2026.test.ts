/**
 * SMART ABSENSI GURU — HOMEROOM & STUDENT CONTINUATION PLAN 2026/2027 TEST SUITE
 *
 * Menguji kepatuhan fitur Ruang Wali Kelas:
 * 1. Sinkronisasi data siswa tahun ajaran 2026/2027.
 * 2. Data rencana studi yang belum ada wajib kosong terlebih dahulu (draft, null choices).
 * 3. Overview statistik merefleksikan kondisi riil tahun ajaran 2026/2027.
 * 4. Fungsionalitas penyimpanan rencana studi (saveStudentPlan / Edit Button) berjalan mulus.
 * 5. Fungsionalitas verifikasi rencana studi mengupdate audit log dan statistik overview.
 */

import { HomeroomRepository } from '../../repositories/HomeroomRepository';
import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import type { SaveStudentPlanDTO } from '../../types/homeroom.types';

function assert(description: string, condition: boolean, extra?: any) {
  if (!condition) {
    console.error(`❌ FAILED: ${description}`, extra !== undefined ? extra : '');
    throw new Error(`Assertion failed: ${description}`);
  } else {
    console.log(`✅ PASSED: ${description}`);
  }
}

async function runHomeroomSyncTests() {
  console.log('🚀 Running Homeroom & Continuation Plan 2026/2027 Sync Test Suite...');

  // Reset persistent storage for clean test state
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('smart_absensi_homeroom_plans_2026_2027');
  }

  ProviderFactory.setProvider(new MockProvider());
  const token = 'mock_token_guru_9a';

  // 1. Sinkronisasi Data Siswa Tahun Ajaran 2026/2027
  const students9A = await HomeroomRepository.getStudents(token, '9A', '2026/2027');
  assert('Homeroom 2026: Mengambil data siswa kelas 9A untuk TA 2026/2027', Array.isArray(students9A) && students9A.length > 0);

  // 2. Data rencana studi yang belum ada wajib KOSONG terlebih dahulu
  const firstStudent = students9A[0];
  assert('Homeroom 2026: Rencana studi siswa baru bernilai kosong (id null)', firstStudent.plan.id === null);
  assert('Homeroom 2026: Status awal rencana studi adalah draft', firstStudent.plan.status === 'draft');
  assert('Homeroom 2026: Pilihan pertama awal bernilai null (kosong)', firstStudent.plan.firstChoice === null);

  // 3. Detail siswa yang belum ada rencana wajib kosong terlebih dahulu
  const initialDetail = await HomeroomRepository.getStudentDetail(firstStudent.id, token, '2026/2027');
  assert('Homeroom 2026: Detail rencana siswa belum diisi menghasilkan plan null', initialDetail.plan === null);
  assert('Homeroom 2026: Daftar pilihan sekolah awal adalah array kosong', Array.isArray(initialDetail.choices) && initialDetail.choices.length === 0);
  assert('Homeroom 2026: Daftar minat awal adalah array kosong', Array.isArray(initialDetail.interests) && initialDetail.interests.length === 0);

  // 4. Overview statistik awal merefleksikan kondisi kosong (0% terverifikasi)
  const initialOverview = await HomeroomRepository.getOverview(token, '9A', '2026/2027');
  assert('Homeroom 2026: Overview TA adalah 2026/2027', initialOverview.academicYear === '2026/2027');
  assert('Homeroom 2026: Completion rate awal adalah 0%', initialOverview.completionRate === 0);
  assert('Homeroom 2026: Seluruh siswa tercatat sebagai draft/belum ada data', initialOverview.stats.draft === students9A.length);
  assert('Homeroom 2026: Jumlah terverifikasi awal adalah 0', initialOverview.stats.verified === 0);

  // 5. Simpan Rencana Studi melalui button edit (saveStudentPlan)
  const saveDto: SaveStudentPlanDTO = {
    studentId: firstStudent.id,
    academicYear: '2026/2027',
    graduationYear: 2027,
    continuationType: 'SMA_NEGERI',
    status: 'submitted',
    parentAgreement: true,
    notes: 'Konsultasi minat bakat telah selesai.',
    choices: [
      {
        priority: 1,
        schoolName: 'SMAN 1 Cibinong',
        schoolType: 'SMA',
        majorName: 'MIPA',
        registrationTrack: 'Zonasi',
        notes: 'Jarak 1.5 km',
      },
      {
        priority: 2,
        schoolName: 'SMAN 2 Cibinong',
        schoolType: 'SMA',
        majorName: 'MIPA',
      },
    ],
    interests: [
      {
        interestField: 'Sains & Teknologi Komputer',
        careerGoal: 'Software Engineer',
        reason: 'Suka pemrograman dan robotika',
      },
    ],
  };

  const saveResult = await HomeroomRepository.saveStudentPlan(saveDto, token);
  assert('Homeroom 2026: Menyimpan rencana studi berhasil (saveStudentPlan)', saveResult.success === true && !!saveResult.planId);

  // 6. Detail siswa terupdate dengan data yang baru diisi
  const updatedDetail = await HomeroomRepository.getStudentDetail(firstStudent.id, token, '2026/2027');
  assert('Homeroom 2026: Plan kini terisi setelah diedit', updatedDetail.plan !== null && updatedDetail.plan.continuationType === 'SMA_NEGERI');
  assert('Homeroom 2026: Pilihan sekolah tersimpan sebanyak 2 sekolah', updatedDetail.choices.length === 2 && updatedDetail.choices[0].schoolName === 'SMAN 1 Cibinong');
  assert('Homeroom 2026: Minat siswa tersimpan', updatedDetail.interests.length === 1 && updatedDetail.interests[0].careerGoal === 'Software Engineer');

  // 7. Roster siswa terupdate dengan status submitted dan pilihan sekolah
  const updatedStudents = await HomeroomRepository.getStudents(token, '9A', '2026/2027');
  const updatedStudentItem = updatedStudents.find((s) => s.id === firstStudent.id);
  assert('Homeroom 2026: Siswa di roster memiliki status submitted', updatedStudentItem?.plan.status === 'submitted');
  assert('Homeroom 2026: Siswa di roster memiliki firstChoice SMAN 1 Cibinong', updatedStudentItem?.plan.firstChoice?.schoolName === 'SMAN 1 Cibinong');

  // 8. Overview statistik terupdate secara dinamis
  const updatedOverview = await HomeroomRepository.getOverview(token, '9A', '2026/2027');
  assert('Homeroom 2026: Overview stats submitted bertambah menjadi 1', updatedOverview.stats.submitted === 1);
  assert('Homeroom 2026: Overview stats parentAgreed bertambah menjadi 1', updatedOverview.stats.parentAgreed === 1);

  // 9. Verifikasi Rencana Studi oleh Wali Kelas
  const verifyResult = await HomeroomRepository.verifyPlan(
    {
      plan_id: updatedDetail.plan!.id,
      decision: 'verified',
    },
    token
  );
  assert('Homeroom 2026: Verifikasi persetujuan rencana studi berhasil', verifyResult.success === true);

  // 10. Overview statistik setelah verifikasi
  const verifiedOverview = await HomeroomRepository.getOverview(token, '9A', '2026/2027');
  assert('Homeroom 2026: Overview stats verified bertambah menjadi 1', verifiedOverview.stats.verified === 1);
  assert('Homeroom 2026: Completion rate meningkat > 0%', verifiedOverview.completionRate > 0);

  console.log('\n🎉 ALL HOMEROOM 2026/2027 TESTS PASSED SUCCESSFULLY!\n');
}

runHomeroomSyncTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
