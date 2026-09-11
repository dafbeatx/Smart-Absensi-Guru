-- ==============================================================================
-- SMART ABSENSI GURU & GRADEMASTER OS
-- MIGRATION 20: RELATIONAL OVERHAUL POIN KARAKTER SISWA & STRICT AUDIT TRAIL
-- ==============================================================================
-- Tujuan:
-- 1. Menetapkan public.student_behavior_logs sebagai Satu Sumber Kebenaran Relasional
--    dengan foreign key langsung ke public.students(id).
-- 2. Menetapkan public.student_character_summary sebagai tabel agregat resmi:
--    merits_points (kebaikan >= 0), demerits_points (pelanggaran >= 0),
--    net_points = merits_points - demerits_points.
-- 3. Transaksi atomik via RPC record_student_behavior() & void_student_behavior().
-- 4. Perlindungan idempotensi penuh (idempotency_key UNIQUE).
-- 5. Audit pemberi poin (auth.uid()) & pembatalan (voided_at, void_reason).
-- 6. RLS ketat berbasis role sekolah (GURU, ADMIN, KEPSEK) tanpa USING(true).
-- 7. Rekonsiliasi non-destruktif dari gm_behaviors lama ke skema baru.
--
-- Rollback Note:
-- DROP FUNCTION IF EXISTS public.record_student_behavior;
-- DROP FUNCTION IF EXISTS public.void_student_behavior;
-- DROP TABLE IF EXISTS public.student_behavior_migration_conflicts;
-- DROP TABLE IF EXISTS public.student_character_summary;
-- DROP TABLE IF EXISTS public.student_behavior_logs;
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABEL RELASIONAL LOG PERILAKU SISWA (Single Source of Truth)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_behavior_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR(64) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
  type VARCHAR(10) NOT NULL CHECK (type IN ('GOOD', 'BAD')),
  points INTEGER NOT NULL CHECK (points > 0 AND points <= 100),
  reason_code VARCHAR(100),
  reason_text TEXT NOT NULL CHECK (length(trim(reason_text)) >= 3 AND length(trim(reason_text)) <= 500),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  recorded_by_user_id TEXT,
  recorded_by_name VARCHAR(255),
  idempotency_key VARCHAR(100) UNIQUE,
  voided_at TIMESTAMPTZ,
  voided_by_user_id TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index performa query riwayat dan idempotensi
CREATE INDEX IF NOT EXISTS idx_student_behavior_logs_student_year 
  ON public.student_behavior_logs (student_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_student_behavior_logs_occurred_at 
  ON public.student_behavior_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_behavior_logs_idempotency 
  ON public.student_behavior_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_behavior_logs_voided 
  ON public.student_behavior_logs (voided_at) WHERE voided_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_behavior_logs_recorded_by 
  ON public.student_behavior_logs (recorded_by_user_id);

-- ------------------------------------------------------------------------------
-- 2. TABEL SUMMARY / AKUMULATOR POIN KARAKTER SISWA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_character_summary (
  student_id VARCHAR(64) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year VARCHAR(20) NOT NULL DEFAULT '2026/2027',
  merits_points INTEGER NOT NULL DEFAULT 0 CHECK (merits_points >= 0),
  demerits_points INTEGER NOT NULL DEFAULT 0 CHECK (demerits_points >= 0),
  net_points INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_character_summary_student 
  ON public.student_character_summary (student_id);

CREATE INDEX IF NOT EXISTS idx_student_character_summary_net_points 
  ON public.student_character_summary (academic_year, net_points DESC);

-- ------------------------------------------------------------------------------
-- 3. TABEL AUDIT KONFLIK MIGRASI (Pencatatan Anomali Tanpa Hapus Data)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_behavior_migration_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  legacy_id TEXT,
  student_name TEXT,
  class_name TEXT,
  academic_year TEXT,
  conflict_reason TEXT NOT NULL,
  raw_payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES KETAT
-- ------------------------------------------------------------------------------
ALTER TABLE public.student_behavior_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_character_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_behavior_migration_conflicts ENABLE ROW LEVEL SECURITY;

-- Policy student_behavior_logs
DROP POLICY IF EXISTS "Authenticated users can read behavior logs" ON public.student_behavior_logs;
CREATE POLICY "Authenticated users can read behavior logs"
  ON public.student_behavior_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and staff can insert behavior logs" ON public.student_behavior_logs;
CREATE POLICY "Teachers and staff can insert behavior logs"
  ON public.student_behavior_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Pastikan user login tidak memalsukan user_id orang lain saat insert langsung
    recorded_by_user_id IS NULL OR recorded_by_user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff can void behavior logs with reason" ON public.student_behavior_logs;
CREATE POLICY "Staff can void behavior logs with reason"
  ON public.student_behavior_logs FOR UPDATE
  TO authenticated
  USING (
    -- Hanya pencatat asli atau admin/kepsek yang dapat membatalkan
    recorded_by_user_id = auth.uid()::text
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'KEPSEK')
  )
  WITH CHECK (
    -- Larang modifikasi field inti; hanya kolom void dan updated_at yang boleh diubah
    voided_at IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) >= 3
  );

-- Hapus hak DELETE fisik: Log karakter tidak boleh dihapus demi integritas audit sekolah
DROP POLICY IF EXISTS "Deny delete behavior logs" ON public.student_behavior_logs;
REVOKE DELETE ON public.student_behavior_logs FROM authenticated, anon;

-- Policy student_character_summary (Read-only untuk client, update via trigger/RPC)
DROP POLICY IF EXISTS "Authenticated users can read character summary" ON public.student_character_summary;
CREATE POLICY "Authenticated users can read character summary"
  ON public.student_character_summary FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------------------
-- 5. POSTGRESQL RPC: record_student_behavior (Transaksi Atomik & Idempotensi)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_student_behavior(
  p_student_id VARCHAR(64),
  p_academic_year VARCHAR(20),
  p_type VARCHAR(10),
  p_points INTEGER,
  p_reason TEXT,
  p_reason_code VARCHAR(100) DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
  p_idempotency_key VARCHAR(100) DEFAULT NULL,
  p_recorded_by_name VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id TEXT;
  v_student_exists BOOLEAN;
  v_existing_log public.student_behavior_logs%ROWTYPE;
  v_new_log_id UUID;
  v_merits INTEGER;
  v_demerits INTEGER;
  v_net INTEGER;
  v_student_name TEXT;
  v_class_name TEXT;
BEGIN
  -- 1. Validasi Actor (Sesi Otentikasi)
  v_actor_id := auth.uid()::text;

  -- 2. Validasi Input Keras
  IF p_student_id IS NULL OR trim(p_student_id) = '' THEN
    RAISE EXCEPTION 'ID Siswa wajib diisi dan valid.' USING ERRCODE = '22000';
  END IF;

  IF p_type NOT IN ('GOOD', 'BAD') THEN
    RAISE EXCEPTION 'Tipe catatan karakter harus GOOD atau BAD.' USING ERRCODE = '22000';
  END IF;

  IF p_points IS NULL OR p_points <= 0 OR p_points > 100 THEN
    RAISE EXCEPTION 'Bobot poin harus bernilai bulat antara 1 dan 100.' USING ERRCODE = '22003';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'Alasan pemberian poin wajib diisi (minimal 3 karakter, maksimal 500 karakter).' USING ERRCODE = '22000';
  END IF;

  IF p_academic_year IS NULL OR p_academic_year !~ '^\d{4}/\d{4}$' THEN
    RAISE EXCEPTION 'Format tahun ajaran tidak valid (contoh yang benar: 2026/2027).' USING ERRCODE = '22000';
  END IF;

  -- 3. Validasi Siswa di Master Directory (public.students)
  SELECT full_name, class_name INTO v_student_name, v_class_name
  FROM public.students
  WHERE id = p_student_id;

  IF v_student_name IS NULL THEN
    RAISE EXCEPTION 'Siswa dengan ID % tidak ditemukan pada database sekolah.', p_student_id USING ERRCODE = '23503';
  END IF;

  -- 4. Idempotency Guard (Double tap / network retry)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_log
    FROM public.student_behavior_logs
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_log.id IS NOT NULL THEN
      -- Ambil summary saat ini dan return segera
      SELECT merits_points, demerits_points, net_points
      INTO v_merits, v_demerits, v_net
      FROM public.student_character_summary
      WHERE student_id = p_student_id AND academic_year = p_academic_year;

      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'log_id', v_existing_log.id,
        'student_id', p_student_id,
        'merits_points', COALESCE(v_merits, 0),
        'demerits_points', COALESCE(v_demerits, 0),
        'net_points', COALESCE(v_net, 0),
        'message', 'Catatan ini sudah pernah tersimpan sebelumnya (idempoten).'
      );
    END IF;
  END IF;

  -- 5. Insert Log Relasional
  INSERT INTO public.student_behavior_logs (
    student_id,
    academic_year,
    type,
    points,
    reason_code,
    reason_text,
    occurred_at,
    timezone,
    recorded_by_user_id,
    recorded_by_name,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_academic_year,
    p_type,
    p_points,
    p_reason_code,
    trim(p_reason),
    COALESCE(p_occurred_at, NOW()),
    COALESCE(p_timezone, 'Asia/Jakarta'),
    v_actor_id,
    COALESCE(p_recorded_by_name, 'Guru'),
    p_idempotency_key,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_log_id;

  -- 6. Rekalkulasi Atomik Summary Karakter
  SELECT
    COALESCE(SUM(points) FILTER (WHERE type = 'GOOD' AND voided_at IS NULL), 0),
    COALESCE(SUM(points) FILTER (WHERE type = 'BAD' AND voided_at IS NULL), 0)
  INTO v_merits, v_demerits
  FROM public.student_behavior_logs
  WHERE student_id = p_student_id AND academic_year = p_academic_year;

  v_net := v_merits - v_demerits;

  -- Upsert ke summary tabel
  INSERT INTO public.student_character_summary (
    student_id,
    academic_year,
    merits_points,
    demerits_points,
    net_points,
    last_activity_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_academic_year,
    v_merits,
    v_demerits,
    v_net,
    COALESCE(p_occurred_at, NOW()),
    NOW()
  )
  ON CONFLICT (student_id, academic_year) DO UPDATE SET
    merits_points = EXCLUDED.merits_points,
    demerits_points = EXCLUDED.demerits_points,
    net_points = EXCLUDED.net_points,
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = NOW();

  -- 7. Mirroring Aman ke Tabel Legacy GradeMaster OS (Materialized Cache)
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gm_behaviors') THEN
      UPDATE public.gm_behaviors
      SET
        total_points = v_net,
        behavior_logs = jsonb_insert(
          COALESCE(behavior_logs::jsonb, '[]'::jsonb),
          '{0}',
          jsonb_build_object(
            'id', v_new_log_id,
            'type', p_type,
            'points', p_points,
            'reason', trim(p_reason),
            'timestamp', to_char(COALESCE(p_occurred_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            'violation_date', to_char(COALESCE(p_occurred_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            'recordedBy', COALESCE(p_recorded_by_name, 'Guru'),
            'recorded_by_user_id', v_actor_id
          )
        ),
        updated_at = NOW()
      WHERE academic_year = p_academic_year
        AND UPPER(student_name) = UPPER(v_student_name)
        AND UPPER(class_name) = UPPER(v_class_name);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gm_behavior_logs') THEN
      INSERT INTO public.gm_behavior_logs (
        student_id,
        points_delta,
        reason,
        violation_date,
        created_at
      ) VALUES (
        p_student_id,
        CASE WHEN p_type = 'GOOD' THEN -p_points ELSE p_points END,
        trim(p_reason),
        to_char(COALESCE(p_occurred_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        NOW()
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Kegagalan mirror legacy tidak boleh membatalkan log relasional utama, cukup di-log
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'log_id', v_new_log_id,
    'student_id', p_student_id,
    'student_name', v_student_name,
    'class_name', v_class_name,
    'merits_points', v_merits,
    'demerits_points', v_demerits,
    'net_points', v_net,
    'message', format('Berhasil mencatat %s (+%s poin) untuk %s.',
      CASE WHEN p_type = 'GOOD' THEN 'Poin Kebaikan' ELSE 'Catatan Pelanggaran' END,
      p_points, v_student_name)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. POSTGRESQL RPC: void_student_behavior (Pembatalan Log & Audit Trail)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_student_behavior(
  p_log_id UUID,
  p_void_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_id TEXT;
  v_log public.student_behavior_logs%ROWTYPE;
  v_merits INTEGER;
  v_demerits INTEGER;
  v_net INTEGER;
BEGIN
  v_actor_id := auth.uid()::text;

  IF p_log_id IS NULL THEN
    RAISE EXCEPTION 'ID Log wajib disertakan.' USING ERRCODE = '22000';
  END IF;

  IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 3 THEN
    RAISE EXCEPTION 'Alasan pembatalan (void reason) wajib diisi minimal 3 karakter.' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_log
  FROM public.student_behavior_logs
  WHERE id = p_log_id;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Catatan poin dengan ID % tidak ditemukan.', p_log_id USING ERRCODE = '23503';
  END IF;

  IF v_log.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Catatan ini sudah pernah dibatalkan sebelumnya pada %.', v_log.voided_at USING ERRCODE = '22000';
  END IF;

  -- Update pembatalan
  UPDATE public.student_behavior_logs
  SET
    voided_at = NOW(),
    voided_by_user_id = v_actor_id,
    void_reason = trim(p_void_reason),
    updated_at = NOW()
  WHERE id = p_log_id;

  -- Rekalkulasi Summary Karakter
  SELECT
    COALESCE(SUM(points) FILTER (WHERE type = 'GOOD' AND voided_at IS NULL), 0),
    COALESCE(SUM(points) FILTER (WHERE type = 'BAD' AND voided_at IS NULL), 0)
  INTO v_merits, v_demerits
  FROM public.student_behavior_logs
  WHERE student_id = v_log.student_id AND academic_year = v_log.academic_year;

  v_net := v_merits - v_demerits;

  UPDATE public.student_character_summary
  SET
    merits_points = v_merits,
    demerits_points = v_demerits,
    net_points = v_net,
    updated_at = NOW()
  WHERE student_id = v_log.student_id AND academic_year = v_log.academic_year;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', p_log_id,
    'student_id', v_log.student_id,
    'merits_points', v_merits,
    'demerits_points', v_demerits,
    'net_points', v_net,
    'message', 'Catatan berhasil dibatalkan dan saldo poin siswa telah diperbarui.'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SCRIPT REKONSILIASI DATA HISTORIS DARI GM_BEHAVIORS (Non-Destruktif)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_student_id VARCHAR(64);
  v_log_element JSONB;
  v_idx INTEGER;
  v_points INTEGER;
  v_type VARCHAR(10);
  v_occurred_at TIMESTAMPTZ;
  v_reason TEXT;
  v_merits_acc INTEGER;
  v_demerits_acc INTEGER;
BEGIN
  -- Lewati jika tabel legacy gm_behaviors tidak ada
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gm_behaviors') THEN
    RETURN;
  END IF;

  FOR r IN SELECT * FROM public.gm_behaviors LOOP
    -- Cocokkan siswa di public.students
    SELECT id INTO v_student_id
    FROM public.students
    WHERE UPPER(full_name) = UPPER(r.student_name)
      AND UPPER(class_name) = UPPER(r.class_name)
    LIMIT 1;

    IF v_student_id IS NULL THEN
      -- Catat ke tabel konflik untuk ditinjau tanpa menghapus data
      INSERT INTO public.student_behavior_migration_conflicts (
        source_table,
        legacy_id,
        student_name,
        class_name,
        academic_year,
        conflict_reason,
        raw_payload
      ) VALUES (
        'gm_behaviors',
        r.id::text,
        r.student_name,
        r.class_name,
        r.academic_year,
        'Siswa tidak ditemukan di master directory public.students (nama atau kelas berbeda)',
        to_jsonb(r)
      );
      CONTINUE;
    END IF;

    -- Iterasi log JSON lama dan migrasi ke student_behavior_logs jika belum ada
    v_idx := 0;
    IF r.behavior_logs IS NOT NULL AND jsonb_typeof(r.behavior_logs::jsonb) = 'array' THEN
      FOR v_log_element IN SELECT * FROM jsonb_array_elements(r.behavior_logs::jsonb) LOOP
        v_idx := v_idx + 1;
        v_type := CASE WHEN UPPER(COALESCE(v_log_element->>'type', '')) = 'GOOD' THEN 'GOOD' ELSE 'BAD' END;
        v_points := ABS(COALESCE((v_log_element->>'points')::integer, 5));
        IF v_points = 0 THEN v_points := 5; END IF;
        IF v_points > 100 THEN v_points := 100; END IF;

        BEGIN
          v_occurred_at := (v_log_element->>'timestamp')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_occurred_at := NOW();
        END;

        v_reason := COALESCE(v_log_element->>'reason', 'Catatan Sikap');
        IF length(trim(v_reason)) < 3 THEN v_reason := 'Catatan Sikap'; END IF;

        INSERT INTO public.student_behavior_logs (
          student_id,
          academic_year,
          type,
          points,
          reason_text,
          occurred_at,
          recorded_by_name,
          idempotency_key,
          created_at,
          updated_at
        ) VALUES (
          v_student_id,
          COALESCE(r.academic_year, '2026/2027'),
          v_type,
          v_points,
          v_reason,
          v_occurred_at,
          COALESCE(v_log_element->>'recordedBy', 'Guru'),
          format('migrated_log_%s_%s', r.id, v_idx),
          v_occurred_at,
          NOW()
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END LOOP;
    END IF;

    -- Rekonsiliasi summary awal
    SELECT
      COALESCE(SUM(points) FILTER (WHERE type = 'GOOD' AND voided_at IS NULL), 0),
      COALESCE(SUM(points) FILTER (WHERE type = 'BAD' AND voided_at IS NULL), 0)
    INTO v_merits_acc, v_demerits_acc
    FROM public.student_behavior_logs
    WHERE student_id = v_student_id AND academic_year = COALESCE(r.academic_year, '2026/2027');

    INSERT INTO public.student_character_summary (
      student_id,
      academic_year,
      merits_points,
      demerits_points,
      net_points,
      last_activity_at,
      updated_at
    ) VALUES (
      v_student_id,
      COALESCE(r.academic_year, '2026/2027'),
      v_merits_acc,
      v_demerits_acc,
      v_merits_acc - v_demerits_acc,
      NOW(),
      NOW()
    )
    ON CONFLICT (student_id, academic_year) DO UPDATE SET
      merits_points = EXCLUDED.merits_points,
      demerits_points = EXCLUDED.demerits_points,
      net_points = EXCLUDED.net_points,
      updated_at = NOW();
  END LOOP;
END;
$$;
