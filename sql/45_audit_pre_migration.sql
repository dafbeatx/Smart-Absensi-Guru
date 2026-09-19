-- ============================================================================
-- SMART ABSENSI GURU — AUDIT PRE-MIGRATION 45: TEACHER POINT HISTORY
-- Mode: 100% READ-ONLY & BULLETPROOF (Aman dijalankan tanpa error 42703)
-- Jalankan query ini di Supabase SQL Editor sebelum menjalankan migrasi 45:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Periksa Seluruh Kolom pada public.users (auth_user_id, role, school_id, dll)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Periksa Distribusi Role & Account Status pada public.users (Dynamic Safe)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_has_status BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'account_status'
  ) INTO v_has_status;

  DROP TABLE IF EXISTS _temp_user_audit;
  CREATE TEMP TABLE _temp_user_audit (
    role TEXT,
    account_status TEXT,
    total_users BIGINT
  );

  IF v_has_status THEN
    EXECUTE '
      INSERT INTO _temp_user_audit
      SELECT COALESCE(role, ''(NULL)''), COALESCE(account_status::TEXT, ''(NULL)''), COUNT(*)
      FROM public.users
      GROUP BY role, account_status
      ORDER BY COUNT(*) DESC';
  ELSE
    EXECUTE '
      INSERT INTO _temp_user_audit
      SELECT COALESCE(role, ''(NULL)''), ''(KOLOM_BELUM_ADA)'', COUNT(*)
      FROM public.users
      GROUP BY role
      ORDER BY COUNT(*) DESC';
  END IF;
END $$;

SELECT * FROM _temp_user_audit;
DROP TABLE IF EXISTS _temp_user_audit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Periksa Seluruh Kolom pada public.teacher_point_history
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'teacher_point_history'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Audit Status Kolom & Duplikasi idempotency_key (100% Dynamic Safe)
-- Catatan: Jika kolom belum dibuat, query ini mengembalikan status 'BELUM_ADA'
-- tanpa menimbulkan error 42703 (column does not exist).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_has_col BOOLEAN;
  v_dup_count INT := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'teacher_point_history' 
      AND column_name = 'idempotency_key'
  ) INTO v_has_col;

  DROP TABLE IF EXISTS _temp_idempotency_audit;
  CREATE TEMP TABLE _temp_idempotency_audit (
    status_kolom TEXT,
    duplikasi_terdeteksi INT,
    kesimpulan TEXT
  );

  IF NOT v_has_col THEN
    INSERT INTO _temp_idempotency_audit VALUES (
      'BELUM_ADA',
      0,
      'Aman: Kolom idempotency_key belum dibuat. Jalankan migrasi 45 untuk menambahkan kolom dan unique index.'
    );
  ELSE
    EXECUTE '
      SELECT COUNT(*) FROM (
        SELECT idempotency_key
        FROM public.teacher_point_history
        WHERE idempotency_key IS NOT NULL
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
      ) sub' INTO v_dup_count;

    IF v_dup_count = 0 THEN
      INSERT INTO _temp_idempotency_audit VALUES (
        'SUDAH_ADA',
        0,
        'Aman: Bebas duplikasi (0 duplikat). Unique index aman dibuat.'
      );
    ELSE
      INSERT INTO _temp_idempotency_audit VALUES (
        'SUDAH_ADA',
        v_dup_count,
        'PERINGATAN: Ditemukan duplikasi! Review data sebelum membuat unique index.'
      );
    END IF;
  END IF;
END $$;

SELECT * FROM _temp_idempotency_audit;
DROP TABLE IF EXISTS _temp_idempotency_audit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Periksa Policy RLS yang Saat Ini Aktif pada public.teacher_point_history
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Periksa Hak Akses / Grants pada public.teacher_point_history
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
  grantee, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'teacher_point_history';
