-- ============================================================================
-- SMART ABSENSI GURU — SQL MIGRATION: 13_calendar_schedule_and_holiday.sql
-- DIFERENSIASI KALENDER AKADEMIK:
-- 1. SCHEDULE (Jadwal Agenda / Pengingat Acara, Tetap Masuk & Presensi)
-- 2. HOLIDAY  (Hari Libur / Tanggal Merah, Libur Resmi)
--
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Pastikan tabel 'holidays' sudah ada (Idempotent DDL)
CREATE TABLE IF NOT EXISTS public.holidays (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'SCHOOL_HOLIDAY',
  category_type TEXT DEFAULT 'HOLIDAY',
  is_holiday BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan kolom 'category_type' & 'is_holiday' jika tabel sudah ada sebelumnya
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'HOLIDAY';
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT TRUE;

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "holidays_select" ON public.holidays;
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT USING (true);
DROP POLICY IF EXISTS "holidays_insert" ON public.holidays;
CREATE POLICY "holidays_insert" ON public.holidays FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "holidays_update" ON public.holidays;
CREATE POLICY "holidays_update" ON public.holidays FOR UPDATE USING (true);
DROP POLICY IF EXISTS "holidays_delete" ON public.holidays;
CREATE POLICY "holidays_delete" ON public.holidays FOR DELETE USING (true);

-- 4. Update data lama jika ada yang bertipe acara/agenda khusus
UPDATE public.holidays
SET 
  category_type = 'SCHEDULE',
  is_holiday = FALSE
WHERE type IN ('OTHER', 'RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP');

-- 5. Indeks untuk performa query pencarian kalender per rentang tanggal
CREATE INDEX IF NOT EXISTS idx_holidays_date_category 
ON public.holidays (date, category_type);

-- 6. Muat ulang cache skema Supabase PostgREST
NOTIFY pgrst, 'reload schema';

-- 7. Insert Otomatis Jadwal Agenda Rutin: Hari Gajian Guru & Staf (Setiap Bulan Tanggal 10)
-- Kategori: SCHEDULE, is_holiday: FALSE (Tetap Masuk & Presensi Normal)
INSERT INTO public.holidays (id, date, name, type, category_type, is_holiday, description)
VALUES
  ('hol_payday_2026_01', '2026-01-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_02', '2026-02-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_03', '2026-03-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_04', '2026-04-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_05', '2026-05-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_06', '2026-06-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_07', '2026-07-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_08', '2026-08-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_09', '2026-09-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_10', '2026-10-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_11', '2026-11-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.'),
  ('hol_payday_2026_12', '2026-12-10', 'Hari Gajian Guru & Staf', 'OTHER', 'SCHEDULE', FALSE, 'Penggajian bulanan guru dan staf sekolah. Tetap masuk & presensi.')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  category_type = EXCLUDED.category_type,
  is_holiday = EXCLUDED.is_holiday,
  description = EXCLUDED.description;

