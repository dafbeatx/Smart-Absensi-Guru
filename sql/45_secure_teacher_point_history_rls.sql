-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 45: SECURE TEACHER POINT HISTORY & IDEMPOTENCY
-- Fitur: RLS Hardening, Defense-in-Depth, Idempotency Key, & Privilege Cleanup
-- Tabel Terkait: public.teacher_point_history
-- Dependensi: public.users(id, role, account_status)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMERIKSAAN & PENAMBAHAN KOLOM: idempotency_key
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'teacher_point_history' 
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.teacher_point_history 
      ADD COLUMN idempotency_key TEXT;
    RAISE NOTICE 'Kolom idempotency_key berhasil ditambahkan.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXING CEPAT UNTUK QUERY BUKU BESAR POIN & KLASEMEN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_teacher_point_history_user_id 
  ON public.teacher_point_history(user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_point_history_created_at 
  ON public.teacher_point_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_point_history_date 
  ON public.teacher_point_history(date DESC);

-- Unique index dibuat secara kondisional aman (hanya jika data bebas duplikasi)
DO $$
DECLARE
  v_dup_count INT;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT idempotency_key
    FROM public.teacher_point_history
    WHERE idempotency_key IS NOT NULL
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  ) sub;

  IF v_dup_count = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_point_history_idempotency 
             ON public.teacher_point_history(idempotency_key) 
             WHERE idempotency_key IS NOT NULL';
    RAISE NOTICE 'Unique index idx_teacher_point_history_idempotency berhasil dibuat.';
  ELSE
    RAISE WARNING 'Ditemukan % duplikasi idempotency_key. Unique index dilewati untuk mencegah kegagalan migrasi.', v_dup_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HELPER FUNCTION SECURITY DEFINER (MENCEGAH MASALAH RLS PADA USERS)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_is_active_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_auth_user_id BOOLEAN;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  -- Periksa apakah kolom auth_user_id tersedia pada public.users
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'auth_user_id'
  ) INTO v_has_auth_user_id;

  IF v_has_auth_user_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()::text)
        AND u.account_status = 'ACTIVE'
        AND u.role IN ('ADMIN', 'GURU', 'KEPSEK', 'KEPALA SEKOLAH', 'OPERATOR')
    ) INTO v_is_authorized;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text
        AND u.account_status = 'ACTIVE'
        AND u.role IN ('ADMIN', 'GURU', 'KEPSEK', 'KEPALA SEKOLAH', 'OPERATOR')
    ) INTO v_is_authorized;
  END IF;

  RETURN v_is_authorized;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) & PRIVILEGES (ZERO-TRUST DEFENSE-IN-DEPTH)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.teacher_point_history ENABLE ROW LEVEL SECURITY;

-- Hapus seluruh policy lama secara dinamis dari pg_policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'teacher_point_history'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teacher_point_history', pol.policyname);
    RAISE NOTICE 'Policy lama % berhasil dihapus.', pol.policyname;
  END LOOP;
END $$;

-- Kebijakan Baca Terbatas untuk Authenticated (Defense-in-Depth jika GoTrue Auth digunakan)
CREATE POLICY "teacher_point_history_authenticated_read"
  ON public.teacher_point_history
  FOR SELECT
  TO authenticated
  USING (
    public.check_is_active_staff()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PENCABUTAN HAK AKSES DML DARI KLIEN (ZERO DIRECT BROWSER MUTATION)
-- ─────────────────────────────────────────────────────────────────────────────
-- Klien anonim dan authenticated browser DILARANG KERAS melakukan INSERT, UPDATE, DELETE langsung
REVOKE ALL ON public.teacher_point_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_point_history FROM authenticated;
GRANT SELECT ON public.teacher_point_history TO authenticated;
GRANT ALL ON public.teacher_point_history TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RELOAD SCHEMA CACHE POSTGREST
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
