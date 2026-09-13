-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 34: STUDENT DOCUMENTS (VERSIONED METADATA)
-- Fitur: Vault Berkas Kependudukan Siswa dengan Model Versioning & Histori Penggantian
-- Tabel Terkait: public.student_documents
-- Dependensi: public.students(id), public.users(id)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PEMBUATAN TABEL: public.student_documents (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'KK', 'AKTA_KELAHIRAN', 'KTP_AYAH', 'KTP_IBU',
        'KIP_KKS_PKH', 'IJAZAH_SD', 'RAPOR', 'LAINNYA'
    )),
    version_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN (
        'pending_verification', 'verified', 'needs_revision', 'archived', 'rejected'
    )),
    uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN (
        'STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'OPERATOR'
    )),
    uploaded_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    verified_by_name TEXT,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    replaced_by_document_id UUID REFERENCES public.student_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_documents IS 'Menyimpan metadata berkas kependudukan resmi siswa berversi (KK, Akta, KTP orang tua, dll). File biner tersimpan di Supabase Storage.';
COMMENT ON COLUMN public.student_documents.is_current IS 'Menandakan versi dokumen yang sedang aktif/berlaku saat ini.';
COMMENT ON COLUMN public.student_documents.version_number IS 'Nomor iterasi berkas (1, 2, 3...) untuk rekam jejak revisi.';
COMMENT ON COLUMN public.student_documents.storage_path IS 'Path objek berkas di private bucket student-documents.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEX & PARTIAL UNIQUE CONSTRAINT (Siklus Penggantian Berkas)
-- ─────────────────────────────────────────────────────────────────────────────

-- Hanya boleh ada TEPAT 1 dokumen berstatus aktif (is_current = true) per tipe dokumen untuk setiap siswa
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_current_doc
    ON public.student_documents (student_id, document_type)
    WHERE is_current = true;

-- Index riwayat versi berkas (versi terbaru paling atas)
CREATE INDEX IF NOT EXISTS idx_student_docs_versioning
    ON public.student_documents (student_id, document_type, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_student_docs_status
    ON public.student_documents (status);

CREATE INDEX IF NOT EXISTS idx_student_docs_storage_path
    ON public.student_documents (storage_path);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES (DENY-BY-DEFAULT FOR ANON)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika ada (termasuk policy permissive lama)
DROP POLICY IF EXISTS "sd_service_role_all" ON public.student_documents;
DROP POLICY IF EXISTS "sd_anon_deny_all" ON public.student_documents;
DROP POLICY IF EXISTS "sd_gtk_read_policy" ON public.student_documents;

-- Akses Penuh HANYA untuk Backend Serverless (Service Role / Supabase Admin)
-- Klien anonim menerapkan DENY-BY-DEFAULT untuk seluruh operasi (SELECT, INSERT, UPDATE, DELETE).
-- Metadata dokumen kependudukan siswa (KK, Akta, KTP, dsb) sepenuhnya terlindung dari akses langsung PostgREST.
-- Akses baca metadata dan pembuatan Signed URL WAJIB dimediasi melalui Serverless API terautentikasi (/api/homeroom/*).
CREATE POLICY "sd_service_role_all" ON public.student_documents
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
-- Seluruh query metadata dan mutasi berkas pada student_documents
-- DILARANG dieksekusi langsung oleh koneksi anonim browser (PostgREST direct access blocked).
-- Akses berkas kependudukan dan download Signed URL WAJIB melalui Backend Serverless Proxy.

NOTIFY pgrst, 'reload schema';
