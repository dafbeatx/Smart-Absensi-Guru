/**
 * SMART ABSENSI GURU — SARANA DAN PRASARANA (SARPRAS) TEST SUITE
 * Memvalidasi sistem inventaris sarpras, pembatasan hak akses M. Iqbal Gustiawan,
 * isolasi menu/icon dari guru lain, dan tinjauan eksekutif Kepala Sekolah.
 */

import { isUserSarprasOfficer, canViewSarprasExecutive } from '../../features/sarpras/utils/sarpras-access.utils';
import { getEffectiveQuickIcons, getEffectiveQuickIconSteps } from '../../features/guru/components/CustomizeQuickIconsModal';
import { InventorySarprasRepository } from '../../repositories/InventorySarprasRepository';
import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import type { UserProfile, InventorySarprasItem } from '../../types/database.types';

export interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

export async function runSarprasInventoryTestSuite(): Promise<{
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

  // ── TEST 1: Role & Identity Access Control (M. Iqbal Gustiawan) ────────
  const iqbalById: UserProfile = {
    id: 'usr_guru_002',
    nip: '199304152021021002',
    full_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r',
    phone_number: '081947674030',
    role: 'GURU',
    position: 'Wakasek Sarana dan Prasarana',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const iqbalByPosition: UserProfile = {
    id: 'usr_custom_99',
    nip: null,
    full_name: 'M. Iqbal',
    phone_number: '08123456789',
    role: 'GURU',
    position: 'Wakasek Sarana dan Prasarana',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const otherTeacherA: UserProfile = {
    id: 'usr_guru_003',
    nip: '199405102022031003',
    full_name: 'Adi Prasetyo, S.Pd., G.r',
    phone_number: '081911223344',
    role: 'GURU',
    position: 'Wali Kelas 8A & Guru Matematika',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const otherTeacherB: UserProfile = {
    id: 'usr_guru_005',
    nip: '199507122023042005',
    full_name: 'Fitri Ani Rahayu, S.Mat',
    phone_number: '081955667788',
    role: 'GURU',
    position: 'Guru IPA Terpadu',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const kepsekUser: UserProfile = {
    id: 'usr_kepsek_002',
    nip: '198807212015041001',
    full_name: 'Farhan Sopian Sahid, S.Pd.I',
    phone_number: '085716117717',
    role: 'KEPSEK',
    position: 'Kepala Sekolah',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  assert(
    'Access Control: M. Iqbal Gustiawan berhasil diidentifikasi sebagai Wakasek Sarpras',
    isUserSarprasOfficer(iqbalById) === true,
    `UserId: ${iqbalById.id}`
  );

  assert(
    'Access Control: M. Iqbal Gustiawan berhasil diidentifikasi via posisi Wakasek Sarpras',
    isUserSarprasOfficer(iqbalByPosition) === true,
    `Position: ${iqbalByPosition.position}`
  );

  assert(
    'Access Control: Guru lain A (Adi Prasetyo) DITOLAK hak akses form sarpras',
    isUserSarprasOfficer(otherTeacherA) === false,
    `Teacher: ${otherTeacherA.full_name}`
  );

  assert(
    'Access Control: Guru lain B (Fitri Ani Rahayu) DITOLAK hak akses form sarpras',
    isUserSarprasOfficer(otherTeacherB) === false,
    `Teacher: ${otherTeacherB.full_name}`
  );

  assert(
    'Access Control: Null atau undefined user DITOLAK secara aman',
    isUserSarprasOfficer(null) === false && isUserSarprasOfficer(undefined) === false
  );

  assert(
    'Access Control: Kepala Sekolah memiliki hak akses Tinjauan Eksekutif Sarpras',
    canViewSarprasExecutive(kepsekUser) === true,
    `Role: ${kepsekUser.role}`
  );

  assert(
    'Access Control: Guru biasa TIDAK memiliki hak akses Tinjauan Eksekutif Sarpras',
    canViewSarprasExecutive(otherTeacherA) === false,
    `Role: ${otherTeacherA.role}`
  );

  // ── TEST 2: Icon Isolation Protocol (Guru Lain Tidak Boleh Melihat Icon) ─
  const iconsForIqbal = getEffectiveQuickIcons(iqbalById);
  const iconsForOther = getEffectiveQuickIcons(otherTeacherA);

  assert(
    'Icon Isolation: Icon sarpras_inventory MUNCUL untuk M. Iqbal Gustiawan',
    iconsForIqbal.some((i) => i.id === 'sarpras_inventory') === true
  );

  assert(
    'Icon Isolation: Icon sarpras_inventory HILANG/TERSEMBUNYI untuk guru lain',
    iconsForOther.some((i) => i.id === 'sarpras_inventory') === false,
    `Icons count for other teacher: ${iconsForOther.length}`
  );

  const stepsForOther = getEffectiveQuickIconSteps(otherTeacherA);
  const hasSarprasInSteps = stepsForOther.some((step) =>
    step.itemIds.includes('sarpras_inventory')
  );
  assert(
    'Icon Isolation: Katalog pemilihan icon di modal kustomisasi TIDAK memuat sarpras untuk guru lain',
    hasSarprasInSteps === false
  );

  // ── TEST 3: Sarpras Statistics Calculation Engine ───────────────────────
  const mockItems: InventorySarprasItem[] = [
    {
      id: 'item_1',
      ruangan: 'Lab Komputer',
      nama_barang: 'PC Client',
      jumlah_total: 20,
      merek: 'Lenovo',
      tahun_perolehan: 2023,
      kondisi: 'LAYAK',
      yang_harus_dibeli: '0',
      sumber_dana: 'BOS Kinerja',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item_2',
      ruangan: 'Lab Komputer',
      nama_barang: 'Proyektor',
      jumlah_total: 2,
      merek: 'Epson',
      tahun_perolehan: 2022,
      kondisi: 'LAYAK',
      yang_harus_dibeli: '0',
      sumber_dana: 'BOS Reguler',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item_3',
      ruangan: 'Ruang Guru',
      nama_barang: 'AC Split',
      jumlah_total: 2,
      merek: 'Daikin',
      tahun_perolehan: 2021,
      kondisi: 'RUSAK',
      yang_harus_dibeli: '1 unit baru',
      sumber_dana: 'Yayasan',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item_4',
      ruangan: 'Ruang Kelas 7A',
      nama_barang: 'Kipas Angin',
      jumlah_total: 4,
      merek: 'Maspion',
      tahun_perolehan: 2022,
      kondisi: 'RUSAK',
      yang_harus_dibeli: '2 unit baru',
      sumber_dana: 'BOS Reguler',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const stats = InventorySarprasRepository.calculateStatistics(mockItems);

  assert(
    'Statistics Engine: Menghitung total jenis barang dengan tepat',
    stats.totalItems === 4,
    `Total: ${stats.totalItems}`
  );

  assert(
    'Statistics Engine: Menghitung total unit fisik secara tepat (20+2+2+4 = 28)',
    stats.totalUnits === 28,
    `Total Units: ${stats.totalUnits}`
  );

  assert(
    'Statistics Engine: Menghitung unit layak secara tepat (20+2 = 22)',
    stats.layakUnits === 22 && stats.layakCount === 2,
    `Layak Units: ${stats.layakUnits}`
  );

  assert(
    'Statistics Engine: Menghitung unit rusak secara tepat (2+4 = 6)',
    stats.rusakUnits === 6 && stats.rusakCount === 2,
    `Rusak Units: ${stats.rusakUnits}`
  );

  assert(
    'Statistics Engine: Menghitung kebutuhan pengadaan (yang_harus_dibeli != 0)',
    stats.needPurchaseCount === 2,
    `Need Purchase Count: ${stats.needPurchaseCount}`
  );

  assert(
    'Statistics Engine: Menghitung jumlah ruangan unik (Lab Komputer, Ruang Guru, Ruang Kelas 7A = 3)',
    stats.roomsCount === 3,
    `Rooms Count: ${stats.roomsCount}`
  );

  // ── TEST 4: Provider CRUD Operations ────────────────────────────────────
  const initialItems = await InventorySarprasRepository.getAll();
  assert(
    'CRUD Engine: Memuat inventaris sarpras sekolah (default bersih dan kosong)',
    Array.isArray(initialItems) && initialItems.length === 0,
    `Loaded: ${initialItems.length} items (Awal kosong)`
  );

  // Tambah item baru
  const created = await InventorySarprasRepository.create({
    ruangan: 'Lab IPA',
    nama_barang: 'Mikroskop Monokuler Digital',
    jumlah_total: 10,
    merek: 'Olympus CX23',
    tahun_perolehan: 2024,
    kondisi: 'LAYAK',
    yang_harus_dibeli: '0',
    sumber_dana: 'BOS Reguler 2024',
    keterangan: '10 unit mikroskop lengkap dengan lensa cadangan dan box kayu penyimpanan.',
    created_by: iqbalById.id,
    created_by_name: iqbalById.full_name,
  });

  assert(
    'CRUD Engine: Berhasil menambahkan barang baru ke inventaris',
    created && created.nama_barang === 'Mikroskop Monokuler Digital' && created.jumlah_total === 10,
    `Created Item ID: ${created.id}`
  );

  // Update item
  const updateSuccess = await InventorySarprasRepository.update(created.id, {
    kondisi: 'RUSAK',
    yang_harus_dibeli: '1 lensa okuler pengganti',
    keterangan: '9 unit normal, 1 unit lensa okuler retak.',
  });

  assert(
    'CRUD Engine: Berhasil memperbarui data barang inventaris',
    updateSuccess === true
  );

  const reloaded = await InventorySarprasRepository.getAll();
  const updatedItem = reloaded.find((i) => i.id === created.id);
  assert(
    'CRUD Engine: Pembaruan kondisi & kebutuhan beli tersimpan akurat',
    updatedItem?.kondisi === 'RUSAK' && updatedItem?.yang_harus_dibeli === '1 lensa okuler pengganti',
    `Updated Condition: ${updatedItem?.kondisi}`
  );

  // Hapus item
  const deleteSuccess = await InventorySarprasRepository.delete(created.id);
  assert(
    'CRUD Engine: Berhasil menghapus barang inventaris',
    deleteSuccess === true
  );

  const afterDelete = await InventorySarprasRepository.getAll();
  assert(
    'CRUD Engine: Item yang dihapus tidak lagi ada di daftar inventaris',
    afterDelete.some((i) => i.id === created.id) === false
  );

  return { passed, failed, results };
}
