-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 37: PRIVATE STORAGE BUCKET (STUDENT DOCUMENTS)
-- Fitur: Bucket Storage Khusus Dokumen Kependudukan Siswa (Private Zero-Trust)
-- Bucket: student-documents
-- Dependensi: Supabase Storage Schema (storage.buckets, storage.objects)
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REGISTRASI PRIVATE BUCKET: student-documents (Idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-documents',
    'student-documents',
    false, -- Wajib PRIVATE (Public access DISABLED)
    3145728, -- Maksimal 3 MB (3 * 1024 * 1024 byte)
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HARDENING STORAGE POLICY: DENY-BY-DEFAULT UNTUK KLIEN ANONIM
-- ─────────────────────────────────────────────────────────────────────────────
-- Karena sistem autentikasi aplikasi menggunakan custom session (public.users),
-- Supabase Auth session tidak aktif di browser.
-- Browser DILARANG membaca atau mengunggah berkas secara langsung ke bucket ini.
-- Seluruh akses berkas WAJIB dimediasi oleh Backend Serverless melalui Signed URL (300 detik).

-- Bersihkan policy lama jika ada pada bucket student-documents
DROP POLICY IF EXISTS "Deny direct anon select on student-documents" ON storage.objects;
DROP POLICY IF EXISTS "Deny direct anon insert on student-documents" ON storage.objects;
DROP POLICY IF EXISTS "Deny direct anon update on student-documents" ON storage.objects;
DROP POLICY IF EXISTS "Deny direct anon delete on student-documents" ON storage.objects;
DROP POLICY IF EXISTS "student_documents_service_role_all" ON storage.objects;

-- A. Akses Penuh HANYA untuk Service Role Backend
CREATE POLICY "student_documents_service_role_all" ON storage.objects
    FOR ALL
    TO public
    USING (
        bucket_id = 'student-documents'
        AND (
            current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
            OR auth.role() = 'service_role'
        )
    )
    WITH CHECK (
        bucket_id = 'student-documents'
        AND (
            current_setting('request.jwt.claim.role', true) IN ('service_role', 'supabase_admin')
            OR auth.role() = 'service_role'
        )
    );

-- Catatan Arsitektur Storage:
-- 1. Browser tidak diizinkan menjalankan createSignedUrl() langsung karena anon key tidak memiliki hak akses.
-- 2. Endpoint Serverless (misal: /api/documents/signed-url) bertindak sebagai gatekeeper:
--    memeriksa session user GTK/Wali Kelas di server, lalu men-generate signed URL bertenggat 300 detik.
-- 3. Struktur folder yang disarankan:
--    student-documents/{student_id}/{document_type}/v{version_number}_{timestamp}_{filename}

NOTIFY pgrst, 'reload schema';
