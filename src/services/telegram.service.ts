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
   * Sends a structured Attendance notification (Presensi Guru Masuk/Pulang)
   */
  public static async sendAttendanceNotification(payload: TelegramAttendancePayload): Promise<boolean> {
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

    const message = [
      `📋 <b>PRESENSI GURU TERCATAT${offlineBadge}</b>`,
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
      `🤖 <i>Smart Absensi Guru System</i>`,
    ].join('\n');

    const res = await this.sendMessage(message, 'HTML');
    return res.success;
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
        const offsetQuery = this.lastUpdateId > 0 ? `?offset=${this.lastUpdateId + 1}&timeout=20` : `?timeout=20`;
        const url = `https://api.telegram.org/bot${token}/getUpdates${offsetQuery}`;

        const controller = new AbortController();
        this.pollingAbortController = controller;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));

        if (!data.ok) {
          // If webhook is active (error 409), stop client polling gracefully
          if (data.error_code === 409) {
            logger.info('TelegramService', 'Telegram Webhook aktif, polling browser dihentikan.');
            this.isPollingActive = false;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 6000));
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
          await this.handleIncomingUpdate(update);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') break;
        await new Promise((resolve) => setTimeout(resolve, 6000));
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
        `Bot ini kini dilengkapi dengan <b>Groq AI Engine</b> yang memahami seluruh alur sistem, kode error, dan aturan presensi sekolah.`,
        ``,
        `📌 <b>Info Koneksi Anda:</b>`,
        `• <b>Chat ID Anda:</b> <code>${chatId}</code>`,
        `• <b>Status:</b> 🟢 Online & Siaga`,
        ``,
        `💡 <b>Hal yang Bisa Anda Tanyakan Langsung:</b>`,
        `• <i>"Kenapa guru gagal scan QR atau muncul error GPS_002?"</i>`,
        `• <i>"Jadwal piket guru tidak tersimpan, apa solusinya?"</i>`,
        `• <i>"Kapan batas jam masuk dan jam pulang hari ini?"</i>`,
        `• <i>"Bagaimana cara verifikasi biometrik fingerprint?"</i>`,
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
