-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 21: TEACHING SCHEDULES RELATIONAL OVERHAUL
-- Idempotent Migration Script for Normalized Teaching Schedules, Conflict
-- Detection RPC, and Strict Role-Based Row Level Security (RLS).
-- ============================================================================

-- 1. Pastikan ekstensi pgcrypto tersedia untuk UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Buat tabel utama teaching_schedules jika belum ada atau migrasikan kolomnya
CREATE TABLE IF NOT EXISTS public.teaching_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id     TEXT NOT NULL,
  teacher_name        TEXT NOT NULL,
  day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  class_name          TEXT NOT NULL,
  subject             TEXT NOT NULL,
  room                TEXT NOT NULL,
  academic_year       TEXT NOT NULL DEFAULT '2026/2027',
  effective_from      DATE,
  effective_until     DATE,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  version             INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  updated_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_time_order CHECK (start_time < end_time)
);

-- 3. Idempotent Column Additions jika tabel lama sudah ada dengan skema lama
DO $$
BEGIN
  -- Tambah teacher_user_id jika belum ada (dari user_id lama)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='teacher_user_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='user_id') THEN
      ALTER TABLE public.teaching_schedules RENAME COLUMN user_id TO teacher_user_id;
    ELSE
      ALTER TABLE public.teaching_schedules ADD COLUMN teacher_user_id TEXT NOT NULL DEFAULT 'UNKNOWN';
    END IF;
  END IF;

  -- Tambah day_of_week jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='day_of_week') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN day_of_week SMALLINT DEFAULT 1 CHECK (day_of_week BETWEEN 1 AND 6);
  END IF;

  -- Tambah start_time jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='start_time') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN start_time TIME DEFAULT '07:30:00';
  END IF;

  -- Tambah end_time jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='end_time') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN end_time TIME DEFAULT '08:50:00';
  END IF;

  -- Tambah academic_year jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='academic_year') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN academic_year TEXT NOT NULL DEFAULT '2026/2027';
  END IF;

  -- Tambah effective_from & effective_until
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='effective_from') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN effective_from DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='effective_until') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN effective_until DATE;
  END IF;

  -- Tambah is_active jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='is_active') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Tambah version jika belum ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='version') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- Tambah created_by & updated_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='created_by') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN created_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='updated_by') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN updated_by TEXT;
  END IF;

  -- Tambah updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='updated_at') THEN
    ALTER TABLE public.teaching_schedules ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 4. Migrasi data legacy jika kolom 'day' (teks) atau 'time' (teks e.g. '07:30 - 08:50') masih ada
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='day') THEN
    -- Update day_of_week dari teks nama hari
    UPDATE public.teaching_schedules
    SET day_of_week = CASE
      WHEN LOWER(day) LIKE '%senin%' THEN 1
      WHEN LOWER(day) LIKE '%selasa%' THEN 2
      WHEN LOWER(day) LIKE '%rabu%' THEN 3
      WHEN LOWER(day) LIKE '%kamis%' THEN 4
      WHEN LOWER(day) LIKE '%jumat%' OR LOWER(day) LIKE '%jum''at%' THEN 5
      WHEN LOWER(day) LIKE '%sabtu%' THEN 6
      ELSE 1
    END
    WHERE day IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teaching_schedules' AND column_name='time') THEN
    -- Parse jam mulai dan selesai dari format '07:30 - 08:50'
    UPDATE public.teaching_schedules
    SET 
      start_time = CASE
        WHEN time ~* '([0-2]?[0-9]:[0-5][0-9])' THEN (SUBSTRING(time FROM '([0-2]?[0-9]:[0-5][0-9])') || ':00')::TIME
        ELSE '07:30:00'::TIME
      END,
      end_time = CASE
        WHEN time ~* '-\s*([0-2]?[0-9]:[0-5][0-9])' THEN (SUBSTRING(time FROM '-\s*([0-2]?[0-9]:[0-5][0-9])') || ':00')::TIME
        ELSE '08:50:00'::TIME
      END
    WHERE time IS NOT NULL;
  END IF;
END $$;

-- 5. Foreign Key ke public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_teaching_schedules_teacher' AND table_name = 'teaching_schedules'
  ) THEN
    BEGIN
      ALTER TABLE public.teaching_schedules
      ADD CONSTRAINT fk_teaching_schedules_teacher
      FOREIGN KEY (teacher_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping FK creation if users table missing or orphaned rows exist: %', SQLERRM;
    END;
  END IF;
END $$;

-- 6. Indexes untuk performa dan pencarian konflik berkecepatan tinggi
CREATE INDEX IF NOT EXISTS idx_ts_teacher_day ON public.teaching_schedules(teacher_user_id, day_of_week) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ts_class_day ON public.teaching_schedules(class_name, day_of_week) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ts_room_day ON public.teaching_schedules(room, day_of_week) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ts_academic_year ON public.teaching_schedules(academic_year);

-- 7. PostgreSQL RPC: Deteksi Bentrok / Konflik Jadwal Atomik
CREATE OR REPLACE FUNCTION public.check_teaching_schedule_conflict(
  p_id UUID,
  p_teacher_user_id TEXT,
  p_day_of_week SMALLINT,
  p_start_time TIME,
  p_end_time TIME,
  p_class_name TEXT,
  p_room TEXT,
  p_academic_year TEXT DEFAULT '2026/2027'
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflict_type TEXT,
  conflicting_id UUID,
  conflict_message TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Validasi 1: start_time < end_time
  IF p_start_time >= p_end_time THEN
    RETURN QUERY SELECT 
      true, 
      'TIME_ORDER', 
      NULL::UUID, 
      'Waktu mulai harus lebih awal daripada waktu selesai (' || p_start_time::TEXT || ' >= ' || p_end_time::TEXT || ')';
    RETURN;
  END IF;

  -- Validasi 2: Overlap Jadwal Guru pada hari & tahun ajaran yang sama
  SELECT id, teacher_name, class_name, subject, start_time, end_time
  INTO v_rec
  FROM public.teaching_schedules
  WHERE teacher_user_id = p_teacher_user_id
    AND day_of_week = p_day_of_week
    AND academic_year = p_academic_year
    AND is_active = true
    AND (p_id IS NULL OR id <> p_id)
    AND (start_time < p_end_time AND end_time > p_start_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 
      true, 
      'TEACHER_OVERLAP', 
      v_rec.id, 
      'Guru sudah memiliki jadwal mengajar di ' || v_rec.class_name || ' (' || v_rec.subject || ') pada pukul ' || 
      TO_CHAR(v_rec.start_time, 'HH24:MI') || ' - ' || TO_CHAR(v_rec.end_time, 'HH24:MI') || ' WIB';
    RETURN;
  END IF;

  -- Validasi 3: Overlap Kelas (satu kelas tidak boleh diajar dua pelajaran berbeda bersamaan)
  SELECT id, teacher_name, class_name, subject, start_time, end_time
  INTO v_rec
  FROM public.teaching_schedules
  WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(p_class_name))
    AND day_of_week = p_day_of_week
    AND academic_year = p_academic_year
    AND is_active = true
    AND (p_id IS NULL OR id <> p_id)
    AND (start_time < p_end_time AND end_time > p_start_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 
      true, 
      'CLASS_OVERLAP', 
      v_rec.id, 
      'Kelas ' || p_class_name || ' sudah memiliki jam pelajaran ' || v_rec.subject || ' bersama ' || v_rec.teacher_name || 
      ' pada pukul ' || TO_CHAR(v_rec.start_time, 'HH24:MI') || ' - ' || TO_CHAR(v_rec.end_time, 'HH24:MI') || ' WIB';
    RETURN;
  END IF;

  -- Validasi 4: Overlap Ruangan (ruangan yang sama tidak boleh dipakai bersamaan)
  SELECT id, teacher_name, class_name, room, start_time, end_time
  INTO v_rec
  FROM public.teaching_schedules
  WHERE LOWER(TRIM(room)) = LOWER(TRIM(p_room))
    AND LOWER(TRIM(room)) NOT IN ('-', 'lapangan', 'ruang terbuka', 'masjid', 'aula')
    AND day_of_week = p_day_of_week
    AND academic_year = p_academic_year
    AND is_active = true
    AND (p_id IS NULL OR id <> p_id)
    AND (start_time < p_end_time AND end_time > p_start_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 
      true, 
      'ROOM_OVERLAP', 
      v_rec.id, 
      'Ruangan ' || p_room || ' sedang digunakan oleh ' || v_rec.class_name || ' (' || v_rec.teacher_name || 
      ') pada pukul ' || TO_CHAR(v_rec.start_time, 'HH24:MI') || ' - ' || TO_CHAR(v_rec.end_time, 'HH24:MI') || ' WIB';
    RETURN;
  END IF;

  -- Tidak ada konflik
  RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, 'Valid: tidak ada konflik jadwal';
END;
$$;

-- 8. Row Level Security (RLS) Ketat — MENGHAPUS SEMUA USING(true)
ALTER TABLE public.teaching_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teaching_schedules_select" ON public.teaching_schedules;
DROP POLICY IF EXISTS "teaching_schedules_insert" ON public.teaching_schedules;
DROP POLICY IF EXISTS "teaching_schedules_update" ON public.teaching_schedules;
DROP POLICY IF EXISTS "teaching_schedules_delete" ON public.teaching_schedules;
DROP POLICY IF EXISTS "ts_select_policy" ON public.teaching_schedules;
DROP POLICY IF EXISTS "ts_insert_policy" ON public.teaching_schedules;
DROP POLICY IF EXISTS "ts_update_policy" ON public.teaching_schedules;
DROP POLICY IF EXISTS "ts_delete_policy" ON public.teaching_schedules;

-- Policy SELECT: Guru hanya melihat jadwal dirinya sendiri, Admin/Operator/Kepsek dapat melihat semua
CREATE POLICY "ts_select_policy" ON public.teaching_schedules
FOR SELECT
TO public
USING (
  -- Guru hanya melihat miliknya
  teacher_user_id = auth.uid()::TEXT
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::TEXT
      AND role IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  )
  -- Fallback untuk environment anon/authenticated token SAG
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
);

-- Policy INSERT: Hanya Admin & Operator yang berhak menambah jadwal
CREATE POLICY "ts_insert_policy" ON public.teaching_schedules
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::TEXT
      AND role IN ('ADMIN', 'OPERATOR')
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR')
);

-- Policy UPDATE: Hanya Admin & Operator yang berhak mengubah jadwal
CREATE POLICY "ts_update_policy" ON public.teaching_schedules
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::TEXT
      AND role IN ('ADMIN', 'OPERATOR')
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR')
);

-- Policy DELETE: Hanya Admin & Operator yang berhak menghapus jadwal
CREATE POLICY "ts_delete_policy" ON public.teaching_schedules
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::TEXT
      AND role IN ('ADMIN', 'OPERATOR')
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR')
);
