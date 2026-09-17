-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 42: FIX SECURITY DEFINER ON users_public_view
-- Issue: Supabase Linter mendeteksi view dengan property SECURITY DEFINER
--        yang menyebabkan RLS dievaluasi menggunakan permission pemilik view
--        (postgres), bukan permission user yang melakukan query.
-- Fix:   Recreate view dengan `security_invoker = true` agar RLS dievaluasi
--        sesuai konteks user yang melakukan query (anon / authenticated).
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fnppfmjsbqxbtioypnap/sql
-- ============================================================================

-- 1. Drop existing view
DROP VIEW IF EXISTS public.users_public_view CASCADE;

-- 2. Recreate view WITH security_invoker = true
--    Ini memastikan RLS pada tabel `public.users` dievaluasi menggunakan
--    role pemanggil (anon/authenticated), BUKAN role pemilik view (postgres).
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
'View profil publik guru/staf yang aman dan hemat egress. Mengecualikan kolom sensitif pin_hash, locked_until, dan failed_login_count. Menggunakan SECURITY INVOKER untuk menghormati RLS pemanggil.';

-- 3. Re-grant permissions (karena CASCADE drop menghapus semua grants)
GRANT SELECT ON public.users_public_view TO anon, authenticated, service_role;
