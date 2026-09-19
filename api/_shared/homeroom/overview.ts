// api/_shared/homeroom/overview.ts
// Serverless Homeroom Overview Endpoint for Smart Absensi Guru (SAGA)
// Returns high-level statistics and class profile for the authenticated homeroom teacher

import { serverSupabase } from '../session-auth.js';
import { authenticateHomeroomTeacher } from '../homeroom-auth.js';

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

  const requestedClass = req.query?.class_name as string | undefined;
  const auth = await authenticateHomeroomTeacher(req, requestedClass);

  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      errorCode: auth.errorCode,
      errorMessage: auth.errorMessage,
    });
  }

  const { user, assignedClass, academicYear, targetGraduationYear, isPrivileged } = auth;
  const targetClass = isPrivileged && requestedClass ? requestedClass : assignedClass;

  try {
    // 1. Ambil daftar siswa kelas bersangkutan
    let studentQuery = serverSupabase
      .from('students')
      .select('id, nis, nisn, full_name, class_name, gender');

    if (targetClass !== 'ALL') {
      studentQuery = studentQuery.eq('class_name', targetClass);
    }

    const { data: students, error: studentErr } = await studentQuery;
    if (studentErr) {
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorMessage: 'Gagal memuat data siswa kelas.',
      });
    }

    const studentList = students || [];
    const studentIds = studentList.map((s: any) => s.id);

    // 2. Ambil rencana lanjutan siswa (student_continuation_plans)
    let plans: any[] = [];
    if (studentIds.length > 0) {
      const { data: planData, error: planErr } = await serverSupabase
        .from('student_continuation_plans')
        .select('id, student_id, status, continuation_type, parent_agreement, submitted_at, verified_at, revision_note')
        .in('student_id', studentIds);

      if (!planErr && planData) {
        plans = planData;
      }
    }

    const planByStudentId = new Map<string, any>();
    plans.forEach((p) => planByStudentId.set(p.student_id, p));

    // 3. Kalkulasi Statistik
    let draftCount = 0;
    let submittedCount = 0;
    let pendingVerificationCount = 0;
    let verifiedCount = 0;
    let needsRevisionCount = 0;
    let parentAgreedCount = 0;

    studentList.forEach((s: any) => {
      const p = planByStudentId.get(s.id);
      const status = p?.status || 'draft';

      if (status === 'draft') draftCount++;
      else if (status === 'submitted') submittedCount++;
      else if (status === 'pending_verification') pendingVerificationCount++;
      else if (status === 'verified') verifiedCount++;
      else if (status === 'needs_revision') needsRevisionCount++;

      if (p?.parent_agreement) parentAgreedCount++;
    });

    const totalStudents = studentList.length;
    const completionRate = totalStudents > 0 ? Math.round((verifiedCount / totalStudents) * 100) : 0;

    return res.status(200).json({
      success: true,
      overview: {
        teacherId: user.id,
        teacherName: user.full_name,
        teacherRole: auth.role,
        assignedClass: targetClass,
        academicYear,
        targetGraduationYear,
        totalStudents,
        completionRate,
        stats: {
          draft: draftCount,
          submitted: submittedCount,
          pendingVerification: pendingVerificationCount,
          verified: verifiedCount,
          needsRevision: needsRevisionCount,
          parentAgreed: parentAgreedCount,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses overview wali kelas.',
    });
  }
}
