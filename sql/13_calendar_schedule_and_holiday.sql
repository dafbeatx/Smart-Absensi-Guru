-- ============================================================================
-- SMART ABSENSI GURU — SQL MIGRATION: 13_calendar_schedule_and_holiday.sql
-- DIFERENSIASI KALENDER AKADEMIK:
-- 1. SCHEDULE (Jadwal Agenda / Pengingat Acara, Tetap Masuk & Presensi)
-- 2. HOLIDAY  (Hari Libur / Tanggal Merah, Libur Resmi)
--
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Tambahkan kolom 'category_type' ke tabel holidays
-- Nilai: 'HOLIDAY' (Hari Libur) atau 'SCHEDULE' (Jadwal Agenda Acara)
ALTER TABLE public.holidays 
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'HOLIDAY';

-- 2. Tambahkan kolom 'is_holiday' (BOOLEAN)
-- TRUE  = Membuat guru libur (presensi dinonaktifkan)
-- FALSE = Tidak membuat guru libur (pengingat acara, KBM/presensi tetap wajib)
ALTER TABLE public.holidays 
ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT TRUE;

-- 3. Update data lama jika ada yang bertipe acara/agenda khusus
UPDATE public.holidays
SET 
  category_type = 'SCHEDULE',
  is_holiday = FALSE
WHERE type IN ('OTHER', 'RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP');

-- 4. Indeks untuk performa query pencarian kalender per rentang tanggal
CREATE INDEX IF NOT EXISTS idx_holidays_date_category 
ON public.holidays (date, category_type);

-- 5. Muat ulang cache skema Supabase PostgREST
NOTIFY pgrst, 'reload schema';
