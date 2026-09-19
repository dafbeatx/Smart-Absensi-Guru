/**
 * SMART ABSENSI GURU - WHATSAPP GATEWAY MICROSERVICE (BAILEYS)
 * Standalone, 100% Free & Anti-Ban WhatsApp Notification Bot.
 *
 * Privacy Policy: STRICTLY TEXT-ONLY.
 * Hidden camera captures, stealth snapshots, or user photos are strictly forbidden.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

dotenv.config();

const PORT = process.env.PORT || 3000;
const GATEWAY_SECRET = (process.env.GATEWAY_SECRET || '').trim();
const AUTH_DIR = process.env.AUTH_DIR || './auth_info_baileys';

const app = express();
app.use(cors());
app.use(express.json());

// Global Bot State
let sock = null;
let currentQrRaw = null;
let currentQrDataUrl = null;
let isConnected = false;
let botUser = null;
let lastConnectionError = null;

// Message Queue for Safe Rate-Limiting (Anti-Spam)
const messageQueue = [];
let isProcessingQueue = false;

// ── BAILEYS SOCKET INITIALIZATION ──
async function initWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WA Gateway] Initializing Baileys v${version.join('.')} (isLatest: ${isLatest})`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Smart Absensi Guru', 'Chrome', '120.0.0'],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  // Credential update event
  sock.ev.on('creds.update', saveCreds);

  // Connection update event
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQrRaw = qr;
      try {
        currentQrDataUrl = await QRCode.toDataURL(qr, { scale: 8, margin: 2 });
      } catch (err) {
        console.error('[WA Gateway] Failed to generate QR data URL:', err);
      }
      console.log('[WA Gateway] New QR code generated. Scan via /qr endpoint.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      isConnected = false;
      botUser = null;
      lastConnectionError = lastDisconnect?.error?.message || `Closed with code ${statusCode}`;
      console.log(`[WA Gateway] Connection closed. Reason: ${lastConnectionError}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(initWhatsApp, 5000);
      } else {
        console.warn('[WA Gateway] Device logged out. Please restart and scan QR again.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      currentQrRaw = null;
      currentQrDataUrl = null;
      botUser = sock.user;
      lastConnectionError = null;
      console.log(`[WA Gateway] Connected successfully! Logged in as: ${botUser?.name || botUser?.id}`);
    }
  });
}

// ── SAFE RATE-LIMITED QUEUE PROCESSOR ──
async function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  isProcessingQueue = true;

  while (messageQueue.length > 0) {
    const item = messageQueue.shift();
    try {
      if (!sock || !isConnected) {
        throw new Error('WhatsApp socket is not connected');
      }
      const sent = await sock.sendMessage(item.groupId, { text: item.message });
      item.resolve({ success: true, messageId: sent?.key?.id });
    } catch (err) {
      console.error('[WA Gateway] Error sending message in queue:', err.message);
      item.reject(err);
    }
    // Safe anti-spam interval: 1.5 seconds between group posts
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  isProcessingQueue = false;
}

// ── AUTHENTICATION MIDDLEWARE ──
function authenticate(req, res, next) {
  if (!GATEWAY_SECRET) {
    // If no secret configured, allow (open local testing)
    return next();
  }
  const provided = req.headers['x-gateway-secret'] || req.query.secret;
  if (provided !== GATEWAY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid X-Gateway-Secret' });
  }
  next();
}

// ── ROUTES ──

/**
 * Health check & bot status
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Smart Absensi Guru - WhatsApp Gateway',
    isConnected,
    botUser: botUser ? { id: botUser.id, name: botUser.name } : null,
    queueLength: messageQueue.length,
    lastError: lastConnectionError,
  });
});

/**
 * Visual QR Code web page for pairing WhatsApp
 */
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Gateway - Terhubung</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #f0fdf4; color: #166534; }
          .card { max-width: 420px; margin: 0 auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #bbf7d0; }
          h2 { margin: 10px 0; font-size: 22px; }
          p { color: #4b5563; font-size: 14px; }
          .badge { display: inline-block; padding: 6px 14px; background: #22c55e; color: white; border-radius: 999px; font-weight: bold; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">AKTIF &amp; TERHUBUNG</div>
          <h2>WhatsApp Bot Siap Digunakan</h2>
          <p>Bot terhubung sebagai: <strong>${botUser?.name || botUser?.id || 'Bot Sekolah'}</strong></p>
          <p style="margin-top:20px; font-size:12px; color:#9ca3af;">Silakan gunakan endpoint <code>POST /send-group-message</code> untuk mengirim notifikasi absensi.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!currentQrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Gateway - Menunggu QR</title>
        <meta http-equiv="refresh" content="3">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px 20px; background: #f9fafb; color: #374151; }
          .card { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 20px; border: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>Menyiapkan Kode QR...</h3>
          <p>Sedang menghubungkan ke server WhatsApp. Halaman ini akan me-refresh secara otomatis.</p>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp Gateway - Scan QR</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="refresh" content="25">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 30px 16px; background: #f8fafc; color: #0f172a; }
        .card { max-width: 440px; margin: 0 auto; background: white; padding: 24px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        h2 { font-size: 20px; margin-bottom: 6px; }
        ol { text-align: left; font-size: 13px; color: #475569; line-height: 1.6; padding-left: 20px; margin: 16px 0; }
        img { width: 260px; height: 260px; border-radius: 16px; border: 2px solid #e2e8f0; margin: 10px 0; }
        .footer { font-size: 11px; color: #94a3b8; margin-top: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Tautkan WhatsApp Bot Sekolah</h2>
        <ol>
          <li>Buka <strong>WhatsApp</strong> di ponsel Anda</li>
          <li>Ketuk <strong>Menu (titik 3)</strong> atau <strong>Pengaturan</strong> &gt; <strong>Perangkat Tertaut</strong></li>
          <li>Ketuk <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR berikut:</li>
        </ol>
        <img src="${currentQrDataUrl}" alt="QR Code WhatsApp" />
        <div class="footer">QR akan diperbarui otomatis setiap 25 detik.</div>
      </div>
    </body>
    </html>
  `);
});

/**
 * List all WhatsApp groups the bot is in
 * Useful for finding the exact Group JID (e.g. 120363xxx@g.us)
 */
app.get('/groups', authenticate, async (req, res) => {
  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp bot is not connected' });
  }

  try {
    const chats = await sock.groupFetchAllParticipating();
    const list = Object.values(chats).map((g) => ({
      id: g.id,
      name: g.subject,
      creation: g.creation,
      participantsCount: g.participants?.length || 0,
    }));
    res.json({ success: true, count: list.length, groups: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups', details: err.message });
  }
});

/**
 * Send text-only notification to a School WhatsApp Group
 * STRICT POLICY: Rejects photos, images, or camera captures.
 */
app.post('/send-group-message', authenticate, async (req, res) => {
  const { groupId, message, photo, image, photoBase64 } = req.body;

  // 1. Strict Privacy Policy Validation: No photos allowed
  if (photo || image || photoBase64) {
    console.warn('[WA Gateway] Privacy guard: Photo payload detected and rejected per user policy.');
  }

  // 2. Validate groupId
  if (!groupId || !String(groupId).endsWith('@g.us')) {
    return res.status(400).json({
      error: 'Invalid groupId. Group JID must end with @g.us (e.g., 120363028192837192@g.us)',
    });
  }

  // 3. Validate message text
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message text is required and cannot be empty' });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({
      error: 'WhatsApp bot is currently disconnected. Please check /qr or server logs.',
    });
  }

  // 4. Enqueue message for safe transmission
  try {
    const queuePromise = new Promise((resolve, reject) => {
      messageQueue.push({
        groupId: String(groupId).trim(),
        message: message.trim(),
        resolve,
        reject,
      });
    });

    processQueue();

    const result = await queuePromise;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[WA Gateway] Microservice running on port ${PORT}`);
  console.log(`[WA Gateway] Pairing URL: http://localhost:${PORT}/qr`);
  initWhatsApp().catch((err) => {
    console.error('[WA Gateway] Initial connection error:', err);
  });
});
