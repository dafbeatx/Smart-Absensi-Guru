-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: RIWAYAT PENDAPATAN POIN GURU (IDEMPOTENT)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tabel: public.teacher_point_history
-- Menyimpan riwayat perolehan poin disiplin, kehadiran tepat waktu,
-- tugas piket, dan penalti guru secara transparan dan terdata per kejadian.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_point_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  points          INTEGER NOT NULL,
  activity_type   TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_teacher_point_user_date_activity UNIQUE (user_id, date, activity_type)
);

-- Row Level Security (RLS)
ALTER TABLE public.teacher_point_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_point_history_select" ON public.teacher_point_history;
CREATE POLICY "teacher_point_history_select" ON public.teacher_point_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "teacher_point_history_insert" ON public.teacher_point_history;
CREATE POLICY "teacher_point_history_insert" ON public.teacher_point_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_point_history_update" ON public.teacher_point_history;
CREATE POLICY "teacher_point_history_update" ON public.teacher_point_history FOR UPDATE USING (true);

DROP POLICY IF EXISTS "teacher_point_history_delete" ON public.teacher_point_history;
CREATE POLICY "teacher_point_history_delete" ON public.teacher_point_history FOR DELETE USING (true);

-- Indexing untuk optimasi query berdasarkan guru dan tanggal
CREATE INDEX IF NOT EXISTS idx_teacher_point_history_user_id ON public.teacher_point_history(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_point_history_date    ON public.teacher_point_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_point_history_created ON public.teacher_point_history(created_at DESC);
