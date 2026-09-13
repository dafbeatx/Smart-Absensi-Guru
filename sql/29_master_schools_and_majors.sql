-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 29: MASTER SEKOLAH & PROGRAM KEAHLIAN SMK
-- Fitur: Master Rujukan Sekolah Lanjutan (SMA, SMK, MA, Pesantren) & Konsentrasi Keahlian
-- Tabel Terkait: public.schools, public.smk_majors
-- Dependensi: Tidak ada (Tabel Mandiri / Master Data)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.schools (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npsn VARCHAR(16),
    name TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('SMA', 'SMK', 'MA', 'PONTREN', 'LAINNYA')),
    ownership TEXT NOT NULL CHECK (ownership IN ('NEGERI', 'SWASTA')),
    province TEXT NOT NULL DEFAULT 'Jawa Barat',
    city TEXT NOT NULL DEFAULT 'Bogor',
    district TEXT,
    address TEXT,
    website TEXT,
    telephone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.schools IS 'Master direktori sekolah rujukan pendidikan lanjutan (SMA, SMK, MA, Pesantren).';
COMMENT ON COLUMN public.schools.npsn IS 'Nomor Pokok Sekolah Nasional (bersifat unik jika diisi).';

-- Partial Unique Index untuk NPSN (hanya jika NPSN diisi dan bukan string kosong)
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_npsn_unique
    ON public.schools (npsn)
    WHERE npsn IS NOT NULL AND length(trim(npsn)) > 0;

-- Index performa pencarian sekolah
CREATE INDEX IF NOT EXISTS idx_schools_level_city
    ON public.schools (level, city);

CREATE INDEX IF NOT EXISTS idx_schools_name_search
    ON public.schools (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_schools_active
    ON public.schools (is_active);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PEMBUATAN TABEL: public.smk_majors (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.smk_majors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Umum',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.smk_majors IS 'Master spektrum program dan konsentrasi keahlian SMK rujukan.';

CREATE INDEX IF NOT EXISTS idx_smk_majors_category
    ON public.smk_majors (category);

CREATE INDEX IF NOT EXISTS idx_smk_majors_active
    ON public.smk_majors (is_active);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smk_majors ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada
DROP POLICY IF EXISTS "schools_select_public" ON public.schools;
DROP POLICY IF EXISTS "schools_service_role_all" ON public.schools;

DROP POLICY IF EXISTS "smk_majors_select_public" ON public.smk_majors;
DROP POLICY IF EXISTS "smk_majors_service_role_all" ON public.smk_majors;

-- A. Policy SELECT: Publik / Anonim dapat membaca direktori sekolah dan kejuruan
CREATE POLICY "schools_select_public" ON public.schools
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "smk_majors_select_public" ON public.smk_majors
    FOR SELECT
    TO public
    USING (true);

-- B. Policy Mutasi: HANYA Backend Service Role / Admin
CREATE POLICY "schools_service_role_all" ON public.schools
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

CREATE POLICY "smk_majors_service_role_all" ON public.smk_majors
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

-- Catatan Seeding:
-- Dataset resmi sekolah di Bogor dan sekitarnya diimpor terpisah dari data Dapodik/Kemdikbud tervalidasi.
-- Tidak ada dummy data atau NPSN fiktif yang disisipkan dalam migration struktural ini.

NOTIFY pgrst, 'reload schema';
