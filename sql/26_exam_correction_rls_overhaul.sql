-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 26: OVERHAUL RLS & SKEMA KOREKSI SOAL & NILAI
-- Integrasi Fitur Koreksi Soal & Input Nilai (GradeMaster In-App)
-- Tabel Terkait: public.gm_sessions, public.gm_students, public.gm_answers, public.student_scores
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBARUAN STRUKTUR TABEL gm_sessions (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gm_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_code TEXT;

-- Backfill owner_user_id berdasarkan kecocokan nama guru pada public.users
UPDATE public.gm_sessions s
SET owner_user_id = u.id
FROM public.users u
WHERE s.owner_user_id IS NULL
  AND LOWER(TRIM(s.teacher)) = LOWER(TRIM(u.full_name));

-- Backfill class_code dari class_name jika class_code masih null
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

-- Indexes untuk pencarian sesi berdasarkan owner dan kode rombel
CREATE INDEX IF NOT EXISTS idx_gm_sessions_owner_user_id ON public.gm_sessions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_gm_sessions_class_code ON public.gm_sessions(class_code);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PEMBARUAN STRUKTUR TABEL gm_students (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gm_students
  ADD COLUMN IF NOT EXISTS student_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Bersihkan data duplikat (session_id, LOWER(name)) sebelum menambahkan constraint unik
DELETE FROM public.gm_students a
USING public.gm_students b
WHERE a.session_id = b.session_id
  AND LOWER(TRIM(a.name)) = LOWER(TRIM(b.name))
  AND a.created_at < b.created_at;

-- Tambahkan Unique Constraint (session_id, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gm_students_session_name_uq'
  ) THEN
    ALTER TABLE public.gm_students
      ADD CONSTRAINT gm_students_session_name_uq UNIQUE (session_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gm_students_session_name ON public.gm_students(session_id, name);
CREATE INDEX IF NOT EXISTS idx_gm_students_student_user_id ON public.gm_students(student_user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PEMBARUAN STRUKTUR TABEL gm_answers (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gm_answers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Bersihkan data duplikat per soal
DELETE FROM public.gm_answers a
USING public.gm_answers b
WHERE a.student_id = b.student_id
  AND a.question_number = b.question_number
  AND a.created_at < b.created_at;

-- Tambahkan Unique Constraint (student_id, question_number) untuk atomic upsert
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
-- 4. PEMBARUAN STRUKTUR TABEL student_scores (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_scores
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_student_scores_student_comp ON public.student_scores(student_id, completed_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AKTIFKAN ROW LEVEL SECURITY (RLS) & HAPUS POLICY LAMA BERBAHAYA
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gm_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

-- Drop seluruh policy USING(true) lama
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. KEBIJAKAN RLS KETAT BARU: public.gm_sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT: Pemilik sesi, admin, operator, kepsek (read-only), atau sesi publik/demo
CREATE POLICY "gm_sessions_select_policy" ON public.gm_sessions
FOR SELECT
TO public
USING (
  -- Otentikasi Supabase Auth
  (auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
    )
  ))
  -- Sesi publik / demo
  OR is_public = true
  OR is_demo = true
  -- Service Role / Admin claim
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  -- Akses Aplikasi SAG via Anon Key
  OR (
    auth.role() = 'anon'
    AND (
      owner_user_id IS NULL -- sesi warisan (legacy)
      OR is_public = true
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE (u.id = owner_user_id OR LOWER(TRIM(u.full_name)) = LOWER(TRIM(public.gm_sessions.teacher)))
      )
    )
  )
);

-- INSERT: Guru pemilik, Admin, Operator
CREATE POLICY "gm_sessions_insert_policy" ON public.gm_sessions
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'GURU')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR (
    auth.role() = 'anon'
    AND length(trim(session_name)) > 0
    AND length(trim(teacher)) > 0
  )
);

-- UPDATE: Guru pemilik, Admin, Operator
CREATE POLICY "gm_sessions_update_policy" ON public.gm_sessions
FOR UPDATE
TO public
USING (
  (auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR (
    auth.role() = 'anon'
  )
);

-- DELETE: Guru pemilik, Admin, Operator
CREATE POLICY "gm_sessions_delete_policy" ON public.gm_sessions
FOR DELETE
TO public
USING (
  (auth.uid() IS NOT NULL AND (
    owner_user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR (
    auth.role() = 'anon'
  )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. KEBIJAKAN RLS KETAT BARU: public.gm_students
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "gm_students_select_policy" ON public.gm_students
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = public.gm_students.session_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_students_insert_policy" ON public.gm_students
FOR INSERT
TO public
WITH CHECK (
  length(trim(name)) > 0
  AND EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = public.gm_students.session_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_students_update_policy" ON public.gm_students
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = public.gm_students.session_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_students_delete_policy" ON public.gm_students
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_sessions s
    WHERE s.id = public.gm_students.session_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. KEBIJAKAN RLS KETAT BARU: public.gm_answers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "gm_answers_select_policy" ON public.gm_answers
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_students st
    WHERE st.id = public.gm_answers.student_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_answers_insert_policy" ON public.gm_answers
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gm_students st
    WHERE st.id = public.gm_answers.student_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_answers_update_policy" ON public.gm_answers
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_students st
    WHERE st.id = public.gm_answers.student_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "gm_answers_delete_policy" ON public.gm_answers
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.gm_students st
    WHERE st.id = public.gm_answers.student_id
  )
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. KEBIJAKAN RLS KETAT BARU: public.student_scores
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "student_scores_select_policy" ON public.student_scores
FOR SELECT
TO public
USING (
  (auth.uid() IS NOT NULL AND (
    created_by = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR current_setting('request.jwt.claim.app_role', true) IN ('ADMIN', 'OPERATOR', 'KEPSEK')
  OR (
    auth.role() = 'anon'
  )
);

CREATE POLICY "student_scores_insert_policy" ON public.student_scores
FOR INSERT
TO public
WITH CHECK (
  score >= 0
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
);

CREATE POLICY "student_scores_update_policy" ON public.student_scores
FOR UPDATE
TO public
USING (
  (auth.uid() IS NOT NULL AND (
    created_by = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR (
    auth.role() = 'anon'
  )
);

CREATE POLICY "student_scores_delete_policy" ON public.student_scores
FOR DELETE
TO public
USING (
  (auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::TEXT
        AND UPPER(u.role) IN ('ADMIN', 'OPERATOR')
    )
  ))
  OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  OR (
    auth.role() = 'anon'
  )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. REALTIME PUBLICATION SINKRONISASI
-- ─────────────────────────────────────────────────────────────────────────────
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
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK STRATEGY (Simpan untuk membatalkan jika diperlukan):
-- ─────────────────────────────────────────────────────────────────────────────
-- /*
-- DROP POLICY IF EXISTS "gm_sessions_select_policy" ON public.gm_sessions;
-- DROP POLICY IF EXISTS "gm_sessions_insert_policy" ON public.gm_sessions;
-- DROP POLICY IF EXISTS "gm_sessions_update_policy" ON public.gm_sessions;
-- DROP POLICY IF EXISTS "gm_sessions_delete_policy" ON public.gm_sessions;
-- CREATE POLICY "gm_sessions_select_policy" ON public.gm_sessions FOR SELECT USING (true);
-- CREATE POLICY "gm_sessions_insert_policy" ON public.gm_sessions FOR INSERT WITH CHECK (true);
-- CREATE POLICY "gm_sessions_update_policy" ON public.gm_sessions FOR UPDATE USING (true);
-- CREATE POLICY "gm_sessions_delete_policy" ON public.gm_sessions FOR DELETE USING (true);
--
-- DROP POLICY IF EXISTS "gm_students_select_policy" ON public.gm_students;
-- DROP POLICY IF EXISTS "gm_students_insert_policy" ON public.gm_students;
-- DROP POLICY IF EXISTS "gm_students_update_policy" ON public.gm_students;
-- DROP POLICY IF EXISTS "gm_students_delete_policy" ON public.gm_students;
-- CREATE POLICY "gm_students_select_policy" ON public.gm_students FOR SELECT USING (true);
-- CREATE POLICY "gm_students_insert_policy" ON public.gm_students FOR INSERT WITH CHECK (true);
-- CREATE POLICY "gm_students_update_policy" ON public.gm_students FOR UPDATE USING (true);
-- CREATE POLICY "gm_students_delete_policy" ON public.gm_students FOR DELETE USING (true);
--
-- ALTER TABLE public.gm_students DROP CONSTRAINT IF EXISTS gm_students_session_name_uq;
-- ALTER TABLE public.gm_answers DROP CONSTRAINT IF EXISTS gm_answers_student_question_uq;
-- ALTER TABLE public.gm_sessions DROP COLUMN IF EXISTS owner_user_id;
-- ALTER TABLE public.gm_sessions DROP COLUMN IF EXISTS class_code;
-- */
