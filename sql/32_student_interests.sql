-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 32: STUDENT INTERESTS
-- Fitur: Pemetaan Minat, Bakat, Mata Pelajaran Favorit, dan Orientasi Karir
-- Tabel Terkait: public.student_interests
-- Dependensi: public.student_continuation_plans(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_interests (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    continuation_plan_id UUID NOT NULL UNIQUE REFERENCES public.student_continuation_plans(id) ON DELETE CASCADE,
    favorite_subjects TEXT[] NOT NULL DEFAULT '{}',
    interest_categories TEXT[] NOT NULL DEFAULT '{}',
    preferred_activities TEXT,
    career_goals TEXT,
    post_secondary_plan TEXT CHECK (post_secondary_plan IN (
        'KULIAH', 'BEKERJA', 'WIRAUSAHA', 'KULIAH_SAMBIL_KERJA', 'BELUM_TAHU'
    )),
    certainty_level INTEGER NOT NULL DEFAULT 3 CHECK (certainty_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_interests IS 'Profil minat, bakat, dan rencana karir pasca-sekolah siswa (Relasi 1:1 dengan rencana lanjutan).';
COMMENT ON COLUMN public.student_interests.certainty_level IS 'Tingkat kemantapan hati siswa terhadap pilihannya (skala 1 = sangat ragu s.d. 5 = sangat mantap).';

CREATE INDEX IF NOT EXISTS idx_student_interests_plan_id
    ON public.student_interests (continuation_plan_id);

CREATE INDEX IF NOT EXISTS idx_student_interests_post_plan
    ON public.student_interests (post_secondary_plan);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY (RLS) & PRIVILEGES (Zero-Trust Backend Proxy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "si_service_role_all" ON public.student_interests;
DROP POLICY IF EXISTS "si_gtk_read_policy" ON public.student_interests;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT. Akses data minat & orientasi karir
-- dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "si_service_role_all" ON public.student_interests
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
