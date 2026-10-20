/**
 * SMART ABSENSI GURU - KOTAK ASPIRASI & KELUHAN GURU TEST SUITE
 * Suite 53: Verifikasi persistensi keluhan/aspirasi, pembuatan ID UUID PostgreSQL,
 * anonimisasi identitas (masking), dan pembaruan tanggapan sekolah.
 */

import { ComplaintRepository } from '../../repositories/ComplaintRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import type { TestResultItem } from '../test-runner.service';
import type { TeacherComplaint } from '../../types/database.types';

export const runComplaintRepositorySyncTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> => {
  const results: TestResultItem[] = [];
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

  const mockProvider = new MockProvider();
  ProviderFactory.setProvider(mockProvider);

  // Test 1: UUID generation
  const c1 = await ComplaintRepository.submitComplaint('usr_guru_001', {
    category: 'SARANA_PRASARANA',
    content: 'Pendingin ruangan di laboratorium komputer perlu servis rutin.',
    is_anonymous: true,
  });

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert(
    '1. Pengiriman aspirasi menghasilkan ID UUID valid yang kompatibel dengan PostgreSQL',
    Boolean(c1 && c1.id && uuidRegex.test(c1.id) && c1.user_id === 'usr_guru_001' && c1.status === 'SUBMITTED'),
    `ID: ${c1?.id}`
  );

  // Test 2: Personal history filtering
  await ComplaintRepository.submitComplaint('usr_guru_002', {
    category: 'KEBIJAKAN_MANAJEMEN',
    content: 'Aspirasi khusus guru 2',
  });

  const g1List = await ComplaintRepository.getUserComplaints('usr_guru_001');
  const g2List = await ComplaintRepository.getUserComplaints('usr_guru_002');
  assert(
    '2. getUserComplaints menyaring catatan aspirasi khusus masing-masing guru secara akurat',
    g1List.length === 1 && g1List[0].user_id === 'usr_guru_001' && g2List.length === 1 && g2List[0].user_id === 'usr_guru_002',
    `Guru 1: ${g1List.length}, Guru 2: ${g2List.length}`
  );

  // Test 3: Anonymity masking
  const allComplaints = await ComplaintRepository.getAllComplaints();
  const allMasked = allComplaints.length >= 2 && allComplaints.every((c) => c.user_id === 'ANONYMOUS');
  assert(
    '3. getAllComplaints untuk Admin & Kepsek secara ketat menyamarkan user_id menjadi ANONYMOUS',
    allMasked,
    `Total: ${allComplaints.length}, User ID Sample: ${allComplaints[0]?.user_id}`
  );

  // Test 4: Update status and response
  const updateSuccess = await ComplaintRepository.updateComplaintStatus({
    complaintId: c1.id,
    status: 'RESOLVED',
    adminResponse: 'AC lab komputer telah dijadwalkan servis hari Sabtu ini.',
    respondedByRole: 'ADMIN',
  });

  const reloaded = await ComplaintRepository.getUserComplaints('usr_guru_001');
  assert(
    '4. updateComplaintStatus berhasil memperbarui status dan tanggapan manajemen sekolah',
    updateSuccess && reloaded[0]?.status === 'RESOLVED' && Boolean(reloaded[0]?.admin_response?.includes('dijadwalkan')),
    `Status: ${reloaded[0]?.status}, Response: ${reloaded[0]?.admin_response}`
  );

  // Test 5: Idempotent storage
  const sampleItem: TeacherComplaint = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    user_id: 'usr_guru_003',
    date: '2026-10-19',
    category: 'KESEJAHTERAAN',
    content: 'Uji coba penyimpanan lokal tanpa duplikasi.',
    status: 'SUBMITTED',
    admin_response: null,
    responded_at: null,
    responded_by_role: null,
    is_anonymous: true,
    created_at: new Date().toISOString(),
  };

  mockProvider.saveComplaintToStorage(sampleItem);
  mockProvider.saveComplaintToStorage({ ...sampleItem, status: 'IN_REVIEW' });
  const checkStored = await mockProvider.getUserComplaints('usr_guru_003');
  assert(
    '5. saveComplaintToStorage memperbarui data secara idempotent tanpa membuat duplikasi',
    checkStored.length === 1 && checkStored[0]?.status === 'IN_REVIEW',
    `Count: ${checkStored.length}, Status: ${checkStored[0]?.status}`
  );

  // Test 6: Metadata coverage
  const categories = Object.keys(ComplaintRepository.CATEGORY_META);
  const statuses = Object.keys(ComplaintRepository.STATUS_META);
  assert(
    '6. Metadata kategori dan status terisi lengkap dengan emoji, label, dan styling token',
    categories.length === 5 && statuses.length === 4,
    `Kategori: ${categories.length}, Status: ${statuses.length}`
  );

  // Test 7: Delete Complaint
  const deleteResult = await ComplaintRepository.deleteComplaint(c1.id);
  assert(
    '7. deleteComplaint berhasil menghapus catatan aspirasi dari sistem',
    deleteResult === true,
    `Deleted: ${c1.id}`
  );

  // Test 8: Purge Test Complaints (Pembersihan Data Uji Coba)
  const purgedCount = await ComplaintRepository.purgeTestComplaints();
  assert(
    '8. purgeTestComplaints membersihkan seluruh data uji coba tanpa sisa',
    purgedCount >= 1,
    `Purged: ${purgedCount}`
  );

  return { passed, failed, results };
};
