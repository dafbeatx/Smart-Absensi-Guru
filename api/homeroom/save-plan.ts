// api/homeroom/save-plan.ts
// Serverless Homeroom Save Plan Endpoint for Smart Absensi Guru (SAGA)
// Allows homeroom teacher to input/update continuation plan and choices for students in their assigned class

import { serverSupabase } from '../_shared/session-auth.js';
import { authenticateHomeroomTeacher, normalizeClassName } from '../_shared/homeroom-auth.js';

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
      errorMessage: 'Akses Ditolak: Akun Anda memiliki hak akses baca-saja dan tidak dapat menyimpan perubahan data siswa.',
    });
  }

  const {
    student_id,
    continuation_type,
    parent_agreement,
    first_choice_school_name,
    first_choice_major_name,
    second_choice_school_name,
    second_choice_major_name,
    parent_notes,
  } = req.body || {};

  if (!student_id || typeof student_id !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Parameter student_id wajib disertakan.',
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
          errorMessage: `Akses Ditolak: Anda hanya berwenang mengelola data rombel ${auth.assignedClass}. Siswa berada di rombel ${student.class_name}.`,
        });
      }
    }

    // 3. Upsert Rencana Studi Siswa
    const now = new Date().toISOString();
    const validContinuationType = continuation_type || 'BELUM_MENENTUKAN';

    const { data: existingPlan } = await serverSupabase
      .from('student_continuation_plans')
      .select('id, status')
      .eq('student_id', student_id)
      .maybeSingle();

    let planId = existingPlan?.id;

    if (existingPlan) {
      const updatePayload: any = {
        continuation_type: validContinuationType,
        parent_agreement: Boolean(parent_agreement),
        parent_notes: parent_notes || null,
        updated_at: now,
      };

      // Jika sebelumnya draft dan sekarang diisi pilihan sekolah, naikkan status ke submitted
      if (existingPlan.status === 'draft' && first_choice_school_name?.trim()) {
        updatePayload.status = 'submitted';
        updatePayload.submitted_at = now;
      }

      await serverSupabase
        .from('student_continuation_plans')
        .update(updatePayload)
        .eq('id', planId);
    } else {
      const isComplete = Boolean(first_choice_school_name?.trim());
      const initialStatus = isComplete ? 'submitted' : 'draft';

      const { data: newPlan, error: insertPlanErr } = await serverSupabase
        .from('student_continuation_plans')
        .insert({
          student_id,
          academic_year: auth.academicYear,
          graduation_year: auth.targetGraduationYear,
          continuation_type: validContinuationType,
          status: initialStatus,
          parent_agreement: Boolean(parent_agreement),
          parent_notes: parent_notes || null,
          submitted_at: isComplete ? now : null,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .maybeSingle();

      if (insertPlanErr || !newPlan) {
        return res.status(500).json({
          success: false,
          errorCode: 'DATABASE_ERROR',
          errorMessage: 'Gagal membuat rekaman rencana studi baru.',
        });
      }
      planId = newPlan.id;
    }

    // 4. Update Pilihan Sekolah (Priority 1 & 2)
    if (planId && (first_choice_school_name || second_choice_school_name)) {
      if (first_choice_school_name?.trim()) {
        await serverSupabase
          .from('student_school_choices')
          .delete()
          .eq('continuation_plan_id', planId)
          .eq('priority', 1);

        await serverSupabase.from('student_school_choices').insert({
          continuation_plan_id: planId,
          priority: 1,
          school_name: first_choice_school_name.trim(),
          school_type: validContinuationType.startsWith('SMK') ? 'SMK' : 'SMA',
          major_name: first_choice_major_name?.trim() || null,
          registration_track: 'Reguler',
          notes: 'Diinput oleh Wali Kelas',
          created_at: now,
        });
      }

      if (second_choice_school_name?.trim()) {
        await serverSupabase
          .from('student_school_choices')
          .delete()
          .eq('continuation_plan_id', planId)
          .eq('priority', 2);

        await serverSupabase.from('student_school_choices').insert({
          continuation_plan_id: planId,
          priority: 2,
          school_name: second_choice_school_name.trim(),
          school_type: validContinuationType.startsWith('SMK') ? 'SMK' : 'SMA',
          major_name: second_choice_major_name?.trim() || null,
          registration_track: 'Zonasi/Afirmasi',
          notes: 'Pilihan cadangan',
          created_at: now,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Rencana pendidikan lanjutan siswa berhasil disimpan.',
      plan_id: planId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat menyimpan rencana siswa.',
    });
  }
}
