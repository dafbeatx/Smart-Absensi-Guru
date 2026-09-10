import type { UserProfile } from '../../../types/database.types';

/**
 * Memeriksa apakah pengguna yang aktif adalah M. Iqbal Gustiawan (Wakasek Sarana dan Prasarana).
 * Hanya beliau yang berhak melihat icon/menu input form inventaris sarpras di halaman guru.
 * Guru lain tidak akan muncul icon maupun menu tersebut.
 */
export function isUserSarprasOfficer(user?: UserProfile | null): boolean {
  if (!user) return false;

  // 1. Identifikasi berdasarkan ID pengguna
  if (user.id === 'usr_guru_002') return true;

  // 2. Identifikasi berdasarkan nomor HP terdaftar
  const cleanPhone = (user.phone_number || '').replace(/\D/g, '');
  if (cleanPhone === '081947674030' || cleanPhone === '6281947674030') return true;

  // 3. Identifikasi berdasarkan nama lengkap
  const name = (user.full_name || '').toLowerCase();
  if (name.includes('iqbal gustiawan') || (name.includes('iqbal') && name.includes('gustiawan'))) {
    return true;
  }

  // 4. Identifikasi berdasarkan jabatan resmi
  const pos = (user.position || '').toLowerCase();
  if (pos.includes('sarana dan prasarana') || pos.includes('sarpras') || pos.includes('wakasek sarana')) {
    return true;
  }

  return false;
}

/**
 * Memeriksa apakah pengguna berhak melihat tampilan eksekutif rekap inventaris sarpras.
 * Khusus Kepala Sekolah (KEPSEK) dan Administrator.
 */
export function canViewSarprasExecutive(user?: UserProfile | null): boolean {
  if (!user) return false;

  if (user.role === 'KEPSEK' || user.role === 'ADMIN' || user.role === 'OPERATOR') {
    return true;
  }

  const pos = (user.position || '').toLowerCase();
  if (pos.includes('kepala sekolah')) {
    return true;
  }

  return false;
}
