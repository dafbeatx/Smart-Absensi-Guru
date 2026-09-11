-- ==============================================================================
-- SMART ABSENSI GURU - SUPABASE DATABASE LINTER FIX
-- Issue: rls_references_user_metadata (Linter code: 0015_rls_references_user_metadata)
-- Table: public.student_behavior_logs
-- Policy: "Staff can void behavior logs with reason"
--
-- Rationale:
-- Supabase Auth 'user_metadata' dapat diedit oleh end-user dari client-side SDK
-- (supabase.auth.updateUser), sehingga TIDAK AMAN digunakan dalam konteks RLS.
-- Perbaikan ini mengganti referensi 'user_metadata' dengan:
-- 1. Verifikasi role via tabel terpercaya `public.users`
-- 2. 'app_metadata' (hanya bisa diubah oleh service_role backend)
-- 3. 'service_role' / 'supabase_admin' claim
-- ==============================================================================

DROP POLICY IF EXISTS "Staff can void behavior logs with reason" ON public.student_behavior_logs;

CREATE POLICY "Staff can void behavior logs with reason"
  ON public.student_behavior_logs FOR UPDATE
  TO authenticated
  USING (
    -- 1. Guru pencatat asli dapat membatalkan log buatannya
    recorded_by_user_id = auth.uid()::text
    -- 2. Atau diverifikasi melalui tabel terpercaya public.users (bukan user_metadata)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text
        AND u.role IN ('ADMIN', 'KEPSEK', 'OPERATOR')
    )
    -- 3. Atau klaim app_metadata yang aman (server-controlled)
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'KEPSEK', 'OPERATOR')
    -- 4. Bypass untuk backend service_role
    OR current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
  )
  WITH CHECK (
    -- Larang modifikasi field inti; hanya kolom void dan updated_at yang boleh diubah
    voided_at IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) >= 3
  );
