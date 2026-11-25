-- ==============================================================================
-- SMART ABSENSI GURU — MIGRATION 72: HARDEN ADMINISTRATION & EXAM RLS POLICIES
-- Menutup akses tulis langsung role publik (anon/browser) pada tabel sensitif:
--   1. public.exam_committees      -> Wajib mutasi via serverless endpoint (service_role)
--   2. public.system_settings      -> Kunci administrasi (exam_*, smart_absensi_exam_committee,
--                                     doc_verify_*) tertutup bagi anon; DELETE dicabut dari anon
--   3. public.student_scores       -> Cabut policy permisif migrasi 67; mutasi wajib via server/RPC
--   4. public.gm_answers           -> Cabut policy permisif migrasi 67; mutasi wajib via server/RPC
--
-- Script ini idempotent (aman dijalankan ulang berkali-kali di Supabase SQL Editor).
-- ==============================================================================

-- 1. HARDENING public.exam_committees
DO $$
BEGIN
  IF to_regclass('public.exam_committees') IS NOT NULL THEN
    ALTER TABLE public.exam_committees ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "exam_committees_select_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_insert_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_update_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_delete_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_all_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_read_policy" ON public.exam_committees;
    DROP POLICY IF EXISTS "exam_committees_service_role_all" ON public.exam_committees;

    CREATE POLICY "exam_committees_service_role_all"
      ON public.exam_committees
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "exam_committees_read_policy"
      ON public.exam_committees
      FOR SELECT
      TO anon, authenticated
      USING (true);

    REVOKE INSERT, UPDATE, DELETE ON public.exam_committees FROM anon;
    GRANT SELECT ON public.exam_committees TO anon, authenticated;
    GRANT ALL ON public.exam_committees TO service_role;
  END IF;
END $$;

-- 2. HARDENING public.system_settings
-- Menutup mutasi kunci administrasi ujian & registri verifikasi dokumen bagi role klien.
-- Catatan: Pengaturan non-ujian (SystemSettingsForm / tombstones) tetap dipertahankan sementara
-- untuk menjaga kompatibilitas modul di luar Administrasi sampai migrasi endpoint berikutnya.
DO $$
BEGIN
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "system_settings_all" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_delete_policy" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_service_role_all" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_read_public" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_legacy_non_admin_insert" ON public.system_settings;
    DROP POLICY IF EXISTS "system_settings_legacy_non_admin_update" ON public.system_settings;

    CREATE POLICY "system_settings_service_role_all"
      ON public.system_settings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "system_settings_read_public"
      ON public.system_settings
      FOR SELECT
      TO anon, authenticated
      USING (key NOT LIKE 'doc_verify_%');

    CREATE POLICY "system_settings_legacy_non_admin_insert"
      ON public.system_settings
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        key NOT LIKE 'exam_%'
        AND key <> 'smart_absensi_exam_committee'
        AND key NOT LIKE 'doc_verify_%'
      );

    CREATE POLICY "system_settings_legacy_non_admin_update"
      ON public.system_settings
      FOR UPDATE
      TO anon, authenticated
      USING (
        key NOT LIKE 'exam_%'
        AND key <> 'smart_absensi_exam_committee'
        AND key NOT LIKE 'doc_verify_%'
      )
      WITH CHECK (
        key NOT LIKE 'exam_%'
        AND key <> 'smart_absensi_exam_committee'
        AND key NOT LIKE 'doc_verify_%'
      );

    REVOKE DELETE ON public.system_settings FROM anon;
    GRANT SELECT, INSERT, UPDATE ON public.system_settings TO anon, authenticated;
    GRANT ALL ON public.system_settings TO service_role;
  END IF;
END $$;

-- 3. HARDENING public.student_scores (Menutup student_scores_permissive_policy dari migrasi 67)
DO $$
BEGIN
  IF to_regclass('public.student_scores') IS NOT NULL THEN
    ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "student_scores_permissive_policy" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_select_policy" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_insert_policy" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_update_policy" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_delete_policy" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_service_role_all" ON public.student_scores;
    DROP POLICY IF EXISTS "student_scores_read_only" ON public.student_scores;

    CREATE POLICY "student_scores_service_role_all"
      ON public.student_scores
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "student_scores_read_only"
      ON public.student_scores
      FOR SELECT
      TO anon, authenticated
      USING (true);

    REVOKE INSERT, UPDATE, DELETE ON public.student_scores FROM anon;
    GRANT SELECT ON public.student_scores TO anon, authenticated;
    GRANT ALL ON public.student_scores TO service_role;
  END IF;
END $$;

-- 4. HARDENING public.gm_answers (Menutup gm_answers_permissive_policy dari migrasi 67)
DO $$
BEGIN
  IF to_regclass('public.gm_answers') IS NOT NULL THEN
    ALTER TABLE public.gm_answers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "gm_answers_permissive_policy" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_strict" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_select_policy" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_insert_policy" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_update_policy" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_delete_policy" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_service_role_all" ON public.gm_answers;
    DROP POLICY IF EXISTS "gm_answers_read_only" ON public.gm_answers;

    CREATE POLICY "gm_answers_service_role_all"
      ON public.gm_answers
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "gm_answers_read_only"
      ON public.gm_answers
      FOR SELECT
      TO anon, authenticated
      USING (true);

    REVOKE INSERT, UPDATE, DELETE ON public.gm_answers FROM anon;
    GRANT SELECT ON public.gm_answers TO anon, authenticated;
    GRANT ALL ON public.gm_answers TO service_role;
  END IF;
END $$;

-- 5. HARDENING public.gm_grade_audit_logs (Pastikan service_role penuh, read-only tidak bocor ke anon)
DO $$
BEGIN
  IF to_regclass('public.gm_grade_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.gm_grade_audit_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "gm_grade_audit_logs_all" ON public.gm_grade_audit_logs;
    DROP POLICY IF EXISTS "gm_grade_audit_logs_service_role_all" ON public.gm_grade_audit_logs;

    CREATE POLICY "gm_grade_audit_logs_service_role_all"
      ON public.gm_grade_audit_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    REVOKE ALL ON public.gm_grade_audit_logs FROM anon;
    GRANT ALL ON public.gm_grade_audit_logs TO service_role;
  END IF;
END $$;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
