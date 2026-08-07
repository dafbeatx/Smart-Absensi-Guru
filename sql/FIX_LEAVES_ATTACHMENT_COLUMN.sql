-- ============================================================================
-- SMART ABSENSI GURU — FIX MIGRATION: TAMBAH KOLOM attachment_url DI TABEL leaves
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

COMMENT ON COLUMN public.leaves.attachment_url IS 'URL atau data Base64 berkas lampiran (surat dokter/dinas/izin)';
