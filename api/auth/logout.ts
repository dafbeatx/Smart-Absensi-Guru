// api/auth/logout.ts
// Serverless Logout Engine for Smart Absensi Guru (SAGA)
// Revokes stateful session token in database immediately upon logout and clears HttpOnly cookie

import {
  serverSupabase,
  hashSessionToken,
  applyAuthCorsHeaders,
  extractSessionToken,
  buildClearSessionCookie,
} from '../_shared/session-auth.js';

export default async function handler(req: any, res: any) {
  applyAuthCorsHeaders(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Metode request tidak diizinkan. Gunakan POST.',
    });
  }

  // Selalu bersihkan cookie sesi klien secara eksplisit
  res.setHeader('Set-Cookie', buildClearSessionCookie(req));

  const rawToken = extractSessionToken(req);
  if (!rawToken || !rawToken.startsWith('saga_sess_')) {
    return res.status(200).json({
      success: true,
      message: 'Sesi telah berakhir atau tidak ditemukan.',
    });
  }

  const tokenHash = hashSessionToken(rawToken);
  const revokeAll = Boolean(req.body?.all_sessions);

  try {
    if (revokeAll) {
      const { data: sessionRow } = await serverSupabase
        .from('user_sessions')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (sessionRow?.user_id) {
        await serverSupabase
          .from('user_sessions')
          .update({
            revoked_at: new Date().toISOString(),
            revocation_reason: 'USER_LOGOUT_ALL',
          })
          .eq('user_id', sessionRow.user_id)
          .is('revoked_at', null);

        return res.status(200).json({
          success: true,
          message: 'Seluruh sesi perangkat berhasil diakhiri.',
        });
      }
    }

    // Tandai sesi aktif sebagai dicabut (revoked) di database
    await serverSupabase
      .from('user_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revocation_reason: 'USER_LOGOUT',
      })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null);

    return res.status(200).json({
      success: true,
      message: 'Sesi berhasil diakhiri.',
    });
  } catch {
    return res.status(200).json({
      success: true,
      message: 'Sesi berhasil diakhiri.',
    });
  }
}
