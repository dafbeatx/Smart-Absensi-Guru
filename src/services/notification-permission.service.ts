/**
 * Smart Absensi Guru - Browser Web Notification Permission & Push Service
 * Mengelola izin notifikasi browser & pengiriman notifikasi OS desktop/mobile real-time
 */

import { SoundService } from './audio.service';
import { pwaService } from './pwa.service';
import { ProviderFactory } from '../providers/provider-factory';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Helper: Konversi URL-safe base64 string ke Uint8Array untuk VAPID applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData =
    typeof window !== 'undefined'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Helper: Konversi ArrayBuffer ke Base64URL string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(binary, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface AttendanceNotificationPayload {
  id?: string;
  title: string;
  body: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'LEAVE_REQUEST' | 'EVENT' | 'SYSTEM';
  teacherName?: string;
  time?: string;
  userId?: string;
  roleTarget?: 'ALL' | 'ADMIN' | 'GURU' | 'KEPSEK';
  actionType?: 'CORRECTION' | 'NAVIGATE_TAB' | 'INFO';
  actionDate?: string;
  actionTargetId?: string;
  createdAt?: string;
  isRead?: boolean;
}

const memoryNotificationCache: AttendanceNotificationPayload[] = [];

class NotificationPermissionService {
  constructor() {
    // Service constructor
  }

  /**
   * Cek apakah notifikasi didukung dan telah diizinkan oleh browser
   */
  public isPermissionGranted(): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }

  /**
   * Dapatkan status izin notifikasi saat ini ('default' | 'granted' | 'denied')
   */
  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /**
   * Minta Perizinan Notifikasi Browser ke Pengguna (Admin / Kepsek / Guru)
   * dan otomatis mendaftarkan Web Push Subscription ke Supabase
   */
  public async requestPermission(userId?: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser ini tidak mendukung Web Notification API.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Otomatis daftarkan Web Push Subscription ke Google FCM / Supabase di background
        this.subscribeUserToPush(userId).catch((err) =>
          console.warn('Silent failure subscribing user to push:', err)
        );

        // Kirim konfirmasi notifikasi selamat datang
        this.sendNativeNotification({
          title: '🔔 Notifikasi Real-time Aktif!',
          body: 'Anda akan menerima pemberitahuan langsung saat guru absen masuk, keluar, atau pengumuman event sekolah.',
          type: 'SYSTEM',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Simpan notifikasi ke local storage cache untuk ditampilkan di in-app notification bell
   */
  private saveToCache(payload: AttendanceNotificationPayload) {
    const newNotif: AttendanceNotificationPayload = {
      id: payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      teacherName: payload.teacherName,
      time: payload.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      userId: payload.userId,
      roleTarget: payload.roleTarget || 'ALL',
      actionType: payload.actionType,
      actionDate: payload.actionDate,
      actionTargetId: payload.actionTargetId,
      createdAt: payload.createdAt || new Date().toISOString(),
      isRead: false,
    };

    memoryNotificationCache.unshift(newNotif);
    if (memoryNotificationCache.length > 50) {
      memoryNotificationCache.length = 50;
    }

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_notifications_cache');
        const existing: AttendanceNotificationPayload[] = saved ? JSON.parse(saved) : [];
        const updated = [newNotif, ...existing].slice(0, 50);
        localStorage.setItem('smart_absensi_notifications_cache', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save notification to cache:', e);
      }
    }
  }

  /**
   * Ambill daftar notifikasi tersimpan dari local cache
   */
  public getCachedNotifications(userId?: string): AttendanceNotificationPayload[] {
    let list = [...memoryNotificationCache];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_notifications_cache');
        if (saved) {
          list = JSON.parse(saved);
        }
      } catch (e) {
        // use memory list
      }
    }
    if (!userId) return list;
    return list.filter((n) => !n.userId || n.userId === userId || n.roleTarget === 'ALL');
  }

  /**
   * Tandai semua notifikasi di cache sebagai sudah dibaca
   */
  public markAllAsRead() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('smart_absensi_notifications_cache');
      if (!saved) return;
      const parsed: AttendanceNotificationPayload[] = JSON.parse(saved);
      const updated = parsed.map((n) => ({ ...n, isRead: true }));
      localStorage.setItem('smart_absensi_notifications_cache', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to mark notifications read:', e);
    }
  }

  /**
   * Ambil Set ID notifikasi yang sudah dibaca oleh user tertentu / global dari LocalStorage
   */
  public getReadNotificationIds(userId?: string): Set<string> {
    if (typeof window === 'undefined') return new Set();
    const readSet = new Set<string>();

    const readKeys = [
      userId ? `smart_absensi_read_notifications_${userId}` : null,
      'smart_absensi_read_notifications_global',
      'smart_absensi_read_notifications_all',
    ].filter(Boolean) as string[];

    for (const key of readKeys) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => readSet.add(id));
          }
        }
      } catch (e) {
        console.warn('Failed to parse read notification IDs:', e);
      }
    }
    return readSet;
  }

  /**
   * Tandai ID notifikasi tertentu sebagai sudah dibaca untuk user tertentu & global
   */
  public markIdAsRead(userId: string | undefined, notificationId: string) {
    if (typeof window === 'undefined') return;
    try {
      const readSet = this.getReadNotificationIds(userId);
      readSet.add(notificationId);
      const arr = Array.from(readSet);

      if (userId) {
        localStorage.setItem(`smart_absensi_read_notifications_${userId}`, JSON.stringify(arr));
      }
      localStorage.setItem('smart_absensi_read_notifications_global', JSON.stringify(arr));
      this.markAllAsRead();

      window.dispatchEvent(new CustomEvent('smart_absensi_notifications_read_updated', { detail: { notificationId } }));
    } catch (e) {
      console.warn('Failed to mark notification ID read:', e);
    }
  }

  /**
   * Tandai seluruh daftar ID notifikasi sebagai sudah dibaca untuk user tertentu & global
   */
  public markAllIdsAsRead(userId: string | undefined, notificationIds: string[]) {
    if (typeof window === 'undefined') return;
    try {
      const readSet = this.getReadNotificationIds(userId);
      notificationIds.forEach((id) => readSet.add(id));
      const arr = Array.from(readSet);

      if (userId) {
        localStorage.setItem(`smart_absensi_read_notifications_${userId}`, JSON.stringify(arr));
      }
      localStorage.setItem('smart_absensi_read_notifications_global', JSON.stringify(arr));
      this.markAllAsRead();

      window.dispatchEvent(new CustomEvent('smart_absensi_notifications_read_updated'));
    } catch (e) {
      console.warn('Failed to mark all notification IDs read:', e);
    }
  }

  /**
   * Cek apakah notifikasi ID tertentu sudah dibaca
   */
  public isNotificationRead(userId: string | undefined, notificationId: string): boolean {
    const readSet = this.getReadNotificationIds(userId);
    return readSet.has(notificationId);
  }

  /**
   * Kirim Notifikasi Native Browser (OS Desktop / HP) + Suara Chime + Cache
   */
  public sendNativeNotification(payload: AttendanceNotificationPayload) {
    // 1. Save to local cache feed
    this.saveToCache(payload);

    // 2. Play Audio Sound Effect
    if (payload.type === 'LEAVE_REQUEST') {
      SoundService.play('WARNING');
    } else {
      SoundService.playSuccess();
    }

    // 3. Kirim Native OS Browser Notification via Service Worker (Android & PWA Safe) dengan Fallback
    if (this.isPermissionGranted() && typeof window !== 'undefined') {
      const iconPath = '/pwa-192x192.png';
      const notificationOptions: NotificationOptions = {
        body: payload.body,
        icon: iconPath,
        badge: iconPath,
        tag: payload.id || `sag-notif-${Date.now()}`,
        requireInteraction: false,
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((registration) => {
            return registration.showNotification(payload.title, notificationOptions);
          })
          .catch(() => {
            try {
              const notification = new Notification(payload.title, notificationOptions);
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch (e) {
              console.warn('Fallback window notification error:', e);
            }
          });
      } else {
        try {
          const notification = new Notification(payload.title, notificationOptions);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (e) {
          console.warn('Error displaying native notification:', e);
        }
      }
    }

    // 4. Dispatch internal custom event for instant UI bell & feed update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_absensi_notification_pushed', { detail: payload }));
    }
  }

  /**
   * Daftarkan PushSubscription ke Google FCM / Apple APNs via ServiceWorker PushManager
   * dan simpan endpoint ke Supabase Database
   */
  public async subscribeUserToPush(userId?: string): Promise<boolean> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      console.warn('[PushManager] Web Push API tidak didukung pada browser ini.');
      return false;
    }

    try {
      const vapidPublicKey =
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY) ||
        'BJxAOVY7XCFiipXVppN_IPu5rWUzXaLzhM33dytmGI6oQ0SES9Qspm3sTPYcz9euG1NhSOSZb8BHLShozXnotnI';

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        });
      }

      if (!subscription) {
        console.warn('[PushManager] Gagal memperoleh PushSubscription dari browser.');
        return false;
      }

      const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
      const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
      const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);

      const effectiveUserId = userId || useAuthStore.getState().user?.id || 'unknown_user';
      const provider = ProviderFactory.getProvider();

      await provider.savePushSubscription({
        user_id: effectiveUserId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        device_type: isMobile ? 'MOBILE' : 'DESKTOP',
        user_agent: navigator.userAgent,
      });

      console.info('[PushManager] Web Push Subscription berhasil tersimpan ke Supabase.');
      return true;
    } catch (error) {
      console.warn('[PushManager] Error mendaftarkan push subscription:', error);
      return false;
    }
  }

  /**
   * Helper: Kirim Web Push Notification melalui Vercel Serverless Function (/api/send-push)
   * Mengirimkan notifikasi ke perangkat guru / admin / kepsek yang sedang offline/tertutup
   */
  public async triggerServerWebPush(params: {
    targetRoles?: ('ADMIN' | 'KEPSEK' | 'GURU' | 'OPERATOR')[];
    targetUserId?: string;
    title: string;
    body: string;
    url?: string;
    tag?: string;
  }): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Masuk (Check-In)
   */
  public notifyTeacherCheckIn(teacherName: string, timeStr: string, userId?: string) {
    const todayIso = new Date().toISOString().substring(0, 10);
    this.sendNativeNotification({
      id: `notif_in_${userId || teacherName.replace(/\s+/g, '_')}_${todayIso}_${timeStr.replace(':', '')}`,
      title: `🟢 Presensi Masuk: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi masuk pada pukul ${timeStr} WIB.`,
      type: 'CHECK_IN',
      teacherName,
      time: timeStr,
      userId,
      roleTarget: 'ALL',
    });

    // Otomatis kirimkan Web Push ke HP Admin & Kepsek di latar belakang
    this.triggerServerWebPush({
      targetRoles: ['ADMIN', 'KEPSEK'],
      title: `🟢 Presensi Masuk: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi masuk pada pukul ${timeStr} WIB.`,
      tag: `in_${userId || 'guru'}_${Date.now()}`,
      url: '/?tab=TEACHERS',
    }).catch(() => {});
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Keluar (Check-Out)
   */
  public notifyTeacherCheckOut(teacherName: string, timeStr: string, userId?: string) {
    const todayIso = new Date().toISOString().substring(0, 10);
    this.sendNativeNotification({
      id: `notif_out_${userId || teacherName.replace(/\s+/g, '_')}_${todayIso}_${timeStr.replace(':', '')}`,
      title: `🔵 Presensi Pulang: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi pulang pada pukul ${timeStr} WIB.`,
      type: 'CHECK_OUT',
      teacherName,
      time: timeStr,
      userId,
      roleTarget: 'ALL',
    });

    // Otomatis kirimkan Web Push ke HP Admin & Kepsek di latar belakang
    this.triggerServerWebPush({
      targetRoles: ['ADMIN', 'KEPSEK'],
      title: `🔵 Presensi Pulang: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi pulang pada pukul ${timeStr} WIB.`,
      tag: `out_${userId || 'guru'}_${Date.now()}`,
      url: '/?tab=TEACHERS',
    }).catch(() => {});
  }

  /**
   * Helper: Trigger Notifikasi Event / Agenda Sekolah Baru
   */
  public notifySchoolEvent(eventTitle: string, eventDate: string, description?: string) {
    this.sendNativeNotification({
      id: `notif_event_${eventDate}_${eventTitle.replace(/\s+/g, '_').substring(0, 20)}`,
      title: `📅 Agenda Sekolah: ${eventTitle}`,
      body: `${eventTitle} (${eventDate})${description ? ' - ' + description : ''}.`,
      type: 'EVENT',
      roleTarget: 'ALL',
    });
  }

  /**
   * Helper: Trigger Notifikasi Hari Gajian Bulanan untuk Guru & Staf (H-2, H-1, Hari H Tanggal 10)
   */
  public notifyPayday(
    teacherName?: string,
    dateStr?: string,
    userId?: string,
    customTitle?: string,
    customBody?: string,
    reminderStatus?: string
  ) {
    const targetDate = dateStr || new Date().toISOString().substring(0, 10);
    const greeting = teacherName ? `Bapak/Ibu ${teacherName}` : 'Bapak/Ibu Guru & Staf';
    const notifId = reminderStatus
      ? `notif_payday_${userId || 'all'}_${targetDate}_${reminderStatus}`
      : `notif_payday_${userId || 'all'}_${targetDate}`;

    this.sendNativeNotification({
      id: notifId,
      title: customTitle || `💰 Hari Gajian Telah Tiba! (${targetDate})`,
      body: customBody || `Selamat ${greeting}! Hari ini tanggal 10 adalah Hari Gajian. Tetap semangat mengajar dan jangan lupa presensi masuk & pulang!`,
      type: 'EVENT',
      teacherName,
      userId,
      roleTarget: 'ALL',
      actionDate: targetDate,
    });

    // Otomatis kirimkan Web Push ke HP Guru, Admin & Kepsek di latar belakang
    this.triggerServerWebPush({
      targetRoles: ['GURU', 'ADMIN', 'KEPSEK'],
      title: customTitle || `💰 Hari Gajian Telah Tiba! (${targetDate})`,
      body: customBody || `Selamat ${greeting}! Hari ini tanggal 10 adalah Hari Gajian. Tetap semangat mengajar dan jangan lupa presensi masuk & pulang!`,
      tag: `payday_${targetDate}_${reminderStatus || 'H'}`,
      url: '/?tab=BERANDA',
    }).catch(() => {});
  }

  /**
   * Helper: Trigger Notifikasi Pengajuan Izin Baru untuk Admin / Kepsek
   */
  public notifyTeacherLeaveRequest(teacherName: string, leaveType: string, reason: string) {
    const todayIso = new Date().toISOString().substring(0, 10);
    this.sendNativeNotification({
      id: `notif_leave_req_${teacherName.replace(/\s+/g, '_')}_${todayIso}_${leaveType}`,
      title: `📝 Pengajuan Izin Baru: ${teacherName}`,
      body: `${teacherName} mengajukan ${leaveType} (${reason}). Perlu persetujuan Kepala Sekolah/Admin.`,
      type: 'LEAVE_REQUEST',
      teacherName,
      roleTarget: 'ADMIN',
    });

    // Otomatis kirimkan Web Push ke HP Admin & Kepsek di latar belakang
    this.triggerServerWebPush({
      targetRoles: ['ADMIN', 'KEPSEK'],
      title: `📝 Pengajuan Izin Baru: ${teacherName}`,
      body: `${teacherName} mengajukan ${leaveType} (${reason}). Perlu persetujuan Kepala Sekolah/Admin.`,
      tag: `leave_${Date.now()}`,
      url: '/?tab=LEAVES',
    }).catch(() => {});
  }

  /**
   * Helper: Trigger Notifikasi Hari Belum Absen untuk Guru
   */
  public notifyTeacherMissingAttendance(teacherName: string, dateStr: string, userId?: string) {
    this.sendNativeNotification({
      id: `notif_missing_att_${userId || 'guru'}_${dateStr}`,
      title: `⚠️ Presensi Belum Tercatat: ${dateStr}`,
      body: `Bapak/Ibu ${teacherName}, Anda belum tercatat presensi pada tanggal ${dateStr}. Ketuk untuk langsung mengajukan Koreksi Absen.`,
      type: 'SYSTEM',
      teacherName,
      userId,
      roleTarget: 'GURU',
      actionType: 'CORRECTION',
      actionDate: dateStr,
      actionTargetId: userId,
    });
  }

  /**
   * Helper: Trigger Notifikasi Ringkasan Guru Belum Absen untuk Admin / Kepsek
   */
  public notifyAdminMissingAttendanceSummary(unabsentedCount: number, dateStr: string) {
    this.sendNativeNotification({
      id: `notif_unabsented_summary_${dateStr}`,
      title: `⚠️ ${unabsentedCount} Guru Belum Presensi: ${dateStr}`,
      body: `Terdapat ${unabsentedCount} guru yang belum tercatat presensi pada ${dateStr}. Ketuk untuk memeriksa dan melakukan koreksi manual.`,
      type: 'SYSTEM',
      roleTarget: 'ADMIN',
      actionType: 'NAVIGATE_TAB',
      actionDate: dateStr,
    });
  }

  private activeCheckoutTimer: any = null;

  /**
   * Dapatkan Jam Target Pulang berdasarkan hari (Senin-Kamis 13.00, Jumat 11.00)
   */
  public getCheckoutTargetTimeForDate(date: Date = new Date()): { hours: number; minutes: number; label: string } {
    const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    if (dayOfWeek === 5) {
      return { hours: 11, minutes: 0, label: '11.00 WIB (Jumat)' };
    }
    return { hours: 13, minutes: 0, label: '13.00 WIB (Senin - Kamis)' };
  }

  /**
   * Menjadwalkan Automatic Local Push Notification & PWA Alarm Presensi Pulang
   * Dipanggil secara otomatis saat Guru berhasil melakukan Absen Masuk
   */
  public scheduleCheckoutReminder(teacherName: string, userId?: string) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const targetInfo = this.getCheckoutTargetTimeForDate(now);

    const targetTime = new Date();
    targetTime.setHours(targetInfo.hours, targetInfo.minutes, 0, 0);

    const delayMs = Math.max(0, targetTime.getTime() - now.getTime());
    const notifTitle = '🔔 Waktu Pulang Sekolah Tiba!';
    const notifBody = `Waktu Pulang Sekolah Tiba! Bapak/Ibu ${teacherName}, jangan lupa scan QR / Absen Pulang sebelum meninggalkan area sekolah.`;

    // 1. Send schedule message to PWA Service Worker
    pwaService.scheduleAttendanceReminder(notifTitle, notifBody, delayMs, 'checkout-reminder');

    // 2. Clear previous active window timer & setup new one
    if (this.activeCheckoutTimer) {
      clearTimeout(this.activeCheckoutTimer);
      this.activeCheckoutTimer = null;
    }

    const fireReminder = () => {
      this.sendNativeNotification({
        title: notifTitle,
        body: notifBody,
        type: 'CHECK_OUT',
        teacherName,
        userId,
        roleTarget: 'GURU',
      });
      this.saveCheckoutReminderState({ teacherName, userId, dateStr: todayStr, isFired: true });
    };

    if (delayMs <= 0) {
      fireReminder();
    } else {
      this.activeCheckoutTimer = setTimeout(fireReminder, delayMs);
      this.saveCheckoutReminderState({
        teacherName,
        userId,
        dateStr: todayStr,
        isFired: false,
        targetTimeIso: targetTime.toISOString(),
      });
    }
  }

  /**
   * Membatalkan Alarm / Pengingat Pulang setelah Guru berhasil melakukan Absen Pulang
   */
  public cancelScheduledCheckoutReminder() {
    if (this.activeCheckoutTimer) {
      clearTimeout(this.activeCheckoutTimer);
      this.activeCheckoutTimer = null;
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smart_absensi_scheduled_checkout_reminder');
    }
  }

  /**
   * Helper internal menyimpan state reminder ke localStorage
   */
  private saveCheckoutReminderState(data: { teacherName: string; userId?: string; dateStr: string; isFired: boolean; targetTimeIso?: string }) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('smart_absensi_scheduled_checkout_reminder', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save checkout reminder state:', e);
    }
  }

  /**
   * Helper: Trigger Notifikasi Keputusan Izin untuk Guru
   */
  public notifyLeaveDecision(teacherName: string, decision: 'APPROVED' | 'REJECTED', leaveType: string, userId?: string) {
    const isApproved = decision === 'APPROVED';
    this.sendNativeNotification({
      title: isApproved ? `✅ Pengajuan ${leaveType} Disetujui` : `❌ Pengajuan ${leaveType} Ditolak`,
      body: `Permohonan ${leaveType} Anda telah ${isApproved ? 'disetujui' : 'ditolak'} oleh Kepsek/Admin.`,
      type: 'LEAVE_REQUEST',
      teacherName,
      userId,
      roleTarget: 'GURU',
    });
  }
}

export const NotificationService = new NotificationPermissionService();
