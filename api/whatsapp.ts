// Vercel Serverless Function for WhatsApp Group Attendance Notification
// Zero-Trust Outbound Proxy: Protects WA_GATEWAY_URL and WA_GATEWAY_SECRET from browser exposure.
// Privacy Policy: STRICTLY TEXT-ONLY. No hidden camera captures, selfie photos, or media blobs.

export interface WhatsAppAttendancePayload {
  teacherName: string;
  npp?: string;
  role?: string;
  type?: 'CHECK_IN' | 'CHECK_OUT' | string;
  timeStr?: string;
  dateStr?: string;
  method?: string;
  distanceMeters?: number | string;
  status?: string;
  isOffline?: boolean;
}

/**
 * Format attendance record into a clean, aesthetic WhatsApp text notification.
 * Note: Never include any photo or image URLs.
 */
export function formatWhatsAppAttendanceMessage(payload: WhatsAppAttendancePayload): string {
  const isMasuk = payload.type === 'CHECK_IN' || String(payload.status).toUpperCase().includes('MASUK');
  const actionTitle = isMasuk ? 'PRESENSI MASUK' : 'PRESENSI PULANG';
  const actionEmoji = isMasuk ? '🟢' : '🔵';

  const dateDisplay = payload.dateStr || new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeDisplay = payload.timeStr || new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' WIB';

  const nppDisplay = payload.npp && payload.npp.trim() !== '' ? payload.npp.trim() : '-';
  const roleDisplay = payload.role === 'ADMIN' ? 'Administrator' : payload.role === 'KEPSEK' ? 'Kepala Sekolah' : 'Guru / Pendidik';

  let distanceDisplay = '-';
  if (payload.distanceMeters !== undefined && payload.distanceMeters !== null) {
    const num = Number(payload.distanceMeters);
    distanceDisplay = !isNaN(num) ? `Radius ~${Math.round(num)} meter` : String(payload.distanceMeters);
  }

  const methodDisplay = payload.method === 'FACE' ? 'Verifikasi Wajah (Biometrik)'
    : payload.method === 'QR_CODE' ? 'Scan Barcode / QR Poster'
    : payload.method === 'GEOFENCE' ? 'Geolokasi Radar GPS'
    : payload.method || 'Presensi Mandiri';

  const modeDisplay = payload.isOffline ? ' (Mode Sinkronisasi Offline)' : '';

  return [
    `🔔 *NOTIFIKASI PRESENSI SEKOLAH*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `${actionEmoji} *Aktivitas:* ${actionTitle}${modeDisplay}`,
    `👤 *Nama:* ${payload.teacherName || 'Guru'}`,
    `🆔 *NPP:* ${nppDisplay}`,
    `💼 *Jabatan:* ${roleDisplay}`,
    `📅 *Hari/Tgl:* ${dateDisplay}`,
    `⏰ *Pukul:* ${timeDisplay}`,
    `📌 *Status:* ${payload.status || 'HADIR TEPAT WAKTU'}`,
    `📍 *Lokasi:* ${distanceDisplay}`,
    `🔍 *Metode:* ${methodDisplay}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `_Smart Absensi Guru • Terverifikasi Sistem_`,
  ].join('\n');
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Smart Absensi Guru - WhatsApp Notification Proxy',
      privacyPolicy: 'STRICTLY_TEXT_ONLY_NO_PHOTOS',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gatewayUrl = (process.env.WA_GATEWAY_URL || '').replace(/\/+$/, '').trim();
  const gatewaySecret = (process.env.WA_GATEWAY_SECRET || '').trim();
  const targetGroupJid = (process.env.WA_GROUP_JID || '').trim();

  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  // 1. Strict Privacy Guard: Strip any photo/image fields immediately
  if (body.photo || body.photoBlob || body.photoPromise || body.photoBase64 || body.image) {
    delete body.photo;
    delete body.photoBlob;
    delete body.photoPromise;
    delete body.photoBase64;
    delete body.image;
  }

  const action = body.action || 'send_attendance_notification';
  const groupId = (body.groupId || targetGroupJid).trim();

  // If gateway is not configured, reply with ignored gracefully (fail-safe for local dev/testing)
  if (!gatewayUrl || !groupId) {
    return res.status(200).json({
      success: true,
      status: 'ignored',
      reason: 'WA_GATEWAY_URL or WA_GROUP_JID not configured in environment',
      privacyCompliant: true,
    });
  }

  // Format message text
  let messageText = '';
  if (action === 'send_attendance_notification') {
    messageText = formatWhatsAppAttendanceMessage(body.attendance || body);
  } else if (action === 'send_raw_message' || action === 'test_connection') {
    messageText = body.text || '🔔 *Tes Koneksi WhatsApp Gateway Smart-Absensi-Guru* (Berhasil Terhubung)';
  } else {
    messageText = body.message || body.text || '';
  }

  if (!messageText.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty' });
  }

  // Forward to Baileys Gateway via HTTP POST
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (gatewaySecret) {
      headers['X-Gateway-Secret'] = gatewaySecret;
    }

    const response = await fetch(`${gatewayUrl}/send-group-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        groupId,
        message: messageText,
        // Privacy mandate: No photo or image field sent
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || 'Gateway returned an error',
      });
    }

    return res.status(200).json({
      success: true,
      mode: 'group_message_sent',
      messageId: data.messageId || null,
    });
  } catch (err: any) {
    // Fail-safe: Return 200 with error logged so caller is never blocked
    return res.status(200).json({
      success: false,
      status: 'gateway_unreachable',
      error: err?.message || 'Failed to reach WhatsApp Gateway',
    });
  }
}
