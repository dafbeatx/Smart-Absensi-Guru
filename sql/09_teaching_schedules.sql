-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: TABEL JADWAL MENGAJAR GURU (TEACHING SCHEDULES)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teaching_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teacher_name  TEXT NOT NULL,
  day           TEXT NOT NULL, -- 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  time          TEXT NOT NULL, -- e.g. '07:30 - 08:50'
  class_name    TEXT NOT NULL, -- e.g. 'Kelas VII-A'
  subject       TEXT NOT NULL, -- e.g. 'Matematika'
  room          TEXT NOT NULL, -- e.g. 'Ruang Teori 7A'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for high-speed retrieval
CREATE INDEX IF NOT EXISTS idx_teaching_schedules_user_id ON public.teaching_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_teaching_schedules_day ON public.teaching_schedules(day);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teaching_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "teaching_schedules_select" ON public.teaching_schedules;
CREATE POLICY "teaching_schedules_select" ON public.teaching_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "teaching_schedules_insert" ON public.teaching_schedules;
CREATE POLICY "teaching_schedules_insert" ON public.teaching_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "teaching_schedules_update" ON public.teaching_schedules;
CREATE POLICY "teaching_schedules_update" ON public.teaching_schedules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "teaching_schedules_delete" ON public.teaching_schedules;
CREATE POLICY "teaching_schedules_delete" ON public.teaching_schedules FOR DELETE USING (true);
