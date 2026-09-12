// Vercel Serverless Function for Telegram Bot Webhook with Groq AI integration

// Fallback Groq Models in priority order
const GROQ_MODELS = ['qwen/qwen3.8-27b', 'groq/compound-mini', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

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
          temperature: 0.6,
          max_tokens: 1200,
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
  // Telegram 4096 char limit safeguard: split into chunks if overly long
  const MAX_LEN = 3900;
  const chunks: string[] = [];
  if (text.length <= MAX_LEN) {
    chunks.push(text);
  } else {
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_LEN) {
        chunks.push(remaining);
        break;
      }
      let splitIdx = remaining.lastIndexOf('\n', MAX_LEN);
      if (splitIdx === -1 || splitIdx < 1000) splitIdx = MAX_LEN;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).trimStart();
    }
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
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
            text: chunk,
            disable_web_page_preview: true,
          }),
        });
      }
    } catch (e) {
      console.error('Failed to send Telegram message:', e);
    }
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

  // 0. Secure Outbound Proxy: Send Telegram message without exposing Bot Token to browser
  if (update?.action === 'send_message' || update?.action === 'send') {
    const targetChat = update.chatId || update.chat_id || process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
    const messageText = update.text;
    if (!messageText || !targetChat) {
      return res.status(400).json({ error: 'Missing text or chatId' });
    }
    await sendTelegramMessage(token, targetChat, messageText, update.parseMode || 'HTML');
    return res.status(200).json({ success: true, mode: 'proxy_sent' });
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
      `Saya siap membantu menjawab pertanyaan teknis, info jadwal jam pulang/masuk, solusi gagal scan QR, maupun kendala absensi lainnya.`,
      ``,
      `📌 <b>Info Koneksi:</b>`,
      `• <b>Chat ID Anda:</b> <code>${chatId}</code>`,
      `• <b>Status:</b> 🟢 Online & Siap Melayani`,
      ``,
      `💡 <b>Contoh yang Bisa Ditanyakan:</b>`,
      `• <i>"Kapan jam pulang hari ini?"</i>`,
      `• <i>"Kenapa guru gagal scan QR?"</i>`,
      `• <i>"Ada guru di luar radius GPS, solusinya bagaimana?"</i>`,
      `• <i>"Jadwal piket guru tidak tersimpan, apa yang harus dicek?"</i>`,
      ``,
      `Silakan ketik pertanyaan atau kendala Anda di sini! 👇`,
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

    const systemPrompt = `Kamu adalah asisten teknis resmi Smart Absensi Guru (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Lawan bicaramu adalah Admin / Pengelola sekolah bernama ${senderName}.

GAYA BICARA & KEPRIBADIAN (WAJIB DIPATUHI):
- Jawablah seperti MANUSIA ASLI yang ramah, hangat, santai tapi profesional, seperti rekan IT sekolah yang pintar, sigap, dan sangat menguasai seluk-beluk logika sistem Smart Absensi Guru.
- JANGAN seperti robot kaku. HINDARI pembuka formal yang kaku seperti "Berdasarkan arsitektur sistem...".
- LANGSUNG ke inti jawaban secara padat, ringkas, dan jelas (cukup 2-3 paragraf pendek atau poin-poin praktis). Sangat nyaman dibaca di layar HP.
- Gunakan bahasa Indonesia natural sehari-hari yang sopan dan hangat (pakai emoji secukupnya agar bersahabat 😊).
- Pastikan jawaban selalu TUNTAS dan selesai sampai akhir kalimat.

KNOWLEDGE BASE LENGKAP SMART ABSENSI GURU (HARUS TEPAT & AKURAT):

1. ATURAN IZIN PERANGKAT & PERMISSION GUARD (SANGAT KETAT):
   - Sistem memiliki fitur "Permission Guard" (AttendancePermissionBlockedModal).
   - Sebelum guru bisa scan QR atau absen biometrik, sistem WAJIB memeriksa 3 izin perangkat:
     a. Izin Notifikasi Web & Mobile (Wajib!)
     b. Izin Lokasi GPS & Geofence (Wajib!)
     c. Izin Kamera Scanner (Wajib jika scan QR!)
   - JIKA ADA IZIN YANG TIDAK DIBERIKAN / DITOLAK (termasuk izin Notifikasi):
     ABSENSI AKAN DITOLAK / DIBLOKIR TOTAL oleh sistem!
     Layar HP guru langsung memunculkan pop-up modal "Izin Perangkat Diperlukan Sebelum Presensi" dan tombol absen tidak bisa diproses sampai menekan tombol "Izinkan" di perizinan browser.
   - Mengapa notifikasi diwajibkan? Karena sistem memerlukan push notification untuk tanda terima konfirmasi presensi masuk/pulang sukses, alarm pengingat jam pulang (13:00 / 11:00), dan pengumuman resmi sekolah.

2. METODE PRESENSI:
   - Scan QR Code Dinamis (refresh berkala di layar monitor admin).
   - Biometrik Sidik Jari (WebAuthn Platform Sensor di HP/laptop guru, tetap divalidasi dengan GPS fisik asli). Jika belum terdaftar, ada auto prompt modal pendaftaran sidik jari.
   - Tap Kartu RFID (untuk siswa & guru piket di alat pembaca fisik, tersimpan di gm_attendance).
   - Koreksi Manual oleh Admin jika ada kendala darurat.

3. SAFETY ENGINE & GEOFENCING (GPS):
   - 5-Step Deterministic State Machine: CHECKING_COOLDOWN -> VALIDATING_GPS -> CHECKING_PHOTO -> SUBMITTING -> RECORDED.
   - Radius Geofence Standar: 100 meter dari sekolah.
   - Mode Door Poster QR: Khusus poster QR di pintu gerbang sekolah, sistem memberi toleransi buffer 500 meter agar guru tidak gagal absen, dengan tetap mencatat titik koordinat GPS asli guru.
   - Fake GPS / Mock Location otomatis ditolak (Error GPS_003).
   - Auto Coordinate Sanitization: Koordinat integer (misal -6613144) otomatis disanitasi jadi -6.613144.

4. JAM KERJA & JAM PULANG:
   - Jam Masuk Standar: Sebelum pukul 07:00 WIB (lewat dari itu tercatat terlambat).
   - Jam Pulang Senin s.d. Kamis: 13:00 WIB.
   - Jam Pulang Jumat: 11:00 WIB.
   - Hari Piket: SENIN s.d. JUMAT (jadwal tersimpan di tabel gm_schedule Supabase).

5. DATABASE & SINKRONISASI:
   - Backend: Supabase PostgreSQL Cloud dengan Row Level Security (RLS).
   - NPP (Nomor Pokok Pegawai): Standar resmi penamaan ID guru/pegawai.
   - Sinkronisasi Real-time: Status notifikasi dibaca/belum dan foto profil 100% tersinkron lintas perangkat (Desktop & HP).
   - Mode Offline (IndexedDB): Jika internet sekolah mati, absen tetap tersimpan di HP dan otomatis sinkron saat online.`;

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
  const fallbackMsg = `Halo! Pesan Anda: "${text}" sudah kami terima.\n\nSistem presensi berjalan normal dengan Supabase Cloud & toleransi Door Poster 500m. Jika ada kendala spesifik seperti scan QR, GPS di luar radius, atau jam kerja, silakan tanyakan langsung ya! 😊`;
  await sendTelegramMessage(token, chatId, fallbackMsg, 'Markdown');

  return res.status(200).json({ ok: true, action: 'fallback_replied' });
}
