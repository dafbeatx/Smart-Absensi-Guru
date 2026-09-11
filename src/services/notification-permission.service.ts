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
  roleTarget?: 'ALL' | 'ADMIN' | 'GURU' | 'KEPSEK' | 'OPERATOR';
  actionType?: 'CORRECTION' | 'NAVIGATE_TAB' | 'INFO';
  actionDate?: string;
  actionTargetId?: string;
  actionUrl?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  createdAt?: string;
  isRead?: boolean;
}

export type DetailedPermissionStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied'
  | 'subscribed'
  | 'subscription_failed';

const memoryNotificationList: AttendanceNotificationPayload[] = [];
const memoryReadStore: Map<string, Set<string>> = new Map();
const memoryPendingReads: Map<string, string[]> = new Map();

class NotificationPermissionService {
  private activeCheckoutTimer: ReturnType<typeof setTimeout> | null = null;
  private activeEarlyCheckoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          this.syncPendingReads(userId).catch(() => {});
        }
      });
    }
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
   * Dapatkan status mendalam (unsupported, default, granted, denied, subscribed, subscription_failed)
   */
  public async getDetailedStatus(_userId?: string): Promise<DetailedPermissionStatus> {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) {
      return 'unsupported';
    }

    const permission = Notification.permission;
    if (permission === 'denied') return 'denied';
    if (permission === 'default') return 'default';

    // permission is 'granted', check push subscription
    try {
      if (!('PushManager' in window)) {
        return 'granted';
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        return 'subscribed';
      }
      return 'granted';
    } catch {
      return 'subscription_failed';
    }
  }

  /**
   * Helper penentuan jam hening (quiet hours)
   * Mengembalikan true jika waktu saat ini berada di antara start (default 21:00) dan end (default 05:00)
   */
  public isWithinQuietHours(start = '21:00', end = '05:00', date: Date = new Date()): boolean {
    try {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes <= endMinutes) {
        // Rentang waktu dalam 1 hari (misal 13:00 s.d 15:00)
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Rentang waktu melewati tengah malam (misal 21:00 s.d 05:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  private getReadKey(userId?: string): string {
    return userId ? `smart_absensi_reads_${userId}` : 'smart_absensi_reads_guest';
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
        const effectiveUserId = userId || useAuthStore.getState().user?.id;
        this.subscribeUserToPush(effectiveUserId).catch((err) =>
          console.warn('Silent failure subscribing user to push:', err)
        );

        // Kirim konfirmasi notifikasi selamat datang
        this.sendNativeNotification({
          title: '🔔 Notifikasi Real-time Aktif!',
          body: 'Anda akan menerima pemberitahuan langsung saat guru absen masuk, keluar, atau pengumuman agenda sekolah.',
          type: 'SYSTEM',
          userId: effectiveUserId,
          roleTarget: 'ALL',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }

  private getCacheKey(userId?: string, userRole?: string): string {
    if (userId && userRole) {
      return `smart_absensi_notifications_cache:${userId}:${userRole}:v2`;
    }
    return 'smart_absensi_notifications_cache';
  }

  /**
   * Simpan notifikasi ke local storage cache yang terisolasi per user
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
      actionUrl: payload.actionUrl,
      severity: payload.severity || 'INFO',
      createdAt: payload.createdAt || new Date().toISOString(),
      isRead: false,
    };

    memoryNotificationList.unshift(newNotif);
    if (memoryNotificationList.length > 50) memoryNotificationList.length = 50;

    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_notifications_cache');
        const existing: AttendanceNotificationPayload[] = saved ? JSON.parse(saved) : [];
        const updated = [newNotif, ...existing.filter((item) => item.id !== newNotif.id)].slice(0, 50);
        localStorage.setItem('smart_absensi_notifications_cache', JSON.stringify(updated));

        // Also save to namespaced cache if user / role available
        const sessionUser = useAuthStore.getState().user;
        const uId = payload.userId || sessionUser?.id;
        const uRole = sessionUser?.role;
        if (uId && uRole) {
          const namespacedKey = this.getCacheKey(uId, uRole);
          const nsSaved = localStorage.getItem(namespacedKey);
          const nsExisting: AttendanceNotificationPayload[] = nsSaved ? JSON.parse(nsSaved) : [];
          const nsUpdated = [newNotif, ...nsExisting.filter((item) => item.id !== newNotif.id)].slice(0, 50);
          localStorage.setItem(namespacedKey, JSON.stringify(nsUpdated));
        }
      } catch (e) {
        console.warn('Failed to save notification to cache:', e);
      }
    }
  }

  /**
   * Ambil daftar notifikasi tersimpan dari local cache terisolasi per user
   * dan disaring berdasarkan target peran pengguna (Role Target Filtering)
   */
  public getCachedNotifications(userId?: string, userRole?: string): AttendanceNotificationPayload[] {
    let list: AttendanceNotificationPayload[] = [...memoryNotificationList];

    if (typeof localStorage !== 'undefined') {
      try {
        let saved: string | null = null;
        if (userId && userRole) {
          saved = localStorage.getItem(this.getCacheKey(userId, userRole));
        }
        if (!saved) {
          saved = localStorage.getItem('smart_absensi_notifications_cache');
        }
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const seen = new Set(list.map((x) => x.id));
            for (const item of parsed) {
              if (!seen.has(item.id)) {
                list.push(item);
                seen.add(item.id);
              }
            }
          }
        }
      } catch {
        // fallback to memory list
      }
    }

    const readIds = this.getReadNotificationIds(userId);

    // Role-based Audience Isolation Filter:
    return list.filter((n) => {
      // 1. Direct user recipient
      if (n.userId) {
        if (userId && n.userId === userId) return true;
        if (!userId && !userRole) return true; // unscoped test check
        return false; // private notification for another user
      }

      // 2. Broadcast or role-targeted notification (no specific userId)
      const targetRole = (n.roleTarget || 'ALL').toUpperCase().trim();
      if (targetRole === 'ALL') return true;

      if (userRole) {
        const currentRole = userRole.toUpperCase().trim();
        if (targetRole === currentRole) return true;
        // Operator gets Admin level alerts
        if (currentRole === 'OPERATOR' && targetRole === 'ADMIN') return true;
        return false;
      }

      // If userRole not provided (unscoped test check)
      return true;
    }).map((n) => ({
      ...n,
      isRead: Boolean(n.isRead) || (n.id ? readIds.has(n.id) : false),
    }));
  }

  /**
   * Tandai semua notifikasi di cache sebagai sudah dibaca untuk user tertentu
   */
  public markAllAsRead(userId?: string, userRole?: string) {
    memoryNotificationList.forEach((n) => {
      n.isRead = true;
    });

    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_notifications_cache');
        if (saved) {
          const parsed: AttendanceNotificationPayload[] = JSON.parse(saved);
          const updated = parsed.map((n) => ({ ...n, isRead: true }));
          localStorage.setItem('smart_absensi_notifications_cache', JSON.stringify(updated));
        }

        if (userId && userRole) {
          const nsKey = this.getCacheKey(userId, userRole);
          const nsSaved = localStorage.getItem(nsKey);
          if (nsSaved) {
            const parsed: AttendanceNotificationPayload[] = JSON.parse(nsSaved);
            const updated = parsed.map((n) => ({ ...n, isRead: true }));
            localStorage.setItem(nsKey, JSON.stringify(updated));
          }
        }
      } catch (e) {
        console.warn('Failed to mark notifications read:', e);
      }
    }
  }

  /**
   * Ambil Set ID notifikasi yang sudah dibaca oleh user tertentu dari LocalStorage yang terisolasi
   */
  public getReadNotificationIds(userId?: string): Set<string> {
    const effectiveUserId = userId || useAuthStore.getState().user?.id || 'guest';
    const memSet = memoryReadStore.get(effectiveUserId) || new Set<string>();
    const readSet = new Set<string>(memSet);

    if (typeof localStorage !== 'undefined') {
      try {
        const readKey = this.getReadKey(effectiveUserId);
        const saved = localStorage.getItem(readKey);
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
   * Tandai ID notifikasi tertentu sebagai sudah dibaca untuk user tertentu (namespaced)
   */
  public markIdAsRead(userId: string | undefined, notificationId: string) {
    const effectiveUserId = userId || useAuthStore.getState().user?.id || 'guest';
    const readSet = this.getReadNotificationIds(effectiveUserId);
    readSet.add(notificationId);

    memoryReadStore.set(effectiveUserId, readSet);

    if (typeof localStorage !== 'undefined') {
      try {
        const readKey = this.getReadKey(effectiveUserId);
        localStorage.setItem(readKey, JSON.stringify(Array.from(readSet)));
      } catch (e) {
        console.warn('Failed to mark notification ID read:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_notifications_read_updated', {
          detail: { notificationId, userId: effectiveUserId },
        })
      );
    }
  }

  /**
   * Tandai seluruh daftar ID notifikasi sebagai sudah dibaca untuk user tertentu (namespaced)
   */
  public markAllIdsAsRead(userId: string | undefined, notificationIds: string[]) {
    const effectiveUserId = userId || useAuthStore.getState().user?.id || 'guest';
    const readSet = this.getReadNotificationIds(effectiveUserId);
    notificationIds.forEach((id) => readSet.add(id));

    memoryReadStore.set(effectiveUserId, readSet);

    if (typeof localStorage !== 'undefined') {
      try {
        const readKey = this.getReadKey(effectiveUserId);
        localStorage.setItem(readKey, JSON.stringify(Array.from(readSet)));
      } catch (e) {
        console.warn('Failed to mark all notification IDs read:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_notifications_read_updated', {
          detail: { notificationIds, userId: effectiveUserId },
        })
      );
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
   * Antrekan pending read untuk offline sync
   */
  public queuePendingRead(userId: string, notificationId: string) {
    if (!userId || !notificationId) return;
    const memList = memoryPendingReads.get(userId) || [];
    if (!memList.includes(notificationId)) {
      memList.push(notificationId);
      memoryPendingReads.set(userId, memList);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const key = `smart_absensi_pending_reads_${userId}`;
        const saved = localStorage.getItem(key);
        const list: string[] = saved ? JSON.parse(saved) : [];
        if (!list.includes(notificationId)) {
          list.push(notificationId);
          localStorage.setItem(key, JSON.stringify(list));
        }
      } catch (e) {
        console.warn('Failed to queue pending read:', e);
      }
    }
  }

  /**
   * Ambil daftar pending read yang belum tersinkron
   */
  public getPendingReads(userId: string): string[] {
    const mem = memoryPendingReads.get(userId) || [];
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`smart_absensi_pending_reads_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return mem;
  }

  /**
   * Sinkronisasikan antrean pending read ke server
   */
  public async syncPendingReads(userId: string): Promise<void> {
    if (!userId) return;
    let list: string[] = [...(memoryPendingReads.get(userId) || [])];
    if (typeof localStorage !== 'undefined') {
      try {
        const key = `smart_absensi_pending_reads_${userId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse pending reads:', e);
      }
    }
    if (!list || list.length === 0) return;

    const provider = ProviderFactory.getProvider();
    const res = await provider.markNotificationsAsRead(list, userId);
    const isSuccess = typeof res === 'object' ? res.synced || res.success : Boolean(res);
    if (isSuccess) {
      memoryPendingReads.delete(userId);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`smart_absensi_pending_reads_${userId}`);
      }
    }
  }

  /**
   * Berlangganan event Realtime notifications dan notification_reads
   */
  public subscribeRealtime(userId: string, callback: (event?: any) => void): () => void {
    const provider = ProviderFactory.getProvider();
    if (typeof provider.subscribeToNotificationUpdates === 'function') {
      return provider.subscribeToNotificationUpdates(userId, (event) => {
        callback(event);
      });
    }
    return () => {};
  }

  /**
   * Kirim Notifikasi Native Browser (OS Desktop / HP) + Suara Chime + Cache
   */
  public sendNativeNotification(payload: AttendanceNotificationPayload) {
    // 1. Save to local namespaced cache feed
    this.saveToCache(payload);

    // 2. Play Audio Sound Effect (respecting quiet hours unless critical)
    const inQuietHours = this.isWithinQuietHours();
    if (!inQuietHours || payload.severity === 'CRITICAL') {
      if (payload.type === 'LEAVE_REQUEST') {
        SoundService.play('WARNING');
      } else {
        SoundService.playNotificationChime();
      }
    }

    // 3. Kirim Native OS Browser Notification via Service Worker (Android & PWA Safe) dengan Fallback
    if (this.isPermissionGranted() && typeof window !== 'undefined') {
      const iconPath = '/pwa-192x192.png';
      const notificationOptions: NotificationOptions = {
        body: payload.body,
        icon: iconPath,
        badge: iconPath,
        tag: payload.id || `sag-notif-${Date.now()}`,
        requireInteraction: payload.severity === 'CRITICAL',
        data: {
          url: payload.actionUrl || '/?tab=BERANDA',
          actionUrl: payload.actionUrl || '/?tab=BERANDA',
          actionType: payload.actionType,
          actionDate: payload.actionDate,
        },
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
                if (payload.actionUrl) {
                  window.location.href = payload.actionUrl;
                }
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
            if (payload.actionUrl) {
              window.location.href = payload.actionUrl;
            }
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
   * dan simpan endpoint ke Supabase Database dengan user_id yang tepat
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

      console.info('[PushManager] Web Push Subscription berhasil tersimpan ke database untuk user:', effectiveUserId);
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
    actionUrl?: string;
    tag?: string;
    severity?: 'CRITICAL' | 'WARNING' | 'INFO';
    dedupeKey?: string;
  }): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...params,
          url: params.actionUrl || params.url,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Masuk (Check-In)
   */
  public notifyTeacherCheckIn(teacherName: string, time: string, userId?: string) {
    this.sendNativeNotification({
      title: '✅ Presensi Masuk Berhasil',
      body: `Bapak/Ibu ${teacherName} berhasil presensi masuk pada pukul ${time} WIB.`,
      type: 'CHECK_IN',
      teacherName,
      time,
      userId,
      roleTarget: 'GURU',
      actionUrl: '/?tab=BERANDA',
    });
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Pulang (Check-Out)
   */
  public notifyTeacherCheckOut(teacherName: string, time: string, userId?: string) {
    this.cancelScheduledCheckoutReminder();
    this.sendNativeNotification({
      title: '👋 Presensi Pulang Berhasil',
      body: `Bapak/Ibu ${teacherName} telah menyelesaikan presensi pulang pada pukul ${time} WIB. Hati-hati di jalan!`,
      type: 'CHECK_OUT',
      teacherName,
      time,
      userId,
      roleTarget: 'GURU',
      actionUrl: '/?tab=BERANDA',
    });
  }

  /**
   * Helper: Trigger Notifikasi Pengumuman / Agenda Sekolah
   */
  public notifySchoolEvent(eventTitle: string, eventDate: string, description?: string) {
    const todayIso = new Date().toISOString().substring(0, 10);
    this.sendNativeNotification({
      id: `notif_event_${eventDate}_${todayIso}`,
      title: `📢 Agenda Sekolah: ${eventTitle}`,
      body: `${eventTitle} dijadwalkan pada ${eventDate}${description ? ' - ' + description : ''}.`,
      type: 'EVENT',
      roleTarget: 'ALL',
      actionDate: eventDate,
      actionUrl: '/?tab=BERANDA',
    });

    this.triggerServerWebPush({
      targetRoles: ['GURU', 'ADMIN', 'KEPSEK'],
      title: `📢 Agenda Sekolah: ${eventTitle}`,
      body: `${eventTitle} (${eventDate})${description ? ' - ' + description : ''}.`,
      tag: `event_${eventDate}_${todayIso}`,
      url: '/?tab=BERANDA',
    }).catch(() => {});
  }

  /**
   * Helper: Trigger Notifikasi Hari Gajian Bulanan untuk Guru & Staf (H-3, H-2, H-1, Hari H Tanggal 10)
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
      actionUrl: '/?tab=BERANDA',
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
      actionUrl: '/?tab=LEAVES',
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
      actionUrl: '/?tab=BERANDA&openCorrection=true',
    });

    if (userId) {
      this.triggerServerWebPush({
        targetUserId: userId,
        title: `⚠️ Presensi Belum Tercatat: ${dateStr}`,
        body: `Bapak/Ibu ${teacherName}, Anda belum tercatat presensi pada tanggal ${dateStr}. Segera ajukan Koreksi Absen.`,
        tag: `missing_att_${userId}_${dateStr}`,
        url: '/?tab=BERANDA&openCorrection=true',
      }).catch(() => {});
    }
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
      actionUrl: '/?tab=ATTENDANCE_TRACKING',
    });

    this.triggerServerWebPush({
      targetRoles: ['ADMIN', 'KEPSEK'],
      title: `⚠️ ${unabsentedCount} Guru Belum Presensi: ${dateStr}`,
      body: `Terdapat ${unabsentedCount} guru yang belum tercatat presensi pada ${dateStr}.`,
      tag: `unabsented_summary_${dateStr}`,
      url: '/?tab=ATTENDANCE_TRACKING',
    }).catch(() => {});
  }

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
   * Dapatkan Waktu Peringatan 1 Jam Sebelum Pulang (Senin-Kamis 12.00 WIB, Jumat 10.00 WIB)
   */
  public getEarlyCheckoutTargetTimeForDate(date: Date = new Date()): {
    hours: number;
    minutes: number;
    departureLabel: string;
    label: string;
  } {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 5) {
      return {
        hours: 10,
        minutes: 0,
        departureLabel: '11.00 WIB',
        label: '10.00 WIB (1 Jam Menuju Kepulangan 11.00 WIB)',
      };
    }
    return {
      hours: 12,
      minutes: 0,
      departureLabel: '13.00 WIB',
      label: '12.00 WIB (1 Jam Menuju Kepulangan 13.00 WIB)',
    };
  }

  /**
   * Cek apakah notifikasi H-1 jam kepulangan sudah pernah dikirimkan hari ini (Peringatan 1x)
   */
  public isEarlyCheckoutReminderFiredToday(userId?: string): boolean {
    if (typeof window === 'undefined') return false;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const key = `smart_absensi_early_checkout_fired_${userId || 'guest'}_${todayStr}`;
    return localStorage.getItem(key) === '1';
  }

  /**
   * Menjadwalkan Automatic Local Push Notification & PWA Alarm Presensi Pulang
   * Termasuk:
   * 1. Pengingat H-1 Jam (12.00 WIB Sen-Kam / 10.00 WIB Jum) - Peringatan 1x
   * 2. Pengingat Tepat Jam Pulang (13.00 WIB Sen-Kam / 11.00 WIB Jum)
   */
  public scheduleCheckoutReminder(teacherName: string, userId?: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return; // Akhir pekan libur

    const todayStr = now.toISOString().split('T')[0];

    // ──────── 1. PENGINGAT 1 JAM SEBELUM JAM PULANG (PERINGATAN 1X) ────────
    const earlyInfo = this.getEarlyCheckoutTargetTimeForDate(now);
    const earlyTargetTime = new Date();
    earlyTargetTime.setHours(earlyInfo.hours, earlyInfo.minutes, 0, 0);

    const earlyDelayMs = earlyTargetTime.getTime() - now.getTime();
    const earlyStorageKey = `smart_absensi_early_checkout_fired_${userId || 'guest'}_${todayStr}`;
    const alreadyFiredEarly = typeof window !== 'undefined' && localStorage.getItem(earlyStorageKey) === '1';

    if (this.activeEarlyCheckoutTimer) {
      clearTimeout(this.activeEarlyCheckoutTimer);
      this.activeEarlyCheckoutTimer = null;
    }

    if (!alreadyFiredEarly) {
      const fireEarlyReminder = () => {
        const notifTitle = '⏰ Pengingat 1 Jam Menuju Waktu Pulang!';
        const notifBody = `Bapak/Ibu ${teacherName}, 1 jam lagi jam kepulangan resmi (${earlyInfo.departureLabel}) tiba. Pastikan Anda tidak lupa melakukan presensi pulang sebelum meninggalkan sekolah.`;

        this.sendNativeNotification({
          title: notifTitle,
          body: notifBody,
          type: 'CHECK_OUT',
          teacherName,
          userId,
          roleTarget: 'GURU',
          actionUrl: '/?tab=BERANDA',
        });

        if (userId) {
          this.triggerServerWebPush({
            targetUserId: userId,
            title: notifTitle,
            body: notifBody,
            tag: `early_checkout_${userId}_${todayStr}`,
            url: '/?tab=BERANDA',
          }).catch(() => {});
        }

        SoundService.playNotificationChime();

        if (typeof window !== 'undefined') {
          localStorage.setItem(earlyStorageKey, '1');
        }
      };

      if (earlyDelayMs <= 0) {
        // Jika check-in dilakukan saat sudah memasuki window H-1 jam (misal jam 12:15 WIB), kirim peringatan 1x
        const departureInfo = this.getCheckoutTargetTimeForDate(now);
        const departureTime = new Date();
        departureTime.setHours(departureInfo.hours, departureInfo.minutes, 0, 0);
        if (now.getTime() < departureTime.getTime()) {
          fireEarlyReminder();
        }
      } else {
        this.activeEarlyCheckoutTimer = setTimeout(fireEarlyReminder, earlyDelayMs);
      }
    }

    // ──────── 2. PENGINGAT TEPAT WAKTU PULANG (13.00 / 11.00 WIB) ────────
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
        actionUrl: '/?tab=BERANDA',
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
    if (this.activeEarlyCheckoutTimer) {
      clearTimeout(this.activeEarlyCheckoutTimer);
      this.activeEarlyCheckoutTimer = null;
    }
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
      actionUrl: '/?tab=LEAVES',
    });

    if (userId) {
      this.triggerServerWebPush({
        targetUserId: userId,
        title: isApproved ? `✅ Pengajuan ${leaveType} Disetujui` : `❌ Pengajuan ${leaveType} Ditolak`,
        body: `Permohonan ${leaveType} Anda telah ${isApproved ? 'disetujui' : 'ditolak'} oleh Kepsek/Admin.`,
        tag: `leave_decision_${userId}_${Date.now()}`,
        url: '/?tab=LEAVES',
      }).catch(() => {});
    }
  }
}

export const NotificationService = new NotificationPermissionService();
