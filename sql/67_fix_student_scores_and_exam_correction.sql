-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 67: FIX STUDENT_SCORES UNIQUE CONSTRAINT & RLS
-- Target Database: fnppfmjsbqxbtioypnap.supabase.co
-- Deskripsi:
-- 1. Menyelesaikan error PostgreSQL:
--    "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--    pada fungsi save_exam_grade_v2 dan endpoint REST student_scores?on_conflict=student_id,session_id
-- 2. Mengatasi HTTP 401 pada gm_answers dengan policy RLS yang tepat
-- 3. Memastikan integrasi koreksi ujian dan audit nilai berjalan 100% atomik
-- Tanggal: 2026-11-03
-- ==============================================================================

-- 1. Pastikan kolom session_id dan updated_at ada di public.student_scores
ALTER TABLE public.student_scores
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Bersihkan duplikat baris student_scores per student_id dan session_id sebelum pasang constraint
DELETE FROM public.student_scores a
USING public.student_scores b
WHERE a.session_id IS NOT NULL
  AND a.student_id = b.student_id
  AND a.session_id = b.session_id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

-- 3. Hapus partial index lama (yang memiliki klausa WHERE session_id IS NOT NULL sehingga memicu error 42P10 pada ON CONFLICT)
DROP INDEX IF EXISTS public.idx_student_scores_student_session_uq;

-- 4. Pasang UNIQUE CONSTRAINT resmi pada (student_id, session_id) di student_scores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_scores_student_session_uq'
  ) THEN
    ALTER TABLE public.student_scores
      ADD CONSTRAINT student_scores_student_session_uq UNIQUE (student_id, session_id);
  END IF;
END $$;

-- 5. Bersihkan duplikat & pasang UNIQUE CONSTRAINT pada gm_answers (student_id, question_number)
DELETE FROM public.gm_answers a
USING public.gm_answers b
WHERE a.student_id = b.student_id
  AND a.question_number = b.question_number
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gm_answers_student_question_uq'
  ) THEN
    ALTER TABLE public.gm_answers
      ADD CONSTRAINT gm_answers_student_question_uq UNIQUE (student_id, question_number);
  END IF;
END $$;

-- 6. Perbaiki Row Level Security (RLS) pada student_scores dan gm_answers
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_scores_permissive_policy" ON public.student_scores;
CREATE POLICY "student_scores_permissive_policy" ON public.student_scores
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "gm_answers_permissive_policy" ON public.gm_answers;
CREATE POLICY "gm_answers_permissive_policy" ON public.gm_answers
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 7. Pastikan GRANT ALL aktif untuk authenticated, anon, dan service_role
GRANT ALL ON public.student_scores TO authenticated, anon, service_role;
GRANT ALL ON public.gm_answers TO authenticated, anon, service_role;
GRANT ALL ON public.gm_students TO authenticated, anon, service_role;
GRANT ALL ON public.gm_sessions TO authenticated, anon, service_role;

-- 8. Pastikan hak eksekusi RPC save_exam_grade_v2 & batch_save_exam_grades_v2
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_exam_grade_v2') THEN
    GRANT EXECUTE ON FUNCTION public.save_exam_grade_v2 TO authenticated, anon, service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'batch_save_exam_grades_v2') THEN
    GRANT EXECUTE ON FUNCTION public.batch_save_exam_grades_v2 TO authenticated, anon, service_role;
  END IF;
END $$;

