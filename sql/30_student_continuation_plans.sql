-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 30: STUDENT CONTINUATION PLANS
-- Fitur: Entitas Utama Rencana Pendidikan Lanjutan Siswa Kelas 9
-- Tabel Terkait: public.student_continuation_plans
-- Dependensi: public.students(id), public.users(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_continuation_plans (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_continuation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026/2027',
    graduation_year INTEGER NOT NULL DEFAULT 2027 CHECK (graduation_year BETWEEN 2020 AND 2100),
    continuation_type TEXT NOT NULL CHECK (continuation_type IN (
        'SMA_NEGERI', 'SMA_SWASTA',
        'SMK_NEGERI', 'SMK_SWASTA',
        'MA_NEGERI', 'MA_SWASTA',
        'PONDOK_PESANTREN', 'LUAR_DAERAH', 'BELUM_MENENTUKAN'
    )),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'pending_verification', 'needs_revision', 'verified'
    )),
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_by_name TEXT,
    revision_note TEXT,
    parent_agreement BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT student_graduation_year_unique UNIQUE (student_id, graduation_year)
);

COMMENT ON TABLE public.student_continuation_plans IS 'Menyimpan rencana utama pendidikan lanjutan per siswa dan tahun kelulusan.';
COMMENT ON COLUMN public.student_continuation_plans.student_id IS 'Merujuk ke public.students(id) yang bertipe TEXT.';
COMMENT ON COLUMN public.student_continuation_plans.graduation_year IS 'Tahun kelulusan siswa (contoh: 2027) untuk menjaga histori lintas angkatan.';
COMMENT ON COLUMN public.student_continuation_plans.verified_by_user_id IS 'Merujuk ke public.users(id) verifikator bertipe TEXT.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scp_student_id
    ON public.student_continuation_plans (student_id);

CREATE INDEX IF NOT EXISTS idx_scp_status
    ON public.student_continuation_plans (status);

CREATE INDEX IF NOT EXISTS idx_scp_graduation_year
    ON public.student_continuation_plans (graduation_year);

CREATE INDEX IF NOT EXISTS idx_scp_academic_year
    ON public.student_continuation_plans (academic_year);

CREATE INDEX IF NOT EXISTS idx_scp_continuation_type
    ON public.student_continuation_plans (continuation_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES (Zero-Trust Backend Proxy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_continuation_plans ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "scp_service_role_all" ON public.student_continuation_plans;
DROP POLICY IF EXISTS "scp_anon_deny_mutations" ON public.student_continuation_plans;
DROP POLICY IF EXISTS "scp_gtk_read_policy" ON public.student_continuation_plans;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT untuk SELECT, INSERT, UPDATE, DELETE.
-- Seluruh akses data rencana lanjutan siswa wajib dimediasi oleh Backend Serverless Proxy.
CREATE POLICY "scp_service_role_all" ON public.student_continuation_plans
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

-- Catatan Keamanan:
-- Seluruh query (SELECT) dan mutasi (INSERT, UPDATE, DELETE) pada student_continuation_plans
-- DILARANG dieksekusi langsung oleh koneksi anonim browser (PostgREST direct access blocked).
-- Akses data rencana lanjutan dan verifikasi status WAJIB melalui Backend Serverless Proxy (/api/homeroom/*).

NOTIFY pgrst, 'reload schema';
