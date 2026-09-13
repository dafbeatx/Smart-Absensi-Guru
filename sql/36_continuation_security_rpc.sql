-- ============================================================================
-- SMART ABSENSI GURU — MIGRATION 36: CONTINUATION SECURITY RPC (SECURITY DEFINER)
-- Fitur: Stored Procedure Terproteksi untuk Verifikasi Rencana & Penggantian Dokumen
-- Fungsi Terkait: public.rpc_verify_continuation_plan, public.rpc_archive_and_replace_document
-- Dependensi: Migration 28, 30, 34, 35
-- Jalankan Query SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fwhdjqvtjzesbdcqorsn/sql
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FUNGSI ATOMIK: rpc_verify_continuation_plan
-- Menangani verifikasi rencana studi (verified / needs_revision) dengan validasi
-- kewenangan wali kelas di PostgreSQL dan pencatatan audit log dalam 1 transaksi.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_verify_continuation_plan(
    p_plan_id UUID,
    p_verifier_user_id TEXT,
    p_decision TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_plan RECORD;
    v_student RECORD;
    v_homeroom RECORD;
BEGIN
    -- A. Input Whitelist Validation (Mencegah status arbitrary)
    IF p_decision NOT IN ('verified', 'needs_revision') THEN
        RAISE EXCEPTION 'Keputusan status tidak sah: %. Hanya "verified" atau "needs_revision" yang diperbolehkan.', p_decision;
    END IF;

    -- B. Validasi Keberadaan & Status Verifikator di public.users
    SELECT * INTO v_user FROM public.users WHERE id = p_verifier_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User verifikator dengan ID "%" tidak ditemukan.', p_verifier_user_id;
    END IF;

    IF v_user.account_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Akun verifikator sedang tidak aktif atau terblokir.';
    END IF;

    -- C. Ambil Data Rencana Lanjutan
    SELECT * INTO v_plan FROM public.student_continuation_plans WHERE id = p_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data rencana lanjutan dengan ID "%" tidak ditemukan.', p_plan_id;
    END IF;

    -- D. Ambil Data Siswa & Rombel Kelas
    SELECT * INTO v_student FROM public.students WHERE id = v_plan.student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Siswa terkait tidak ditemukan dalam master students.';
    END IF;

    -- E. Validasi Otoritas Berdasarkan Role
    IF UPPER(v_user.role) = 'GURU' THEN
        -- Guru WAJIB tercatat sebagai Wali Kelas AKTIF untuk rombel siswa bersangkutan
        SELECT * INTO v_homeroom 
        FROM public.homeroom_assignments 
        WHERE teacher_id = p_verifier_user_id 
          AND class_name = v_student.class_name 
          AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Akses Ditolak: Guru "%" bukan wali kelas aktif untuk rombel %.', v_user.full_name, v_student.class_name;
        END IF;
    ELSIF UPPER(v_user.role) NOT IN ('ADMIN', 'OPERATOR', 'KEPSEK') THEN
        RAISE EXCEPTION 'Role "%" tidak memiliki hak akses verifikasi rencana siswa.', v_user.role;
    END IF;

    -- F. Eksekusi Mutasi Status Rencana Lanjutan (Atomik)
    UPDATE public.student_continuation_plans
    SET status = p_decision,
        verified_by_user_id = p_verifier_user_id,
        verified_by_name = v_user.full_name,
        verified_at = NOW(),
        revision_note = CASE WHEN p_decision = 'needs_revision' THEN p_notes ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_plan_id;

    -- G. Catat Riwayat ke Audit Trail (Append-Only)
    INSERT INTO public.student_verification_logs (
        continuation_plan_id,
        student_id,
        action,
        performed_by_type,
        performed_by_user_id,
        actor_name,
        note,
        created_at
    ) VALUES (
        p_plan_id,
        v_student.id,
        UPPER(p_decision),
        CASE WHEN UPPER(v_user.role) = 'GURU' THEN 'TEACHER' ELSE UPPER(v_user.role) END,
        p_verifier_user_id,
        v_user.full_name,
        p_notes,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', p_plan_id,
        'student_id', v_student.id,
        'student_name', v_student.full_name,
        'class_name', v_student.class_name,
        'status', p_decision,
        'verified_by', v_user.full_name,
        'timestamp', NOW()
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNGSI ATOMIK: rpc_archive_and_replace_document
-- Menangani penggantian berkas dokumen siswa secara atomik (versioning increment)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_archive_and_replace_document(
    p_student_id TEXT,
    p_document_type TEXT,
    p_storage_path TEXT,
    p_original_filename TEXT,
    p_mime_type TEXT,
    p_file_size_bytes BIGINT,
    p_uploaded_by_type TEXT,
    p_uploaded_by_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old_doc RECORD;
    v_new_doc_id UUID := gen_random_uuid();
    v_new_version INTEGER := 1;
BEGIN
    -- 1. Cari dokumen aktif yang ada saat ini
    SELECT * INTO v_old_doc
    FROM public.student_documents
    WHERE student_id = p_student_id
      AND document_type = p_document_type
      AND is_current = true;

    IF FOUND THEN
        v_new_version := v_old_doc.version_number + 1;

        -- Arsipkan versi lama
        UPDATE public.student_documents
        SET is_current = false,
            status = 'archived',
            replaced_by_document_id = v_new_doc_id,
            updated_at = NOW()
        WHERE id = v_old_doc.id;
    END IF;

    -- 2. Sisipkan dokumen baru dengan status pending_verification
    INSERT INTO public.student_documents (
        id,
        student_id,
        document_type,
        version_number,
        is_current,
        storage_path,
        original_filename,
        mime_type,
        file_size_bytes,
        status,
        uploaded_by_type,
        uploaded_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_new_doc_id,
        p_student_id,
        p_document_type,
        v_new_version,
        true,
        p_storage_path,
        p_original_filename,
        p_mime_type,
        p_file_size_bytes,
        'pending_verification',
        p_uploaded_by_type,
        p_uploaded_by_user_id,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'document_id', v_new_doc_id,
        'student_id', p_student_id,
        'document_type', p_document_type,
        'version_number', v_new_version,
        'previous_document_id', CASE WHEN FOUND THEN v_old_doc.id ELSE NULL END
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HARDENING PRIVILEGES: Zero-Trust Backend Execution
-- Fungsi RPC ini DILARANG KERAS dieksekusi langsung oleh koneksi browser (anon / authenticated).
-- Eksekusi HANYA dapat dilakukan oleh Backend Serverless Proxy berotentikasi via service_role.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_verify_continuation_plan(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_continuation_plan(UUID, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_archive_and_replace_document(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_archive_and_replace_document(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
