-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 49: ADD LAST_TAP_AT TO STUDENTS TABLE
-- Fitur: Menambahkan kolom opsional last_tap_at ke tabel public.students
-- Mencegah error HTTP 400 Bad Request saat memilih/memperbarui data absensi kartu siswa
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'students' 
      AND column_name = 'last_tap_at'
  ) THEN
    ALTER TABLE public.students 
      ADD COLUMN last_tap_at TIMESTAMPTZ;
    RAISE NOTICE 'Kolom last_tap_at berhasil ditambahkan ke public.students.';
  END IF;
END $$;

-- Reload schema cache PostgREST agar kolom langsung dikenali oleh API
NOTIFY pgrst, 'reload schema';
