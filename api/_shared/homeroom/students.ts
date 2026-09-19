// api/_shared/homeroom/students.ts
// Serverless Homeroom Students Roster Endpoint for Smart Absensi Guru (SAGA)
// Lists grade 9 students with their current continuation plan status for the authenticated teacher

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

  const { assignedClass, isPrivileged } = auth;
  const targetClass = isPrivileged && requestedClass ? requestedClass : assignedClass;

  try {
    // 1. Ambil seluruh data siswa pada rombel
    let studentQuery = serverSupabase
      .from('students')
      .select('id, nis, nisn, full_name, class_name, gender, photo_url')
      .order('full_name', { ascending: true });

    if (targetClass !== 'ALL') {
      studentQuery = studentQuery.eq('class_name', targetClass);
    }

    const { data: students, error: studentErr } = await studentQuery;
    if (studentErr) {
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorMessage: 'Gagal memuat daftar siswa dari database.',
      });
    }

    const studentList = students || [];
    const studentIds = studentList.map((s: any) => s.id);

    // 2. Ambil rencana studi siswa
    let plans: any[] = [];
    if (studentIds.length > 0) {
      const { data: planData, error: planErr } = await serverSupabase
        .from('student_continuation_plans')
        .select('id, student_id, continuation_type, status, parent_agreement, submitted_at, verified_at, revision_note')
        .in('student_id', studentIds);

      if (!planErr && planData) {
        plans = planData;
      }
    }

    // 3. Ambil pilihan sekolah prioritas 1
    let choices: any[] = [];
    const planIds = plans.map((p) => p.id);
    if (planIds.length > 0) {
      const { data: choiceData, error: choiceErr } = await serverSupabase
        .from('student_school_choices')
        .select('continuation_plan_id, priority, school_name, school_type, major_name')
        .in('continuation_plan_id', planIds)
        .eq('priority', 1);

      if (!choiceErr && choiceData) {
        choices = choiceData;
      }
    }

    const planByStudentId = new Map<string, any>();
    plans.forEach((p) => planByStudentId.set(p.student_id, p));

    const choiceByPlanId = new Map<string, any>();
    choices.forEach((c) => choiceByPlanId.set(c.continuation_plan_id, c));

    // 4. Susun respons terpadu
    const result = studentList.map((student: any) => {
      const plan = planByStudentId.get(student.id) || null;
      const firstChoice = plan ? choiceByPlanId.get(plan.id) || null : null;

      return {
        id: student.id,
        nis: student.nis || null,
        nisn: student.nisn || null,
        fullName: student.full_name,
        className: student.class_name,
        gender: student.gender || null,
        photoUrl: student.photo_url || null,
        plan: plan
          ? {
              id: plan.id,
              continuationType: plan.continuation_type,
              status: plan.status,
              parentAgreement: plan.parent_agreement,
              submittedAt: plan.submitted_at,
              verifiedAt: plan.verified_at,
              revisionNote: plan.revision_note,
              firstChoice: firstChoice
                ? {
                    schoolName: firstChoice.school_name,
                    schoolType: firstChoice.school_type,
                    majorName: firstChoice.major_name,
                  }
                : null,
            }
          : {
              id: null,
              continuationType: 'BELUM_MENENTUKAN',
              status: 'draft',
              parentAgreement: false,
              submittedAt: null,
              verifiedAt: null,
              revisionNote: null,
              firstChoice: null,
            },
      };
    });

    return res.status(200).json({
      success: true,
      className: targetClass,
      total: result.length,
      students: result,
    });
  } catch {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan saat memproses daftar siswa.',
    });
  }
}
