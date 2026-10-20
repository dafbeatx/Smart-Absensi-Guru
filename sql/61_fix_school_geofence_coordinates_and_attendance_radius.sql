-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 61: FIX GEOFENCE COORDINATES & 500M SAFETY BUFFER
-- Masalah:
-- 1. Nilai geofence_lng di public.system_settings sebelumnya tersimpan 106.812294
--    yang berjarak 14 KM dari lokasi riil sekolah (-6.613144, 106.684975).
--    Akibatnya, saat ponsel terhubung internet (online), data absensi SELALU DITOLAK
--    karena terdeteksi berada di luar radius (14.082 meter > radius).
-- 2. Memastikan radius minimal 500 meter diterapkan agar sinyal GPS HP di dalam
--    gedung/ruang kelas tidak tertolak.
-- 3. Memastikan jam operasional (masuk 06:00-07:30, pulang 12:00/Jumat 10:00) selaras.
-- 4. Memberikan GRANT ALL pada tabel public.attendance & public.system_settings
--    ke role anon, authenticated, dan service_role.
-- ============================================================================

-- 1. Update / Upsert Koordinat Riil Sekolah & Jam Operasional di public.system_settings
INSERT INTO public.system_settings (key, value, updated_at)
VALUES
  ('app_name', 'Smart Absensi Guru', NOW()),
  ('institution_name', 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam', NOW()),
  ('geofence_lat', '-6.613144', NOW()),
  ('geofence_lng', '106.684975', NOW()),
  ('geofence_radius', '500', NOW()),
  ('work_checkin_start', '06:00', NOW()),
  ('work_checkin_end', '07:30', NOW()),
  ('work_checkout_start', '12:00', NOW()),
  ('friday_checkout_start', '10:00', NOW()),
  ('saturday_is_holiday', 'true', NOW()),
  ('sunday_is_holiday', 'true', NOW())
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- 2. Pastikan tabel public.attendance memiliki RLS lengkap dan terupdate
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance
  FOR DELETE
  USING (true);

-- 3. Pastikan tabel public.system_settings memiliki RLS yang mengizinkan pembacaan & update
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
CREATE POLICY "system_settings_select_policy" ON public.system_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
CREATE POLICY "system_settings_insert_policy" ON public.system_settings
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
CREATE POLICY "system_settings_update_policy" ON public.system_settings
  FOR UPDATE
  USING (true);

-- 4. Berikan hak akses penuh tabel ke role anon, authenticated, dan service_role
GRANT ALL ON public.attendance TO anon, authenticated, service_role;
GRANT ALL ON public.system_settings TO anon, authenticated, service_role;

-- 5. Jika tabel device_bindings ada, pastikan juga memiliki privileges yang tepat
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'device_bindings') THEN
    EXECUTE 'GRANT ALL ON public.device_bindings TO anon, authenticated, service_role';
    EXECUTE 'ALTER TABLE public.device_bindings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "device_bindings_all" ON public.device_bindings';
    EXECUTE 'CREATE POLICY "device_bindings_all" ON public.device_bindings FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;
