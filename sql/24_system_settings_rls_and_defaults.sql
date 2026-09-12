-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 24: TABEL SYSTEM_SETTINGS & RLS SYNC
-- Sinkronisasi Pengaturan Nama Utama Aplikasi, Identitas Sekolah & Operational Hours
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- 1. Buat Tabel public.system_settings jika belum ada
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan RLS (Public / Authenticated Access)
-- Pengaturan sistem (Nama Aplikasi, Sub-Branding, Jam Kerja, Geofence) wajib dapat dibaca oleh publik & guru
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
CREATE POLICY "system_settings_select_policy" ON public.system_settings
  FOR SELECT
  USING (true);

-- Admin & Operator dapat menambahkan / mengupdate pengaturan
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
CREATE POLICY "system_settings_insert_policy" ON public.system_settings
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
CREATE POLICY "system_settings_update_policy" ON public.system_settings
  FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "system_settings_delete_policy" ON public.system_settings;
CREATE POLICY "system_settings_delete_policy" ON public.system_settings
  FOR DELETE
  USING (true);

-- 4. Seed Nilai Default Pengaturan Sistem (Idempotent)
INSERT INTO public.system_settings (key, value)
VALUES
  ('app_name', 'Smart Absensi Guru'),
  ('institution_name', 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam'),
  ('work_checkin_start', '06:00'),
  ('work_checkin_end', '07:15'),
  ('work_checkout_start', '14:00'),
  ('friday_checkout_start', '11:30'),
  ('saturday_is_holiday', 'true'),
  ('sunday_is_holiday', 'true'),
  ('geofence_lat', '-6.613144'),
  ('geofence_lng', '106.812294'),
  ('geofence_radius', '200')
ON CONFLICT (key) DO NOTHING;

-- 5. Tambahkan ke Publikasi Realtime Supabase (jika belum terdaftar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Abaikan jika ekstensi realtime belum aktif di instance
END $$;
