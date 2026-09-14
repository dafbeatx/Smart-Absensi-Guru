// api/homeroom/upload-document.ts
// Serverless Homeroom Upload Document Endpoint for Smart Absensi Guru (SAGA)
// Handles direct upload of student documents from mobile cameras or file managers into private bucket student-documents

import { serverSupabase } from '../_shared/session-auth';
import { authenticateHomeroomTeacher, normalizeClassName } from '../_shared/homeroom-auth';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Metode request tidak diizinkan. Gunakan POST.',
    });
  }

  const auth = await authenticateHomeroomTeacher(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      errorCode: auth.errorCode,
      errorMessage: auth.errorMessage,
    });
  }

  if (auth.isReadOnly) {
    return res.status(403).json({
      success: false,
      errorCode: 'AUTH_FORBIDDEN_READONLY',
      errorMessage: 'Akses Ditolak: Akun Anda memiliki hak akses baca-saja dan tidak dapat mengunggah dokumen siswa.',
    });
  }

  const { student_id, document_type, file_base64, file_name, mime_type } = req.body || {};

  if (!student_id || !file_base64 || !document_type) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Parameter student_id, document_type, dan file_base64 wajib diisi.',
    });
  }

  try {
    // 1. Verifikasi Siswa dan Rombel
    const { data: student, error: studentErr } = await serverSupabase
      .from('students')
      .select('id, class_name, full_name')
      .eq('id', student_id)
      .maybeSingle();

    if (studentErr || !student) {
      return res.status(404).json({
        success: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Data siswa tidak ditemukan di database.',
      });
    }

    // 2. Keamanan Rombel: Pastikan siswa berada di rombel wali kelas
    if (!auth.isPrivileged) {
      const studentClass = normalizeClassName(student.class_name);
      const teacherClass = normalizeClassName(auth.assignedClass);

      if (studentClass !== teacherClass) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_FORBIDDEN_CLASS_MISMATCH',
          errorMessage: `Akses Ditolak: Anda tidak berwenang mengunggah berkas untuk rombel ${student.class_name}.`,
        });
      }
    }

    // 3. Konversi Base64 ke Buffer biner
    const base64Clean = file_base64.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(base64Clean, 'base64');
    const fileSizeBytes = fileBuffer.length;
    const cleanDocType = String(document_type).toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanFileName = (file_name || `${cleanDocType}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${student_id}/${cleanDocType}_${Date.now()}_${cleanFileName}`;
    const contentType = mime_type || 'image/jpeg';

    // 4. Unggah ke Private Supabase Storage (student-documents)
    const { error: uploadErr } = await serverSupabase.storage
      .from('student-documents')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({
        success: false,
        errorCode: 'STORAGE_UPLOAD_FAILED',
        errorMessage: 'Gagal mengunggah berkas ke penyimpanan storage: ' + (uploadErr.message || ''),
      });
    }

    // 5. Arsipkan versi dokumen sebelumnya jika ada
    await serverSupabase
      .from('student_documents')
      .update({ is_active: false })
      .eq('student_id', student_id)
      .eq('document_type', cleanDocType);

    // 6. Simpan rekaman dokumen ke public.student_documents
    const now = new Date().toISOString();
    const { data: newDoc, error: insertDocErr } = await serverSupabase
      .from('student_documents')
      .insert({
        student_id,
        document_type: cleanDocType,
        version_number: 1,
        is_active: true,
        storage_path: storagePath,
        original_filename: cleanFileName,
        mime_type: contentType,
        file_size_bytes: fileSizeBytes,
        status: 'pending_verification',
        uploaded_by_type: 'TEACHER',
        uploaded_by_user_id: auth.userId,
        created_at: now,
      })
      .select('*')
      .maybeSingle();

    if (insertDocErr || !newDoc) {
      return res.status(500).json({
        success: false,
        errorCode: 'DATABASE_ERROR',
        errorMessage: 'Gagal mencatat metadata dokumen ke database.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dokumen berhasil diunggah ke arsip siswa.',
      document: {
        id: newDoc.id,
        studentId: newDoc.student_id,
        documentType: newDoc.document_type,
        versionNumber: newDoc.version_number,
        isActive: newDoc.is_active,
        originalFilename: newDoc.original_filename,
        mimeType: newDoc.mime_type,
        fileSizeBytes: newDoc.file_size_bytes,
        status: newDoc.status,
        verificationNotes: null,
        createdAt: newDoc.created_at,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses unggahan dokumen.',
    });
  }
}
