-- ============================================================================
-- SMART ABSENSI GURU — AUDIT PRE-MIGRATION 45: TEACHER POINT HISTORY
-- Mode: 100% READ-ONLY (Aman dijalankan tanpa mengubah data atau schema)
-- Jalankan query ini di Supabase SQL Editor sebelum menjalankan migrasi:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- 1. Periksa Kolom pada public.users (Verifikasi keberadaan auth_user_id, school_id, account_status, role)
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Periksa Distribusi Role & Account Status pada public.users
SELECT 
  role, 
  account_status, 
  COUNT(*) AS total_users
FROM public.users
GROUP BY role, account_status
ORDER BY total_users DESC;

-- 3. Periksa Kolom pada public.teacher_point_history
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'teacher_point_history'
ORDER BY ordinal_position;

-- 4. Audit Duplikasi idempotency_key pada public.teacher_point_history
-- JIKA HASILNYA > 0: Migration unique index harus dihentikan untuk review data duplikat
SELECT 
  idempotency_key, 
  COUNT(*) AS duplicate_count
FROM public.teacher_point_history
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1;

-- 5. Periksa Policy RLS yang Saat Ini Aktif pada public.teacher_point_history
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'teacher_point_history';

-- 6. Periksa Hak Akses / Grants pada public.teacher_point_history
SELECT 
  grantee, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'teacher_point_history';
