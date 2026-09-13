-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 28: HOMEROOM ASSIGNMENTS (RUANG WALI KELAS)
-- Fitur: Penugasan Resmi Wali Kelas untuk Siswa Tingkat Akhir (Kelas 9)
-- Tabel Terkait: public.homeroom_assignments
-- Dependensi: public.users(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.homeroom_assignments (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.homeroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    class_name TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2026/2027',
    target_graduation_year INTEGER NOT NULL DEFAULT 2027 CHECK (target_graduation_year BETWEEN 2020 AND 2100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tambahkan komentar dokumentasi tabel dan kolom
COMMENT ON TABLE public.homeroom_assignments IS 'Menyimpan penugasan resmi guru sebagai wali kelas per tahun ajaran dan angkatan kelulusan.';
COMMENT ON COLUMN public.homeroom_assignments.teacher_id IS 'Merujuk ke public.users(id) yang bertipe TEXT.';
COMMENT ON COLUMN public.homeroom_assignments.is_active IS 'Menandakan status aktif penugasan. Riwayat mutasi/pergantian wali kelas disimpan dengan is_active = false.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEX & PARTIAL UNIQUE CONSTRAINTS (Mencegah Duplikasi Aktif & Jaga Histori)
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Satu rombel kelas hanya boleh memiliki tepat 1 wali kelas aktif pada tahun ajaran yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_homeroom_active_class
    ON public.homeroom_assignments (class_name, academic_year)
    WHERE is_active = true;

-- B. Satu guru hanya boleh memegang tepat 1 kelas aktif pada tahun ajaran yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_homeroom_active_teacher
    ON public.homeroom_assignments (teacher_id, academic_year)
    WHERE is_active = true;

-- C. Index pencarian cepat berdasarkan guru, nama kelas, dan tahun kelulusan
CREATE INDEX IF NOT EXISTS idx_homeroom_teacher_lookup
    ON public.homeroom_assignments (teacher_id, is_active);

CREATE INDEX IF NOT EXISTS idx_homeroom_class_lookup
    ON public.homeroom_assignments (class_name);

CREATE INDEX IF NOT EXISTS idx_homeroom_grad_year_lookup
    ON public.homeroom_assignments (target_graduation_year);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.homeroom_assignments ENABLE ROW LEVEL SECURITY;

-- Drop seluruh policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "homeroom_assignments_select_policy" ON public.homeroom_assignments;
DROP POLICY IF EXISTS "homeroom_assignments_service_role_all" ON public.homeroom_assignments;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT. Akses data penugasan wali kelas
-- dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "homeroom_assignments_service_role_all" ON public.homeroom_assignments
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

-- Refresh schema cache PostgREST
NOTIFY pgrst, 'reload schema';
