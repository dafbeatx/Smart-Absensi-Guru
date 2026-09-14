// api/homeroom/document-download.ts
// Serverless Homeroom Document Download Endpoint for Smart Absensi Guru (SAGA)
// Emits short-lived (15 minutes) signed URLs from private storage bucket student-documents

import { serverSupabase } from '../_shared/session-auth';
import { authenticateHomeroomTeacher, normalizeClassName } from '../_shared/homeroom-auth';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Metode request tidak diizinkan. Gunakan GET.',
    });
  }

  const documentId = req.query?.document_id as string | undefined;
  if (!documentId || typeof documentId !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Parameter document_id wajib disertakan.',
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

  try {
    // 1. Ambil rekaman dokumen
    const { data: doc, error: docErr } = await serverSupabase
      .from('student_documents')
      .select('id, student_id, storage_path, original_filename, is_active, students:student_id(id, full_name, class_name)')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return res.status(404).json({
        success: false,
        errorCode: 'DOCUMENT_NOT_FOUND',
        errorMessage: 'Dokumen berkas tidak ditemukan di database.',
      });
    }

    const student = Array.isArray(doc.students) ? doc.students[0] : doc.students;
    if (!student) {
      return res.status(404).json({
        success: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Data siswa pemilik berkas tidak ditemukan.',
      });
    }

    // 2. Keamanan Rombel: Pastikan siswa pemilik berkas berada di rombel wali kelas
    if (!auth.isPrivileged) {
      const studentClass = normalizeClassName(student.class_name);
      const teacherClass = normalizeClassName(auth.assignedClass);

      if (studentClass !== teacherClass) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_FORBIDDEN_CLASS_MISMATCH',
          errorMessage: `Akses Ditolak: Anda tidak memiliki wewenang mengakses berkas siswa dari rombel ${student.class_name}.`,
        });
      }
    }

    // 3. Terbitkan Signed URL sementara (15 Menit = 900 Detik)
    const { data: signedData, error: storageErr } = await serverSupabase.storage
      .from('student-documents')
      .createSignedUrl(doc.storage_path, 900);

    if (storageErr || !signedData?.signedUrl) {
      return res.status(500).json({
        success: false,
        errorCode: 'STORAGE_SIGNED_URL_FAILED',
        errorMessage: 'Gagal membuat tautan unduhan aman dari storage.',
      });
    }

    return res.status(200).json({
      success: true,
      downloadUrl: signedData.signedUrl,
      fileName: doc.original_filename,
      expiresInSeconds: 900,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses berkas dokumen.',
    });
  }
}
