// api/homeroom/student-detail.ts
// Serverless Homeroom Student Detail Endpoint for Smart Absensi Guru (SAGA)
// Returns complete relational data of a student's continuation plan for homeroom verification

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

  const studentId = req.query?.student_id as string | undefined;
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Parameter student_id wajib disertakan.',
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

  const { assignedClass, isPrivileged } = auth;

  try {
    // 1. Ambil data siswa
    const { data: student, error: studentErr } = await serverSupabase
      .from('students')
      .select('id, nis, nisn, full_name, class_name, gender, photo_url')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student) {
      return res.status(404).json({
        success: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Data siswa tidak ditemukan di database.',
      });
    }

    // 2. Keamanan Rombel: Pastikan siswa berada di kelas yang diampu guru
    if (!isPrivileged) {
      const studentClass = normalizeClassName(student.class_name);
      const teacherClass = normalizeClassName(assignedClass);

      if (studentClass !== teacherClass) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_FORBIDDEN_CLASS_MISMATCH',
          errorMessage: `Akses Ditolak: Anda hanya memiliki wewenang untuk rombel ${assignedClass}. Siswa ini berada di rombel ${student.class_name}.`,
        });
      }
    }

    // 3. Ambil rencana studi siswa
    const { data: plan } = await serverSupabase
      .from('student_continuation_plans')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    let choices: any[] = [];
    let interests: any[] = [];
    let achievements: any[] = [];
    let documents: any[] = [];
    let verificationLogs: any[] = [];

    if (plan?.id) {
      // 4. Ambil pilihan sekolah
      const { data: choicesData } = await serverSupabase
        .from('student_school_choices')
        .select('*')
        .eq('continuation_plan_id', plan.id)
        .order('priority', { ascending: true });

      choices = choicesData || [];

      // 5. Ambil minat & bakat
      const { data: interestsData } = await serverSupabase
        .from('student_interests')
        .select('*')
        .eq('continuation_plan_id', plan.id);

      interests = interestsData || [];

      // 6. Ambil prestasi
      const { data: achievementsData } = await serverSupabase
        .from('student_achievements')
        .select('*')
        .eq('continuation_plan_id', plan.id)
        .order('year', { ascending: false });

      achievements = achievementsData || [];

      // 7. Ambil berkas / dokumen
      const { data: documentsData } = await serverSupabase
        .from('student_documents')
        .select('id, student_id, document_type, version_number, is_active, original_filename, mime_type, file_size_bytes, status, verification_notes, created_at')
        .eq('student_id', studentId)
        .eq('is_active', true);

      documents = documentsData || [];

      // 8. Ambil riwayat verifikasi (audit log)
      const { data: logsData } = await serverSupabase
        .from('student_verification_logs')
        .select('*')
        .eq('continuation_plan_id', plan.id)
        .order('created_at', { ascending: false });

      verificationLogs = logsData || [];
    }

    return res.status(200).json({
      success: true,
      detail: {
        student: {
          id: student.id,
          nis: student.nis,
          nisn: student.nisn,
          fullName: student.full_name,
          className: student.class_name,
          gender: student.gender,
          photoUrl: student.photo_url,
        },
        plan: plan
          ? {
              id: plan.id,
              academicYear: plan.academic_year,
              graduationYear: plan.graduation_year,
              continuationType: plan.continuation_type,
              status: plan.status,
              submittedAt: plan.submitted_at,
              verifiedAt: plan.verified_at,
              verifiedByName: plan.verified_by_name,
              revisionNote: plan.revision_note,
              parentAgreement: plan.parent_agreement,
            }
          : null,
        choices,
        interests,
        achievements,
        documents,
        verificationLogs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses detail siswa.',
    });
  }
}
