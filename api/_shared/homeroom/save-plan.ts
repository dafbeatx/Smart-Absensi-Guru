// api/_shared/homeroom/save-plan.ts
// Serverless Homeroom Plan Creation/Update Endpoint for Smart Absensi Guru (SAGA)
// Saves and updates continuation plans, school choices, and interests for Academic Year 2026/2027

import { serverSupabase } from '../session-auth.js';
import { authenticateHomeroomTeacher, normalizeClassName } from '../homeroom-auth.js';

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
      errorMessage: 'Akses Ditolak: Akun Anda memiliki hak akses baca-saja dan tidak dapat mengubah rencana studi.',
    });
  }

  const body = req.body || {};
  const studentId = body.student_id || body.studentId;
  const continuationType = body.continuation_type || body.continuationType || 'BELUM_MENENTUKAN';
  const status = body.status || 'draft';
  const academicYear = body.academic_year || body.academicYear || '2026/2027';
  const graduationYear = Number(body.graduation_year || body.graduationYear || 2027);
  const parentAgreement = Boolean(body.parent_agreement ?? body.parentAgreement ?? false);
  const choices = Array.isArray(body.choices) ? body.choices : [];

  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'ID Siswa (student_id) wajib diisi.',
    });
  }

  try {
    // 1. Validasi keberadaan siswa dan wewenang rombel
    const { data: student, error: studentErr } = await serverSupabase
      .from('students')
      .select('id, class_name')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student) {
      return res.status(404).json({
        success: false,
        errorCode: 'STUDENT_NOT_FOUND',
        errorMessage: 'Data siswa tidak ditemukan di sistem.',
      });
    }

    if (!auth.isPrivileged) {
      const studentClass = normalizeClassName(student.class_name);
      const teacherClass = normalizeClassName(auth.assignedClass);
      if (studentClass !== teacherClass) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_FORBIDDEN_CLASS_MISMATCH',
          errorMessage: `Akses Ditolak: Anda hanya memiliki wewenang untuk rombel ${auth.assignedClass}.`,
        });
      }
    }

    // 2. Cek apakah rencana studi sudah ada untuk (student_id, graduation_year)
    const { data: existingPlan } = await serverSupabase
      .from('student_continuation_plans')
      .select('id')
      .eq('student_id', studentId)
      .eq('graduation_year', graduationYear)
      .maybeSingle();

    let planId = existingPlan?.id;

    if (planId) {
      // Update rencana studi yang ada
      const { error: updateErr } = await serverSupabase
        .from('student_continuation_plans')
        .update({
          continuation_type: continuationType,
          status,
          academic_year: academicYear,
          parent_agreement: parentAgreement,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (updateErr) {
        return res.status(500).json({
          success: false,
          errorCode: 'DB_ERROR',
          errorMessage: 'Gagal memperbarui data rencana studi di database.',
        });
      }
    } else {
      // Buat rencana studi baru
      const { data: newPlan, error: insertErr } = await serverSupabase
        .from('student_continuation_plans')
        .insert({
          student_id: studentId,
          academic_year: academicYear,
          graduation_year: graduationYear,
          continuation_type: continuationType,
          status,
          parent_agreement: parentAgreement,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !newPlan) {
        return res.status(500).json({
          success: false,
          errorCode: 'DB_ERROR',
          errorMessage: 'Gagal menyimpan rencana studi baru di database.',
        });
      }
      planId = newPlan.id;
    }

    // 3. Simpan pilihan sekolah (student_school_choices) jika ada
    if (choices.length > 0 && planId) {
      // Hapus pilihan sekolah lama untuk plan ini
      await serverSupabase
        .from('student_school_choices')
        .delete()
        .eq('continuation_plan_id', planId);

      // Masukkan pilihan baru
      const choiceRows = choices.map((c: any, index: number) => ({
        continuation_plan_id: planId,
        priority: c.priority || index + 1,
        school_name: c.schoolName || c.school_name || '',
        school_type: c.schoolType || c.school_type || 'SMA',
        major_name: c.majorName || c.major_name || null,
        registration_track: c.registrationTrack || c.registration_track || null,
        notes: c.notes || null,
      }));

      await serverSupabase.from('student_school_choices').insert(choiceRows);
    }

    return res.status(200).json({
      success: true,
      message: 'Rencana studi siswa berhasil disimpan.',
      planId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: err?.message || 'Terjadi kesalahan sistem saat menyimpan rencana studi.',
    });
  }
}
