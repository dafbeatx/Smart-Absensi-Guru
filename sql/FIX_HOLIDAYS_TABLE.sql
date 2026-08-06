-- ============================================================================
-- SMART ABSENSI GURU — FIX HOLIDAYS TABLE SCHEMA (TAMBAH KOLOM 'type')
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Tambahkan kolom 'type' ke tabel holidays jika belum ada
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'SCHOOL_HOLIDAY';

-- 2. Muat ulang cache skema Supabase PostgREST
NOTIFY pgrst, 'reload schema';
