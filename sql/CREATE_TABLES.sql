-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION: BUAT TABEL YANG BELUM ADA (IDEMPOTENT)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
--
-- Tabel yang dibuat / dipastikan ada:
--   1. device_bindings        — menyimpan binding device UUID per user
--   2. notifications          — menyimpan notifikasi per user
--   3. teacher_duty_schedules — menyimpan jadwal piket guru (Senin - Jumat)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABEL: device_bindings
-- Menyimpan UUID perangkat yang terikat ke setiap akun guru/staf.
-- Dipakai oleh SupabaseProvider.checkDeviceBinding()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_bindings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_uuid   TEXT NOT NULL,
  device_name   TEXT,
  bound_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  CONSTRAINT device_bindings_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.device_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_bindings_select" ON public.device_bindings;
CREATE POLICY "device_bindings_select" ON public.device_bindings FOR SELECT USING (true);

DROP POLICY IF EXISTS "device_bindings_insert" ON public.device_bindings;
CREATE POLICY "device_bindings_insert" ON public.device_bindings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "device_bindings_update" ON public.device_bindings;
CREATE POLICY "device_bindings_update" ON public.device_bindings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "device_bindings_delete" ON public.device_bindings;
CREATE POLICY "device_bindings_delete" ON public.device_bindings FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_device_bindings_user_id ON public.device_bindings(user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABEL: notifications
-- Menyimpan notifikasi in-app per user.
-- Dipakai oleh SupabaseProvider.getNotifications() dan markNotificationAsRead()
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'INFO',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (true);

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SEED: Notifikasi awal sistem untuk semua user yang sudah ada
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.notifications (user_id, title, message, type, is_read)
SELECT
  u.id,
  'Selalu Absen Masuk Tepat Waktu',
  'Batas toleransi absen masuk adalah sesuai jam operasional sekolah. Gunakan QR Code resmi yang terpasang di sekolah.',
  'INFO',
  FALSE
FROM public.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (user_id, title, message, type, is_read)
SELECT
  u.id,
  'Keamanan Perangkat (Device Binding)',
  'Akun Anda terikat pada HP aktif. Sistem menerapkan pembatasan 1 akun 1 HP aktif untuk keamanan absensi.',
  'SUCCESS',
  FALSE
FROM public.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (user_id, title, message, type, is_read)
SELECT
  u.id,
  'Pengingat PIN Keamanan',
  'Apabila Anda masih menggunakan PIN default 123456, segera ubah PIN melalui tab Profil untuk keamanan akun Anda.',
  'WARNING',
  TRUE
FROM public.users u
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABEL: teacher_duty_schedules (Jadwal Piket Guru Senin - Jumat)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_duty_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  teacher_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teacher_name  TEXT NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_day_teacher UNIQUE (day_of_week, teacher_id)
);

ALTER TABLE public.teacher_duty_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_schedules_select" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_select" ON public.teacher_duty_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "duty_schedules_insert" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_insert" ON public.teacher_duty_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "duty_schedules_update" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_update" ON public.teacher_duty_schedules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "duty_schedules_delete" ON public.teacher_duty_schedules;
CREATE POLICY "duty_schedules_delete" ON public.teacher_duty_schedules FOR DELETE USING (true);
