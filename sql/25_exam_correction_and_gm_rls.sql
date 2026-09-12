-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 25: TABEL KOREKSI SOAL & NILAI SISWA (RLS SYNC)
-- Integrasi Fitur Koreksi Soal & Input Nilai (GradeMaster In-App)
-- Tabel Terkait: public.gm_sessions, public.gm_students, public.gm_answers, public.student_scores
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- 1. Pastikan tabel gm_sessions memiliki struktur yang lengkap
CREATE TABLE IF NOT EXISTS public.gm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  teacher TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_name TEXT NOT NULL,
  school_level TEXT NOT NULL DEFAULT 'SMP',
  answer_key JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  password_hash TEXT,
  scoring_config JSONB NOT NULL DEFAULT '{"pgWeight": 0.7, "essayWeight": 0.3, "essayMaxScore": 20, "essayCount": 5}'::jsonb,
  exam_type TEXT NOT NULL DEFAULT 'Harian',
  academic_year TEXT NOT NULL DEFAULT '2025/2026',
  semester TEXT NOT NULL DEFAULT 'Ganjil',
  kkm NUMERIC NOT NULL DEFAULT 75,
  remedial_essay_count INTEGER DEFAULT 5,
  remedial_timer INTEGER DEFAULT 15,
  is_public BOOLEAN DEFAULT true,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Pastikan tabel gm_students memiliki struktur yang lengkap
CREATE TABLE IF NOT EXISTS public.gm_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.gm_sessions(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pastikan tabel gm_answers memiliki struktur yang lengkap
CREATE TABLE IF NOT EXISTS public.gm_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.gm_students(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Pastikan tabel student_scores memiliki struktur yang lengkap
CREATE TABLE IF NOT EXISTS public.student_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  quiz_id UUID,
  lesson_id UUID,
  score NUMERIC NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_completed BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Aktifkan Row Level Security (RLS) di seluruh tabel terkait
ALTER TABLE public.gm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

-- 6. Kebijakan RLS gm_sessions
DROP POLICY IF EXISTS "gm_sessions_select_policy" ON public.gm_sessions;
CREATE POLICY "gm_sessions_select_policy" ON public.gm_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "gm_sessions_insert_policy" ON public.gm_sessions;
CREATE POLICY "gm_sessions_insert_policy" ON public.gm_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "gm_sessions_update_policy" ON public.gm_sessions;
CREATE POLICY "gm_sessions_update_policy" ON public.gm_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "gm_sessions_delete_policy" ON public.gm_sessions;
CREATE POLICY "gm_sessions_delete_policy" ON public.gm_sessions FOR DELETE USING (true);

-- 7. Kebijakan RLS gm_students
DROP POLICY IF EXISTS "gm_students_select_policy" ON public.gm_students;
CREATE POLICY "gm_students_select_policy" ON public.gm_students FOR SELECT USING (true);

DROP POLICY IF EXISTS "gm_students_insert_policy" ON public.gm_students;
CREATE POLICY "gm_students_insert_policy" ON public.gm_students FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "gm_students_update_policy" ON public.gm_students;
CREATE POLICY "gm_students_update_policy" ON public.gm_students FOR UPDATE USING (true);

DROP POLICY IF EXISTS "gm_students_delete_policy" ON public.gm_students;
CREATE POLICY "gm_students_delete_policy" ON public.gm_students FOR DELETE USING (true);

-- 8. Kebijakan RLS gm_answers
DROP POLICY IF EXISTS "gm_answers_select_policy" ON public.gm_answers;
CREATE POLICY "gm_answers_select_policy" ON public.gm_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "gm_answers_insert_policy" ON public.gm_answers;
CREATE POLICY "gm_answers_insert_policy" ON public.gm_answers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "gm_answers_update_policy" ON public.gm_answers;
CREATE POLICY "gm_answers_update_policy" ON public.gm_answers FOR UPDATE USING (true);

DROP POLICY IF EXISTS "gm_answers_delete_policy" ON public.gm_answers;
CREATE POLICY "gm_answers_delete_policy" ON public.gm_answers FOR DELETE USING (true);

-- 9. Kebijakan RLS student_scores
DROP POLICY IF EXISTS "student_scores_select_policy" ON public.student_scores;
CREATE POLICY "student_scores_select_policy" ON public.student_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "student_scores_insert_policy" ON public.student_scores;
CREATE POLICY "student_scores_insert_policy" ON public.student_scores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "student_scores_update_policy" ON public.student_scores;
CREATE POLICY "student_scores_update_policy" ON public.student_scores FOR UPDATE USING (true);

DROP POLICY IF EXISTS "student_scores_delete_policy" ON public.student_scores;
CREATE POLICY "student_scores_delete_policy" ON public.student_scores FOR DELETE USING (true);

-- 10. Publikasi Realtime Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gm_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gm_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gm_students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gm_students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_scores;
  END IF;
END $$;
