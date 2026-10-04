-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 58: EXAM CORRECTION & GRADE AUDIT OVERHAUL
-- Deskripsi: Audit & Perbaikan Modul Koreksi Soal & Input Nilai (GradeMaster)
-- Fitur:
--   1. Schema Hardening: gm_sessions, gm_students, gm_answers, student_scores
--   2. Unique Constraints: (session_id, student_user_id) & (student_id, question_number)
--   3. Tabel Audit: gm_grade_audit_logs (Revision tracking, actor, old/new values)
--   4. Outbox Idempoten: gm_external_sync_outbox (Sync background non-blocking)
--   5. Atomic RPC: save_exam_grade_v2 & batch_save_exam_grades_v2
--   6. Strict RLS: Isolasi per Guru (owner), Admin/Operator penuh, Kepsek read-only
--   7. Zero Egress & Log Flooding: Penghapusan dual-write langsung & query spam
-- Jalankan Query SQL ini di Supabase SQL Editor (Project Primary)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABEL gm_sessions: Hardening & Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_name TEXT NOT NULL,
  teacher TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_name TEXT NOT NULL,
  class_code TEXT,
  owner_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  school_level TEXT NOT NULL DEFAULT 'SMP',
  answer_key JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  password_hash TEXT,
  scoring_config JSONB NOT NULL DEFAULT '{"pgWeight": 0.7, "essayWeight": 0.3, "essayMaxScore": 20, "essayCount": 5}'::jsonb,
  exam_type TEXT NOT NULL DEFAULT 'Harian',
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  semester TEXT NOT NULL DEFAULT 'Ganjil',
  kkm NUMERIC NOT NULL DEFAULT 75,
  remedial_essay_count INTEGER DEFAULT 5,
  remedial_timer INTEGER DEFAULT 15,
  is_public BOOLEAN DEFAULT false,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill missing columns idempotently
ALTER TABLE public.gm_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_code TEXT,
  ADD COLUMN IF NOT EXISTS scoring_config JSONB DEFAULT '{"pgWeight": 0.7, "essayWeight": 0.3, "essayMaxScore": 20, "essayCount": 5}'::jsonb,
  ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2026/2027',
  ADD COLUMN IF NOT EXISTS semester TEXT DEFAULT 'Ganjil',
  ADD COLUMN IF NOT EXISTS kkm NUMERIC DEFAULT 75,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill class_code if null
UPDATE public.gm_sessions
SET class_code = UPPER(
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(class_name, '^(Kelas|kelas|KELAS)\s*', '', 'i'),
      '[\s\-_]+', '', 'g'
    )
  )
)
WHERE class_code IS NULL AND class_name IS NOT NULL;

-- Backfill owner_user_id matching teacher name if null
UPDATE public.gm_sessions s
SET owner_user_id = u.id
FROM public.users u
WHERE s.owner_user_id IS NULL
  AND LOWER(TRIM(s.teacher)) = LOWER(TRIM(u.full_name));

CREATE INDEX IF NOT EXISTS idx_gm_sessions_owner ON public.gm_sessions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_gm_sessions_class_code ON public.gm_sessions(class_code);
CREATE INDEX IF NOT EXISTS idx_gm_sessions_academic_semester ON public.gm_sessions(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_gm_sessions_created ON public.gm_sessions(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABEL gm_students: Hardening, Unique (session_id, student_user_id), & Concurrency
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_students (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL REFERENCES public.gm_sessions(id) ON DELETE CASCADE,
  student_user_id VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  mcq_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  essay_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  mcq_score NUMERIC NOT NULL DEFAULT 0,
  essay_score NUMERIC NOT NULL DEFAULT 0,
  final_score NUMERIC NOT NULL DEFAULT 0,
  csi NUMERIC NOT NULL DEFAULT 0,
  lps NUMERIC NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  remedial_status TEXT DEFAULT 'NONE',
  source TEXT DEFAULT 'MANUAL_ENTRY',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill missing columns on gm_students
ALTER TABLE public.gm_students
  ADD COLUMN IF NOT EXISTS student_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL_ENTRY',
  ADD COLUMN IF NOT EXISTS revision INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill student_user_id from students table if missing
UPDATE public.gm_students gs
SET student_user_id = s.id
FROM public.students s
WHERE (gs.student_user_id IS NULL OR gs.student_user_id = '')
  AND LOWER(TRIM(gs.name)) = LOWER(TRIM(s.full_name));

-- Fallback student_user_id to deterministic hash or row id if not matched
UPDATE public.gm_students
SET student_user_id = 'std_legacy_' || SUBSTRING(MD5(LOWER(TRIM(name))), 1, 16)
WHERE student_user_id IS NULL OR student_user_id = '';

-- Pastikan student_user_id NOT NULL
ALTER TABLE public.gm_students ALTER COLUMN student_user_id SET NOT NULL;

-- Bersihkan baris duplikat sebelum menambahkan UNIQUE constraint (session_id, student_user_id)
DELETE FROM public.gm_students a
USING public.gm_students b
WHERE a.session_id = b.session_id
  AND a.student_user_id = b.student_user_id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

-- Unique constraint (session_id, student_user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gm_students_session_student_uq'
  ) THEN
    ALTER TABLE public.gm_students
      ADD CONSTRAINT gm_students_session_student_uq UNIQUE (session_id, student_user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gm_students_session_student ON public.gm_students(session_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_gm_students_student_user_id ON public.gm_students(student_user_id);
CREATE INDEX IF NOT EXISTS idx_gm_students_session_final_score ON public.gm_students(session_id, final_score);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABEL gm_answers: Hardening & Unique (student_id, question_number)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_answers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  student_id TEXT NOT NULL REFERENCES public.gm_students(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gm_answers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Bersihkan duplikat (student_id, question_number)
DELETE FROM public.gm_answers a
USING public.gm_answers b
WHERE a.student_id = b.student_id
  AND a.question_number = b.question_number
  AND a.ctid < b.ctid;

-- Unique constraint (student_id, question_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gm_answers_student_question_uq'
  ) THEN
    ALTER TABLE public.gm_answers
      ADD CONSTRAINT gm_answers_student_question_uq UNIQUE (student_id, question_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gm_answers_student_qnum ON public.gm_answers(student_id, question_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABEL student_scores: Mirroring & Anti-Duplikasi
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_scores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  student_id TEXT NOT NULL,
  session_id TEXT REFERENCES public.gm_sessions(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_completed BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_scores
  ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES public.gm_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Bersihkan duplikat student_scores per student_id dan session_id
DELETE FROM public.student_scores a
USING public.student_scores b
WHERE a.session_id IS NOT NULL
  AND a.student_id = b.student_id
  AND a.session_id = b.session_id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

-- Unique constraint (student_id, session_id) jika session_id NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_scores_student_session_uq'
  ) THEN
    -- Menggunakan conditional partial unique index atau constraint
    CREATE UNIQUE INDEX IF NOT EXISTS idx_student_scores_student_session_uq 
      ON public.student_scores(student_id, session_id) 
      WHERE session_id IS NOT NULL;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABEL AUDIT NILAI: gm_grade_audit_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_grade_audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL REFERENCES public.gm_sessions(id) ON DELETE CASCADE,
  student_user_id VARCHAR(64) NOT NULL,
  student_name TEXT NOT NULL,
  actor_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  old_values JSONB,
  new_values JSONB NOT NULL,
  change_reason TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL_ENTRY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gm_grade_audit_session ON public.gm_grade_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_gm_grade_audit_student ON public.gm_grade_audit_logs(student_user_id);
CREATE INDEX IF NOT EXISTS idx_gm_grade_audit_created ON public.gm_grade_audit_logs(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABEL OUTBOX GRADE MASTER: gm_external_sync_outbox
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gm_external_sync_outbox (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SYNCED', 'FAILED')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gm_outbox_status ON public.gm_external_sync_outbox(status, created_at ASC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ATOMIC STORED PROCEDURE: save_exam_grade_v2
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_exam_grade_v2(
  p_session_id TEXT,
  p_student_user_id VARCHAR(64),
  p_student_name TEXT,
  p_mcq_answers JSONB,
  p_essay_scores JSONB,
  p_actor_user_id TEXT,
  p_actor_name TEXT,
  p_actor_role TEXT,
  p_expected_revision INTEGER DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'MANUAL_ENTRY',
  p_final_score NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session RECORD;
  v_existing RECORD;
  v_total_questions INTEGER := 0;
  v_correct INTEGER := 0;
  v_wrong INTEGER := 0;
  v_q_num INTEGER;
  v_student_ans TEXT;
  v_correct_ans TEXT;
  v_mcq_score NUMERIC := 0;
  v_essay_raw NUMERIC := 0;
  v_essay_score NUMERIC := 0;
  v_final_score NUMERIC := 0;
  v_csi NUMERIC := 0;
  v_lps NUMERIC := 0;
  v_pg_weight NUMERIC := 0.7;
  v_essay_weight NUMERIC := 0.3;
  v_essay_max NUMERIC := 20;
  v_essay_count INTEGER := 5;
  v_has_essay BOOLEAN := false;
  v_new_revision INTEGER := 1;
  v_saved_student_id TEXT;
  v_ans_key_elem JSONB;
  v_ans_idx INTEGER;
  v_old_values JSONB := NULL;
  v_new_values JSONB;
  v_result JSONB;
  v_essay_val NUMERIC;
BEGIN
  -- 1. Ambil detail sesi ujian
  SELECT * INTO v_session FROM public.gm_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Sesi ujian dengan ID % tidak ditemukan.', p_session_id;
  END IF;

  -- 2. Baca konfigurasi bobot
  IF v_session.scoring_config IS NOT NULL THEN
    v_pg_weight := COALESCE((v_session.scoring_config->>'pgWeight')::NUMERIC, 0.7);
    v_essay_weight := COALESCE((v_session.scoring_config->>'essayWeight')::NUMERIC, 0.3);
    v_essay_max := COALESCE((v_session.scoring_config->>'essayMaxScore')::NUMERIC, 20);
    v_essay_count := COALESCE((v_session.scoring_config->>'essayCount')::INTEGER, 5);
  END IF;

  v_has_essay := (v_essay_count > 0 AND v_essay_max > 0);
  IF NOT v_has_essay THEN
    v_pg_weight := 1.0;
    v_essay_weight := 0.0;
  END IF;

  -- 3. Hitung Koreksi Soal PG secara Server-Side (Validasi Deterministik)
  IF jsonb_typeof(v_session.answer_key) = 'array' THEN
    v_total_questions := jsonb_array_length(v_session.answer_key);
  END IF;

  IF v_total_questions > 0 THEN
    FOR v_ans_idx IN 0 .. (v_total_questions - 1) LOOP
      v_q_num := v_ans_idx + 1;
      v_correct_ans := UPPER(TRIM(BOTH '"' FROM (v_session.answer_key->v_ans_idx)::TEXT));
      v_student_ans := UPPER(TRIM(BOTH '"' FROM COALESCE(p_mcq_answers->(v_q_num::TEXT), '""'::jsonb)::TEXT));

      IF v_student_ans IS NOT NULL AND LENGTH(v_student_ans) > 0 AND v_student_ans != '""' THEN
        IF v_student_ans = v_correct_ans THEN
          v_correct := v_correct + 1;
        ELSE
          v_wrong := v_wrong + 1;
        END IF;
      END IF;
    END LOOP;

    v_mcq_score := ROUND((v_correct::NUMERIC / v_total_questions::NUMERIC) * 100, 2);
  ELSE
    v_mcq_score := 0;
  END IF;

  -- 4. Hitung Nilai Essay (Server-Side Clamping 0..100)
  IF v_has_essay AND p_essay_scores IS NOT NULL AND jsonb_typeof(p_essay_scores) = 'array' THEN
    FOR v_ans_idx IN 0 .. (jsonb_array_length(p_essay_scores) - 1) LOOP
      v_essay_val := COALESCE((p_essay_scores->>v_ans_idx)::NUMERIC, 0);
      -- Validasi non-negatif
      IF v_essay_val < 0 THEN v_essay_val := 0; END IF;
      v_essay_raw := v_essay_raw + v_essay_val;
    END LOOP;
    IF v_essay_max > 0 THEN
      v_essay_score := ROUND((v_essay_raw / v_essay_max) * 100, 2);
    END IF;
  ELSE
    v_essay_score := 0;
  END IF;

  -- Pastikan essay score clamped 0..100
  IF v_essay_score > 100 THEN v_essay_score := 100; END IF;
  IF v_essay_score < 0 THEN v_essay_score := 0; END IF;

  -- 5. Hitung Skor Akhir, CSI, dan LPS
  IF p_final_score IS NOT NULL AND p_final_score >= 0 THEN
    v_final_score := LEAST(100, GREATEST(0, ROUND(p_final_score)));
    IF v_total_questions = 0 AND v_mcq_score = 0 THEN
      v_mcq_score := v_final_score;
    END IF;
  ELSE
    v_final_score := ROUND((v_mcq_score * v_pg_weight) + (v_essay_score * v_essay_weight));
  END IF;
  IF v_final_score > 100 THEN v_final_score := 100; END IF;
  IF v_final_score < 0 THEN v_final_score := 0; END IF;

  IF v_total_questions > 0 THEN
    v_csi := ROUND(((v_correct::NUMERIC / v_total_questions) * 70) + (((v_correct + v_wrong)::NUMERIC / v_total_questions) * 30));
  ELSE
    v_csi := 0;
  END IF;

  IF v_has_essay THEN
    v_lps := ROUND((v_mcq_score * 0.6) + (v_essay_score * 0.4));
  ELSE
    v_lps := ROUND(v_mcq_score);
  END IF;

  -- 6. Optimistic Concurrency & Ambil data existing
  SELECT * INTO v_existing 
  FROM public.gm_students 
  WHERE session_id = p_session_id AND student_user_id = p_student_user_id;

  IF FOUND THEN
    IF p_expected_revision IS NOT NULL AND v_existing.revision != p_expected_revision THEN
      RAISE EXCEPTION 'CONCURRENCY_CONFLICT: Data siswa % telah diperbarui oleh pengguna lain (revisi saat ini %, dikirim %). Silakan muat ulang.',
        v_existing.name, v_existing.revision, p_expected_revision;
    END IF;

    v_new_revision := v_existing.revision + 1;
    v_saved_student_id := v_existing.id;

    v_old_values := jsonb_build_object(
      'mcq_score', v_existing.mcq_score,
      'essay_score', v_existing.essay_score,
      'final_score', v_existing.final_score,
      'correct', v_existing.correct,
      'wrong', v_existing.wrong,
      'revision', v_existing.revision
    );

    UPDATE public.gm_students
    SET name = TRIM(p_student_name),
        mcq_answers = p_mcq_answers,
        essay_scores = p_essay_scores,
        mcq_score = v_mcq_score,
        essay_score = v_essay_score,
        final_score = v_final_score,
        csi = v_csi,
        lps = v_lps,
        correct = v_correct,
        wrong = v_wrong,
        remedial_status = CASE WHEN v_final_score >= v_session.kkm THEN 'PASSED' ELSE 'REMEDIAL' END,
        source = p_source,
        revision = v_new_revision,
        updated_at = NOW()
    WHERE id = v_saved_student_id;
  ELSE
    v_saved_student_id := gen_random_uuid()::TEXT;
    v_new_revision := 1;

    INSERT INTO public.gm_students (
      id, session_id, student_user_id, name,
      mcq_answers, essay_scores, mcq_score, essay_score, final_score,
      csi, lps, correct, wrong, remedial_status, source, revision,
      created_at, updated_at
    ) VALUES (
      v_saved_student_id, p_session_id, p_student_user_id, TRIM(p_student_name),
      p_mcq_answers, p_essay_scores, v_mcq_score, v_essay_score, v_final_score,
      v_csi, v_lps, v_correct, v_wrong, 
      CASE WHEN v_final_score >= v_session.kkm THEN 'PASSED' ELSE 'REMEDIAL' END,
      p_source, v_new_revision,
      NOW(), NOW()
    );
  END IF;

  -- 7. Atomic UPSERT gm_answers per nomor soal (Tanpa destructive delete!)
  IF v_total_questions > 0 THEN
    FOR v_ans_idx IN 0 .. (v_total_questions - 1) LOOP
      v_q_num := v_ans_idx + 1;
      v_correct_ans := UPPER(TRIM(BOTH '"' FROM (v_session.answer_key->v_ans_idx)::TEXT));
      v_student_ans := UPPER(TRIM(BOTH '"' FROM COALESCE(p_mcq_answers->(v_q_num::TEXT), '""'::jsonb)::TEXT));

      IF v_student_ans IS NOT NULL AND LENGTH(v_student_ans) > 0 AND v_student_ans != '""' THEN
        INSERT INTO public.gm_answers (
          student_id, question_number, selected_answer, is_correct, updated_at
        ) VALUES (
          v_saved_student_id, v_q_num, v_student_ans, (v_student_ans = v_correct_ans), NOW()
        )
        ON CONFLICT (student_id, question_number) DO UPDATE
        SET selected_answer = EXCLUDED.selected_answer,
            is_correct = EXCLUDED.is_correct,
            updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  -- 8. Atomic UPSERT ke public.student_scores (Satu Baris Unik per Siswa per Sesi)
  INSERT INTO public.student_scores (
    student_id, session_id, score, answers, is_completed, completed_at, updated_at
  ) VALUES (
    p_student_user_id, p_session_id, v_final_score,
    jsonb_build_object(
      'session_id', p_session_id,
      'name', TRIM(p_student_name),
      'mcq_answers', p_mcq_answers,
      'essay_scores', p_essay_scores,
      'csi', v_csi,
      'lps', v_lps,
      'correct', v_correct,
      'wrong', v_wrong
    ),
    true, NOW(), NOW()
  )
  ON CONFLICT (student_id, session_id) DO UPDATE
  SET score = EXCLUDED.score,
      answers = EXCLUDED.answers,
      completed_at = NOW(),
      updated_at = NOW();

  -- 9. Catat ke Tabel Audit Nilai (gm_grade_audit_logs)
  v_new_values := jsonb_build_object(
    'mcq_score', v_mcq_score,
    'essay_score', v_essay_score,
    'final_score', v_final_score,
    'correct', v_correct,
    'wrong', v_wrong,
    'revision', v_new_revision
  );

  INSERT INTO public.gm_grade_audit_logs (
    session_id, student_user_id, student_name,
    actor_user_id, actor_name, actor_role, revision,
    old_values, new_values, change_reason, source, created_at
  ) VALUES (
    p_session_id, p_student_user_id, TRIM(p_student_name),
    p_actor_user_id, p_actor_name, p_actor_role, v_new_revision,
    v_old_values, v_new_values, p_change_reason, p_source, NOW()
  );

  -- 10. Susun Return JSONB
  v_result := jsonb_build_object(
    'id', v_saved_student_id,
    'session_id', p_session_id,
    'student_user_id', p_student_user_id,
    'name', TRIM(p_student_name),
    'mcq_answers', p_mcq_answers,
    'essay_scores', p_essay_scores,
    'mcq_score', v_mcq_score,
    'essay_score', v_essay_score,
    'final_score', v_final_score,
    'csi', v_csi,
    'lps', v_lps,
    'correct', v_correct,
    'wrong', v_wrong,
    'remedial_status', CASE WHEN v_final_score >= v_session.kkm THEN 'PASSED' ELSE 'REMEDIAL' END,
    'source', p_source,
    'revision', v_new_revision,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. BATCH ATOMIC STORED PROCEDURE: batch_save_exam_grades_v2
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.batch_save_exam_grades_v2(
  p_session_id TEXT,
  p_items JSONB,
  p_actor_user_id TEXT,
  p_actor_name TEXT,
  p_actor_role TEXT,
  p_source TEXT DEFAULT 'IMPORT_EXCEL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER;
  v_total INTEGER;
  v_student_user_id VARCHAR(64);
  v_student_name TEXT;
  v_final_score NUMERIC;
  v_mcq_answers JSONB;
  v_essay_scores JSONB;
  v_single_res JSONB;
  v_saved_results JSONB := '[]'::jsonb;
  v_session RECORD;
BEGIN
  -- Validasi sesi
  SELECT * INTO v_session FROM public.gm_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: Sesi ujian ID % tidak ditemukan.', p_session_id;
  END IF;

  IF jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: p_items wajib berupa array JSON.';
  END IF;

  v_total := jsonb_array_length(p_items);
  IF v_total > 100 THEN
    RAISE EXCEPTION 'BATCH_LIMIT_EXCEEDED: Maksimal 100 siswa per transaksi batch (diterima: %).', v_total;
  END IF;

  -- Validasi & Simpan setiap siswa dalam 1 transaksi atomik
  FOR v_idx IN 0 .. (v_total - 1) LOOP
    v_item := p_items->v_idx;
    v_student_user_id := TRIM(COALESCE(v_item->>'student_user_id', ''));
    v_student_name := TRIM(COALESCE(v_item->>'name', ''));

    IF v_student_user_id = '' OR v_student_name = '' THEN
      RAISE EXCEPTION 'INVALID_ROW: Baris ke-% memiliki student_user_id atau nama yang kosong.', (v_idx + 1);
    END IF;

    v_mcq_answers := COALESCE(v_item->'mcq_answers', '{}'::jsonb);
    v_essay_scores := COALESCE(v_item->'essay_scores', '[]'::jsonb);

    -- Panggil atomic save function
    v_single_res := public.save_exam_grade_v2(
      p_session_id,
      v_student_user_id,
      v_student_name,
      v_mcq_answers,
      v_essay_scores,
      p_actor_user_id,
      p_actor_name,
      p_actor_role,
      NULL,
      'Batch Import Nilai',
      p_source
    );

    v_saved_results := v_saved_results || jsonb_build_array(v_single_res);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_processed', v_total,
    'results', v_saved_results
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (RLS) POLICIES YANG KETAT
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_grade_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_external_sync_outbox ENABLE ROW LEVEL SECURITY;

-- Drop all old permissive policies
DROP POLICY IF EXISTS "gm_sessions_select_policy" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_insert_policy" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_update_policy" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_delete_policy" ON public.gm_sessions;

DROP POLICY IF EXISTS "gm_students_select_policy" ON public.gm_students;
DROP POLICY IF EXISTS "gm_students_insert_policy" ON public.gm_students;
DROP POLICY IF EXISTS "gm_students_update_policy" ON public.gm_students;
DROP POLICY IF EXISTS "gm_students_delete_policy" ON public.gm_students;

DROP POLICY IF EXISTS "gm_answers_select_policy" ON public.gm_answers;
DROP POLICY IF EXISTS "gm_answers_insert_policy" ON public.gm_answers;
DROP POLICY IF EXISTS "gm_answers_update_policy" ON public.gm_answers;
DROP POLICY IF EXISTS "gm_answers_delete_policy" ON public.gm_answers;

DROP POLICY IF EXISTS "student_scores_select_policy" ON public.student_scores;
DROP POLICY IF EXISTS "student_scores_insert_policy" ON public.student_scores;
DROP POLICY IF EXISTS "student_scores_update_policy" ON public.student_scores;
DROP POLICY IF EXISTS "student_scores_delete_policy" ON public.student_scores;

DROP POLICY IF EXISTS "gm_grade_audit_select_policy" ON public.gm_grade_audit_logs;
DROP POLICY IF EXISTS "gm_grade_audit_insert_policy" ON public.gm_grade_audit_logs;

-- A. RLS: gm_sessions
CREATE POLICY "gm_sessions_select_strict" ON public.gm_sessions
FOR SELECT TO authenticated, anon
USING (
  -- Service role / Admin / Operator / Kepsek (read-only)
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  )
  -- Guru hanya melihat sesi miliknya sendiri
  OR (
    owner_user_id IS NOT NULL 
    AND (owner_user_id = auth.uid()::TEXT OR owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
  OR is_public = true
);

CREATE POLICY "gm_sessions_insert_strict" ON public.gm_sessions
FOR INSERT TO authenticated, anon
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'GURU')
  )
);

CREATE POLICY "gm_sessions_update_strict" ON public.gm_sessions
FOR UPDATE TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
  )
  OR (
    owner_user_id IS NOT NULL 
    AND (owner_user_id = auth.uid()::TEXT OR owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

CREATE POLICY "gm_sessions_delete_strict" ON public.gm_sessions
FOR DELETE TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) = 'ADMIN'
  )
  OR (
    owner_user_id IS NOT NULL 
    AND (owner_user_id = auth.uid()::TEXT OR owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

-- B. RLS: gm_students
CREATE POLICY "gm_students_select_strict" ON public.gm_students
FOR SELECT TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  )
  OR EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = session_id
      AND s.owner_user_id IS NOT NULL
      AND (s.owner_user_id = auth.uid()::TEXT OR s.owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

CREATE POLICY "gm_students_modify_strict" ON public.gm_students
FOR ALL TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
  )
  OR EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = session_id
      AND s.owner_user_id IS NOT NULL
      AND (s.owner_user_id = auth.uid()::TEXT OR s.owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

-- C. RLS: gm_answers
CREATE POLICY "gm_answers_strict" ON public.gm_answers
FOR ALL TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
  )
  OR EXISTS (
    SELECT 1 FROM public.gm_students st
    JOIN public.gm_sessions s ON s.id = st.session_id
    WHERE st.id = student_id
      AND s.owner_user_id IS NOT NULL
      AND (s.owner_user_id = auth.uid()::TEXT OR s.owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

-- D. RLS: gm_grade_audit_logs
CREATE POLICY "gm_grade_audit_select_strict" ON public.gm_grade_audit_logs
FOR SELECT TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  )
  OR EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = session_id
      AND s.owner_user_id IS NOT NULL
      AND (s.owner_user_id = auth.uid()::TEXT OR s.owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
);

CREATE POLICY "gm_grade_audit_insert_strict" ON public.gm_grade_audit_logs
FOR INSERT TO authenticated, anon
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'GURU')
  )
);

-- E. RLS: gm_external_sync_outbox
CREATE POLICY "gm_outbox_service_only" ON public.gm_external_sync_outbox
FOR ALL TO authenticated, anon
USING (
  current_setting('request.jwt.claim.role', true) = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.id = auth.uid()::TEXT OR u.id = current_setting('request.jwt.claim.sub', true))
      AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT ALL ON public.gm_sessions TO authenticated, anon, service_role;
GRANT ALL ON public.gm_students TO authenticated, anon, service_role;
GRANT ALL ON public.gm_answers TO authenticated, anon, service_role;
GRANT ALL ON public.student_scores TO authenticated, anon, service_role;
GRANT ALL ON public.gm_grade_audit_logs TO authenticated, anon, service_role;
GRANT ALL ON public.gm_external_sync_outbox TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.save_exam_grade_v2 TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.batch_save_exam_grades_v2 TO authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. VERIFICATION QUERY (Jalankan untuk memvalidasi keberhasilan migrasi)
-- ─────────────────────────────────────────────────────────────────────────────
/*
SELECT 
  c.relname AS table_name,
  con.conname AS constraint_name,
  con.contype AS constraint_type
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
WHERE c.relname IN ('gm_sessions', 'gm_students', 'gm_answers', 'student_scores')
ORDER BY c.relname, con.conname;

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('gm_sessions', 'gm_students', 'gm_answers', 'student_scores', 'gm_grade_audit_logs', 'gm_external_sync_outbox');
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. STRATEGI ROLLBACK
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Rollback Policies:
DROP POLICY IF EXISTS "gm_sessions_select_strict" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_insert_strict" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_update_strict" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_sessions_delete_strict" ON public.gm_sessions;
DROP POLICY IF EXISTS "gm_students_select_strict" ON public.gm_students;
DROP POLICY IF EXISTS "gm_students_modify_strict" ON public.gm_students;
DROP POLICY IF EXISTS "gm_answers_strict" ON public.gm_answers;
DROP POLICY IF EXISTS "gm_grade_audit_select_strict" ON public.gm_grade_audit_logs;
DROP POLICY IF EXISTS "gm_grade_audit_insert_strict" ON public.gm_grade_audit_logs;
DROP POLICY IF EXISTS "gm_outbox_service_only" ON public.gm_external_sync_outbox;

-- Rollback Constraints:
ALTER TABLE public.gm_students DROP CONSTRAINT IF EXISTS gm_students_session_student_uq;
ALTER TABLE public.gm_answers DROP CONSTRAINT IF EXISTS gm_answers_student_question_uq;
DROP INDEX IF EXISTS idx_student_scores_student_session_uq;

-- Rollback RPC:
DROP FUNCTION IF EXISTS public.save_exam_grade_v2;
DROP FUNCTION IF EXISTS public.batch_save_exam_grades_v2;

-- Rollback Tables (Opsional):
-- DROP TABLE IF EXISTS public.gm_grade_audit_logs;
-- DROP TABLE IF EXISTS public.gm_external_sync_outbox;
*/
