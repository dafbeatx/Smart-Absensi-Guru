-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 73: ORAL EXAM CLOUD PERSISTENCE TABLES & RLS
-- Memastikan seluruh hasil penilaian Ujian Lisan (Bahasa Inggris/Arab & BTQ/Hafalan)
-- serta penempatan penguji tersimpan permanen di PostgreSQL Cloud (zero localStorage).
-- Script ini idempotent (aman dijalankan berulang kali di Supabase SQL Editor).
-- ==============================================================================

-- 1. Tabel Sesi & Nilai Ujian Lisan (BTQ, Hafalan, Checklist Bahasa Inggris/Arab)
CREATE TABLE IF NOT EXISTS public.oral_exam_sessions (
  id TEXT PRIMARY KEY,
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  semester TEXT NOT NULL DEFAULT 'GANJIL',
  template_type TEXT NOT NULL,
  subject_scope TEXT,
  group_id TEXT,
  title TEXT NOT NULL,
  examiner_user_id TEXT,
  examiner_name TEXT NOT NULL,
  examiner_npp TEXT,
  room_number TEXT NOT NULL DEFAULT 'Ruang 01',
  class_name TEXT NOT NULL DEFAULT '7',
  exam_date TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 15,
  students JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oral_exam_sessions_year_updated
  ON public.oral_exam_sessions (academic_year, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_oral_exam_sessions_group_template
  ON public.oral_exam_sessions (group_id, template_type);

-- 2. Strict Row Level Security (Semua mutasi wajib melalui endpoint terautentikasi)
ALTER TABLE public.oral_exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oral_exam_sessions_service_role_all" ON public.oral_exam_sessions;
DROP POLICY IF EXISTS "oral_exam_sessions_read_policy" ON public.oral_exam_sessions;
DROP POLICY IF EXISTS "oral_exam_sessions_all_policy" ON public.oral_exam_sessions;

CREATE POLICY "oral_exam_sessions_service_role_all"
  ON public.oral_exam_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "oral_exam_sessions_read_policy"
  ON public.oral_exam_sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.oral_exam_sessions FROM anon;
GRANT SELECT ON public.oral_exam_sessions TO anon, authenticated;
GRANT ALL ON public.oral_exam_sessions TO service_role;

-- 3. Tambahkan ke publikasi Realtime agar perangkat Admin & Guru sinkron otomatis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'oral_exam_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.oral_exam_sessions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Lewati alter publication untuk oral_exam_sessions: %', SQLERRM;
END $$;
