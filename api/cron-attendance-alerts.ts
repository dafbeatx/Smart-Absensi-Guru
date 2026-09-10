// Vercel Serverless Function: api/cron-attendance-alerts.ts
// Handles scheduled background push notifications for Teachers & Staff
// Runs automatically via Vercel Cron (or manual trigger) even when phone is sleeping/closed

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID keys
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || 'BJxAOVY7XCFiipXVppN_IPu5rWUzXaLzhM33dytmGI6oQ0SES9Qspm3sTPYcz9euG1NhSOSZb8BHLShozXnotnI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'OBCW3DLo1qUpLq021YMbV0f-m-kwR_W40hzU47MY68E';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@sekolah.sch.id';

let isVapidReady = false;
try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidReady = true;
  }
} catch (err) {
  console.error('[CronPush] VAPID configuration error:', err);
}

// Supabase client initialization
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fwhdjqvtjzesbdcqorsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isVapidReady) {
    return res.status(500).json({ error: 'VAPID keys not configured.' });
  }

  // Calculate Jakarta Time (WIB, UTC+7)
  const now = new Date();
  const jakartaTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
  const [curH, curM] = jakartaTimeStr.split(':').map((n) => parseInt(n, 10));
  
  // Format Date in Jakarta
  const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const todayDateStr = jakartaDateFormatter.format(now); // YYYY-MM-DD
  const dayOfMonth = parseInt(todayDateStr.split('-')[2], 10);
  
  // Day of week: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const jakartaDayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' });
  const dayName = jakartaDayFormatter.format(now);
  const isWeekend = dayName === 'Sat' || dayName === 'Sun';

  const reqType = (req.query && req.query.type) || (req.body && req.body.type) || 'auto';

  const alertsToSend: Array<{
    title: string;
    body: string;
    tag: string;
    url: string;
    targetRoles?: string[];
  }> = [];

  // 1. 💰 PENGINGAT HARI GAJIAN BULANAN (H-3, H-2, H-1, HARI H TANGGAL 10)
  if (dayOfMonth === 7) {
    alertsToSend.push({
      title: '💰 Pengingat: 3 Hari Lagi Hari Gajian! (Tanggal 10)',
      body: 'Halo Bapak/Ibu Guru & Staf! 3 hari lagi (tanggal 10) adalah Hari Gajian bulanan. Tetap semangat mengajar dan selalu lakukan presensi.',
      tag: `payday_h3_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  } else if (dayOfMonth === 8) {
    alertsToSend.push({
      title: '💰 Pengingat: 2 Hari Lagi Hari Gajian! (Tanggal 10)',
      body: 'Halo Bapak/Ibu Guru & Staf! 2 hari lagi (tanggal 10) adalah Hari Gajian bulanan. Tetap semangat mengajar dan selalu lakukan presensi.',
      tag: `payday_h2_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  } else if (dayOfMonth === 9) {
    alertsToSend.push({
      title: '💰 Pengingat: Besok Hari Gajian! (Tanggal 10)',
      body: 'Halo Bapak/Ibu Guru & Staf! Besok (tanggal 10) adalah jadwal penggajian bulanan. Tetap semangat mengajar dan jangan lupa presensi.',
      tag: `payday_h1_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  } else if (dayOfMonth === 10) {
    alertsToSend.push({
      title: '💰 Hari Gajian Telah Tiba! (Tanggal 10)',
      body: 'Selamat Bapak/Ibu Guru & Staf! Hari ini tanggal 10 adalah Hari Gajian Guru & Staf. Tetap semangat mengajar dan jangan lupa presensi masuk & pulang.',
      tag: `payday_h0_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  }

  // 2. ⏰ PENGINGAT PRESENSI MASUK PAGI (Hari Kerja, Pagi)
  const isMorningSlot = reqType === 'morning' || (curH >= 6 && curH <= 8);
  if (!isWeekend && isMorningSlot && reqType !== 'checkout') {
    alertsToSend.push({
      title: '⏰ Pengingat Presensi Masuk Pagi',
      body: 'Selamat pagi Bapak/Ibu Guru! Jangan lupa melakukan presensi masuk sebelum jam pembelajaran dimulai.',
      tag: `checkin_morning_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  }

  // 3. 🔔 PENGINGAT PRESENSI PULANG (Hari Kerja, Siang)
  const isCheckoutSlot = reqType === 'checkout' || (curH >= 11 && curH <= 14);
  if (!isWeekend && isCheckoutSlot && reqType !== 'morning') {
    const isFriday = dayName === 'Fri';
    const departureTime = isFriday ? '11.00 WIB' : '13.00 WIB';
    alertsToSend.push({
      title: '🔔 Waktu Pulang Sekolah Tiba!',
      body: `Bapak/Ibu Guru, jam kepulangan resmi (${departureTime}) telah tiba. Jangan lupa scan QR / Absen Pulang sebelum meninggalkan area sekolah.`,
      tag: `checkout_afternoon_${todayDateStr}`,
      url: '/?tab=BERANDA',
    });
  }

  // 4. 📢 AGENDA SEKOLAH HARI INI
  try {
    const { data: events } = await supabase
      .from('school_events')
      .select('*')
      .eq('event_date', todayDateStr);

    if (events && events.length > 0) {
      for (const ev of events) {
        alertsToSend.push({
          title: `📢 Agenda Hari Ini: ${ev.title}`,
          body: `${ev.title}${ev.description ? ' - ' + ev.description : ''}. Tetap masuk & presensi.`,
          tag: `agenda_${todayDateStr}_${ev.id || 'ev'}`,
          url: '/?tab=BERANDA',
        });
      }
    }
  } catch (err: any) {
    console.warn('[CronPush] Warning fetching school events:', err.message);
  }

  if (alertsToSend.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'Tidak ada jadwal notifikasi yang perlu dikirimkan saat ini.',
      time: jakartaTimeStr,
      date: todayDateStr,
    });
  }

  // Fetch all active push subscriptions
  const { data: subscriptions, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (subErr || !subscriptions || subscriptions.length === 0) {
    return res.status(200).json({
      ok: true,
      message: 'Tidak ada perangkat terdaftar di push_subscriptions.',
      alertsCount: alertsToSend.length,
    });
  }

  let totalSent = 0;
  let totalFailed = 0;
  const staleEndpoints: string[] = [];

  for (const alert of alertsToSend) {
    const payload = JSON.stringify({
      title: alert.title,
      body: alert.body,
      url: alert.url,
      action_url: alert.url,
      tag: alert.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });

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
          totalSent++;
        } catch (err: any) {
          totalFailed++;
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );
  }

  // Clean stale endpoints
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return res.status(200).json({
    ok: true,
    alertsDispatched: alertsToSend.map((a) => a.title),
    totalSent,
    totalFailed,
    cleanedStale: staleEndpoints.length,
    time: jakartaTimeStr,
    date: todayDateStr,
  });
}
