-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: RIWAYAT PENDAPATAN POIN GURU (IDEMPOTENT)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tabel: public.teacher_point_history
-- Menyimpan riwayat perolehan poin disiplin, kehadiran tepat waktu,
-- presensi pulang, tugas piket, dan penalti guru secara transparan dan terdata per kejadian.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_point_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teacher_name    TEXT,
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

-- ============================================================================
-- AUTOMATIC BACKFILL / REKONSILIASI OTOMATIS DATA POIN KEHADIRAN GURU
-- Mengisi riwayat poin secara otomatis dari rekaman kehadiran nyata di tabel attendance
-- (Termasuk tanggal 8 & 9 September 2026 dan tanggal sebelumnya)
-- ============================================================================

-- 1. Backfill Presensi Masuk (Tepat Waktu: +15 Poin | Terlambat: +5 Poin)
INSERT INTO public.teacher_point_history (user_id, teacher_name, date, points, activity_type, title, description, created_at)
SELECT 
  a.user_id,
  u.full_name as teacher_name,
  a.date::date,
  CASE WHEN a.status = 'TERLAMBAT' THEN 5 ELSE 15 END as points,
  CASE WHEN a.status = 'TERLAMBAT' THEN 'CHECK_IN_LATE' ELSE 'CHECK_IN_ON_TIME' END as activity_type,
  CASE WHEN a.status = 'TERLAMBAT' THEN 'Presensi Masuk Sekolah (> 07:30 WIB)' ELSE 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)' END as title,
  'Tercatat hadir pukul ' || COALESCE(a.check_in_time::text, '07:00') || ' WIB' as description,
  (a.date::text || ' ' || COALESCE(a.check_in_time::text, '07:00:00'))::timestamptz as created_at
FROM public.attendance a
LEFT JOIN public.users u ON u.id = a.user_id
WHERE a.status IN ('HADIR', 'TERLAMBAT')
ON CONFLICT (user_id, date, activity_type) DO NOTHING;

-- 2. Backfill Presensi Pulang Tuntas Bertugas (+10 Poin)
INSERT INTO public.teacher_point_history (user_id, teacher_name, date, points, activity_type, title, description, created_at)
SELECT 
  a.user_id,
  u.full_name as teacher_name,
  a.date::date,
  10 as points,
  'CHECK_OUT' as activity_type,
  'Presensi Pulang Tuntas Bertugas' as title,
  'Tercatat menyelesaikan dinas sekolah pada pukul ' || a.check_out_time::text || ' WIB' as description,
  (a.date::text || ' ' || a.check_out_time::text)::timestamptz as created_at
FROM public.attendance a
LEFT JOIN public.users u ON u.id = a.user_id
WHERE a.check_out_time IS NOT NULL
ON CONFLICT (user_id, date, activity_type) DO NOTHING;

-- 3. Backfill Tugas Piket Harian Sekolah (+10 Poin)
INSERT INTO public.teacher_point_history (user_id, teacher_name, date, points, activity_type, title, description, created_at)
SELECT 
  a.user_id,
  u.full_name as teacher_name,
  a.date::date,
  10 as points,
  'DUTY_PIKET' as activity_type,
  'Tugas Piket Harian Sekolah' as title,
  'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah' as description,
  (a.date::text || ' 07:30:00')::timestamptz as created_at
FROM public.attendance a
LEFT JOIN public.users u ON u.id = a.user_id
INNER JOIN public.teacher_duty_schedules tds 
  ON tds.teacher_id = a.user_id 
  AND tds.day_of_week = EXTRACT(DOW FROM a.date::date)
WHERE a.status IN ('HADIR', 'TERLAMBAT')
ON CONFLICT (user_id, date, activity_type) DO NOTHING;

-- 4. Backfill Teladan Fajar (Early Bird ≤ 07:00 WIB: +5 Poin)
INSERT INTO public.teacher_point_history (user_id, teacher_name, date, points, activity_type, title, description, created_at)
SELECT 
  a.user_id,
  u.full_name as teacher_name,
  a.date::date,
  5 as points,
  'EARLY_BIRD_BONUS' as activity_type,
  '🌅 Teladan Fajar (Early Bird ≤ 07:00 WIB)' as title,
  'Tercatat hadir sangat awal pukul ' || COALESCE(a.check_in_time::text, '06:50') || ' WIB menyambut siswa' as description,
  (a.date::text || ' ' || COALESCE(a.check_in_time::text, '06:50:00'))::timestamptz as created_at
FROM public.attendance a
LEFT JOIN public.users u ON u.id = a.user_id
WHERE a.status = 'HADIR' 
  AND a.check_in_time IS NOT NULL 
  AND a.check_in_time::time <= '07:00:00'::time
ON CONFLICT (user_id, date, activity_type) DO NOTHING;

