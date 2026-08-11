-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: TAMBAH KOLOM NOTES PADA TABEL ATTENDANCE
-- Jalankan Script SQL ini di Supabase SQL Editor jika ingin kolom 'notes'
-- tersimpan langsung pada tabel 'attendance' (opsional & aman):
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes TEXT;
