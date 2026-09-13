-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 35: STUDENT VERIFICATION LOGS
-- Fitur: Audit Trail Permanen (Append-Only) Riwayat Pengajuan & Verifikasi Siswa
-- Tabel Terkait: public.student_verification_logs
-- Dependensi: public.student_continuation_plans(id), public.students(id), public.users(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_verification_logs (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    continuation_plan_id UUID NOT NULL REFERENCES public.student_continuation_plans(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'SUBMITTED', 'VERIFIED', 'NEEDS_REVISION', 'RESUBMITTED', 'CANCELLED'
    )),
    performed_by_type TEXT NOT NULL CHECK (performed_by_type IN (
        'TEACHER', 'ADMIN', 'OPERATOR', 'KEPSEK', 'STUDENT', 'PARENT', 'SYSTEM'
    )),
    performed_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_verification_logs IS 'Audit log permanen (append-only) untuk mencatat kronologi perubahan status verifikasi rencana studi siswa.';
COMMENT ON COLUMN public.student_verification_logs.performed_by_type IS 'Tipe entitas pelaku: TEACHER, ADMIN, OPERATOR, KEPSEK, STUDENT, PARENT, atau SYSTEM.';
COMMENT ON COLUMN public.student_verification_logs.actor_name IS 'Nama terang snapshot pelaku saat aksi dicatat.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_svl_plan_timeline
    ON public.student_verification_logs (continuation_plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_svl_student_id
    ON public.student_verification_logs (student_id);

CREATE INDEX IF NOT EXISTS idx_svl_action
    ON public.student_verification_logs (action);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT LOG IMMUTABILITY TRIGGER (Anti-Tampering)
-- ─────────────────────────────────────────────────────────────────────────────
-- Mencegah modifikasi (UPDATE) atau penghapusan (DELETE) pada baris audit log
CREATE OR REPLACE FUNCTION public.prevent_verification_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit log bersifat immutable: data tidak boleh diubah (UPDATE) atau dihapus (DELETE).';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_verification_logs ON public.student_verification_logs;
CREATE TRIGGER trg_protect_verification_logs
    BEFORE UPDATE OR DELETE ON public.student_verification_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_verification_log_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) & PRIVILEGES (Zero-Trust Backend Proxy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_verification_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "svl_service_role_all" ON public.student_verification_logs;
DROP POLICY IF EXISTS "svl_gtk_read_policy" ON public.student_verification_logs;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT untuk seluruh operasi (SELECT, INSERT, UPDATE, DELETE).
-- Riwayat verifikasi rencana studi sepenuhnya terproteksi dari akses langsung PostgREST.
-- Pembacaan riwayat verifikasi dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "svl_service_role_all" ON public.student_verification_logs
    FOR ALL
    TO public
    USING (
        current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
        OR auth.role() = 'service_role'
    );

NOTIFY pgrst, 'reload schema';
