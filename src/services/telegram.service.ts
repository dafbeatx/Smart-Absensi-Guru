import { logger } from '../utils/logger.utils';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../utils/time.utils';
import { GroqAIService } from './groq-ai.service';
import { APP_CONFIG } from '../config/app.config';

export interface TelegramAttendancePayload {
  teacherName: string;
  nip?: string;
  role?: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | string;
  timeStr?: string;
  dateStr?: string;
  method?: string;
  distanceMeters?: number;
  status?: string;
  isOffline?: boolean;
  photoBlob?: Blob | null;
  photoPromise?: Promise<Blob | null>;
}

export interface TelegramAttendanceFailurePayload {
  teacherName: string;
  nip?: string;
  role?: string;
  attemptType?: 'CHECK_IN' | 'CHECK_OUT' | string;
  type?: 'CHECK_IN' | 'CHECK_OUT' | string;
  timeStr?: string;
  dateStr?: string;
  method?: string;
  distanceMeters?: number;
  errorMessage?: string;
  reason?: string;
  errorCode?: string;
}

export interface TelegramWebLoginPayload {
  teacherName: string;
  nip?: string;
  role?: string;
  device?: string;
  timeStr?: string;
  dateStr?: string;
}

export interface TelegramAuditPayload {
  actorId: string;
  actorRole: string;
  actionType: string;
  targetEntity: string;
  reason?: string;
  details?: string;
}

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramService {
  /**
   * Retrieves the Telegram Bot Token from environment
   */
  public static getBotToken(): string {
    const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env as Record<string, string | undefined>) : undefined;
    const procEnv = typeof process !== 'undefined' && process.env ? process.env : undefined;

    return (
      metaEnv?.VITE_TELEGRAM_BOT_TOKEN ||
      metaEnv?.TELEGRAM_BOT_TOKEN ||
      procEnv?.VITE_TELEGRAM_BOT_TOKEN ||
      procEnv?.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim();
  }

  /**
   * Retrieves the Telegram Target Chat ID from environment (supports VITE_TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID)
   */
  public static getChatId(): string {
    const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env as Record<string, string | undefined>) : undefined;
    const procEnv = typeof process !== 'undefined' && process.env ? process.env : undefined;

    return (
      metaEnv?.VITE_TELEGRAM_CHAT_ID ||
      metaEnv?.TELEGRAM_CHAT_ID ||
      procEnv?.VITE_TELEGRAM_CHAT_ID ||
      procEnv?.TELEGRAM_CHAT_ID ||
      ''
    ).trim();
  }

  /**
   * Checks whether the Telegram credentials are configured
   */
  public static isConfigured(): boolean {
    const token = this.getBotToken();
    const chatId = this.getChatId();
    return Boolean(token && chatId);
  }

  /**
   * Sends raw message to Telegram chat via Telegram Bot API
   */
  public static async sendMessage(
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    targetChatId?: string | number
  ): Promise<{ success: boolean; error?: string }> {
    const token = this.getBotToken();
    const chatId = targetChatId ? String(targetChatId).trim() : this.getChatId();

    if (!token || !chatId) {
      logger.info('TelegramService', 'Telegram Bot Token / Chat ID belum diisi di .env. Notifikasi Telegram dilewati.');
      return { success: false, error: 'NOT_CONFIGURED' };
    }

    // Telegram 4096 character limit safeguard: chunk message safely
    const MAX_LEN = 3900;
    if (text.length > MAX_LEN) {
      const chunks: string[] = [];
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

      let allOk = true;
      for (const chunk of chunks) {
        const res = await this.sendSingleMessage(token, chatId, chunk, parseMode);
        if (!res.success) allOk = false;
      }
      return { success: allOk };
    }

    return this.sendSingleMessage(token, chatId, text, parseMode);
  }

  private static async sendSingleMessage(
    token: string,
    chatId: string,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
  ): Promise<{ success: boolean; error?: string }> {
    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.ok) {
        // Fallback: If Telegram failed to parse Markdown/HTML formatting, retry as plain text
        if (parseMode) {
          try {
            const retryResponse = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true,
              }),
            });
            const retryData = await retryResponse.json().catch(() => ({}));
            if (retryResponse.ok && retryData.ok) {
              logger.info('TelegramService', 'Pesan Telegram berhasil terkirim (fallback plain text) ke chat ID:', chatId);
              return { success: true };
            }
          } catch {
            // ignore retry fetch error
          }
        }

        const errorMsg = resData.description || `HTTP ${response.status}`;
        logger.warn('TelegramService', `Gagal mengirim pesan Telegram: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      logger.info('TelegramService', 'Pesan Telegram berhasil terkirim ke chat ID:', chatId);
      return { success: true };
    } catch (err: any) {
      logger.warn('TelegramService', 'Kendala koneksi saat menghubungi Telegram Bot API:', err?.message || err);
      return { success: false, error: err?.message || 'NETWORK_ERROR' };
    }
  }

  /**
   * Sends photo directly to Telegram chat via Telegram Bot API (bypassing serverless functions to ensure zero weight on Vercel)
   */
  public static async sendPhoto(
    photoBlob: Blob,
    caption: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
    targetChatId?: string | number
  ): Promise<{ success: boolean; error?: string }> {
    const token = this.getBotToken();
    const chatId = targetChatId ? String(targetChatId).trim() : this.getChatId();

    if (!token || !chatId) {
      logger.info('TelegramService', 'Telegram credentials not configured');
      return { success: false, error: 'NOT_CONFIGURED' };
    }

    if (!photoBlob || photoBlob.size < 500) {
      logger.warn('TelegramService', 'Invalid or empty photoBlob provided to sendPhoto, fallback to text');
      return this.sendMessage(caption, parseMode, chatId);
    }

    // Telegram Bot API caption hard limit is 1024 characters
    const safeCaption = caption.length > 1020 ? caption.slice(0, 1017) + '...' : caption;

    const endpoint = `https://api.telegram.org/bot${token}/sendPhoto`;

    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', photoBlob, 'attendance_capture.jpg');
      formData.append('caption', safeCaption);
      formData.append('parse_mode', parseMode);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.ok) {
        const errorMsg = resData.description || `HTTP ${response.status}`;

        // If entity parsing failed, retry sendPhoto once with stripped plain text caption
        if (parseMode && errorMsg.toLowerCase().includes('parse')) {
          logger.warn('TelegramService', 'Telegram photo caption parse failed, retrying plain text caption...');
          const retryFormData = new FormData();
          retryFormData.append('chat_id', chatId);
          retryFormData.append('photo', photoBlob, 'attendance_capture.jpg');
          retryFormData.append('caption', safeCaption.replace(/<[^>]*>/g, ''));
          const retryRes = await fetch(endpoint, { method: 'POST', body: retryFormData });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok && retryData.ok) {
            logger.info('TelegramService', 'Auto-capture photo presensi berhasil terkirim ke Telegram (retry plain text)');
            return { success: true };
          }
        }

        logger.warn('TelegramService', `Gagal mengirim photo ke Telegram (${errorMsg}), fallback ke pesan teks...`);
        return this.sendMessage(safeCaption, parseMode, chatId);
      }

      logger.info('TelegramService', 'Auto-capture photo presensi berhasil terkirim ke Telegram');
      return { success: true };
    } catch (err: any) {
      logger.warn('TelegramService', 'Error sending photo to Telegram, fallback text:', err?.message || err);
      return this.sendMessage(caption, parseMode, chatId);
    }
  }

  /**
   * Sends a structured Attendance notification (Presensi Guru Masuk/Pulang)
   */
  public static async sendAttendanceNotification(payload: TelegramAttendancePayload): Promise<boolean> {
    let resolvedPhotoBlob = payload.photoBlob;

    // Asynchronously await photoPromise in background (up to 3500ms) without blocking user UI
    if (!resolvedPhotoBlob && payload.photoPromise) {
      try {
        resolvedPhotoBlob = await Promise.race([
          payload.photoPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 3500)),
        ]);
      } catch (e) {
        logger.warn('TelegramService', 'Error resolving photoPromise in background:', e);
        resolvedPhotoBlob = null;
      }
    }

    const timeStr = payload.timeStr || getCurrentTimeInJakarta();
    const dateStr = payload.dateStr || getTodayDateInJakarta();
    const isCheckIn = payload.type === 'CHECK_IN';
    const typeLabel = isCheckIn ? '🟢 MASUK (Check-In)' : '🔴 PULANG (Check-Out)';

    let methodLabel = '📷 Scan QR Code';
    if (payload.method === 'BIOMETRIC_GPS' || payload.method === 'BIOMETRIC') {
      methodLabel = '👆 Biometrik Sidik Jari (GPS)';
    } else if (payload.method === 'RFID') {
      methodLabel = '💳 Kartu RFID';
    } else if (payload.method === 'MANUAL_CORRECTION') {
      methodLabel = '📝 Koreksi Manual Admin';
    }

    let locationLabel = '📍 Lokasi Terverifikasi';
    if (payload.distanceMeters !== undefined && payload.distanceMeters !== null) {
      locationLabel = `📍 Radius ${Math.round(payload.distanceMeters)}m dari sekolah`;
    }

    const statusBadge = payload.status === 'TERLAMBAT'
      ? '⚠️ TERLAMBAT'
      : (payload.status || '✅ TEPAT WAKTU');

    const offlineBadge = payload.isOffline ? ' [MODE OFFLINE]' : '';

    const hasPhoto = Boolean(resolvedPhotoBlob && resolvedPhotoBlob.size > 500);
    const photoBadge = hasPhoto ? ' 📷 [FOTO TERVERIFIKASI]' : '';
    const headerTitle = hasPhoto ? 'FOTO AUTO-CAPTURE PRESENSI GURU' : 'PRESENSI GURU TERCATAT';

    const message = [
      `📋 <b>${headerTitle}${offlineBadge}${photoBadge}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Nama:</b> ${escapeHtml(payload.teacherName)}`,
      `🆔 <b>NPP/NIP:</b> ${escapeHtml(payload.nip || '-')}`,
      `🏷️ <b>Role:</b> ${escapeHtml(payload.role || 'GURU')}`,
      `📌 <b>Tipe:</b> ${typeLabel}`,
      `⏰ <b>Waktu:</b> ${escapeHtml(timeStr)} WIB (${escapeHtml(dateStr)})`,
      `📱 <b>Metode:</b> ${escapeHtml(methodLabel)}`,
      `🧭 <b>Posisi:</b> ${escapeHtml(locationLabel)}`,
      `📊 <b>Status:</b> ${escapeHtml(statusBadge)}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🤖 <i>Smart Absensi Guru - Silent Audit Camera</i>`,
    ].join('\n');

    if (hasPhoto && resolvedPhotoBlob) {
      const photoRes = await this.sendPhoto(resolvedPhotoBlob, message, 'HTML');
      if (photoRes.success) return true;
    }

    const res = await this.sendMessage(message, 'HTML');
    return res.success;
  }

  /**
   * Sends an alert notification to Telegram when an attendance attempt fails / is rejected
   */
  public static async sendAttendanceFailureNotification(payload: TelegramAttendanceFailurePayload): Promise<boolean> {
    const timeStr = payload.timeStr || getCurrentTimeInJakarta();
    const dateStr = payload.dateStr || getTodayDateInJakarta();
    const effAttempt = payload.attemptType || payload.type || 'CHECK_IN';
    const isCheckIn = effAttempt === 'CHECK_IN';
    const typeLabel = isCheckIn ? '🟡 MASUK (Check-In Gagal)' : '🔴 PULANG (Check-Out Gagal)';

    let methodLabel = '📷 Scan QR Code';
    if (payload.method === 'BIOMETRIC_GPS' || payload.method === 'BIOMETRIC') {
      methodLabel = '👆 Biometrik Sidik Jari';
    } else if (payload.method === 'RFID') {
      methodLabel = '💳 Kartu RFID';
    }

    let locationLabel = '📍 Lokasi Tidak Terdeteksi';
    if (payload.distanceMeters !== undefined && payload.distanceMeters !== null) {
      locationLabel = `📍 Radius ${Math.round(payload.distanceMeters)}m dari gerbang`;
    }

    const failureReason = payload.errorMessage || payload.reason || 'Kendala koneksi atau validasi sistem';

    const message = [
      `⚠️ <b>PERINGATAN KENDALA PRESENSI GURU</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Nama:</b> ${escapeHtml(payload.teacherName)}`,
      `🆔 <b>NPP/NIP:</b> ${escapeHtml(payload.nip || '-')}`,
      `🏷️ <b>Role:</b> ${escapeHtml(payload.role || 'GURU')}`,
      `📌 <b>Percobaan:</b> ${typeLabel}`,
      `⏰ <b>Waktu:</b> ${escapeHtml(timeStr)} WIB (${escapeHtml(dateStr)})`,
      `📱 <b>Metode:</b> ${escapeHtml(methodLabel)}`,
      `🧭 <b>Posisi:</b> ${escapeHtml(locationLabel)}`,
      `❌ <b>Keterangan Masalah:</b>`,
      `<code>${escapeHtml(failureReason)}</code>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>Sistem mencatat laporan kendala ini secara otomatis untuk investigasi admin.</i>`,
    ].join('\n');

    try {
      const res = await this.sendMessage(message, 'HTML');
      return res.success;
    } catch (err) {
      logger.warn('TelegramService', 'Failed sending attendance failure notification:', err);
      return false;
    }
  }

  /**
   * Sends a notification when a teacher enters or logs into the web application
   */
  public static async sendWebLoginNotification(payload: TelegramWebLoginPayload): Promise<boolean> {
    const timeStr = payload.timeStr || getCurrentTimeInJakarta();
    const dateStr = payload.dateStr || getTodayDateInJakarta();

    const message = [
      `🌐 <b>GURU MASUK KE WEB (LOGIN)</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Nama:</b> ${escapeHtml(payload.teacherName)}`,
      `🆔 <b>NPP/NIP:</b> ${escapeHtml(payload.nip || '-')}`,
      `🏷️ <b>Role:</b> ${escapeHtml(payload.role || 'GURU')}`,
      `⏰ <b>Waktu Akses:</b> ${escapeHtml(timeStr)} WIB (${escapeHtml(dateStr)})`,
      `📱 <b>Perangkat:</b> ${escapeHtml(payload.device || 'Web Browser')}`,
      `ℹ️ <b>Aktivitas:</b> Membuka Dashboard Web Presensi`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🤖 <i>Smart Absensi Guru System</i>`,
    ].join('\n');

    const res = await this.sendMessage(message, 'HTML');
    return res.success;
  }

  /**
   * Sends an Audit Log entry directly to Telegram
   */
  public static async sendAuditLog(payload: TelegramAuditPayload): Promise<boolean> {
    const timeStr = getCurrentTimeInJakarta();
    const dateStr = getTodayDateInJakarta();

    const message = [
      `🛡️ <b>AUDIT LOG SISTEM</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `⚡ <b>Aksi:</b> <code>${escapeHtml(payload.actionType)}</code>`,
      `👤 <b>Aktor:</b> ${escapeHtml(payload.actorId)} (${escapeHtml(payload.actorRole)})`,
      `🎯 <b>Target:</b> ${escapeHtml(payload.targetEntity)}`,
      `📝 <b>Keterangan:</b> ${escapeHtml(payload.reason || '-')}`,
      ...(payload.details ? [`📄 <b>Detail:</b> <pre>${escapeHtml(payload.details)}</pre>`] : []),
      `⏰ <b>Waktu:</b> ${escapeHtml(timeStr)} WIB (${escapeHtml(dateStr)})`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🤖 <i>Smart Absensi Guru System</i>`,
    ].join('\n');

    const res = await this.sendMessage(message, 'HTML');
    return res.success;
  }

  /**
   * Sends a test ping to verify Telegram Bot configuration
   */
  public static async sendTestMessage(): Promise<{ success: boolean; error?: string }> {
    const timeStr = getCurrentTimeInJakarta();
    const dateStr = getTodayDateInJakarta();

    const testMessage = [
      `🤖 <b>UJI COBA KONEKSI TELEGRAM BOT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ Bot Token & Chat ID terhubung dengan sukses!`,
      `⏰ <b>Waktu:</b> ${escapeHtml(timeStr)} WIB (${escapeHtml(dateStr)})`,
      `🏫 <b>Instansi:</b> SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>Sistem Smart Absensi Guru siap mengirimkan log presensi dan audit ke saluran ini.</i>`,
    ].join('\n');

    return this.sendMessage(testMessage, 'HTML');
  }

  // =========================================================================
  // BACKGROUND POLLING & GROQ AI INTERACTIVE ENGINE
  // =========================================================================

  private static isPollingActive = false;
  private static lastUpdateId = 0;
  private static pollingAbortController: AbortController | null = null;

  /**
   * Initializes background silent polling when client web app is open
   */
  public static init(): void {
    if (typeof window === 'undefined') return;
    this.startPolling();
  }

  /**
   * Starts background long-polling for incoming updates (/start, admin queries)
   */
  public static startPolling(): void {
    const token = this.getBotToken();
    if (!token || this.isPollingActive) return;

    // If webhook is already verified active on cloud backend, skip browser polling
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('smart_absensi_tele_webhook_active') === 'true') {
        return;
      }
    } catch {
      // ignore storage errors
    }

    this.isPollingActive = true;
    this.pollLoop().catch((err) => {
      logger.warn('TelegramService', 'Background polling loop encountered an error:', err);
    });
  }

  /**
   * Stops background polling cleanly
   */
  public static stopPolling(): void {
    this.isPollingActive = false;
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
  }

  /**
   * Main background polling loop
   */
  private static async pollLoop(): Promise<void> {
    const token = this.getBotToken();
    if (!token) {
      this.isPollingActive = false;
      return;
    }

    try {
      const savedOffset = localStorage.getItem('smart_absensi_tele_offset');
      if (savedOffset) {
        this.lastUpdateId = parseInt(savedOffset, 10) || 0;
      }
    } catch {
      // ignore storage errors
    }

    while (this.isPollingActive) {
      try {
        // Short polling timeout (3s) for fast /start responsiveness
        const offsetQuery = this.lastUpdateId > 0 ? `?offset=${this.lastUpdateId + 1}&timeout=3` : `?timeout=3`;
        const url = `https://api.telegram.org/bot${token}/getUpdates${offsetQuery}`;

        const controller = new AbortController();
        this.pollingAbortController = controller;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));

        if (!data.ok || res.status === 409) {
          // If webhook is active (error 409 Conflict), the cloud serverless backend (api/telegram.ts) handles all Telegram updates.
          // Browser polling cannot run concurrently with an active webhook.
          if (data.error_code === 409 || res.status === 409) {
            logger.info('TelegramService', 'Telegram Webhook aktif di cloud backend. Polling client browser dinonaktifkan.');
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('smart_absensi_tele_webhook_active', 'true');
              }
            } catch {
              // ignore storage errors
            }
            this.isPollingActive = false;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const updates = data.result || [];
        for (const update of updates) {
          if (update.update_id) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            try {
              localStorage.setItem('smart_absensi_tele_offset', String(this.lastUpdateId));
            } catch {
              // ignore
            }
          }
          // Fire-and-forget: don't block the polling loop while waiting for Groq AI
          this.handleIncomingUpdate(update).catch((e) =>
            logger.warn('TelegramService', 'Error handling Telegram update:', e)
          );
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  /**
   * Handles incoming update from Telegram (/start, questions, error queries)
   */
  public static async handleIncomingUpdate(update: any): Promise<void> {
    const message = update?.message;
    if (!message || !message.text) return;

    const chatId = message.chat?.id;
    const text = message.text.trim();
    const senderName = message.from?.first_name || 'Admin';

    if (!chatId) return;

    // Command: /start
    if (text === '/start' || text.startsWith('/start ')) {
      const welcomeMsg = [
        `🤖 <b>Smart Absensi AI Assistant</b>`,
        `<i>SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</i>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Halo <b>${escapeHtml(senderName)}</b>! 👋`,
        `Saya siap membantu menjawab pertanyaan teknis, info jadwal jam pulang/masuk, solusi gagal scan QR, maupun kendala absensi lainnya.`,
        ``,
        `📌 <b>Info Koneksi:</b>`,
        `• <b>Chat ID:</b> <code>${chatId}</code>`,
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

      await this.sendMessage(welcomeMsg, 'HTML', chatId);
      return;
    }

    // Command: /status or /info
    if (text === '/status' || text === '/info') {
      const statusMsg = [
        `📊 <b>STATUS SISTEM SMART ABSENSI GURU</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `• <b>Backend:</b> Supabase PostgreSQL Cloud`,
        `• <b>AI Diagnostic:</b> Groq Engine (${APP_CONFIG.GROQ_MODEL || 'qwen/qwen3.8-27b'})`,
        `• <b>Door Poster QR:</b> Buffer 500 meter`,
        `• <b>Metode Presensi:</b> QR Code, Biometrik, RFID`,
        `• <b>Jam Pulang:</b> 13:00 (Senin-Kamis), 11:00 (Jumat)`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `✅ Sistem siap memantau presensi dan melayani konsultasi teknis.`,
      ].join('\n');

      await this.sendMessage(statusMsg, 'HTML', chatId);
      return;
    }

    // Interactive Technical Query via Groq AI Engine
    try {
      const token = this.getBotToken();
      if (token) {
        fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
        }).catch(() => {});
      }

      const aiReply = await GroqAIService.answerTelegramAdminQuery(text, senderName);
      await this.sendMessage(aiReply, 'Markdown', chatId);
    } catch (err) {
      logger.error('TelegramService', 'Gagal memproses AI query Telegram:', err);
      await this.sendMessage(
        'Maaf, terjadi kendala saat memproses jawaban AI. Silakan coba kembali sesaat lagi.',
        'Markdown',
        chatId
      );
    }
  }
}
