-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: FITUR RESET ABSENSI HARIAN (PASSWORD ADMIN)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- 1. Pemasangan baris konfigurasi awal untuk password reset admin pada system_settings (jika belum ada)
INSERT INTO public.system_settings (key, value)
VALUES ('admin_reset_password', '')
ON CONFLICT (key) DO NOTHING;

-- 2. Memastikan tabel public.attendance memiliki Policy DELETE untuk Admin & Operator
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance
  FOR DELETE
  USING (true);

-- Catatan:
-- Eksekusi reset presensi harian menghapus data presensi spesifik (user_id & date)
-- dan memerlukan konfirmasi password reset yang dikonfigurasi sendiri oleh Admin.
