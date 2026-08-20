/**
 * Smart Absensi Guru - Browser Web Notification Permission & Push Service
 * Mengelola izin notifikasi browser & pengiriman notifikasi OS desktop/mobile real-time
 */

import { SoundService } from './audio.service';
import { pwaService } from './pwa.service';

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
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser ini tidak mendukung Web Notification API.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
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

    // 3. Kirim Native OS Browser Notification jika diizinkan
    if (this.isPermissionGranted()) {
      try {
        const iconPath = '/pwa-192x192.png';
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: iconPath,
          badge: iconPath,
          tag: `sag-notif-${Date.now()}`,
          requireInteraction: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn('Error displaying native notification:', e);
      }
    }

    // 4. Dispatch internal custom event for instant UI bell & feed update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_absensi_notification_pushed', { detail: payload }));
    }
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Masuk (Check-In)
   */
  public notifyTeacherCheckIn(teacherName: string, timeStr: string, userId?: string) {
    this.sendNativeNotification({
      title: `🟢 Presensi Masuk: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi masuk pada pukul ${timeStr} WIB.`,
      type: 'CHECK_IN',
      teacherName,
      time: timeStr,
      userId,
      roleTarget: 'ALL',
    });
  }

  /**
   * Helper: Trigger Notifikasi Guru Absen Keluar (Check-Out)
   */
  public notifyTeacherCheckOut(teacherName: string, timeStr: string, userId?: string) {
    this.sendNativeNotification({
      title: `🔵 Presensi Pulang: ${teacherName}`,
      body: `Bapak/Ibu ${teacherName} telah melakukan presensi pulang pada pukul ${timeStr} WIB.`,
      type: 'CHECK_OUT',
      teacherName,
      time: timeStr,
      userId,
      roleTarget: 'ALL',
    });
  }

  /**
   * Helper: Trigger Notifikasi Event / Agenda Sekolah Baru
   */
  public notifySchoolEvent(eventTitle: string, eventDate: string, description?: string) {
    this.sendNativeNotification({
      title: `📅 Agenda Sekolah: ${eventTitle}`,
      body: `${eventTitle} (${eventDate})${description ? ' - ' + description : ''}.`,
      type: 'EVENT',
      roleTarget: 'ALL',
    });
  }

  /**
   * Helper: Trigger Notifikasi Pengajuan Izin Baru untuk Admin / Kepsek
   */
  public notifyTeacherLeaveRequest(teacherName: string, leaveType: string, reason: string) {
    this.sendNativeNotification({
      title: `📝 Pengajuan Izin Baru: ${teacherName}`,
      body: `${teacherName} mengajukan ${leaveType} (${reason}). Perlu persetujuan Kepala Sekolah/Admin.`,
      type: 'LEAVE_REQUEST',
      teacherName,
      roleTarget: 'ADMIN',
    });
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
