// Vercel Serverless Function for Telegram Bot Webhook with Groq AI integration

// Fallback Groq Models in priority order
const GROQ_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function callGroq(apiKey: string, messages: Array<{ role: string; content: string }>): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    } catch {
      // try next model
    }
  }
  return null;
}

async function sendTelegramMessage(token: string, chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    // If parsing entities failed (e.g. Markdown unescaped character), fallback to plain text
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
    }
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
  }
}

async function sendTypingAction(token: string, chatId: string | number) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch {}
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      service: 'Smart Absensi Guru - Telegram Groq AI Webhook',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const groqKey = (process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();

  if (!token) {
    return res.status(200).json({ status: 'ignored', reason: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  let update: any = req.body;
  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch {
      update = {};
    }
  }

  const message = update?.message || update?.edited_message;

  if (!message || !message.text) {
    return res.status(200).json({ status: 'ok', note: 'no text message in update' });
  }

  const chatId = message.chat?.id;
  const text = message.text.trim();
  const senderName = message.from?.first_name || 'Admin';

  if (!chatId) {
    return res.status(200).json({ status: 'ok', note: 'no chat id' });
  }

  // 1. Command: /start
  if (text === '/start' || text.startsWith('/start ')) {
    const welcomeMsg = [
      `🤖 <b>Smart Absensi AI Assistant</b>`,
      `<i>SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</i>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Halo <b>${escapeHtml(senderName)}</b>! 👋`,
      `Bot ini kini terhubung dengan <b>Groq AI Engine</b> yang memahami arsitektur sistem, aturan geofence, dan solusi troubleshooting error absensi.`,
      ``,
      `📌 <b>Info Koneksi Anda:</b>`,
      `• <b>Chat ID Anda:</b> <code>${chatId}</code>`,
      `• <b>Status:</b> 🟢 Terhubung 24/7 (Vercel Serverless)`,
      ``,
      `💡 <b>Hal yang Bisa Anda Tanyakan:</b>`,
      `• <i>"Kenapa guru gagal scan QR atau muncul error GPS_002?"</i>`,
      `• <i>"Jadwal piket guru tidak tersimpan, bagaimana solusinya?"</i>`,
      `• <i>"Kapan jam masuk dan jam pulang hari ini?"</i>`,
      `• <i>"Bagaimana aturan buffer geofence 500m di pintu sekolah?"</i>`,
      ``,
      `Silakan ketik pesan atau laporkan error di sini! 👇`,
    ].join('\n');

    await sendTelegramMessage(token, chatId, welcomeMsg, 'HTML');
    return res.status(200).json({ ok: true, action: 'start_replied' });
  }

  // 2. Command: /status
  if (text === '/status' || text === '/info') {
    const statusMsg = [
      `📊 <b>STATUS SISTEM SMART ABSENSI GURU</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `• <b>Backend:</b> Supabase PostgreSQL Cloud`,
      `• <b>AI Diagnostic:</b> Groq Engine (Qwen / GPT OSS)`,
      `• <b>Door Poster QR:</b> Buffer 500 meter`,
      `• <b>Metode:</b> QR Code, Biometrik Fingerprint, RFID`,
      `• <b>Jam Pulang:</b> 13:00 (Senin-Kamis), 11:00 (Jumat)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ Sistem siap memantau presensi dan melayani konsultasi teknis.`,
    ].join('\n');

    await sendTelegramMessage(token, chatId, statusMsg, 'HTML');
    return res.status(200).json({ ok: true, action: 'status_replied' });
  }

  // 3. Admin / Technical Query with Groq AI
  if (groqKey) {
    sendTypingAction(token, chatId);

    const systemPrompt = `Anda adalah "Smart AI Technical Diagnostic Engine" untuk Telegram Bot resmi aplikasi "Smart Absensi Guru" (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Pengguna adalah Admin / Pengelola Sistem bernama ${senderName}.

Konteks Arsitektur & Pengetahuan Sistem Lengkap:
1. INFRASTRUKTUR:
   - Backend: Supabase PostgreSQL Cloud dengan Row Level Security (RLS) ketat.
   - Provider Pattern: Akses data wajib melalui ProviderFactory.
   - Tabel Kunci: gm_attendance (log presensi guru & siswa RFID), gm_users (pengguna, role, NPP, password), gm_schedule (jadwal piket guru SENIN-JUMAT), gm_leaves (izin/cuti).
   - NPP (Nomor Pokok Pegawai): Standar wajib penamaan ID seluruh pegawai.

2. ATURAN JADWAL KERJA & JAM PULANG:
   - Jam Masuk Standar: Sebelum pukul 07:00 WIB.
   - Jam Pulang Senin s.d. Kamis: 13:00 WIB.
   - Jam Pulang Jumat: 11:00 WIB.

3. ALUR PRESENSI (5-Step State Machine):
   - CHECKING_COOLDOWN -> VALIDATING_GPS -> CHECKING_PHOTO -> SUBMITTING -> RECORDED.
   - Door Poster QR Mode: Buffer radius 500m saat scan poster pintu sekolah agar absensi langsung diterima dengan tetap mencatat GPS asli guru.
   - Auto Coordinate Sanitization: Koordinat integer (misal -6613144) otomatis disanitasi menjadi -6.613144.

4. KODE ERROR RESMI:
   - [GPS_001]: Izin lokasi GPS tidak aktif / ditolak browser. Solusi: Izinkan akses lokasi di browser HP.
   - [GPS_002]: Di luar radius geofence sekolah (>100m). Solusi: Mendekat ke sekolah atau scan QR poster pintu sekolah (buffer 500m).
   - [GPS_003]: Terdeteksi Fake GPS / Mock Location. Solusi: Matikan aplikasi Fake GPS di HP.
   - [QR_001]: QR Code kadaluarsa / Invalid Signature. Solusi: Refresh QR Code di layar admin atau input kode manual.
   - [PHOTO_001]: Kamera tidak dapat diakses / izin ditolak. Solusi: Izinkan izin kamera.
   - [OFFLINE_SYNC]: Presensi aman tersimpan di IndexedDB offline dan otomatis sinkron saat online.
   - [PIKET_NOT_SAVED]: Periksa RLS policy pada tabel gm_schedule di Supabase (izinkan INSERT/UPDATE).

PANDUAN MENJAWAB:
- Jawab secara langsung, ramah, solutif, dan teknis dalam Bahasa Indonesia.
- Gunakan format Markdown yang rapi (bold untuk istilah/error code, bullet points untuk instruksi perbaikan).`;

    const aiAnswer = await callGroq(groqKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ]);

    if (aiAnswer) {
      await sendTelegramMessage(token, chatId, aiAnswer, 'Markdown');
      return res.status(200).json({ ok: true, action: 'ai_answered' });
    }
  }

  // Fallback if Groq unavailable
  const fallbackMsg = `🤖 *Smart Absensi Assistant:*\n\nPesan Anda: "${text}".\nSistem presensi berjalan normal dengan Supabase Cloud & toleransi Door Poster 500m. Silakan tanyakan kode error spesifik seperti GPS_002, QR_001, atau kendala piket guru.`;
  await sendTelegramMessage(token, chatId, fallbackMsg, 'Markdown');

  return res.status(200).json({ ok: true, action: 'fallback_replied' });
}
