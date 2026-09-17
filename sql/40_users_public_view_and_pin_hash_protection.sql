-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 40: USERS PUBLIC VIEW & PIN HASH PROTECTION
-- Fitur: Proteksi Kolom Sensitif pin_hash & Optimasi Bandwidth (Zero Egress Inflation)
-- Objek: public.users_public_view (VIEW) & Kolom Privileges pada public.users
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fnppfmjsbqxbtioypnap/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ANALISIS KEAMANAN & PENGHEMATAN EGRESS (BANDWIDTH)
-- ─────────────────────────────────────────────────────────────────────────────
-- Masalah Sebelumnya:
--   Jika klien web atau pihak luar mengeksekusi:
--   `supabase.from('users').select('*')`
--   Kolom `pin_hash`, `locked_until`, dan `failed_login_count` terkirim ke publik.
--   Selain membahayakan kredensial pengguna, pengiriman kolom `pin_hash` (64 karakter)
--   dan kolom keamanan internal lainnya memboroskan kuota Egress Supabase Free Tier (~5 GB).
--
-- Solusi:
--   1. Buat VIEW `public.users_public_view` yang HANYA memuat kolom profil publik.
--   2. Cabut hak SELECT pada kolom `pin_hash`, `locked_until`, dan `failed_login_count`
--      dari role `anon` dan `authenticated` pada tabel fisik `public.users`.
--   3. VIEW diproses murni di engine PostgreSQL server tanpa duplikasi data fisik,
--      sehingga ukuran payload HTTP menjadi LEBIH KECIL (MENGHEMAT EGRESS).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PEMBUATAN VIEW: public.users_public_view (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.users_public_view CASCADE;

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
    created_at,
    updated_at
FROM public.users;

COMMENT ON VIEW public.users_public_view IS 
'View profil publik guru/staf yang aman dan hemat egress. Mengecualikan kolom sensitif pin_hash, locked_until, dan failed_login_count.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HAK AKSES (PERMISSIONS) PADA VIEW
-- ─────────────────────────────────────────────────────────────────────────────
-- Mengizinkan aplikasi web (anon & authenticated) dan serverless (service_role)
-- untuk membaca data profil guru melalui VIEW
GRANT SELECT ON public.users_public_view TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. HARDENING TABEL FISIK public.users (COLUMN-LEVEL PRIVILEGE)
-- ─────────────────────────────────────────────────────────────────────────────
-- A. Pastikan service_role (backend / api/auth/login.ts) tetap memiliki hak penuh
GRANT ALL ON public.users TO service_role;

-- B. Cabut izin baca (SELECT) pada kolom sensitif dari role publik (anon & authenticated)
--    Dengan ini, jika ada pihak yang mencoba `supabase.from('users').select('pin_hash')`
--    atau `select('*')`, PostgreSQL akan langsung menolak dengan:
--    "permission denied for column pin_hash of relation users".
REVOKE SELECT (pin_hash, locked_until, failed_login_count) ON public.users FROM anon, authenticated;

-- C. Berikan izin SELECT secara eksplisit hanya untuk kolom non-sensitif di public.users
--    (Menjamin kueri spesifik yang sudah ada tetap berjalan tanpa hambatan)
GRANT SELECT (
    id,
    nip,
    full_name,
    phone_number,
    role,
    position,
    account_status,
    avatar_url,
    biometric_credential_id,
    created_at,
    updated_at
) ON public.users TO anon, authenticated;

-- D. Pertahankan izin UPDATE untuk pembaruan profil mandiri / reset status
GRANT UPDATE (
    full_name,
    nip,
    phone_number,
    position,
    avatar_url,
    account_status,
    updated_at
) ON public.users TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFIKASI INSTAN (Bisa dijalankan di SQL Editor untuk tes)
-- ─────────────────────────────────────────────────────────────────────────────
-- Query 1: Membaca via View (Harus Berhasil & Egress Berkurang):
-- SELECT * FROM public.users_public_view LIMIT 5;
--
-- Query 2: Kolom pin_hash dipastikan TIDAK ADA di users_public_view:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'users_public_view';
-- (Hasil tidak memuat pin_hash, locked_until, failed_login_count)
