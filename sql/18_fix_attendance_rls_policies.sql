-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 18: FIX ATTENDANCE ROW LEVEL SECURITY (RLS) POLICIES
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Masalah yang Diperbaiki:
-- Sebelumnya pada sql/07_admin_reset_password.sql, RLS diaktifkan pada public.attendance
-- namun HANYA policy DELETE yang dibuat. Akibatnya, query UPDATE saat absensi pulang
-- (check-out) diblokir oleh PostgreSQL RLS bagi role anon/authenticated dengan error:
-- "new row violates row-level security policy for table attendance".
--
-- Script ini memastikan tabel public.attendance memiliki Policy lengkap:
--   1. SELECT - untuk membaca status kehadiran hari ini dan riwayat bulanan
--   2. INSERT - untuk mencatat absensi masuk (check-in)
--   3. UPDATE - untuk mencatat absensi pulang (check_out_time) dan update verifikasi
--   4. DELETE - untuk reset absensi harian oleh Admin
-- ============================================================================

-- 1. Pastikan Row Level Security aktif pada public.attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 2. Policy SELECT: Mengizinkan pembacaan log absensi
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT
  USING (true);

-- 3. Policy INSERT: Mengizinkan pencatatan absensi masuk baru
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
  FOR INSERT
  WITH CHECK (true);

-- 4. Policy UPDATE: Mengizinkan pencatatan absensi pulang (check_out_time) & koreksi
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. Policy DELETE: Mengizinkan reset absensi harian
DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance
  FOR DELETE
  USING (true);

-- 6. Pastikan indeks pencarian dan constraint unik user_id & date optimal
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);
