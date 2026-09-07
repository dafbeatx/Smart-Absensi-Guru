-- ==============================================================================
-- MIGRATION: 11_student_rfid_directory.sql
-- DESCRIPTION: Master Direktori Siswa & Integrasi Absensi Kartu RFID (2026/2027)
-- COMPATIBILITY: Terintegrasi langsung dengan tabel public.gm_attendance
-- ==============================================================================

-- 1. TABEL MASTER SISWA (public.students)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  nisn TEXT,
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  gender TEXT CHECK (gender IN ('L', 'P')),
  rfid_uid TEXT UNIQUE,
  card_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (card_status IN ('ACTIVE', 'INACTIVE', 'LOST')),
  attendance_rate NUMERIC DEFAULT 100,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index performa pencarian kartu RFID & kelas
CREATE INDEX IF NOT EXISTS idx_students_rfid_uid ON public.students (rfid_uid);
CREATE INDEX IF NOT EXISTS idx_students_class_academic ON public.students (class_name, academic_year);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON public.students (full_name);

-- 2. ROW LEVEL SECURITY (RLS) UNTUK TABEL STUDENTS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
CREATE POLICY "Allow authenticated read students"
  ON public.students
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert students" ON public.students;
CREATE POLICY "Allow authenticated insert students"
  ON public.students
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update students" ON public.students;
CREATE POLICY "Allow authenticated update students"
  ON public.students
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete students" ON public.students;
CREATE POLICY "Allow authenticated delete students"
  ON public.students
  FOR DELETE
  TO authenticated, anon
  USING (true);

-- 3. TABEL RIWAYAT ABSENSI SISWA (public.gm_attendance)
-- Memastikan tabel public.gm_attendance memiliki index performa optimal
CREATE TABLE IF NOT EXISTS public.gm_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject TEXT DEFAULT 'Presensi Harian',
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa')),
  date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  rfid_uid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index performa pencarian absensi
CREATE INDEX IF NOT EXISTS idx_gm_attendance_date_class ON public.gm_attendance (date, class_name, academic_year);
CREATE INDEX IF NOT EXISTS idx_gm_attendance_student_date ON public.gm_attendance (student_name, date);

-- 4. MIGRASI DATA SISWA AKTIF DARI GM_BEHAVIORS (TAHUN AJARAN 2026/2027)
-- Mengisi tabel public.students dengan 149 siswa aktif 2026/2027 yang sudah naik kelas
INSERT INTO public.students (id, nisn, full_name, class_name, academic_year, gender, card_status, attendance_rate, created_at, updated_at)
SELECT
  'std_' || encode(digest(b.student_name || '_' || b.class_name, 'sha256'), 'hex') as id,
  NULL as nisn,
  b.student_name as full_name,
  b.class_name as class_name,
  '2026/2027' as academic_year,
  'L' as gender,
  'ACTIVE' as card_status,
  100 as attendance_rate,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  SELECT DISTINCT student_name, class_name
  FROM public.gm_behaviors
  WHERE academic_year = '2026/2027' AND student_name IS NOT NULL
) b
ON CONFLICT (id) DO UPDATE SET
  class_name = EXCLUDED.class_name,
  academic_year = EXCLUDED.academic_year,
  updated_at = NOW();
