-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 19: ENABLE SUPABASE REALTIME REPLICATION
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tujuan:
-- Mengaktifkan penerbitan event real-time (PostgreSQL Changes) pada tabel
-- public.attendance dan public.leaves ke publikasi supabase_realtime.
--
-- Hal ini memungkinkan sinkronisasi real-time instan lintas perangkat (Cross-Device)
-- antara HP guru (saat absen masuk/pulang) dan Laptop Admin / Kepsek (Live Tracking).
-- ============================================================================

-- 1. Pastikan REPLICA IDENTITY diset ke FULL agar Supabase Realtime menerima data lengkap saat UPDATE / DELETE
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.leaves REPLICA IDENTITY FULL;

-- 2. Tambahkan tabel public.attendance dan public.leaves ke publication supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leaves'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaves;
  END IF;
END $$;
