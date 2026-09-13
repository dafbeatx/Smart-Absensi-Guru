-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 31: STUDENT SCHOOL CHOICES
-- Fitur: Pilihan Sekolah Lanjutan Siswa (Pilihan 1, 2, 3, 4 / Alternatif)
-- Tabel Terkait: public.student_school_choices
-- Dependensi: public.student_continuation_plans(id), public.schools(id), public.smk_majors(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_school_choices (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_school_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    continuation_plan_id UUID NOT NULL REFERENCES public.student_continuation_plans(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    choice_order INTEGER NOT NULL CHECK (choice_order BETWEEN 1 AND 4),
    preferred_major_id UUID REFERENCES public.smk_majors(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_choice_order UNIQUE (continuation_plan_id, choice_order),
    CONSTRAINT uq_plan_school UNIQUE (continuation_plan_id, school_id)
);

COMMENT ON TABLE public.student_school_choices IS 'Daftar prioritas pilihan sekolah tujuan per rencana pendidikan lanjutan siswa.';
COMMENT ON COLUMN public.student_school_choices.choice_order IS 'Nomor urut pilihan: 1 (Prioritas Utama), 2, 3, atau 4 (Alternatif).';
COMMENT ON COLUMN public.student_school_choices.preferred_major_id IS 'Konsentrasi keahlian pilihan jika sekolah bertipe SMK (nullable).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ssc_plan_id
    ON public.student_school_choices (continuation_plan_id);

CREATE INDEX IF NOT EXISTS idx_ssc_school_id
    ON public.student_school_choices (school_id);

CREATE INDEX IF NOT EXISTS idx_ssc_preferred_major_id
    ON public.student_school_choices (preferred_major_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES (Zero-Trust Backend Proxy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_school_choices ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "ssc_service_role_all" ON public.student_school_choices;
DROP POLICY IF EXISTS "ssc_gtk_read_policy" ON public.student_school_choices;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT. Akses data pilihan sekolah
-- dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "ssc_service_role_all" ON public.student_school_choices
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
