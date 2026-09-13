-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 33: STUDENT ACHIEVEMENTS
-- Fitur: Pendataan Prestasi & Portofolio Siswa untuk Administrasi dan Pemetaan Sekolah
-- Tabel Terkait: public.student_achievements
-- Dependensi: public.students(id), public.users(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_achievements (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026/2027',
    title TEXT NOT NULL,
    field TEXT NOT NULL CHECK (field IN (
        'AKADEMIK', 'OLAHRAGA', 'SENI_BUDAYA', 'KEAGAMAAN', 'TEKNOLOGI_RISET', 'PRAMUKA', 'LAINNYA'
    )),
    level TEXT NOT NULL CHECK (level IN (
        'SEKOLAH', 'KECAMATAN', 'KAB_KOTA', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL'
    )),
    rank TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2035),
    organizer TEXT NOT NULL,
    certificate_number TEXT,
    certificate_storage_path TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
        'pending', 'verified', 'rejected'
    )),
    verified_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_achievements IS 'Pendataan prestasi siswa untuk keperluan administrasi, portofolio kelulusan, dan pemetaan bimbingan sekolah tanpa klaim/penghitungan otomatis PPDB.';
COMMENT ON COLUMN public.student_achievements.student_id IS 'Merujuk ke public.students(id) yang bertipe TEXT.';
COMMENT ON COLUMN public.student_achievements.verified_by_user_id IS 'Merujuk ke public.users(id) verifikator prestasi.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sa_student_id
    ON public.student_achievements (student_id);

CREATE INDEX IF NOT EXISTS idx_sa_academic_year
    ON public.student_achievements (academic_year);

CREATE INDEX IF NOT EXISTS idx_sa_verification_status
    ON public.student_achievements (verification_status);

CREATE INDEX IF NOT EXISTS idx_sa_field_level
    ON public.student_achievements (field, level);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES (Zero-Trust Backend Proxy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "sa_service_role_all" ON public.student_achievements;
DROP POLICY IF EXISTS "sa_gtk_read_policy" ON public.student_achievements;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT. Akses data prestasi & portofolio siswa
-- dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "sa_service_role_all" ON public.student_achievements
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
