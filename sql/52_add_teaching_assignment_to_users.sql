-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 52: ADD TEACHING ASSIGNMENT TO USERS
-- Fitur: Mata Pelajaran yang Diampu Guru (Opsional)
-- Deskripsi: Menambahkan kolom `teaching_assignment` ke tabel `public.users`
--            dan memperbarui `public.users_public_view` agar dapat diakses
--            secara aman, hemat egress, dan menghormati RLS (security_invoker).
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fnppfmjsbqxbtioypnap/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TAMBAHKAN KOLOM teaching_assignment KE TABEL FISIK public.users (Opsional)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS teaching_assignment TEXT;

COMMENT ON COLUMN public.users.teaching_assignment IS 
'Mata pelajaran yang diampu oleh guru/pendidik (opsional). Digunakan untuk pre-populasi jadwal pelajaran dan pembuatan soal ujian.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECREATE VIEW: public.users_public_view DENGAN KOLOM teaching_assignment
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop view lama jika ada (CASCADE menjamin tidak ada keterikatan struktur usang)
DROP VIEW IF EXISTS public.users_public_view CASCADE;

-- Buat ulang view dengan security_invoker = true sesuai standar Migration 40 & 42
CREATE OR REPLACE VIEW public.users_public_view
WITH (security_invoker = true)
AS
SELECT 
    id,
    nip,
    full_name,
    phone_number,
    role,
    position,
    account_status,
    avatar_url,
    biometric_credential_id,
    teaching_assignment,
    created_at,
    updated_at
FROM public.users;

COMMENT ON VIEW public.users_public_view IS 
'View profil publik guru/staf yang aman dan hemat egress. Mengecualikan kolom sensitif pin_hash, locked_until, dan failed_login_count, serta memuat teaching_assignment opsional.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HAK AKSES (PERMISSIONS) PADA VIEW & TABEL FISIK
-- ─────────────────────────────────────────────────────────────────────────────
-- Berikan izin SELECT pada view untuk semua role aplikasi
GRANT SELECT ON public.users_public_view TO anon, authenticated, service_role;

-- Berikan izin SELECT pada kolom baru di tabel fisik public.users
GRANT SELECT (
    teaching_assignment
) ON public.users TO anon, authenticated;

-- Berikan izin UPDATE pada kolom baru di tabel fisik public.users untuk pembaruan profil/data guru
GRANT UPDATE (
    teaching_assignment
) ON public.users TO anon, authenticated;

-- Pastikan service_role tetap memiliki akses penuh
GRANT ALL ON public.users TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RELOAD POSTGREST SCHEMA CACHE (WAJIB agar error schema cache 400 hilang)
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFIKASI INSTAN (Jalankan untuk menguji keabsahan struktur)
-- ─────────────────────────────────────────────────────────────────────────────
-- Query 1: Cek apakah kolom teaching_assignment terdaftar di view
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users_public_view' AND column_name = 'teaching_assignment';
--
-- Query 2: Membaca sampel data dari view
-- SELECT id, full_name, role, position, teaching_assignment 
-- FROM public.users_public_view 
-- LIMIT 5;

