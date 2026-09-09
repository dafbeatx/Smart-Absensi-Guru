// Vercel Serverless Function: api/send-push.ts
// Handles sending encrypted Web Push notifications to teachers, admin, and kepsek via Google FCM / Apple APNs

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID details exclusively from environment secrets
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@sekolah.sch.id';

let isVapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidConfigured = true;
  } catch (err) {
    console.error('VAPID setup error:', err);
  }
} else {
  console.warn('[VAPID] VAPID_PRIVATE_KEY atau VAPID_PUBLIC_KEY belum dikonfigurasi di environment variables.');
}

// Supabase client initialization (prefer service role key for backend push delivery)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fwhdjqvtjzesbdcqorsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface PushRequestBody {
  targetRoles?: ('ADMIN' | 'KEPSEK' | 'GURU' | 'OPERATOR')[];
  targetUserId?: string;
  senderUserId?: string;
  senderRole?: 'ADMIN' | 'KEPSEK' | 'GURU' | 'OPERATOR';
  eventType?: 'ATTENDANCE' | 'LEAVE' | 'SCHEDULE' | 'ANNOUNCEMENT' | 'CRITICAL' | 'SYSTEM';
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  url?: string;
  action_url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Helper: Cek apakah waktu saat ini berada di dalam jendela Quiet Hours (HH:mm)
 */
function isInQuietHours(startTimeStr?: string | null, endTimeStr?: string | null): boolean {
  if (!startTimeStr || !endTimeStr) return false;
  try {
    const now = new Date();
    // Jakarta time (UTC+7)
    const jakartaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
    const [curH, curM] = jakartaTimeStr.split(':').map((n) => parseInt(n, 10));
    const currentMin = curH * 60 + curM;

    const [sH, sM] = startTimeStr.split(':').map((n) => parseInt(n, 10));
    const startMin = sH * 60 + sM;

    const [eH, eM] = endTimeStr.split(':').map((n) => parseInt(n, 10));
    const endMin = eH * 60 + eM;

    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin < endMin;
    } else {
      // Overnight (misal 21:00 sampai 05:00)
      return currentMin >= startMin || currentMin < endMin;
    }
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  // Allow CORS for web requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Gunakan POST.' });
  }

  if (!isVapidConfigured) {
    return res.status(500).json({
      error: 'VAPID belum dikonfigurasi. Pastikan VAPID_PRIVATE_KEY dan VITE_VAPID_PUBLIC_KEY tersedia di server environment.',
    });
  }

  const authHeader = req.headers.authorization || '';
  const internalSecretHeader = req.headers['x-internal-secret'] || '';
  const expectedSecret = process.env.INTERNAL_PUSH_SECRET || process.env.VAPID_PRIVATE_KEY;

  // Verifikasi Autentikasi Pengirim (Bearer token atau internal server secret)
  const isInternalServerCall = expectedSecret && internalSecretHeader === expectedSecret;
  const hasAuthToken = authHeader.startsWith('Bearer ');

  if (!isInternalServerCall && !hasAuthToken && process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      error: 'Unauthorized: Endpoint ini memerlukan token autentikasi atau signature server.',
    });
  }

  const {
    targetRoles,
    targetUserId,
    senderUserId,
    senderRole,
    eventType = 'SYSTEM',
    severity = 'INFO',
    title,
    body,
    url = '/',
    action_url,
    tag = `push_${Date.now()}`,
    icon = '/pwa-192x192.png',
    badge = '/pwa-192x192.png',
    actions = [
      { action: 'open_app', title: '📱 Buka Aplikasi' },
      { action: 'close', title: 'Tutup' },
    ],
  }: PushRequestBody = req.body || {};

  if (!title || !body) {
    return res.status(400).json({ error: 'Field "title" dan "body" wajib diisi.' });
  }

  // Otorisasi Role Pengirim:
  // Role GURU hanya boleh mengirim notifikasi yang relevan (ke diri sendiri atau event presensi/izin ke Admin/Kepsek)
  if (senderRole === 'GURU') {
    const isTargetSelf = targetUserId && targetUserId === senderUserId;
    const isLegitStaffAlert =
      targetRoles &&
      targetRoles.every((r) => r === 'ADMIN' || r === 'KEPSEK') &&
      (eventType === 'ATTENDANCE' || eventType === 'LEAVE');

    if (!isTargetSelf && !isLegitStaffAlert) {
      return res.status(403).json({
        error: 'Forbidden: Guru hanya diizinkan memicu notifikasi presensi atau pengajuan izin.',
      });
    }
  }

  // Sanitasi URL tujuan internal agar aman dari open-redirect
  const effectiveUrl = action_url || url;
  const sanitizedUrl = effectiveUrl.startsWith('/') ? effectiveUrl : `/${effectiveUrl.replace(/^https?:\/\/[^/]+/, '')}`;

  try {
    let candidateUserIds: string[] = [];

    if (targetUserId) {
      candidateUserIds = [targetUserId];
    } else if (targetRoles && targetRoles.length > 0) {
      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id')
        .in('role', targetRoles);

      if (userErr) {
        console.warn('Error fetching target users by role:', userErr.message);
      }
      candidateUserIds = (users || []).map((u: { id: string }) => u.id);
    }

    if (candidateUserIds.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        message: 'Tidak ada target user yang sesuai kriteria.',
      });
    }

    // Filter preferensi notifikasi & Quiet Hours target user
    let eligibleUserIds = candidateUserIds;
    try {
      const { data: prefsList } = await supabase
        .from('notification_preferences')
        .select('*')
        .in('user_id', candidateUserIds);

      if (prefsList && prefsList.length > 0) {
        const prefMap = new Map(prefsList.map((p: any) => [p.user_id, p]));
        eligibleUserIds = candidateUserIds.filter((uid) => {
          const pref: any = prefMap.get(uid);
          if (!pref) return true; // Default allow

          if (pref.push_enabled === false) return false;

          // Event type filtering
          if (eventType === 'ATTENDANCE' && pref.attendance_enabled === false) return false;
          if (eventType === 'LEAVE' && pref.leave_enabled === false) return false;
          if (eventType === 'SCHEDULE' && pref.schedule_enabled === false) return false;
          if (eventType === 'ANNOUNCEMENT' && pref.announcement_enabled === false) return false;

          // Quiet hours filtering (kecuali severity CRITICAL)
          if (severity !== 'CRITICAL' && isInQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
            return false;
          }

          return true;
        });
      }
    } catch (prefErr) {
      console.warn('Preferences check warning (table might be initializing):', prefErr);
    }

    if (eligibleUserIds.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        message: 'Semua target pengguna menonaktifkan notifikasi atau sedang dalam jam tenang (quiet hours).',
      });
    }

    // Ambil daftar Push Subscriptions dari tabel push_subscriptions
    const { data: subscriptions, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', eligibleUserIds);

    if (subErr) {
      console.warn('Error fetching push subscriptions:', subErr.message);
      return res.status(200).json({
        ok: false,
        message: 'Tabel push_subscriptions belum dibuat atau gagal diakses.',
        error: subErr.message,
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        message: 'Tidak ada perangkat terdaftar untuk target pengguna yang eligible.',
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: sanitizedUrl,
      action_url: sanitizedUrl,
      tag,
      severity,
      eventType,
      icon,
      badge,
      actions,
    });

    let successCount = 0;
    let failCount = 0;
    const staleEndpoints: string[] = [];

    // Kirim Web Push terenkripsi ke masing-masing subscription
    await Promise.all(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          successCount++;
        } catch (err: any) {
          failCount++;
          // Jika endpoint sudah tidak valid (404 atau 410 Gone), tandai untuk dihapus
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Hapus endpoint kedaluwarsa secara otomatis
    if (staleEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    return res.status(200).json({
      ok: true,
      sent: successCount,
      failed: failCount,
      cleanedStale: staleEndpoints.length,
    });
  } catch (error: any) {
    console.error('send-push handler exception:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
}
