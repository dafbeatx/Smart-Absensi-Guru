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

    const systemPrompt = `Kamu adalah asisten teknis Smart Absensi Guru (SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam).
Lawan bicaramu adalah Admin / Pengelola sekolah bernama ${senderName}.

PEDOMAN GAYA BICARA (SANGAT PENTING):
1. Jawablah seperti MANUSIA ASLI yang ramah, santai tapi profesional, seperti rekan tim IT sekolah yang sigap dan asyik diajak diskusi di Telegram.
2. JANGAN seperti robot kaku. HINDARI kalimat pembuka formal yang kaku seperti "Berdasarkan arsitektur sistem...", "Sebagai mesin teknis...", dsb.
3. LANGSUNG ke inti jawaban secara padat, ringkas, dan jelas (cukup 2-3 paragraf pendek atau poin-poin ringkas). Sangat nyaman dibaca di layar HP.
4. Gunakan bahasa Indonesia natural sehari-hari yang sopan dan hangat (pakai emoji secukupnya agar bersahabat 😊).
5. WAJIB selalu menyelesaikan jawaban sampai tuntas dan ada titik/penutup, jangan sampai terpotong di tengah kalimat.

INFORMASI PENTING SISTEM:
- Jam Kerja & Pulang: Masuk sebelum 07:00 WIB. Pulang Senin-Kamis pukul 13:00 WIB, Jumat pukul 11:00 WIB.
- Masalah Scan QR: Sering kali karena QR Code di layar admin sudah expired/berganti. Cukup refresh QR di layar admin, atau minta guru ketik kode manual di bawah barcode. Pastikan izin kamera di browser HP aktif.
- Masalah GPS / Geofence: Radius normal 100m. Khusus scan QR poster pintu gerbang sekolah ada toleransi buffer 500m sehingga guru tetap bisa absen lancar. Kalau GPS mati/ditolak, cukup aktifkan izin lokasi di HP. Fake GPS otomatis ditolak.
- Jadwal Piket: Hari piket Senin sampai Jumat. Jika ada kendala simpan jadwal di admin, periksa RLS policy tabel gm_schedule di Supabase.
- Fitur Offline: Kalau internet mati, presensi aman tersimpan di HP guru dan otomatis terkirim saat online kembali.`;

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
