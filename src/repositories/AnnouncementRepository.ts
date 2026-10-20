/**
 * SMART ABSENSI GURU — ANNOUNCEMENT REPOSITORY
 * Centralized business engine for Admin & Kepsek broadcast notifications.
 * Enforces anti-spam rate limiting, duplicate message prevention,
 * database persistence, and encrypted Web Push delivery to teachers' phones.
 */

import { ProviderFactory } from '../providers/provider-factory';
import type {
  AppNotification,
  BroadcastResult,
  NotificationAudience,
  NotificationSeverity,
  UserProfile,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export type AnnouncementTargetType = 'GURU' | 'ADMIN' | 'KEPSEK' | 'ALL' | 'SPECIFIC_USER';

export interface PublishAnnouncementParams {
  title: string;
  message: string;
  severity?: NotificationSeverity;
  audience_role?: NotificationAudience;
  target_user_id?: string | null;
  target_user_name?: string | null;
  action_url?: string;
  user: UserProfile;
  token?: string;
}

export interface AntiSpamCheckResult {
  allowed: boolean;
  remainingSeconds: number;
  reason?: string;
}

const COOLDOWN_SECONDS = 180; // 3 menit jeda minimum antar-broadcast
const LAST_SENT_KEY = 'smart_absensi_broadcast_last_sent';
const HISTORY_KEY = 'smart_absensi_broadcast_history';

// In-memory fallback map for non-browser / test environments
const memoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch (_) {}
  return memoryStorage.get(key) ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  memoryStorage.set(key, value);
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key);
      return;
    }
  } catch (_) {}
  memoryStorage.delete(key);
}

export class AnnouncementRepository {
  public static readonly COOLDOWN_KEY = LAST_SENT_KEY;
  public static readonly HISTORY_KEY = HISTORY_KEY;
  public static readonly COOLDOWN_SECONDS = COOLDOWN_SECONDS;

  /**
   * Helper ringkas untuk mendapatkan sisa detik cooldown anti-spam
   */
  public static getCooldownRemainingSeconds(): number {
    return this.checkAntiSpamCooldown().remainingSeconds;
  }

  /**
   * Helper untuk set timestamp cooldown secara eksplisit (termasuk keperluan testing)
   */
  public static setCooldownTimestamp(timestamp: number): void {
    safeSetItem(LAST_SENT_KEY, String(timestamp));
  }

  /**
   * Helper untuk membersihkan cooldown
   */
  public static clearCooldown(): void {
    safeRemoveItem(LAST_SENT_KEY);
  }

  /**
   * Helper untuk membersihkan riwayat
   */
  public static clearHistory(): void {
    safeRemoveItem(HISTORY_KEY);
  }

  /**
   * Cek apakah pengirim sedang dalam status cooldown anti-spam
   */
  public static checkAntiSpamCooldown(): AntiSpamCheckResult {
    const lastSentStr = safeGetItem(LAST_SENT_KEY);
    if (!lastSentStr) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const lastSent = Number(lastSentStr);
    if (isNaN(lastSent)) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;
      return {
        allowed: false,
        remainingSeconds,
        reason: `⏱️ Cooldown aktif: Mohon tunggu ${remainingSeconds} detik sebelum mengirim pengumuman baru untuk mencegah spam ke HP guru.`,
      };
    }

    return { allowed: true, remainingSeconds: 0 };
  }

  /**
   * Cek apakah pesan dengan judul dan isi yang sama persis pernah dikirim baru-baru ini
   */
  public static checkDuplicateContent(title: string, message: string): boolean {
    const history = this.getLocalBroadcastHistory();
    const cleanTitle = title.trim().toLowerCase();
    const cleanMsg = message.trim().toLowerCase();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    return history.some((item) => {
      const isSameTitle = item.title.trim().toLowerCase() === cleanTitle;
      const isSameMsg = item.message.trim().toLowerCase() === cleanMsg;
      const itemTime = new Date(item.created_at).getTime();
      return isSameTitle && isSameMsg && itemTime > oneHourAgo;
    });
  }

  /**
   * Publikasikan pengumuman ke seluruh HP guru dan database sekolah
   */
  public static async publishAnnouncement(
    params: PublishAnnouncementParams
  ): Promise<BroadcastResult & { pushDetails?: any }> {
    const {
      title,
      message,
      severity = 'INFO',
      audience_role = 'GURU',
      target_user_id = null,
      target_user_name = null,
      action_url = '/',
      user,
      token,
    } = params;

    // 1. Validasi Hak Akses (Hanya Admin, Operator, dan Kepsek)
    if (!user || (user.role !== 'ADMIN' && user.role !== 'OPERATOR' && user.role !== 'KEPSEK')) {
      throw new Error('Akses ditolak: Hanya Admin dan Kepala Sekolah yang berhak mempublikasikan pengumuman.');
    }

    // 2. Validasi Kelengkapan Konten
    const trimmedTitle = title.trim();
    const trimmedMsg = message.trim();

    if (trimmedTitle.length < 3) {
      throw new Error('Judul pengumuman terlalu pendek (minimal 3 karakter).');
    }
    if (trimmedTitle.length > 80) {
      throw new Error('Judul pengumuman terlalu panjang (maksimal 80 karakter).');
    }
    if (trimmedMsg.length < 5) {
      throw new Error('Isi pesan pengumuman terlalu pendek (minimal 5 karakter).');
    }
    if (trimmedMsg.length > 350) {
      throw new Error('Isi pesan pengumuman terlalu panjang (maksimal 350 karakter).');
    }

    // 3. Validasi Anti-Spam Cooldown
    const cooldown = this.checkAntiSpamCooldown();
    if (!cooldown.allowed) {
      throw new Error(cooldown.reason || 'Cooldown pengiriman pengumuman sedang aktif.');
    }

    // 4. Validasi Anti-Duplicate Content
    if (this.checkDuplicateContent(trimmedTitle, trimmedMsg)) {
      throw new Error('⚠️ Pengumuman dengan judul dan isi yang persis sama telah dipublikasikan dalam 1 jam terakhir. Mohon perbarui isi pesan untuk menghindari duplikasi.');
    }

    const isDirectUser = Boolean(target_user_id);
    const targetLabel = isDirectUser
      ? `User: ${target_user_name || target_user_id}`
      : `Role: ${audience_role}`;

    logger.info(
      'AnnouncementRepository',
      `Broadcasting announcement "${trimmedTitle}" by ${user.full_name} (${user.role}) to ${targetLabel}`
    );

    // 5. Simpan ke Database Master Notifikasi via Provider
    const provider = ProviderFactory.getProvider();
    const dbResult = await provider.createBroadcastNotification(
      {
        title: trimmedTitle,
        message: trimmedMsg,
        severity,
        audience_role: isDirectUser ? undefined : audience_role,
        recipient_user_id: target_user_id || undefined,
        target_user_name: target_user_name || undefined,
        action_url,
        created_by: user.id,
        sender_name: user.full_name,
      },
      token
    );

    // 6. Trigger Web Push ke HP Penerima via Serverless Function
    let pushSent = false;
    let pushCount = 0;
    let pushDetails: any = null;

    try {
      const pushBody: Record<string, any> = {
        title: trimmedTitle,
        body: trimmedMsg,
        severity,
        eventType: 'ANNOUNCEMENT',
        url: action_url,
        action_url,
        senderUserId: user.id,
        senderRole: user.role,
        tag: `announcement_${Date.now()}`,
      };

      if (isDirectUser && target_user_id) {
        pushBody.targetUserId = target_user_id;
      } else {
        const targetRoles: ('GURU' | 'ADMIN' | 'KEPSEK')[] =
          audience_role === 'ALL'
            ? ['GURU', 'ADMIN', 'KEPSEK']
            : audience_role === 'ADMIN'
            ? ['ADMIN']
            : audience_role === 'KEPSEK'
            ? ['KEPSEK']
            : ['GURU'];
        pushBody.targetRoles = targetRoles;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers,
        body: JSON.stringify(pushBody),
      });

      if (res.ok) {
        pushDetails = await res.json().catch(() => null);
        pushSent = true;
        pushCount = pushDetails?.sent || 0;
        logger.info('AnnouncementRepository', 'Web Push dispatched successfully:', pushDetails);
      } else {
        const errText = await res.text().catch(() => '');
        logger.warn('AnnouncementRepository', `Web Push returned status ${res.status}: ${errText}`);
      }
    } catch (pushErr) {
      logger.warn('AnnouncementRepository', 'Web Push dispatch exception (non-fatal, DB record saved):', pushErr);
    }

    // 7. Simpan Timestamp Cooldown
    safeSetItem(LAST_SENT_KEY, String(Date.now()));

    // 8. Simpan ke Riwayat Lokal
    const newRecord: AppNotification = {
      id: dbResult.notificationId || `ann_${Date.now()}`,
      user_id: target_user_id || null,
      recipient_user_id: target_user_id || null,
      audience_role: isDirectUser ? undefined : audience_role,
      target_user_name: target_user_name || null,
      title: trimmedTitle,
      message: trimmedMsg,
      type: 'ANNOUNCEMENT',
      severity,
      action_url,
      created_by: user.id,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.saveToLocalHistory(newRecord);

    // Dispatch realtime event to update in-app notification dropdowns & mobile HP
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('smart_absensi_notifications_updated'));
    }

    return {
      success: true,
      notificationId: dbResult.notificationId,
      pushSent,
      pushCount,
      pushDetails,
    };
  }

  /**
   * Ambil riwayat pengumuman yang pernah dipublikasikan
   */
  public static async getBroadcastHistory(token?: string, limit = 20): Promise<AppNotification[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const serverHistory = await provider.getBroadcastAnnouncements(token, limit);
      if (serverHistory && serverHistory.length > 0) {
        return serverHistory;
      }
    } catch (err) {
      logger.warn('AnnouncementRepository', 'Failed to fetch server announcements, using local fallback:', err);
    }

    return this.getLocalBroadcastHistory().slice(0, limit);
  }

  /**
   * Helper: Ambil riwayat lokal dari storage
   */
  public static getLocalBroadcastHistory(): AppNotification[] {
    const saved = safeGetItem(HISTORY_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  /**
   * Helper: Simpan item ke riwayat lokal
   */
  private static saveToLocalHistory(item: AppNotification): void {
    try {
      const current = this.getLocalBroadcastHistory();
      current.unshift(item);
      safeSetItem(HISTORY_KEY, JSON.stringify(current.slice(0, 50)));
    } catch (_) {}
  }
}
