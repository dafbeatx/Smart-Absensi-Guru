// api/auth/logout.ts
// Serverless Logout Engine for Smart Absensi Guru (SAGA)
// Revokes stateful session token in database immediately upon logout

import { serverSupabase, hashSessionToken } from '../_shared/session-auth';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  const authHeader = req.headers?.authorization || req.headers?.['x-session-token'];
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(200).json({
      success: true,
      message: 'Sesi telah berakhir atau tidak ditemukan.',
    });
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken || !rawToken.startsWith('saga_sess_')) {
    return res.status(200).json({
      success: true,
      message: 'Sesi telah berakhir.',
    });
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    // Tandai sesi sebagai dicabut (revoked)
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
