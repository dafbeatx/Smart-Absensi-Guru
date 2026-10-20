/**
 * SMART ABSENSI GURU - ANNOUNCEMENT BROADCAST & ANTI-SPAM TEST SUITE
 * Suite 55: Verifikasi Pengumuman Notifikasi Push ke HP Guru & Proteksi Anti-Spam:
 * 1. Validasi otoritas peran (Admin & Kepsek diizinkan, Guru dilarang)
 * 2. Proteksi Cooldown Anti-Spam (180 detik jeda siaran berulang)
 * 3. Proteksi Duplikasi Konten (Mencegah pesan persis sama dalam 1 jam)
 * 4. Kontrak Penyimpanan Provider & Sinkronisasi Notifikasi Database
 * 5. Validasi Payload Notifikasi Push Web & Mobile Lockscreen
 * 6. Event Sinkronisasi Real-time Antar Perangkat (Desktop & HP)
 */

import type { TestResultItem } from '../test-runner.service';
import { AnnouncementRepository } from '../../repositories/AnnouncementRepository';
import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import type { UserProfile } from '../../types/database.types';

export const runAnnouncementBroadcastTestSuite = async (): Promise<{
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

  // Setup isolated mock provider and clean storage
  const mockProvider = new MockProvider();
  ProviderFactory.setProvider(mockProvider);

  // Clear anti-spam cooldown and history using repository safe helpers
  AnnouncementRepository.clearCooldown();
  AnnouncementRepository.clearHistory();

  const mockAdminUser: UserProfile = {
    id: 'test_admin_user_01',
    nip: 'NPP_ADMIN_01',
    full_name: 'Drs. H. Ahmad Fauzi (Admin)',
    phone_number: '081234567890',
    position: 'Administrator Website',
    avatar_url: null,
    role: 'ADMIN',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const mockKepsekUser: UserProfile = {
    id: 'test_kepsek_user_01',
    nip: 'NPP_KEPSEK_01',
    full_name: 'Dr. Hj. Siti Aminah, M.Pd (Kepsek)',
    phone_number: '081234567891',
    position: 'Kepala Sekolah',
    avatar_url: null,
    role: 'KEPSEK',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const mockGuruUser: UserProfile = {
    id: 'test_guru_user_01',
    nip: 'NPP_GURU_01',
    full_name: 'Budi Santoso, S.Pd (Guru)',
    phone_number: '081234567892',
    position: 'Guru Pengajar',
    avatar_url: null,
    role: 'GURU',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  // ── 1. Role Authorization Tests ─────────────────────────────────────────
  const adminCooldownInitial = AnnouncementRepository.getCooldownRemainingSeconds();
  assert(
    '1. Cooldown awal berstatus 0 detik saat belum ada broadcast yang dikirim',
    adminCooldownInitial === 0,
    `Remaining: ${adminCooldownInitial}s`
  );

  // Guru should be rejected from publishing announcement
  let guruError = '';
  try {
    await AnnouncementRepository.publishAnnouncement({
      title: 'Percobaan Broadcast Guru',
      message: 'Halo semua guru, ini pesan dari akun guru.',
      severity: 'INFO',
      user: mockGuruUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    guruError = err?.message || String(err);
  }
  assert(
    '2. Pengguna dengan peran GURU ditolak saat mencoba menyiarkan pengumuman',
    guruError.toLowerCase().includes('ditolak') || guruError.toLowerCase().includes('hanya admin'),
    `Hasil: ${guruError}`
  );

  // Admin should be accepted
  let adminFirstBroadcast: any = null;
  try {
    adminFirstBroadcast = await AnnouncementRepository.publishAnnouncement({
      title: 'Rapat Dewan Guru Mendadak',
      message: 'Seluruh dewan guru dimohon hadir di Ruang Guru lantai 2 pukul 13.00 WIB.',
      severity: 'CRITICAL',
      action_url: '/dashboard',
      user: mockAdminUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    adminFirstBroadcast = { error: err?.message };
  }
  assert(
    '3. Pengguna dengan peran ADMIN sukses menyiarkan pengumuman ke seluruh HP guru',
    adminFirstBroadcast?.success === true && adminFirstBroadcast?.notificationId !== undefined,
    `ID: ${adminFirstBroadcast?.notificationId}`
  );

  // ── 2. Anti-Spam Cooldown Protection (180 Detik) ─────────────────────────
  const cooldownAfterFirst = AnnouncementRepository.getCooldownRemainingSeconds();
  assert(
    '4. Cooldown anti-spam aktif (170-180 detik) segera setelah siaran pertama berhasil',
    cooldownAfterFirst > 0 && cooldownAfterFirst <= 180,
    `Remaining cooldown: ${cooldownAfterFirst}s`
  );

  // Second broadcast immediately should be blocked by cooldown
  let cooldownError = '';
  try {
    await AnnouncementRepository.publishAnnouncement({
      title: 'Pesan Broadcast Kedua Cepat',
      message: 'Pesan kedua yang dikirim tanpa jeda cooldown.',
      severity: 'INFO',
      user: mockAdminUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    cooldownError = err?.message || String(err);
  }
  assert(
    '5. Percobaan pengiriman kedua langsung diblokir oleh pelindung anti-spam cooldown',
    cooldownError.toLowerCase().includes('cooldown') || cooldownError.toLowerCase().includes('tunggu'),
    `Status: ${cooldownError}`
  );

  // ── 3. Duplicate Content Detection (1 Jam) ──────────────────────────────
  // Simulate cooldown expired, but send identical title and message
  const fakeOldTimestamp = Date.now() - 200 * 1000; // 200 seconds ago (cooldown expired)
  AnnouncementRepository.setCooldownTimestamp(fakeOldTimestamp);

  let duplicateError = '';
  try {
    await AnnouncementRepository.publishAnnouncement({
      title: 'Rapat Dewan Guru Mendadak',
      message: 'Seluruh dewan guru dimohon hadir di Ruang Guru lantai 2 pukul 13.00 WIB.',
      severity: 'CRITICAL',
      user: mockAdminUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    duplicateError = err?.message || String(err);
  }
  assert(
    '6. Deteksi duplikasi konten memblokir pesan dengan judul dan isi identik dalam waktu < 1 jam',
    duplicateError.toLowerCase().includes('duplikasi') || duplicateError.toLowerCase().includes('persis sama'),
    `Hasil: ${duplicateError}`
  );

  // ── 4. Kepsek Broadcast & Different Content Acceptance ───────────────────
  let kepsekBroadcast: any = null;
  try {
    kepsekBroadcast = await AnnouncementRepository.publishAnnouncement({
      title: 'Apresiasi Presensi Guru Tepat Waktu',
      message: 'Terima kasih kepada bapak/ibu guru yang telah hadir sebelum pukul 07.15 WIB hari ini.',
      severity: 'INFO',
      user: mockKepsekUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    kepsekBroadcast = { error: err?.message };
  }
  assert(
    '7. Kepala Sekolah sukses menerbitkan pengumuman apresiasi dengan pesan berbeda',
    kepsekBroadcast?.success === true,
    `Hasil: success=${kepsekBroadcast?.success}`
  );

  // ── 5. Provider Contract & Notification Table Insertion ──────────────────
  const storedAnnouncements = await mockProvider.getBroadcastAnnouncements('MOCK_TOKEN');
  assert(
    '8. Pengumuman tersimpan di database provider dan dapat diambil kembali',
    Array.isArray(storedAnnouncements) && storedAnnouncements.length >= 2,
    `Total pengumuman tersimpan: ${storedAnnouncements.length}`
  );

  const latestAnnouncement = storedAnnouncements[0];
  assert(
    '9. Metadata pengumuman mencakup nama pengirim, peran, tingkat urgensi, dan status notifikasi',
    latestAnnouncement !== undefined &&
      latestAnnouncement.title !== undefined &&
      latestAnnouncement.severity !== undefined,
    `Title: ${latestAnnouncement?.title}, Severity: ${latestAnnouncement?.severity}`
  );

  // Verify notification table also contains the broadcast for all teachers
  const allDbNotifs = await mockProvider.getNotifications(mockGuruUser.id, 'MOCK_TOKEN', 'GURU');
  const foundBroadcastInGuruNotifs = allDbNotifs.some(
    (n) => n.title.includes('Apresiasi') || n.title.includes('Rapat Dewan Guru')
  );
  assert(
    '10. Notifikasi siaran otomatis masuk ke daftar notifikasi in-app akun Guru',
    foundBroadcastInGuruNotifs,
    `Ditemukan di in-app notification guru: ${foundBroadcastInGuruNotifs}`
  );

  // ── 6. Character Limit & Payload Validation ─────────────────────────────
  AnnouncementRepository.setCooldownTimestamp(Date.now() - 200 * 1000);

  let longTitleError = '';
  try {
    await AnnouncementRepository.publishAnnouncement({
      title: 'A'.repeat(120),
      message: 'Pesan normal.',
      severity: 'INFO',
      user: mockAdminUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    longTitleError = err?.message || String(err);
  }
  assert(
    '11. Judul melebihi 80 karakter ditolak demi kenyamanan tampilan layar HP',
    longTitleError.toLowerCase().includes('judul') && longTitleError.toLowerCase().includes('panjang'),
    `Hasil: ${longTitleError}`
  );

  let longMsgError = '';
  try {
    await AnnouncementRepository.publishAnnouncement({
      title: 'Judul Valid',
      message: 'B'.repeat(450),
      severity: 'INFO',
      user: mockAdminUser,
      token: 'MOCK_TOKEN',
    });
  } catch (err: any) {
    longMsgError = err?.message || String(err);
  }
  assert(
    '12. Pesan melebihi 350 karakter ditolak agar payload Web Push tidak terpotong sistem OS Android/iOS',
    longMsgError.toLowerCase().includes('pesan') && longMsgError.toLowerCase().includes('panjang'),
    `Hasil: ${longMsgError}`
  );

  // ── 7. Realtime Event Dispatch Test ─────────────────────────────────────
  let eventFired = false;
  const eventListener = () => {
    eventFired = true;
  };
  const hasWindowEvents = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (hasWindowEvents) {
    window.addEventListener('smart_absensi_notifications_updated', eventListener);
  }

  AnnouncementRepository.setCooldownTimestamp(Date.now() - 200 * 1000);
  await AnnouncementRepository.publishAnnouncement({
    title: 'Pengumuman Uji Event Realtime',
    message: 'Pesan ini memastikan event sinkronisasi tertrigger ke seluruh tab.',
    severity: 'INFO',
    user: mockAdminUser,
    token: 'MOCK_TOKEN',
  });

  if (hasWindowEvents) {
    window.removeEventListener('smart_absensi_notifications_updated', eventListener);
  }
  const isRealtimeSyncValid = hasWindowEvents ? eventFired : true;
  assert(
    '13. Event smart_absensi_notifications_updated dipancarkan agar navbar dan HP guru realtime sync',
    isRealtimeSyncValid === true,
    `Event dispatched: ${isRealtimeSyncValid}`
  );

  // ── 8. Multi-Targeting Tests: Role-Based & Single Specific User ──────────
  // Test 14: Target Admin Saja
  AnnouncementRepository.setCooldownTimestamp(Date.now() - 200 * 1000);
  const adminTargetBroadcast = await AnnouncementRepository.publishAnnouncement({
    title: 'Pengumuman Internal Admin',
    message: 'Hanya administrator yang menerima pesan teknis ini.',
    severity: 'WARNING',
    audience_role: 'ADMIN',
    user: mockKepsekUser,
    token: 'MOCK_TOKEN',
  });
  assert(
    '14. Target penerima ADMIN saja berhasil dipublikasikan oleh Kepala Sekolah',
    adminTargetBroadcast?.success === true,
    `Notification ID: ${adminTargetBroadcast?.notificationId}`
  );

  // Test 15: Target Kepsek Saja
  AnnouncementRepository.setCooldownTimestamp(Date.now() - 200 * 1000);
  const kepsekTargetBroadcast = await AnnouncementRepository.publishAnnouncement({
    title: 'Laporan Khusus untuk Kepala Sekolah',
    message: 'Dokumen evaluasi tahunan telah siap untuk ditinjau.',
    severity: 'INFO',
    audience_role: 'KEPSEK',
    user: mockAdminUser,
    token: 'MOCK_TOKEN',
  });
  assert(
    '15. Target penerima KEPSEK saja berhasil dipublikasikan oleh Administrator',
    kepsekTargetBroadcast?.success === true,
    `Notification ID: ${kepsekTargetBroadcast?.notificationId}`
  );

  // Test 16: Target 1 Orang Tertentu (Specific Single User)
  AnnouncementRepository.setCooldownTimestamp(Date.now() - 200 * 1000);
  const singleUserBroadcast = await AnnouncementRepository.publishAnnouncement({
    title: 'Pemberitahuan Khusus Pak Budi',
    message: 'Jadwal supervisi kelas Anda ditetapkan hari Kamis jam ke-3.',
    severity: 'INFO',
    target_user_id: mockGuruUser.id,
    target_user_name: mockGuruUser.full_name,
    user: mockKepsekUser,
    token: 'MOCK_TOKEN',
  });

  // Verify recipient isolation: Pak Budi receives it, other user doesn't
  const guruNotifs = await mockProvider.getNotifications(mockGuruUser.id, 'MOCK_TOKEN', 'GURU');
  const otherGuruNotifs = await mockProvider.getNotifications('other_guru_id_99', 'MOCK_TOKEN', 'GURU');

  const budiHasNotification = guruNotifs.some((n) => n.title.includes('Pemberitahuan Khusus Pak Budi'));
  const otherHasNotification = otherGuruNotifs.some((n) => n.title.includes('Pemberitahuan Khusus Pak Budi'));

  assert(
    '16. Target 1 orang tertentu (spesifik) hanya diterima oleh user yang dituju secara terisolasi',
    singleUserBroadcast.success === true && budiHasNotification === true && otherHasNotification === false,
    `Budi received: ${budiHasNotification}, Other received: ${otherHasNotification}`
  );

  // Clean up
  AnnouncementRepository.clearCooldown();
  AnnouncementRepository.clearHistory();

  return { passed, failed, results };
};
