// Vercel Serverless Function: api/send-push.ts
// Handles sending encrypted Web Push notifications to teachers, admin, and kepsek via Google FCM / Apple APNs

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID details
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BJxAOVY7XCFiipXVppN_IPu5rWUzXaLzhM33dytmGI6oQ0SES9Qspm3sTPYcz9euG1NhSOSZb8BHLShozXnotnI';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'OBCW3DLo1qUpLq021YMbV0f-m-kwR_W40hzU47MY68E';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@sekolah.sch.id';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('VAPID setup warning:', err);
}

// Supabase client initialization
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fwhdjqvtjzesbdcqorsn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PushRequestBody {
  targetRoles?: ('ADMIN' | 'KEPSEK' | 'GURU' | 'OPERATOR')[];
  targetUserId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  actions?: Array<{ action: string; title: string }>;
}

export default async function handler(req: any, res: any) {
  // Allow CORS for local and web requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Gunakan POST.' });
  }

  const {
    targetRoles,
    targetUserId,
    title,
    body,
    url = '/',
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

  try {
    let targetUserIds: string[] = [];

    if (targetUserId) {
      targetUserIds = [targetUserId];
    } else if (targetRoles && targetRoles.length > 0) {
      // Cari ID pengguna yang memiliki role sesuai target
      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id')
        .in('role', targetRoles);

      if (userErr) {
        console.warn('Error fetching target users by role:', userErr.message);
      }
      targetUserIds = (users || []).map((u: { id: string }) => u.id);
    }

    // Ambil daftar Push Subscriptions dari tabel push_subscriptions
    let query = supabase.from('push_subscriptions').select('*');

    if (targetUserIds.length > 0) {
      query = query.in('user_id', targetUserIds);
    }

    const { data: subscriptions, error: subErr } = await query;

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
        message: 'Tidak ada perangkat terdaftar untuk target ini.',
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag,
      icon,
      badge,
      actions,
    });

    let successCount = 0;
    let failCount = 0;
    const staleEndpoints: string[] = [];

    // Kirim notifikasi ke semua subscription
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
