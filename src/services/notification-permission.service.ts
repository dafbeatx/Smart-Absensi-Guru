/**
 * Smart Absensi Guru - Browser Web Notification Permission & Push Service
 * Mengelola izin notifikasi browser & pengiriman notifikasi OS desktop/mobile real-time
 */

import { SoundService } from './audio.service';

export interface AttendanceNotificationPayload {
  id?: string;
  title: string;
  body: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'LEAVE_REQUEST' | 'EVENT' | 'SYSTEM';
  teacherName?: string;
  time?: string;
  userId?: string;
  roleTarget?: 'ALL' | 'ADMIN' | 'GURU' | 'KEPSEK';
  createdAt?: string;
  isRead?: boolean;
}

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
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('smart_absensi_notifications_cache');
      const existing: AttendanceNotificationPayload[] = saved ? JSON.parse(saved) : [];
      const newNotif: AttendanceNotificationPayload = {
        id: payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        teacherName: payload.teacherName,
        time: payload.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        userId: payload.userId,
        roleTarget: payload.roleTarget || 'ALL',
        createdAt: payload.createdAt || new Date().toISOString(),
        isRead: false,
      };

      // Keep up to 50 latest notifications
      const updated = [newNotif, ...existing].slice(0, 50);
      localStorage.setItem('smart_absensi_notifications_cache', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notification to cache:', e);
    }
  }

  /**
   * Ambill daftar notifikasi tersimpan dari local cache
   */
  public getCachedNotifications(userId?: string): AttendanceNotificationPayload[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('smart_absensi_notifications_cache');
      if (!saved) return [];
      const parsed: AttendanceNotificationPayload[] = JSON.parse(saved);
      if (!userId) return parsed;
      return parsed.filter((n) => !n.userId || n.userId === userId || n.roleTarget === 'ALL');
    } catch (e) {
      return [];
    }
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
