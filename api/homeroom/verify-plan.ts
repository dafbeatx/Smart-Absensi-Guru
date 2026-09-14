// api/homeroom/verify-plan.ts
// Serverless Homeroom Plan Verification Endpoint for Smart Absensi Guru (SAGA)
// Executes atomic PostgreSQL RPC rpc_verify_continuation_plan with strict security boundary

import { serverSupabase } from '../_shared/session-auth.js';
import { authenticateHomeroomTeacher } from '../_shared/homeroom-auth.js';

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

  // Wewenang Baca-Saja (misal: Kepala Sekolah) diblokir dari mutasi
  if (auth.isReadOnly) {
    return res.status(403).json({
      success: false,
      errorCode: 'AUTH_FORBIDDEN_READONLY',
      errorMessage: 'Akses Ditolak: Akun Anda memiliki hak akses baca-saja (monitoring) dan tidak dapat melakukan verifikasi langsung.',
    });
  }

  const { plan_id, decision, notes } = req.body || {};

  // 1. Validasi Input
  if (!plan_id || typeof plan_id !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'ID Rencana Studi (plan_id) wajib diisi.',
    });
  }

  if (decision !== 'verified' && decision !== 'needs_revision') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Keputusan verifikasi tidak sah. Pilihan: "verified" atau "needs_revision".',
    });
  }

  if (decision === 'needs_revision' && (!notes || typeof notes !== 'string' || !notes.trim())) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Catatan perbaikan wajib diisi ketika meminta siswa melakukan revisi.',
    });
  }

  try {
    // 2. Eksekusi Stored Procedure Atomik di Database PostgreSQL
    const { data: rpcResult, error: rpcErr } = await serverSupabase.rpc('rpc_verify_continuation_plan', {
      p_plan_id: plan_id,
      p_verifier_user_id: auth.userId,
      p_decision: decision,
      p_notes: notes?.trim() || null,
    });

    if (rpcErr) {
      // Tangani pesan penolakan dari database RPC
      return res.status(400).json({
        success: false,
        errorCode: 'VERIFICATION_FAILED',
        errorMessage: rpcErr.message || 'Gagal mengeksekusi verifikasi rencana siswa di database.',
      });
    }

    return res.status(200).json({
      success: true,
      message: decision === 'verified'
        ? 'Rencana pendidikan lanjutan siswa berhasil disetujui dan diverifikasi.'
        : 'Permintaan revisi rencana berhasil dikirimkan kepada siswa/orang tua.',
      result: rpcResult,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses verifikasi rencana.',
    });
  }
}
