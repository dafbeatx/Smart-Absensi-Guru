-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 69: HAPUS PERMANEN ISI NPP KESELURUHAN GURU
-- Fitur: Pembersihan Permanen NPP / NIP Guru & Tenaga Kependidikan
-- Sekolah: SMP Terpadu Al-Ittihadiyah
-- Target Database: fnppfmjsbqxbtioypnap.supabase.co
-- Dashboard URL: https://supabase.com/dashboard/project/fnppfmjsbqxbtioypnap/sql
-- Tanggal: 2026-11-03
-- ==============================================================================

BEGIN;

-- 1. Kosongkan NIP/NPP pada tabel master pengguna (public.users)
-- Memastikan seluruh akun guru, staf, operator, dan pimpinan tidak lagi memiliki data NPP
UPDATE public.users
SET 
    nip = NULL,
    updated_at = timezone('utc', now())
WHERE nip IS NOT NULL;

-- 2. Kosongkan NPP konselor pada tabel catatan bimbingan konseling (public.counseling_records)
UPDATE public.counseling_records
SET 
    counselor_npp = NULL,
    updated_at = timezone('utc', now())
WHERE counselor_npp IS NOT NULL;

-- 3. Kosongkan NPP guru pada tabel catatan bimtek & diklat (public.bimtek_records) jika ada
UPDATE public.bimtek_records
SET 
    teacher_nip = NULL,
    updated_at = timezone('utc', now())
WHERE teacher_nip IS NOT NULL;

-- 4. Verifikasi hasil pembersihan
DO $$
DECLARE
    v_users_with_nip INTEGER;
    v_bk_with_npp INTEGER;
    v_bimtek_with_nip INTEGER;
BEGIN
    SELECT count(*) INTO v_users_with_nip FROM public.users WHERE nip IS NOT NULL;
    SELECT count(*) INTO v_bk_with_npp FROM public.counseling_records WHERE counselor_npp IS NOT NULL;
    SELECT count(*) INTO v_bimtek_with_nip FROM public.bimtek_records WHERE teacher_nip IS NOT NULL;

    IF v_users_with_nip > 0 OR v_bk_with_npp > 0 OR v_bimtek_with_nip > 0 THEN
        RAISE EXCEPTION 'Pembersihan NPP belum tuntas: users(%), bk(%), bimtek(%)',
            v_users_with_nip, v_bk_with_npp, v_bimtek_with_nip;
    ELSE
        RAISE NOTICE 'Sukses: Seluruh isi NPP guru telah dibersihkan secara permanen (0 data tersisa).';
    END IF;
END $$;

COMMIT;

