-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 75: SINKRONISASI 3 SISWA UJIAN LISAN KE MASTER
-- Sumber: Downloads/UJIAN MENGAJI DAN BILINGUAL fix.docx (TA 2026/2027)
-- Menambahkan 3 siswa yang tercantum di file Ujian Mengaji & Bilingual fix namun
-- belum tercatat pada tabel public.students:
--   1. MUHAMAD NAZRIEL ADHA (Kelas 8B)
--   2. FADLI ADRIANSYAH (Kelas SMA)
--   3. MUHAMAD TAHFIDZ (Kelas SMA)
-- Idempotent & menghormati daftar tombstone (deleted_student_keys).
-- ==============================================================================

DO $$
DECLARE
  v_deleted_keys JSONB := '[]'::jsonb;
  v_item RECORD;
  v_natural_key TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) THEN
    RAISE NOTICE 'Tabel public.students tidak ditemukan, lewati migrasi 75.';
    RETURN;
  END IF;

  SELECT CASE
    WHEN value IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(value::jsonb) = 'array' THEN value::jsonb
    ELSE '[]'::jsonb
  END
  INTO v_deleted_keys
  FROM public.system_settings
  WHERE key = 'deleted_student_keys'
  LIMIT 1;

  FOR v_item IN
    SELECT * FROM (
      VALUES
        ('std_2026_8b_nazriel1', 'MUHAMAD NAZRIEL ADHA', '8B', '2026/2027', 'L'),
        ('std_2026_sma_fadli1', 'FADLI ADRIANSYAH', 'SMA', '2026/2027', 'L'),
        ('std_2026_sma_tahfidz1', 'MUHAMAD TAHFIDZ', 'SMA', '2026/2027', 'L')
    ) AS t(id, full_name, class_name, academic_year, gender)
  LOOP
    v_natural_key := v_item.class_name || '|||' || UPPER(TRIM(REGEXP_REPLACE(v_item.full_name, '\s+', ' ', 'g')));

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_deleted_keys, '[]'::jsonb)) AS dk(val)
      WHERE dk.val = v_natural_key
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.students s
      WHERE UPPER(TRIM(REGEXP_REPLACE(s.full_name, '\s+', ' ', 'g'))) = UPPER(v_item.full_name)
        AND UPPER(TRIM(s.class_name)) = UPPER(v_item.class_name)
    ) THEN
      INSERT INTO public.students (
        id,
        nisn,
        full_name,
        class_name,
        academic_year,
        gender,
        card_status,
        attendance_rate,
        created_at,
        updated_at
      ) VALUES (
        v_item.id,
        '',
        v_item.full_name,
        v_item.class_name,
        v_item.academic_year,
        v_item.gender,
        'ACTIVE',
        100,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Pastikan policy baca & tulis admin tetap utuh dan cache PostgREST segar
NOTIFY pgrst, 'reload schema';
